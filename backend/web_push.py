"""Standards-based Web Push: persistent VAPID, per-device subscriptions, no Firebase."""
import asyncio
import base64
import hashlib
import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlsplit

import requests
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field, field_validator
from pymongo.errors import DuplicateKeyError
from pywebpush import WebPushException, webpush

logger = logging.getLogger("family.web_push")


def b64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode()


def decode_key(value: str) -> bytes:
    return base64.b64decode(value + "=" * (-len(value) % 4), altchars=b"-_", validate=True)


def endpoint_id(endpoint: str) -> str:
    return hashlib.sha256(endpoint.encode()).hexdigest()


class EndpointIn(BaseModel):
    endpoint: str = Field(min_length=20, max_length=2048)

    @field_validator("endpoint")
    @classmethod
    def validate_endpoint(cls, value):
        try:
            url = urlsplit(value)
            host = url.hostname or ""
            allowed = host in {"fcm.googleapis.com", "updates.push.services.mozilla.com", "push.services.mozilla.com"} or host.endswith(".push.apple.com")
            valid = url.scheme == "https" and allowed and not (url.username or url.password or url.port or url.fragment)
        except ValueError:
            valid = False
        if not valid:
            raise ValueError("Servizio notifiche non supportato")
        return value


class SubscriptionKeys(BaseModel):
    p256dh: str = Field(max_length=128)
    auth: str = Field(max_length=64)

    @field_validator("p256dh")
    @classmethod
    def validate_public(cls, value):
        try:
            ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), decode_key(value))
        except (ValueError, TypeError) as exc:
            raise ValueError("Chiave pubblica non valida") from exc
        return value

    @field_validator("auth")
    @classmethod
    def validate_auth(cls, value):
        if len(decode_key(value)) != 16:
            raise ValueError("Chiave di sottoscrizione non valida")
        return value


class SubscriptionIn(EndpointIn):
    keys: SubscriptionKeys
    expirationTime: Optional[float] = None


class PushConfig(BaseModel):
    publicKey: str


class PushStatus(BaseModel):
    enabled: bool


class PushTestResult(BaseModel):
    accepted: bool


class NoRedirectSession(requests.Session):
    def request(self, method, url, **kwargs):
        kwargs["allow_redirects"] = False
        return super().request(method, url, **kwargs)


class WebPush:
    def __init__(self, db):
        self.db = db
        self._keys = None
        self._lock = asyncio.Lock()
        self._concurrency = asyncio.Semaphore(8)

    async def keys(self):
        async with self._lock:
            if self._keys:
                return self._keys
            stored = await self.db.app_config.find_one({"_id": "webpush-vapid"}, {"_id": 0})
            if not stored:
                key = ec.generate_private_key(ec.SECP256R1())
                values = {
                    "private_key": b64url(key.private_numbers().private_value.to_bytes(32, "big")),
                    "public_key": b64url(key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)),
                    "created_at": datetime.now(timezone.utc),
                }
                try:
                    await self.db.app_config.update_one({"_id": "webpush-vapid"}, {"$setOnInsert": values}, upsert=True)
                except DuplicateKeyError:
                    pass  # Another process initialized the same persistent key pair.
                stored = await self.db.app_config.find_one({"_id": "webpush-vapid"}, {"_id": 0})
            self._keys = stored
            return stored

    async def deliver(self, doc: dict, data: dict) -> bool:
        subject = os.environ.get("WEB_PUSH_SUBJECT")
        if not subject:
            logger.warning("WEB_PUSH_SUBJECT missing; web push disabled")
            return False
        keys = await self.keys()
        subscription = {"endpoint": doc["endpoint"], "keys": doc["keys"]}
        async with self._concurrency:
            for attempt in range(2):
                try:
                    with NoRedirectSession() as session:
                        result = await asyncio.to_thread(
                            webpush, subscription_info=subscription,
                            data=json.dumps(data, ensure_ascii=False),
                            vapid_private_key=keys["private_key"], vapid_claims={"sub": subject},
                            ttl=3600, timeout=8, requests_session=session,
                        )
                    return 200 <= result.status_code < 300
                except WebPushException as exc:
                    status = exc.response.status_code if exc.response is not None else None
                    if status in (404, 410):
                        await self.db.web_push_subscriptions.delete_one({"_id": endpoint_id(doc["endpoint"])})
                    if status in (429, 500, 502, 503, 504) and attempt == 0:
                        await asyncio.sleep(1)
                        continue
                    logger.warning("Web push not accepted, status=%s", status)
                    return False
                except Exception as exc:
                    logger.warning("Web push unavailable: %s", type(exc).__name__)
                    return False
        return False

    async def send(self, recipients, data):
        # Ignore subscriptions belonging to removed members.
        members = await self.db.members.find({"member_id": {"$in": recipients}, "deleted_at": None}, {"_id": 0, "member_id": 1}).to_list(100)
        valid = [m["member_id"] for m in members]
        docs = await self.db.web_push_subscriptions.find({"member_id": {"$in": valid}}, {"_id": 0}).to_list(500)
        await asyncio.gather(*(self.deliver(doc, data) for doc in docs), return_exceptions=True)


def create_web_push_router(push: WebPush, require_auth, get_actor):
    router = APIRouter(prefix="/web-push", tags=["web-push"])

    async def actor_context(ctx=Depends(require_auth), x_member_id: Optional[str] = Header(default=None)):
        actor = await get_actor(ctx["family"]["family_id"], x_member_id)
        if not actor:
            raise HTTPException(403, "Seleziona un membro della famiglia")
        return actor

    def owned(actor, endpoint):
        return {"_id": endpoint_id(endpoint), "family_id": actor["family_id"], "member_id": actor["member_id"]}

    @router.get("/config", response_model=PushConfig)
    async def config(actor=Depends(actor_context)):
        if not os.environ.get("WEB_PUSH_SUBJECT"):
            raise HTTPException(503, "Notifiche web non ancora configurate")
        return PushConfig(publicKey=(await push.keys())["public_key"])

    @router.put("/subscription", response_model=PushStatus)
    async def subscribe(body: SubscriptionIn, actor=Depends(actor_context)):
        await push.db.web_push_subscriptions.update_one(
            {"_id": endpoint_id(body.endpoint)},
            {"$set": {**body.model_dump(), "family_id": actor["family_id"], "member_id": actor["member_id"], "updated_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
        return PushStatus(enabled=True)

    @router.post("/status", response_model=PushStatus)
    async def status(body: EndpointIn, actor=Depends(actor_context)):
        doc = await push.db.web_push_subscriptions.find_one(owned(actor, body.endpoint), {"_id": 0, "member_id": 1})
        return PushStatus(enabled=bool(doc))

    @router.delete("/subscription", response_model=PushStatus)
    async def unsubscribe(body: EndpointIn, actor=Depends(actor_context)):
        await push.db.web_push_subscriptions.delete_one(owned(actor, body.endpoint))
        return PushStatus(enabled=False)

    @router.post("/test", response_model=PushTestResult)
    async def test(body: EndpointIn, actor=Depends(actor_context)):
        doc = await push.db.web_push_subscriptions.find_one(owned(actor, body.endpoint), {"_id": 0})
        if not doc:
            raise HTTPException(404, "Attiva prima le notifiche su questo dispositivo")
        result = await push.deliver(doc, {"title": "Family Task", "message": "Le notifiche della tua famiglia ti aspettano qui.", "action_url": "/"})
        if not result:
            raise HTTPException(502, "Il servizio notifiche non ha accettato l’avviso. Riprova più tardi.")
        return PushTestResult(accepted=True)

    return router