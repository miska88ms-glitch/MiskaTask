"""Iteration 4 API tests: authenticated web-push endpoints, validation and device isolation."""

import base64
import os
from pathlib import Path

import pytest
import requests
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def _read_base_url() -> str:
    base = os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    if base:
        return base.rstrip("/")
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
            return line.split("=", 1)[1].strip().strip('"').rstrip("/")
    raise RuntimeError("EXPO_PUBLIC_BACKEND_URL is missing")


BASE_URL = _read_base_url()
API = f"{BASE_URL}/api"


def _headers(token: str | None = None, member_id: str | None = None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    if member_id:
        h["X-Member-Id"] = member_id
    return h


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _valid_subscription(endpoint: str):
    private_key = ec.generate_private_key(ec.SECP256R1())
    pub = private_key.public_key().public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint,
    )
    return {
        "endpoint": endpoint,
        "expirationTime": None,
        "keys": {
            "p256dh": _b64url(pub),
            "auth": _b64url(os.urandom(16)),
        },
    }


@pytest.fixture(scope="module")
def webpush_ctx():
    """Create two families for ownership/isolation checks."""
    fam1 = requests.post(
        f"{API}/family/create",
        json={
            "family_name": "Famiglia PWA Test",
            "capo_name": "Mamma PWA",
            "pin": "1234",
            "avatar": "👑",
            "accent_color": "coral",
        },
        timeout=20,
    )
    assert fam1.status_code == 200, fam1.text
    d1 = fam1.json()
    capo1 = next(m for m in d1["members"] if m["role"] == "capo")

    add_luca = requests.post(
        f"{API}/family/members",
        headers=_headers(d1["session_token"], capo1["member_id"]),
        json={
            "name": "Luca PWA",
            "avatar": "🧒",
            "accent_color": "mint",
            "role": "membro",
            "pin": "1111",
        },
        timeout=20,
    )
    assert add_luca.status_code == 200, add_luca.text
    luca = add_luca.json()

    fam2 = requests.post(
        f"{API}/family/create",
        json={
            "family_name": "Famiglia PWA Isolata",
            "capo_name": "Papà PWA",
            "pin": "2222",
            "avatar": "👨",
            "accent_color": "azure",
        },
        timeout=20,
    )
    assert fam2.status_code == 200, fam2.text
    d2 = fam2.json()
    capo2 = next(m for m in d2["members"] if m["role"] == "capo")

    print(
        f"PWA_TEST_CREDENTIALS family_id={d1['family']['family_id']} "
        f"invite_code={d1['family']['invite_code']} capo_member_id={capo1['member_id']} "
        f"luca_member_id={luca['member_id']}"
    )

    return {
        "token1": d1["session_token"],
        "capo1": capo1["member_id"],
        "family1": d1["family"],
        "luca": luca["member_id"],
        "token2": d2["session_token"],
        "capo2": capo2["member_id"],
    }


class TestWebPushConfig:
    """Config endpoint behavior."""

    def test_config_unauthorized_401(self):
        r = requests.get(f"{API}/web-push/config", timeout=15)
        assert r.status_code == 401

    def test_config_requires_member_403(self, webpush_ctx):
        r = requests.get(
            f"{API}/web-push/config",
            headers=_headers(webpush_ctx["token1"]),
            timeout=15,
        )
        assert r.status_code == 403

    def test_config_returns_only_public_key(self, webpush_ctx):
        r = requests.get(
            f"{API}/web-push/config",
            headers=_headers(webpush_ctx["token1"], webpush_ctx["capo1"]),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert sorted(data.keys()) == ["publicKey"]
        assert isinstance(data["publicKey"], str)
        assert len(data["publicKey"]) > 40


class TestWebPushSubscription:
    """PUT/POST/DELETE ownership and validation checks."""

    def test_subscribe_requires_auth_401(self):
        body = _valid_subscription("https://fcm.googleapis.com/fcm/send/test-device-1")
        r = requests.put(f"{API}/web-push/subscription", json=body, timeout=15)
        assert r.status_code == 401

    def test_subscribe_requires_actor_403(self, webpush_ctx):
        body = _valid_subscription("https://fcm.googleapis.com/fcm/send/test-device-2")
        r = requests.put(
            f"{API}/web-push/subscription",
            headers=_headers(webpush_ctx["token1"]),
            json=body,
            timeout=15,
        )
        assert r.status_code == 403

    def test_subscribe_foreign_member_header_forbidden_403(self, webpush_ctx):
        body = _valid_subscription("https://fcm.googleapis.com/fcm/send/test-device-3")
        r = requests.put(
            f"{API}/web-push/subscription",
            headers=_headers(webpush_ctx["token1"], webpush_ctx["capo2"]),
            json=body,
            timeout=15,
        )
        assert r.status_code == 403

    def test_invalid_endpoints_and_keys_422(self, webpush_ctx):
        bad_bodies = [
            {
                "endpoint": "http://fcm.googleapis.com/fcm/send/insecure",
                "keys": {"p256dh": "abc", "auth": _b64url(os.urandom(16))},
            },
            {
                "endpoint": "https://localhost/fcm/send/local",
                "keys": {"p256dh": "abc", "auth": _b64url(os.urandom(16))},
            },
            {
                "endpoint": "https://evil.example.com/fcm/send/host",
                "keys": {"p256dh": "abc", "auth": _b64url(os.urandom(16))},
            },
            {
                "endpoint": "https://fcm.googleapis.com/fcm/send/bad-auth",
                "keys": {
                    "p256dh": _valid_subscription("https://fcm.googleapis.com/fcm/send/tmp")["keys"]["p256dh"],
                    "auth": _b64url(os.urandom(8)),
                },
            },
        ]
        for body in bad_bodies:
            r = requests.put(
                f"{API}/web-push/subscription",
                headers=_headers(webpush_ctx["token1"], webpush_ctx["capo1"]),
                json=body,
                timeout=15,
            )
            assert r.status_code == 422, r.text

    def test_full_device_isolation_flow(self, webpush_ctx):
        ep1 = "https://fcm.googleapis.com/fcm/send/family-task-device-1"
        ep2 = "https://updates.push.services.mozilla.com/wpush/v2/family-task-device-2"

        sub1 = _valid_subscription(ep1)
        sub2 = _valid_subscription(ep2)

        put1 = requests.put(
            f"{API}/web-push/subscription",
            headers=_headers(webpush_ctx["token1"], webpush_ctx["capo1"]),
            json=sub1,
            timeout=15,
        )
        assert put1.status_code == 200, put1.text
        assert put1.json()["enabled"] is True

        status1 = requests.post(
            f"{API}/web-push/status",
            headers=_headers(webpush_ctx["token1"], webpush_ctx["capo1"]),
            json={"endpoint": ep1},
            timeout=15,
        )
        assert status1.status_code == 200
        assert status1.json()["enabled"] is True

        # Update existing subscription for same endpoint with new keys.
        updated = _valid_subscription(ep1)
        put_update = requests.put(
            f"{API}/web-push/subscription",
            headers=_headers(webpush_ctx["token1"], webpush_ctx["capo1"]),
            json=updated,
            timeout=15,
        )
        assert put_update.status_code == 200
        assert put_update.json()["enabled"] is True

        put2 = requests.put(
            f"{API}/web-push/subscription",
            headers=_headers(webpush_ctx["token1"], webpush_ctx["capo1"]),
            json=sub2,
            timeout=15,
        )
        assert put2.status_code == 200

        # Delete one device only; second remains enabled.
        delete1 = requests.delete(
            f"{API}/web-push/subscription",
            headers=_headers(webpush_ctx["token1"], webpush_ctx["capo1"]),
            json={"endpoint": ep1},
            timeout=15,
        )
        assert delete1.status_code == 200
        assert delete1.json()["enabled"] is False

        status_deleted = requests.post(
            f"{API}/web-push/status",
            headers=_headers(webpush_ctx["token1"], webpush_ctx["capo1"]),
            json={"endpoint": ep1},
            timeout=15,
        )
        assert status_deleted.status_code == 200
        assert status_deleted.json()["enabled"] is False

        status_other = requests.post(
            f"{API}/web-push/status",
            headers=_headers(webpush_ctx["token1"], webpush_ctx["capo1"]),
            json={"endpoint": ep2},
            timeout=15,
        )
        assert status_other.status_code == 200
        assert status_other.json()["enabled"] is True

        # Cross-family status must be false and delete must not remove foreign owner data.
        cross_status = requests.post(
            f"{API}/web-push/status",
            headers=_headers(webpush_ctx["token2"], webpush_ctx["capo2"]),
            json={"endpoint": ep2},
            timeout=15,
        )
        assert cross_status.status_code == 200
        assert cross_status.json()["enabled"] is False

        cross_delete = requests.delete(
            f"{API}/web-push/subscription",
            headers=_headers(webpush_ctx["token2"], webpush_ctx["capo2"]),
            json={"endpoint": ep2},
            timeout=15,
        )
        assert cross_delete.status_code == 200
        assert cross_delete.json()["enabled"] is False

        owner_status_after_cross_delete = requests.post(
            f"{API}/web-push/status",
            headers=_headers(webpush_ctx["token1"], webpush_ctx["capo1"]),
            json={"endpoint": ep2},
            timeout=15,
        )
        assert owner_status_after_cross_delete.status_code == 200
        assert owner_status_after_cross_delete.json()["enabled"] is True

        # Cleanup second device.
        cleanup = requests.delete(
            f"{API}/web-push/subscription",
            headers=_headers(webpush_ctx["token1"], webpush_ctx["capo1"]),
            json={"endpoint": ep2},
            timeout=15,
        )
        assert cleanup.status_code == 200

    def test_test_endpoint_auth_and_ownership_guards(self, webpush_ctx):
        endpoint = "https://fcm.googleapis.com/fcm/send/family-task-device-guard"
        sub = _valid_subscription(endpoint)
        r_put = requests.put(
            f"{API}/web-push/subscription",
            headers=_headers(webpush_ctx["token1"], webpush_ctx["capo1"]),
            json=sub,
            timeout=15,
        )
        assert r_put.status_code == 200

        no_auth = requests.post(f"{API}/web-push/test", json={"endpoint": endpoint}, timeout=15)
        assert no_auth.status_code == 401

        foreign_actor = requests.post(
            f"{API}/web-push/test",
            headers=_headers(webpush_ctx["token1"], webpush_ctx["capo2"]),
            json={"endpoint": endpoint},
            timeout=15,
        )
        assert foreign_actor.status_code == 403

        not_subscribed = requests.post(
            f"{API}/web-push/test",
            headers=_headers(webpush_ctx["token1"], webpush_ctx["capo1"]),
            json={"endpoint": "https://fcm.googleapis.com/fcm/send/not-subscribed"},
            timeout=15,
        )
        assert not_subscribed.status_code == 404

        own = requests.post(
            f"{API}/web-push/test",
            headers=_headers(webpush_ctx["token1"], webpush_ctx["capo1"]),
            json={"endpoint": endpoint},
            timeout=15,
        )
        assert own.status_code in (200, 502), own.text
