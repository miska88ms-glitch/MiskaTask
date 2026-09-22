import os
import uuid
import secrets
import random
import logging
import asyncio
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, List

import httpx
from fastapi import FastAPI, APIRouter, Header, HTTPException, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from passlib.context import CryptContext
from web_push import WebPush, create_web_push_router

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("familia")

# --------------------------------------------------------------------------- #
# Push notifications (Emergent managed relay)
# --------------------------------------------------------------------------- #
PUSH_BASE_URL = "https://integrations.emergentagent.com"
PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")
_push_client = httpx.AsyncClient(base_url=PUSH_BASE_URL, headers={"X-Push-Key": PUSH_KEY}, timeout=10.0)
web_push = WebPush(db)
_push_tasks = set()


async def send_push(recipients, data: dict, idempotency_key: Optional[str] = None) -> None:
    recipients = [r for r in dict.fromkeys(recipients) if r]
    if not recipients:
        return
    if "title" not in data or "message" not in data:
        return
    # Delivery runs independently from saving a task/message. Retain task references.
    if len(_push_tasks) >= 100:
        logger.warning("Notification queue full; delivery skipped")
        return
    task = asyncio.create_task(_deliver_push(recipients, data, idempotency_key))
    _push_tasks.add(task)
    task.add_done_callback(_push_tasks.discard)


async def _deliver_push(recipients, data, idempotency_key):
    try:
        await web_push.send(recipients, data)
    except Exception as exc:
        logger.warning("Web push unavailable: %s", type(exc).__name__)
    if not PUSH_KEY or PUSH_KEY == "placeholder":
        return  # Native relay isn't configured; web push needs no relay key.
    payload: dict = {"recipients": recipients[:100], "data": data}
    if idempotency_key:
        payload["$idempotency_key"] = idempotency_key
    try:
        resp = await _push_client.post("/api/v1/push/trigger", json=payload)
        resp.raise_for_status()
    except Exception as e:
        logger.warning(f"Push failed (non-blocking): {e}")


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def ensure_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def gen_invite_code() -> str:
    # Unambiguous characters only (no O/0/I/1).
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(random.choices(alphabet, k=6))


async def unique_invite_code() -> str:
    for _ in range(20):
        code = gen_invite_code()
        if not await db.families.find_one({"invite_code": code}):
            return code
    return gen_invite_code()


# --------------------------------------------------------------------------- #
# Models
# --------------------------------------------------------------------------- #
class GoogleSessionIn(BaseModel):
    session_id: str


class CreateFamilyIn(BaseModel):
    family_name: str = Field(min_length=1, max_length=60)
    capo_name: str = Field(min_length=1, max_length=60)
    pin: Optional[str] = Field(default=None, pattern=r"^\d{4}$")
    avatar: str = Field(default="🦁", max_length=8)
    accent_color: str = Field(default="coral", max_length=24)


class MemberIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    avatar: str = Field(default="🐼", max_length=8)
    accent_color: str = Field(default="mint", max_length=24)
    role: str = Field(default="membro", max_length=10)
    pin: Optional[str] = Field(default=None, pattern=r"^\d{4}$")


class MemberUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=60)
    avatar: Optional[str] = Field(default=None, max_length=8)
    accent_color: Optional[str] = Field(default=None, max_length=24)
    role: Optional[str] = Field(default=None, max_length=10)
    pin: Optional[str] = Field(default=None, max_length=4)


class PinIn(BaseModel):
    pin: str = Field(default="", max_length=4)


class JoinIn(BaseModel):
    code: str = Field(min_length=4, max_length=12)


class CommentIn(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


class RegisterPushBody(BaseModel):
    user_id: str
    platform: str
    device_token: str


class ActivityIn(BaseModel):
    type: str = Field(default="compito", max_length=20)
    title: str = Field(min_length=1, max_length=120)
    icon: str = Field(default="star", max_length=40)
    points: int = Field(default=0, ge=0, le=1000)
    assigned_to: str = Field(min_length=1, max_length=60)
    date: str = Field(min_length=1, max_length=10)
    note: Optional[str] = Field(default=None, max_length=2000)
    time: Optional[str] = Field(default=None, max_length=5)
    end_time: Optional[str] = Field(default=None, max_length=5)
    # for recurring: create one activity per date
    dates: Optional[List[str]] = Field(default=None, max_length=90)


class RewardIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    icon: str = Field(default="gift", max_length=40)
    cost: int = Field(ge=0, le=100000)


class RewardUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=120)
    icon: Optional[str] = Field(default=None, max_length=40)
    cost: Optional[int] = Field(default=None, ge=0, le=100000)


class ActivityUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=120)
    icon: Optional[str] = Field(default=None, max_length=40)
    points: Optional[int] = Field(default=None, ge=0, le=1000)
    assigned_to: Optional[str] = Field(default=None, max_length=60)
    date: Optional[str] = Field(default=None, max_length=10)
    note: Optional[str] = Field(default=None, max_length=2000)
    time: Optional[str] = Field(default=None, max_length=5)
    end_time: Optional[str] = Field(default=None, max_length=5)


# --------------------------------------------------------------------------- #
# Serializers
# --------------------------------------------------------------------------- #
def member_public(m: dict) -> dict:
    return {
        "member_id": m["member_id"],
        "family_id": m["family_id"],
        "name": m["name"],
        "avatar": m.get("avatar", "🐼"),
        "accent_color": m.get("accent_color", "coral"),
        "role": m.get("role", "membro"),
        "points": m.get("points", 0),
        "has_pin": bool(m.get("pin_hash")),
    }


def activity_public(a: dict) -> dict:
    return {
        "id": a["id"],
        "family_id": a["family_id"],
        "type": a.get("type", "compito"),
        "title": a["title"],
        "icon": a.get("icon", "star"),
        "points": a.get("points", 0),
        "assigned_to": a.get("assigned_to"),
        "date": a.get("date"),
        "time": a.get("time"),
        "end_time": a.get("end_time"),
        "note": a.get("note"),
        "has_note": bool(a.get("note")),
        "comment_count": a.get("comment_count", 0),
        "status": a.get("status", "todo"),
        "created_by": a.get("created_by"),
        "completed_by": a.get("completed_by"),
        "completed_at": a.get("completed_at"),
    }


def comment_public(c: dict) -> dict:
    created = c.get("created_at")
    return {
        "id": c["id"],
        "activity_id": c["activity_id"],
        "member_id": c["member_id"],
        "member_name": c.get("member_name"),
        "member_avatar": c.get("member_avatar"),
        "member_accent": c.get("member_accent"),
        "text": c["text"],
        "created_at": created.isoformat() if isinstance(created, datetime) else created,
    }


# --------------------------------------------------------------------------- #
# Auth dependency
# --------------------------------------------------------------------------- #
async def require_auth(authorization: Optional[str] = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Non autenticato")
    token = authorization.split(" ", 1)[1].strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Sessione non valida")
    if ensure_aware(session["expires_at"]) < now_utc():
        raise HTTPException(status_code=401, detail="Sessione scaduta")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utente non trovato")
    family = None
    if user.get("family_id"):
        family = await db.families.find_one({"family_id": user["family_id"]}, {"_id": 0})
    if not family:
        family = await db.families.find_one({"owner_user_id": user["user_id"]}, {"_id": 0})
    if not family:
        raise HTTPException(status_code=404, detail="Famiglia non trovata")
    return {"user": user, "family": family, "session": session}


async def get_actor(ctx: dict, x_member_id: Optional[str]) -> Optional[dict]:
    """The acting member is bound to the server-side session by /verify-pin.

    A client-supplied X-Member-Id is never trusted on its own: it is only
    accepted when it matches the member already activated on this session.
    """
    member_id = (ctx.get("session") or {}).get("active_member_id")
    if not member_id:
        return None
    if x_member_id and x_member_id != member_id:
        return None
    return await db.members.find_one(
        {"member_id": member_id, "family_id": ctx["family"]["family_id"], "deleted_at": None},
        {"_id": 0},
    )


async def activate_member(session_token: str, member_id: str) -> None:
    await db.user_sessions.update_one(
        {"session_token": session_token}, {"$set": {"active_member_id": member_id}}
    )


async def mint_session(user_id: str, active_member_id: Optional[str] = None) -> str:
    token = secrets.token_urlsafe(32)
    await db.user_sessions.insert_one(
        {
            "session_token": token,
            "user_id": user_id,
            "active_member_id": active_member_id,
            "created_at": now_utc(),
            "expires_at": now_utc() + timedelta(days=7),
        }
    )
    return token


async def family_payload(user: dict, family: dict, active_member_id: Optional[str] = None) -> dict:
    members = await db.members.find(
        {"family_id": family["family_id"], "deleted_at": None}, {"_id": 0}
    ).to_list(100)
    members.sort(key=lambda m: (m.get("role") != "capo", m.get("created_at", now_utc())))
    return {
        "user": {"user_id": user["user_id"], "name": user.get("name"), "email": user.get("email")},
        "family": {"family_id": family["family_id"], "name": family["name"], "invite_code": family.get("invite_code")},
        "members": [member_public(m) for m in members],
        "active_member_id": active_member_id,
    }


# --------------------------------------------------------------------------- #
# Routes: auth / family creation
# --------------------------------------------------------------------------- #
@api_router.get("/")
async def root():
    return {"message": "Family Task API"}


@api_router.post("/auth/session")
async def google_session(body: GoogleSessionIn):
    async with httpx.AsyncClient(timeout=20) as http:
        resp = await http.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": body.session_id})
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Sessione Google non valida")
    data = resp.json()
    email = data.get("email")
    name = data.get("name") or (email.split("@")[0] if email else "Genitore")
    picture = data.get("picture")

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user_id = new_id("user")
        user = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "auth_type": "google",
            "created_at": now_utc(),
        }
        await db.users.insert_one(dict(user))
        family = {
            "family_id": new_id("fam"),
            "owner_user_id": user_id,
            "name": f"Famiglia di {name}",
            "invite_code": await unique_invite_code(),
            "created_at": now_utc(),
        }
        await db.families.insert_one(dict(family))
        await db.members.insert_one(
            {
                "member_id": new_id("mem"),
                "family_id": family["family_id"],
                "name": name,
                "avatar": "👑",
                "accent_color": "coral",
                "role": "capo",
                "points": 0,
                "pin_hash": None,
                "deleted_at": None,
                "created_at": now_utc(),
            }
        )
    else:
        family = await db.families.find_one({"owner_user_id": user["user_id"]}, {"_id": 0})
        if family and not family.get("invite_code"):
            code = await unique_invite_code()
            await db.families.update_one({"family_id": family["family_id"]}, {"$set": {"invite_code": code}})
            family["invite_code"] = code

    token = await mint_session(user["user_id"])
    payload = await family_payload(user, family)
    return {"session_token": token, **payload}


@api_router.post("/family/create")
async def create_family(body: CreateFamilyIn):
    user_id = new_id("user")
    user = {
        "user_id": user_id,
        "email": None,
        "name": body.capo_name,
        "picture": None,
        "auth_type": "device",
        "created_at": now_utc(),
    }
    await db.users.insert_one(dict(user))
    family = {
        "family_id": new_id("fam"),
        "owner_user_id": user_id,
        "name": body.family_name.strip() or "La mia famiglia",
        "invite_code": await unique_invite_code(),
        "created_at": now_utc(),
    }
    await db.families.insert_one(dict(family))
    capo_member_id = new_id("mem")
    await db.members.insert_one(
        {
            "member_id": capo_member_id,
            "family_id": family["family_id"],
            "name": body.capo_name.strip() or "Capo",
            "avatar": body.avatar,
            "accent_color": body.accent_color,
            "role": "capo",
            "points": 0,
            "pin_hash": pwd_ctx.hash(body.pin) if body.pin else None,
            "deleted_at": None,
            "created_at": now_utc(),
        }
    )
    token = await mint_session(user_id, active_member_id=capo_member_id)
    payload = await family_payload(user, family, capo_member_id)
    return {"session_token": token, **payload}


@api_router.post("/family/join")
async def join_family(body: JoinIn):
    code = body.code.strip().upper()
    family = await db.families.find_one({"invite_code": code}, {"_id": 0})
    if not family:
        raise HTTPException(status_code=404, detail="Codice non valido")
    user_id = new_id("user")
    user = {
        "user_id": user_id,
        "email": None,
        "name": "Familiare",
        "picture": None,
        "auth_type": "device-join",
        "family_id": family["family_id"],
        "created_at": now_utc(),
    }
    await db.users.insert_one(dict(user))
    token = await mint_session(user_id)
    payload = await family_payload(user, family)
    return {"session_token": token, **payload}


@api_router.post("/family/regenerate-code")
async def regenerate_code(
    ctx: dict = Depends(require_auth), x_member_id: Optional[str] = Header(default=None)
):
    family = ctx["family"]
    actor = await get_actor(ctx, x_member_id)
    if not actor or actor.get("role") != "capo":
        raise HTTPException(status_code=403, detail="Solo il capo può cambiare il codice")
    code = await unique_invite_code()
    await db.families.update_one({"family_id": family["family_id"]}, {"$set": {"invite_code": code}})
    return {"invite_code": code}


@api_router.post("/register-push", status_code=201)
async def register_push(body: RegisterPushBody, ctx: dict = Depends(require_auth)):
    try:
        resp = await _push_client.post("/api/v1/push/users/register", json=body.model_dump())
        resp.raise_for_status()
    except Exception as e:
        logger.warning(f"register-push failed (non-blocking): {e}")
        return {"status": "skipped"}
    return {"status": "registered"}


@api_router.get("/auth/me")
async def auth_me(ctx: dict = Depends(require_auth)):
    return await family_payload(
        ctx["user"], ctx["family"], ctx["session"].get("active_member_id")
    )


@api_router.get("/family")
async def get_family(ctx: dict = Depends(require_auth)):
    return await family_payload(
        ctx["user"], ctx["family"], ctx["session"].get("active_member_id")
    )


@api_router.post("/family/deactivate")
async def deactivate_member(ctx: dict = Depends(require_auth)):
    """Release the active profile on this session (switch user)."""
    await db.user_sessions.update_one(
        {"session_token": ctx["session"]["session_token"]},
        {"$set": {"active_member_id": None}},
    )
    return {"ok": True}


@api_router.delete("/auth/session")
async def revoke_session(ctx: dict = Depends(require_auth)):
    await db.user_sessions.delete_one({"session_token": ctx["session"]["session_token"]})
    return {"ok": True}


@api_router.get("/activities/{activity_id}")
async def get_activity(activity_id: str, ctx: dict = Depends(require_auth)):
    a = await db.activities.find_one(
        {"id": activity_id, "family_id": ctx["family"]["family_id"], "deleted_at": None}, {"_id": 0}
    )
    if not a:
        raise HTTPException(status_code=404, detail="Attività non trovata")
    return activity_public(a)


@api_router.get("/activities/{activity_id}/comments")
async def list_comments(activity_id: str, ctx: dict = Depends(require_auth)):
    family = ctx["family"]
    a = await db.activities.find_one(
        {"id": activity_id, "family_id": family["family_id"]}, {"_id": 0}
    )
    if not a:
        raise HTTPException(status_code=404, detail="Attività non trovata")
    cs = await db.comments.find(
        {"activity_id": activity_id, "family_id": family["family_id"], "deleted_at": None},
        {"_id": 0},
    ).to_list(500)
    cs.sort(key=lambda c: c.get("created_at") or now_utc())
    return [comment_public(c) for c in cs]


@api_router.post("/activities/{activity_id}/comments")
async def add_comment(
    activity_id: str,
    body: CommentIn,
    ctx: dict = Depends(require_auth),
    x_member_id: Optional[str] = Header(default=None),
):
    family = ctx["family"]
    actor = await get_actor(ctx, x_member_id)
    if not actor:
        raise HTTPException(status_code=403, detail="Membro non valido")
    a = await db.activities.find_one(
        {"id": activity_id, "family_id": family["family_id"], "deleted_at": None}, {"_id": 0}
    )
    if not a:
        raise HTTPException(status_code=404, detail="Attività non trovata")
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Il messaggio è vuoto")
    c = {
        "id": new_id("cmt"),
        "activity_id": activity_id,
        "family_id": family["family_id"],
        "member_id": actor["member_id"],
        "member_name": actor["name"],
        "member_avatar": actor.get("avatar"),
        "member_accent": actor.get("accent_color"),
        "text": text,
        "deleted_at": None,
        "created_at": now_utc(),
    }
    await db.comments.insert_one(dict(c))
    await db.activities.update_one(
        {"id": activity_id, "family_id": family["family_id"]}, {"$inc": {"comment_count": 1}}
    )
    prev = await db.comments.distinct(
        "member_id", {"activity_id": activity_id, "family_id": family["family_id"]}
    )
    recipients = set(prev) | {a.get("assigned_to"), a.get("created_by")}
    recipients.discard(actor["member_id"])
    await send_push(
        list(recipients),
        {
            "title": f"💬 {actor['name']} · {a['title']}",
            "message": text[:140],
            "action_url": f"/task/{activity_id}",
        },
    )
    return comment_public(c)


# --------------------------------------------------------------------------- #
# Routes: members
# --------------------------------------------------------------------------- #
@api_router.post("/family/members")
async def add_member(
    body: MemberIn,
    ctx: dict = Depends(require_auth),
    x_member_id: Optional[str] = Header(default=None),
):
    family = ctx["family"]
    actor = await get_actor(ctx, x_member_id)
    if not actor or actor.get("role") != "capo":
        raise HTTPException(status_code=403, detail="Solo il capo famiglia può aggiungere membri")
    member = {
        "member_id": new_id("mem"),
        "family_id": family["family_id"],
        "name": body.name.strip(),
        "avatar": body.avatar,
        "accent_color": body.accent_color,
        "role": body.role if body.role in ("capo", "membro") else "membro",
        "points": 0,
        "pin_hash": pwd_ctx.hash(body.pin) if body.pin else None,
        "deleted_at": None,
        "created_at": now_utc(),
    }
    await db.members.insert_one(dict(member))
    return member_public(member)


@api_router.put("/family/members/{member_id}")
async def update_member(
    member_id: str,
    body: MemberUpdate,
    ctx: dict = Depends(require_auth),
    x_member_id: Optional[str] = Header(default=None),
):
    family = ctx["family"]
    actor = await get_actor(ctx, x_member_id)
    if not actor:
        raise HTTPException(status_code=403, detail="Membro non valido")
    if actor.get("role") != "capo" and actor["member_id"] != member_id:
        raise HTTPException(status_code=403, detail="Non puoi modificare questo membro")

    updates: dict = {}
    if body.name is not None:
        updates["name"] = body.name.strip()
    if body.avatar is not None:
        updates["avatar"] = body.avatar
    if body.accent_color is not None:
        updates["accent_color"] = body.accent_color
    if body.role is not None and actor.get("role") == "capo":
        updates["role"] = body.role if body.role in ("capo", "membro") else "membro"
    if body.pin is not None:
        updates["pin_hash"] = pwd_ctx.hash(body.pin) if body.pin else None

    if updates:
        await db.members.update_one(
            {"member_id": member_id, "family_id": family["family_id"]}, {"$set": updates}
        )
    m = await db.members.find_one(
        {"member_id": member_id, "family_id": family["family_id"]}, {"_id": 0}
    )
    if not m:
        raise HTTPException(status_code=404, detail="Membro non trovato")
    return member_public(m)


@api_router.delete("/family/members/{member_id}")
async def delete_member(
    member_id: str,
    ctx: dict = Depends(require_auth),
    x_member_id: Optional[str] = Header(default=None),
):
    family = ctx["family"]
    actor = await get_actor(ctx, x_member_id)
    if not actor or actor.get("role") != "capo":
        raise HTTPException(status_code=403, detail="Solo il capo famiglia può rimuovere membri")
    target = await db.members.find_one(
        {"member_id": member_id, "family_id": family["family_id"]}, {"_id": 0}
    )
    if not target:
        raise HTTPException(status_code=404, detail="Membro non trovato")
    if target.get("role") == "capo":
        raise HTTPException(status_code=400, detail="Non puoi rimuovere il capo famiglia")
    await db.members.update_one(
        {"member_id": member_id, "family_id": family["family_id"]},
        {"$set": {"deleted_at": now_utc()}},
    )
    return {"ok": True}


@api_router.post("/family/members/{member_id}/verify-pin")
async def verify_pin(member_id: str, body: PinIn, ctx: dict = Depends(require_auth)):
    """Verify the member PIN and bind that member to the current session.

    Every mutating route derives the acting member from the session, so this is
    the only place where a profile can be activated.
    """
    family = ctx["family"]
    m = await db.members.find_one(
        {"member_id": member_id, "family_id": family["family_id"], "deleted_at": None}, {"_id": 0}
    )
    if not m:
        raise HTTPException(status_code=404, detail="Membro non trovato")
    if m.get("pin_hash") and not pwd_ctx.verify(body.pin, m["pin_hash"]):
        raise HTTPException(status_code=401, detail="PIN errato")
    await activate_member(ctx["session"]["session_token"], member_id)
    return {"ok": True, "member": member_public(m)}


# --------------------------------------------------------------------------- #
# Routes: activities
# --------------------------------------------------------------------------- #
@api_router.get("/activities")
async def list_activities(
    start: Optional[str] = None,
    end: Optional[str] = None,
    ctx: dict = Depends(require_auth),
):
    query: dict = {"family_id": ctx["family"]["family_id"], "deleted_at": None}
    if start and end:
        query["date"] = {"$gte": start, "$lte": end}
    elif start:
        query["date"] = start
    items = await db.activities.find(query, {"_id": 0}).to_list(1000)
    items.sort(key=lambda a: (a.get("date", ""), a.get("time") or "99:99"))
    return [activity_public(a) for a in items]


@api_router.post("/activities")
async def create_activity(
    body: ActivityIn,
    ctx: dict = Depends(require_auth),
    x_member_id: Optional[str] = Header(default=None),
):
    family = ctx["family"]
    actor = await get_actor(ctx, x_member_id)
    if not actor:
        raise HTTPException(status_code=403, detail="Membro non valido")

    atype = body.type if body.type in ("compito", "impegno") else "compito"
    if actor.get("role") != "capo":
        if atype == "compito":
            raise HTTPException(status_code=403, detail="Solo il capo può assegnare compiti")
        if body.assigned_to != actor["member_id"]:
            raise HTTPException(status_code=403, detail="Puoi aggiungere impegni solo per te")

    target = await db.members.find_one(
        {"member_id": body.assigned_to, "family_id": family["family_id"], "deleted_at": None},
        {"_id": 0},
    )
    if not target:
        raise HTTPException(status_code=400, detail="Membro assegnato non valido")

    dates = body.dates if body.dates else [body.date]
    dates = sorted({d for d in dates if d})
    if not dates:
        dates = [body.date]

    created = []
    for d in dates:
        created.append(
            {
                "id": new_id("act"),
                "family_id": family["family_id"],
                "type": atype,
                "title": body.title.strip(),
                "icon": body.icon,
                "points": max(0, body.points) if atype == "compito" else 0,
                "assigned_to": body.assigned_to,
                "date": d,
                "time": body.time,
                "end_time": body.end_time,
                "note": body.note,
                "status": "todo",
                "created_by": actor["member_id"],
                "completed_by": None,
                "completed_at": None,
                "comment_count": 0,
                "deleted_at": None,
                "created_at": now_utc(),
            }
        )
    await db.activities.insert_many([dict(a) for a in created])
    first = created[0]
    if first["assigned_to"] != actor["member_id"]:
        extra = f" (x{len(created)})" if len(created) > 1 else ""
        await send_push(
            [first["assigned_to"]],
            {
                "title": "📋 Nuovo compito" if atype == "compito" else "📌 Nuovo impegno",
                "message": f"{actor['name']} ti ha assegnato: {first['title']}{extra}",
                "action_url": f"/task/{first['id']}",
            },
        )
    return activity_public(first)


@api_router.put("/activities/{activity_id}")
async def update_activity(
    activity_id: str,
    body: ActivityUpdate,
    ctx: dict = Depends(require_auth),
    x_member_id: Optional[str] = Header(default=None),
):
    family = ctx["family"]
    actor = await get_actor(ctx, x_member_id)
    if not actor:
        raise HTTPException(status_code=403, detail="Membro non valido")
    a = await db.activities.find_one(
        {"id": activity_id, "family_id": family["family_id"], "deleted_at": None}, {"_id": 0}
    )
    if not a:
        raise HTTPException(status_code=404, detail="Attività non trovata")
    if actor.get("role") != "capo" and a.get("created_by") != actor["member_id"]:
        raise HTTPException(status_code=403, detail="Non puoi modificare questa attività")

    updates = {k: v for k, v in body.dict().items() if v is not None}
    if "title" in updates:
        updates["title"] = updates["title"].strip()
    if a.get("type") == "impegno":
        updates.pop("points", None)
    if updates:
        await db.activities.update_one(
            {"id": activity_id, "family_id": family["family_id"]}, {"$set": updates}
        )
    a = await db.activities.find_one(
        {"id": activity_id, "family_id": family["family_id"]}, {"_id": 0}
    )
    return activity_public(a)


@api_router.post("/activities/{activity_id}/complete")
async def complete_activity(
    activity_id: str,
    ctx: dict = Depends(require_auth),
    x_member_id: Optional[str] = Header(default=None),
):
    family = ctx["family"]
    actor = await get_actor(ctx, x_member_id)
    if not actor:
        raise HTTPException(status_code=403, detail="Membro non valido")
    a = await db.activities.find_one(
        {"id": activity_id, "family_id": family["family_id"], "deleted_at": None}, {"_id": 0}
    )
    if not a:
        raise HTTPException(status_code=404, detail="Attività non trovata")
    if a.get("status") == "done":
        return activity_public(a)
    await db.activities.update_one(
        {"id": activity_id, "family_id": family["family_id"]},
        {"$set": {"status": "done", "completed_by": actor["member_id"], "completed_at": now_utc()}},
    )
    pts = a.get("points", 0)
    if a.get("type") == "compito" and pts > 0:
        await db.members.update_one(
            {"member_id": a["assigned_to"], "family_id": family["family_id"]},
            {"$inc": {"points": pts}},
        )
    capos = await db.members.find(
        {"family_id": family["family_id"], "role": "capo", "deleted_at": None}, {"_id": 0}
    ).to_list(50)
    recips = {a.get("created_by")} | {c["member_id"] for c in capos}
    recips.discard(actor["member_id"])
    await send_push(
        list(recips),
        {
            "title": "✅ Compito completato",
            "message": f"{actor['name']} ha completato: {a['title']}",
            "action_url": f"/task/{activity_id}",
        },
    )
    a = await db.activities.find_one(
        {"id": activity_id, "family_id": family["family_id"]}, {"_id": 0}
    )
    return activity_public(a)


@api_router.post("/activities/{activity_id}/uncomplete")
async def uncomplete_activity(
    activity_id: str,
    ctx: dict = Depends(require_auth),
    x_member_id: Optional[str] = Header(default=None),
):
    family = ctx["family"]
    actor = await get_actor(ctx, x_member_id)
    if not actor:
        raise HTTPException(status_code=403, detail="Membro non valido")
    a = await db.activities.find_one(
        {"id": activity_id, "family_id": family["family_id"], "deleted_at": None}, {"_id": 0}
    )
    if not a:
        raise HTTPException(status_code=404, detail="Attività non trovata")
    if a.get("status") != "done":
        return activity_public(a)
    pts = a.get("points", 0)
    if a.get("type") == "compito" and pts > 0:
        await db.members.update_one(
            {"member_id": a["assigned_to"], "family_id": family["family_id"]},
            {"$inc": {"points": -pts}},
        )
    await db.activities.update_one(
        {"id": activity_id, "family_id": family["family_id"]},
        {"$set": {"status": "todo", "completed_by": None, "completed_at": None}},
    )
    a = await db.activities.find_one(
        {"id": activity_id, "family_id": family["family_id"]}, {"_id": 0}
    )
    return activity_public(a)


@api_router.delete("/activities/{activity_id}")
async def delete_activity(
    activity_id: str,
    ctx: dict = Depends(require_auth),
    x_member_id: Optional[str] = Header(default=None),
):
    family = ctx["family"]
    actor = await get_actor(ctx, x_member_id)
    if not actor:
        raise HTTPException(status_code=403, detail="Membro non valido")
    a = await db.activities.find_one(
        {"id": activity_id, "family_id": family["family_id"], "deleted_at": None}, {"_id": 0}
    )
    if not a:
        raise HTTPException(status_code=404, detail="Attività non trovata")
    if actor.get("role") != "capo" and a.get("created_by") != actor["member_id"]:
        raise HTTPException(status_code=403, detail="Non puoi eliminare questa attività")
    if a.get("status") == "done" and a.get("type") == "compito" and a.get("points", 0) > 0:
        await db.members.update_one(
            {"member_id": a["assigned_to"], "family_id": family["family_id"]},
            {"$inc": {"points": -a["points"]}},
        )
    await db.activities.update_one(
        {"id": activity_id, "family_id": family["family_id"]},
        {"$set": {"deleted_at": now_utc()}},
    )
    return {"ok": True}


# --------------------------------------------------------------------------- #
# Routes: rewards
# --------------------------------------------------------------------------- #
def reward_public(r: dict) -> dict:
    return {
        "id": r["id"],
        "family_id": r["family_id"],
        "title": r["title"],
        "icon": r.get("icon", "gift"),
        "cost": r.get("cost", 0),
    }


def redemption_public(r: dict) -> dict:
    created = r.get("created_at")
    return {
        "id": r["id"],
        "reward_id": r.get("reward_id"),
        "reward_title": r.get("reward_title"),
        "reward_icon": r.get("reward_icon", "gift"),
        "member_id": r.get("member_id"),
        "member_name": r.get("member_name"),
        "member_avatar": r.get("member_avatar"),
        "cost": r.get("cost", 0),
        "created_at": created.isoformat() if isinstance(created, datetime) else created,
    }


@api_router.get("/rewards")
async def list_rewards(ctx: dict = Depends(require_auth)):
    rs = await db.rewards.find(
        {"family_id": ctx["family"]["family_id"], "deleted_at": None}, {"_id": 0}
    ).to_list(200)
    rs.sort(key=lambda r: r.get("cost", 0))
    return [reward_public(r) for r in rs]


@api_router.post("/rewards")
async def create_reward(
    body: RewardIn, ctx: dict = Depends(require_auth), x_member_id: Optional[str] = Header(default=None)
):
    family = ctx["family"]
    actor = await get_actor(ctx, x_member_id)
    if not actor or actor.get("role") != "capo":
        raise HTTPException(status_code=403, detail="Solo il capo può creare premi")
    reward = {
        "id": new_id("rwd"),
        "family_id": family["family_id"],
        "title": body.title.strip(),
        "icon": body.icon,
        "cost": max(1, body.cost),
        "created_by": actor["member_id"],
        "deleted_at": None,
        "created_at": now_utc(),
    }
    await db.rewards.insert_one(dict(reward))
    return reward_public(reward)


@api_router.put("/rewards/{reward_id}")
async def update_reward(
    reward_id: str,
    body: RewardUpdate,
    ctx: dict = Depends(require_auth),
    x_member_id: Optional[str] = Header(default=None),
):
    family = ctx["family"]
    actor = await get_actor(ctx, x_member_id)
    if not actor or actor.get("role") != "capo":
        raise HTTPException(status_code=403, detail="Solo il capo può modificare premi")
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if "title" in updates:
        updates["title"] = updates["title"].strip()
    if "cost" in updates:
        updates["cost"] = max(1, int(updates["cost"]))
    if updates:
        await db.rewards.update_one(
            {"id": reward_id, "family_id": family["family_id"]}, {"$set": updates}
        )
    r = await db.rewards.find_one({"id": reward_id, "family_id": family["family_id"]}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Premio non trovato")
    return reward_public(r)


@api_router.delete("/rewards/{reward_id}")
async def delete_reward(
    reward_id: str, ctx: dict = Depends(require_auth), x_member_id: Optional[str] = Header(default=None)
):
    family = ctx["family"]
    actor = await get_actor(ctx, x_member_id)
    if not actor or actor.get("role") != "capo":
        raise HTTPException(status_code=403, detail="Solo il capo può rimuovere premi")
    await db.rewards.update_one(
        {"id": reward_id, "family_id": family["family_id"]}, {"$set": {"deleted_at": now_utc()}}
    )
    return {"ok": True}


@api_router.post("/rewards/{reward_id}/redeem")
async def redeem_reward(
    reward_id: str, ctx: dict = Depends(require_auth), x_member_id: Optional[str] = Header(default=None)
):
    family = ctx["family"]
    actor = await get_actor(ctx, x_member_id)
    if not actor:
        raise HTTPException(status_code=403, detail="Membro non valido")
    reward = await db.rewards.find_one(
        {"id": reward_id, "family_id": family["family_id"], "deleted_at": None}, {"_id": 0}
    )
    if not reward:
        raise HTTPException(status_code=404, detail="Premio non trovato")
    cost = reward.get("cost", 0)
    if actor.get("points", 0) < cost:
        raise HTTPException(status_code=400, detail="Punti insufficienti per questo premio")
    await db.members.update_one(
        {"member_id": actor["member_id"], "family_id": family["family_id"]},
        {"$inc": {"points": -cost}},
    )
    redemption = {
        "id": new_id("rdm"),
        "family_id": family["family_id"],
        "reward_id": reward_id,
        "reward_title": reward["title"],
        "reward_icon": reward.get("icon", "gift"),
        "member_id": actor["member_id"],
        "member_name": actor["name"],
        "member_avatar": actor.get("avatar"),
        "cost": cost,
        "created_at": now_utc(),
    }
    await db.redemptions.insert_one(dict(redemption))
    capos = await db.members.find(
        {"family_id": family["family_id"], "role": "capo", "deleted_at": None}, {"_id": 0}
    ).to_list(50)
    recips = {c["member_id"] for c in capos}
    recips.discard(actor["member_id"])
    await send_push(
        list(recips),
        {"title": "🎁 Premio riscattato", "message": f"{actor['name']} ha riscattato: {reward['title']}"},
    )
    updated = await db.members.find_one(
        {"member_id": actor["member_id"], "family_id": family["family_id"]}, {"_id": 0}
    )
    return {"redemption": redemption_public(redemption), "member": member_public(updated)}


@api_router.get("/redemptions")
async def list_redemptions(ctx: dict = Depends(require_auth)):
    rs = await db.redemptions.find(
        {"family_id": ctx["family"]["family_id"]}, {"_id": 0}
    ).to_list(200)
    rs.sort(key=lambda r: r.get("created_at") or now_utc(), reverse=True)
    return [redemption_public(r) for r in rs[:50]]


# --------------------------------------------------------------------------- #
# Routes: leaderboard + presets
# --------------------------------------------------------------------------- #
@api_router.get("/leaderboard")
async def leaderboard(ctx: dict = Depends(require_auth)):
    members = await db.members.find(
        {"family_id": ctx["family"]["family_id"], "deleted_at": None}, {"_id": 0}
    ).to_list(100)
    members.sort(key=lambda m: m.get("points", 0), reverse=True)
    return [member_public(m) for m in members]


PRESETS = [
    {"title": "Studia", "icon": "book", "points": 20},
    {"title": "Pulisci la stanza", "icon": "broom", "points": 15},
    {"title": "Fai la lavatrice", "icon": "laundry", "points": 20},
    {"title": "Lava i piatti", "icon": "dishes", "points": 15},
    {"title": "Porta fuori la spazzatura", "icon": "trash", "points": 10},
    {"title": "Apparecchia la tavola", "icon": "table", "points": 10},
    {"title": "Rifai il letto", "icon": "bed", "points": 5},
    {"title": "Innaffia le piante", "icon": "plant", "points": 5},
    {"title": "Fai la spesa", "icon": "cart", "points": 25},
]


@api_router.get("/presets")
async def get_presets(ctx: dict = Depends(require_auth)):
    return PRESETS


# --------------------------------------------------------------------------- #
# App wiring
# --------------------------------------------------------------------------- #
api_router.include_router(create_web_push_router(web_push, require_auth, get_actor))
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    # Auth uses a Bearer token (no cookies), so credentials must stay off:
    # wildcard origins with credentials is an invalid/unsafe combination.
    allow_credentials=False,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def create_indexes():
    try:
        await db.users.create_index("user_id", unique=True)
        await db.users.create_index("email", sparse=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
        await db.families.create_index("owner_user_id")
        await db.families.create_index("invite_code", unique=True, sparse=True)
        await db.members.create_index("family_id")
        await db.activities.create_index([("family_id", 1), ("date", 1)])
        await db.comments.create_index([("activity_id", 1), ("created_at", 1)])
        await db.rewards.create_index("family_id")
        await db.redemptions.create_index([("family_id", 1), ("created_at", -1)])
        await db.web_push_subscriptions.create_index("member_id")
    except Exception as e:
        logger.warning(f"Index creation issue: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    for task in list(_push_tasks):
        task.cancel()
    if _push_tasks:
        await asyncio.gather(*_push_tasks, return_exceptions=True)
    await _push_client.aclose()
    client.close()
