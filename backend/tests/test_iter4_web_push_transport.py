"""Iteration 4 transport tests (MOCKED): pywebpush calls, retries, cleanup, VAPID persistence."""

import asyncio
import os
import sys
from pathlib import Path

from pywebpush import WebPushException

sys.path.append(str(Path(__file__).resolve().parents[1]))

from web_push import WebPush, endpoint_id


class _FakeResult:
    def __init__(self, status_code):
        self.status_code = status_code


class _FakeCursor:
    def __init__(self, docs):
        self._docs = docs

    async def to_list(self, _):
        return list(self._docs)


class _FakeCollection:
    def __init__(self, docs=None):
        self.docs = docs or {}

    async def find_one(self, query, projection=None):
        _ = projection
        key = query.get("_id")
        if key is not None:
            doc = self.docs.get(key)
            return dict(doc) if doc else None
        for doc in self.docs.values():
            ok = True
            for k, v in query.items():
                if doc.get(k) != v:
                    ok = False
                    break
            if ok:
                return dict(doc)
        return None

    async def update_one(self, query, update, upsert=False):
        key = query.get("_id")
        if key is None:
            raise AssertionError("Expected _id in update_one query")
        existing = self.docs.get(key, {}) if upsert else self.docs.get(key)
        if existing is None:
            return
        if "$setOnInsert" in update and key not in self.docs:
            existing.update(update["$setOnInsert"])
        if "$set" in update:
            existing.update(update["$set"])
        existing["_id"] = key
        self.docs[key] = existing

    async def delete_one(self, query):
        key = query.get("_id")
        if key in self.docs:
            del self.docs[key]

    def find(self, query, projection=None):
        _ = projection
        member_ids = set(query.get("member_id", {}).get("$in", []))
        out = [
            dict(doc)
            for doc in self.docs.values()
            if not member_ids or doc.get("member_id") in member_ids
        ]
        return _FakeCursor(out)


class _FakeDb:
    def __init__(self):
        self.app_config = _FakeCollection()
        self.web_push_subscriptions = _FakeCollection()
        self.members = _FakeCollection()


def test_vapid_persists_across_instances():
    """VAPID keys must be generated once and reused by fresh WebPush instances."""
    db = _FakeDb()
    first = WebPush(db)
    second = WebPush(db)
    k1 = asyncio.run(first.keys())
    k2 = asyncio.run(second.keys())
    assert k1["public_key"] == k2["public_key"]
    assert k1["private_key"] == k2["private_key"]


def test_deliver_calls_pywebpush_with_expected_args(monkeypatch):
    """Transport call passes expected webpush payload and VAPID claim."""
    db = _FakeDb()
    wp = WebPush(db)
    asyncio.run(wp.keys())
    observed = {}

    def _fake_webpush(**kwargs):
        observed.update(kwargs)
        return _FakeResult(201)

    monkeypatch.setattr("web_push.webpush", _fake_webpush)
    monkeypatch.setenv("WEB_PUSH_SUBJECT", "https://family-planner-133.preview.emergentagent.com")

    doc = {
        "endpoint": "https://fcm.googleapis.com/fcm/send/mock-ok",
        "keys": {"p256dh": "BN7U8r9QzIzwE1lRzQ2drfM2vR7vT0j6CYLY5z9fQ8rJYjHg7f8mDj83aR3mghQKNfPz1vXH8HABH_2ttMmTLG0", "auth": "AAAAAAAAAAAAAAAAAAAAAA"},
    }
    ok = asyncio.run(wp.deliver(doc, {"title": "T", "message": "M"}))
    assert ok is True
    assert observed["subscription_info"]["endpoint"] == doc["endpoint"]
    assert observed["vapid_claims"]["sub"] == os.environ["WEB_PUSH_SUBJECT"]


def test_410_deletes_subscription(monkeypatch):
    """410/404 errors should remove stale endpoint from database."""
    db = _FakeDb()
    wp = WebPush(db)
    endpoint = "https://fcm.googleapis.com/fcm/send/mock-gone"
    db.web_push_subscriptions.docs[endpoint_id(endpoint)] = {
        "_id": endpoint_id(endpoint),
        "endpoint": endpoint,
        "keys": {"p256dh": "X", "auth": "Y"},
        "member_id": "mem_1",
    }

    class _Gone(WebPushException):
        def __init__(self):
            super().__init__("gone")
            self.response = _FakeResult(410)

    def _fake_webpush(**kwargs):
        _ = kwargs
        raise _Gone()

    monkeypatch.setattr("web_push.webpush", _fake_webpush)
    monkeypatch.setenv("WEB_PUSH_SUBJECT", "https://family-planner-133.preview.emergentagent.com")

    ok = asyncio.run(
        wp.deliver(
            {"endpoint": endpoint, "keys": {"p256dh": "X", "auth": "Y"}},
            {"title": "T", "message": "M"},
        )
    )
    assert ok is False
    assert endpoint_id(endpoint) not in db.web_push_subscriptions.docs


def test_transient_failure_retries_once(monkeypatch):
    """503 should retry once then succeed when backend recovers."""
    db = _FakeDb()
    wp = WebPush(db)
    calls = {"n": 0}

    class _Transient(WebPushException):
        def __init__(self):
            super().__init__("temp")
            self.response = _FakeResult(503)

    def _fake_webpush(**kwargs):
        _ = kwargs
        calls["n"] += 1
        if calls["n"] == 1:
            raise _Transient()
        return _FakeResult(201)

    monkeypatch.setattr("web_push.webpush", _fake_webpush)
    monkeypatch.setenv("WEB_PUSH_SUBJECT", "https://family-planner-133.preview.emergentagent.com")

    ok = asyncio.run(wp.deliver(
        {
            "endpoint": "https://fcm.googleapis.com/fcm/send/mock-retry",
            "keys": {"p256dh": "X", "auth": "Y"},
        },
        {"title": "T", "message": "M"},
    ))
    assert ok is True
    assert calls["n"] == 2


def test_send_does_not_raise_when_single_delivery_fails(monkeypatch):
    """Delivery exceptions must not break notification fan-out."""
    db = _FakeDb()
    wp = WebPush(db)

    db.members.docs = {
        "m1": {"_id": "m1", "member_id": "mem_ok", "deleted_at": None},
        "m2": {"_id": "m2", "member_id": "mem_fail", "deleted_at": None},
    }
    db.web_push_subscriptions.docs = {
        "s1": {"_id": "s1", "member_id": "mem_ok", "endpoint": "https://fcm.googleapis.com/fcm/send/ok", "keys": {}},
        "s2": {"_id": "s2", "member_id": "mem_fail", "endpoint": "https://fcm.googleapis.com/fcm/send/fail", "keys": {}},
    }

    async def _fake_deliver(doc, data):
        _ = data
        if doc["member_id"] == "mem_fail":
            raise RuntimeError("boom")
        await asyncio.sleep(0)
        return True

    monkeypatch.setattr(wp, "deliver", _fake_deliver)
    asyncio.run(wp.send(["mem_ok", "mem_fail"], {"title": "T", "message": "M"}))
