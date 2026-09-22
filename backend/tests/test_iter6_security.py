"""Iteration 6 - Security audit regression tests.

Covers:
- SEC-001: X-Member-Id spoofing must be rejected (403) unless server session activated it via verify-pin.
- Family create auto-activates capo (active_member_id in response).
- Verify-pin (correct/wrong/empty for members without PIN).
- Deactivate / revoke session semantics.
- Full CRUD activities/comments/rewards/members with server-side actor binding.
- Pydantic input validation (422).
- /api/register-push auth requirement.
"""
import os
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path("/app/frontend/.env"))
_backend = os.environ.get("EXPO_PUBLIC_BACKEND_URL")
if not _backend:
    raise RuntimeError("EXPO_PUBLIC_BACKEND_URL missing from /app/frontend/.env")
BASE_URL = _backend.rstrip("/") + "/api"


def _client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def capo_ctx():
    """Create a fresh family for the module. Return session, family, capo member ids."""
    c = _client()
    r = c.post(f"{BASE_URL}/family/create", json={
        "family_name": "TEST_Iter6_Family",
        "capo_name": "TEST_Mamma",
        "pin": "1234",
        "avatar": "👑",
        "accent_color": "coral",
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("session_token"), data
    assert data.get("active_member_id"), "capo must be auto-activated"
    capo_member_id = next(m["member_id"] for m in data["members"] if m["role"] == "capo")
    assert data["active_member_id"] == capo_member_id
    return {
        "session_token": data["session_token"],
        "family_id": data["family"]["family_id"],
        "invite_code": data["family"]["invite_code"],
        "capo_member_id": capo_member_id,
        "client": c,
    }


def _auth_headers(token, member_id=None):
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    if member_id:
        h["X-Member-Id"] = member_id
    return h


# --------------------------------------------------------------------- #
# 1. Family create / capo auto-activation
# --------------------------------------------------------------------- #
class TestFamilyCreate:
    def test_create_family_returns_active_member(self, capo_ctx):
        # Already created via fixture; just verify context invariants.
        assert capo_ctx["capo_member_id"].startswith("mem_")
        assert capo_ctx["invite_code"]

    def test_pin_must_be_4_digits(self):
        c = _client()
        r = c.post(f"{BASE_URL}/family/create", json={
            "family_name": "TEST_BadPIN", "capo_name": "X", "pin": "12", "avatar": "🦁", "accent_color": "coral",
        })
        assert r.status_code == 422, r.text

    def test_family_name_required(self):
        c = _client()
        r = c.post(f"{BASE_URL}/family/create", json={
            "family_name": "", "capo_name": "X", "pin": "1234", "avatar": "🦁", "accent_color": "coral",
        })
        assert r.status_code == 422, r.text


# --------------------------------------------------------------------- #
# 2. SEC-001: X-Member-Id spoofing must be rejected
# --------------------------------------------------------------------- #
class TestSecurityMemberBinding:
    def test_joiner_cannot_spoof_capo_via_header(self, capo_ctx):
        c = _client()
        # New joiner enters with invite code -> gets a session with NO active member.
        j = c.post(f"{BASE_URL}/family/join", json={"code": capo_ctx["invite_code"]})
        assert j.status_code == 200, j.text
        jdata = j.json()
        assert jdata.get("active_member_id") in (None, "")
        joiner_token = jdata["session_token"]

        # Attempt to create an activity while spoofing the capo's member id.
        # Expected: 403 "Membro non valido".
        r = c.post(
            f"{BASE_URL}/activities",
            headers=_auth_headers(joiner_token, capo_ctx["capo_member_id"]),
            json={"type": "compito", "title": "hack", "assigned_to": capo_ctx["capo_member_id"], "date": "2026-01-15"},
        )
        assert r.status_code == 403, f"Expected 403 for header spoof, got {r.status_code}: {r.text}"
        assert "Membro non valido" in r.text or "Non autenticato" in r.text

    def test_joiner_can_act_after_verify_pin(self, capo_ctx):
        # Create a member with a PIN via capo (must reuse capo_ctx).
        cctx = capo_ctx
        new_mem = cctx["client"].post(
            f"{BASE_URL}/family/members",
            headers=_auth_headers(cctx["session_token"], cctx["capo_member_id"]),
            json={"name": "TEST_Luca", "avatar": "🐼", "accent_color": "mint", "role": "membro", "pin": "1111"},
        )
        assert new_mem.status_code == 200, new_mem.text
        member_id = new_mem.json()["member_id"]

        # A new joiner session activates that member with correct PIN.
        c = _client()
        jdata = c.post(f"{BASE_URL}/family/join", json={"code": cctx["invite_code"]}).json()
        token = jdata["session_token"]

        # Wrong PIN -> 401.
        wrong = c.post(
            f"{BASE_URL}/family/members/{member_id}/verify-pin",
            headers=_auth_headers(token), json={"pin": "0000"},
        )
        assert wrong.status_code == 401, wrong.text

        # Correct PIN -> 200 + activation.
        ok = c.post(
            f"{BASE_URL}/family/members/{member_id}/verify-pin",
            headers=_auth_headers(token), json={"pin": "1111"},
        )
        assert ok.status_code == 200, ok.text

        # Now the joiner can create an "impegno" for himself.
        r = c.post(
            f"{BASE_URL}/activities",
            headers=_auth_headers(token, member_id),
            json={"type": "impegno", "title": "TEST_impegno", "assigned_to": member_id, "date": "2026-01-15"},
        )
        assert r.status_code == 200, r.text

        # But cannot spoof capo id afterwards.
        r2 = c.post(
            f"{BASE_URL}/activities",
            headers=_auth_headers(token, cctx["capo_member_id"]),
            json={"type": "compito", "title": "TEST_hack2", "assigned_to": cctx["capo_member_id"], "date": "2026-01-15"},
        )
        assert r2.status_code == 403, r2.text

        # And cannot create a "compito" for himself (only capo can assign compiti).
        r3 = c.post(
            f"{BASE_URL}/activities",
            headers=_auth_headers(token, member_id),
            json={"type": "compito", "title": "TEST_notallowed", "assigned_to": member_id, "date": "2026-01-15"},
        )
        assert r3.status_code == 403, r3.text

        # Store for follow-up tests.
        capo_ctx["_member_id"] = member_id
        capo_ctx["_member_token"] = token

    def test_verify_pin_empty_for_pinless_member(self, capo_ctx):
        cctx = capo_ctx
        # Add a PIN-less member.
        m = cctx["client"].post(
            f"{BASE_URL}/family/members",
            headers=_auth_headers(cctx["session_token"], cctx["capo_member_id"]),
            json={"name": "TEST_Anna", "avatar": "🐰", "accent_color": "lavender", "role": "membro"},
        )
        assert m.status_code == 200, m.text
        mid = m.json()["member_id"]
        assert m.json()["has_pin"] is False

        c = _client()
        jdata = c.post(f"{BASE_URL}/family/join", json={"code": cctx["invite_code"]}).json()
        token = jdata["session_token"]

        # Empty PIN allowed for members without PIN.
        r = c.post(f"{BASE_URL}/family/members/{mid}/verify-pin",
                   headers=_auth_headers(token), json={"pin": ""})
        assert r.status_code == 200, r.text


# --------------------------------------------------------------------- #
# 3. Deactivate / revoke session
# --------------------------------------------------------------------- #
class TestSessionLifecycle:
    def test_deactivate_blocks_mutations_but_keeps_session(self, capo_ctx):
        cctx = capo_ctx
        c = cctx["client"]
        # Deactivate current capo profile.
        r = c.post(f"{BASE_URL}/family/deactivate",
                   headers=_auth_headers(cctx["session_token"], cctx["capo_member_id"]))
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # Mutating route should now return 403 (no active member).
        act = c.post(f"{BASE_URL}/activities",
                     headers=_auth_headers(cctx["session_token"], cctx["capo_member_id"]),
                     json={"type": "compito", "title": "TEST_x", "assigned_to": cctx["capo_member_id"], "date": "2026-01-15"})
        assert act.status_code == 403, act.text

        # But read routes / me still work (session still valid).
        me = c.get(f"{BASE_URL}/auth/me", headers=_auth_headers(cctx["session_token"]))
        assert me.status_code == 200, me.text
        assert me.json().get("active_member_id") in (None, "")

        # Re-activate capo for next tests.
        v = c.post(f"{BASE_URL}/family/members/{cctx['capo_member_id']}/verify-pin",
                   headers=_auth_headers(cctx["session_token"]), json={"pin": "1234"})
        assert v.status_code == 200, v.text

    def test_revoke_session_kills_all_requests(self):
        # Create isolated family so we can freely revoke.
        c = _client()
        data = c.post(f"{BASE_URL}/family/create", json={
            "family_name": "TEST_Revoke", "capo_name": "TEST_R", "pin": "1234", "avatar": "🦁", "accent_color": "coral",
        }).json()
        tok = data["session_token"]
        r = c.delete(f"{BASE_URL}/auth/session", headers=_auth_headers(tok))
        assert r.status_code == 200, r.text
        # Now every route must return 401.
        me = c.get(f"{BASE_URL}/auth/me", headers=_auth_headers(tok))
        assert me.status_code == 401, me.text


# --------------------------------------------------------------------- #
# 4. Activities CRUD + comments + Pydantic validation
# --------------------------------------------------------------------- #
class TestActivitiesAndComments:
    def test_full_activity_lifecycle_and_comment(self, capo_ctx):
        cctx = capo_ctx
        c = cctx["client"]
        h = _auth_headers(cctx["session_token"], cctx["capo_member_id"])

        # Create.
        r = c.post(f"{BASE_URL}/activities", headers=h, json={
            "type": "compito", "title": "TEST_Studia", "icon": "book",
            "points": 20, "assigned_to": cctx["capo_member_id"], "date": "2026-01-16",
        })
        assert r.status_code == 200, r.text
        aid = r.json()["id"]

        # GET verify persistence.
        g = c.get(f"{BASE_URL}/activities/{aid}", headers=h)
        assert g.status_code == 200
        assert g.json()["title"] == "TEST_Studia"
        assert g.json()["points"] == 20

        # Update.
        u = c.put(f"{BASE_URL}/activities/{aid}", headers=h, json={"title": "TEST_Studia2", "points": 30})
        assert u.status_code == 200 and u.json()["title"] == "TEST_Studia2"

        # Complete / uncomplete.
        cp = c.post(f"{BASE_URL}/activities/{aid}/complete", headers=h)
        assert cp.status_code == 200 and cp.json()["status"] == "done"
        up = c.post(f"{BASE_URL}/activities/{aid}/uncomplete", headers=h)
        assert up.status_code == 200 and up.json()["status"] == "todo"

        # Comments: GET empty, POST valid, POST >1000 chars -> 422, then verify count.
        gl = c.get(f"{BASE_URL}/activities/{aid}/comments", headers=h)
        assert gl.status_code == 200 and gl.json() == []

        pc = c.post(f"{BASE_URL}/activities/{aid}/comments", headers=h, json={"text": "TEST_ciao"})
        assert pc.status_code == 200, pc.text
        assert pc.json()["text"] == "TEST_ciao"

        too_long = c.post(f"{BASE_URL}/activities/{aid}/comments", headers=h, json={"text": "x" * 1001})
        assert too_long.status_code == 422, too_long.text

        # Delete.
        d = c.delete(f"{BASE_URL}/activities/{aid}", headers=h)
        assert d.status_code == 200
        # And now GET returns 404.
        g2 = c.get(f"{BASE_URL}/activities/{aid}", headers=h)
        assert g2.status_code == 404

    def test_activity_validation(self, capo_ctx):
        cctx = capo_ctx
        h = _auth_headers(cctx["session_token"], cctx["capo_member_id"])
        c = cctx["client"]
        # empty title
        r = c.post(f"{BASE_URL}/activities", headers=h,
                   json={"type": "compito", "title": "", "assigned_to": cctx["capo_member_id"], "date": "2026-01-15"})
        assert r.status_code == 422
        # negative points
        r2 = c.post(f"{BASE_URL}/activities", headers=h, json={
            "type": "compito", "title": "TEST_neg", "points": -5,
            "assigned_to": cctx["capo_member_id"], "date": "2026-01-15",
        })
        assert r2.status_code == 422


# --------------------------------------------------------------------- #
# 5. Rewards & leaderboard
# --------------------------------------------------------------------- #
class TestRewards:
    def test_reward_crud_and_redeem_flow(self, capo_ctx):
        cctx = capo_ctx
        c = cctx["client"]
        h = _auth_headers(cctx["session_token"], cctx["capo_member_id"])

        # Create reward (as capo).
        r = c.post(f"{BASE_URL}/rewards", headers=h, json={"title": "TEST_Gelato", "icon": "gift", "cost": 5})
        assert r.status_code == 200, r.text
        rid = r.json()["id"]

        # List.
        lst = c.get(f"{BASE_URL}/rewards", headers=h)
        assert lst.status_code == 200 and any(x["id"] == rid for x in lst.json())

        # Update.
        u = c.put(f"{BASE_URL}/rewards/{rid}", headers=h, json={"cost": 10})
        assert u.status_code == 200 and u.json()["cost"] == 10

        # Negative cost -> 422.
        neg = c.post(f"{BASE_URL}/rewards", headers=h, json={"title": "TEST_Bad", "icon": "gift", "cost": -1})
        assert neg.status_code == 422

        # Capo has 0 pts, redeem should fail with 400.
        red = c.post(f"{BASE_URL}/rewards/{rid}/redeem", headers=h)
        assert red.status_code == 400, red.text

        # Give capo enough points by creating+completing a compito.
        act = c.post(f"{BASE_URL}/activities", headers=h, json={
            "type": "compito", "title": "TEST_Points", "points": 50,
            "assigned_to": cctx["capo_member_id"], "date": "2026-01-17",
        })
        aid = act.json()["id"]
        c.post(f"{BASE_URL}/activities/{aid}/complete", headers=h)

        red2 = c.post(f"{BASE_URL}/rewards/{rid}/redeem", headers=h)
        assert red2.status_code == 200, red2.text
        assert red2.json()["member"]["points"] == 40  # 50 - 10

        # Leaderboard sees capo.
        lb = c.get(f"{BASE_URL}/leaderboard", headers=h)
        assert lb.status_code == 200 and any(m["member_id"] == cctx["capo_member_id"] for m in lb.json())

        # Delete reward.
        d = c.delete(f"{BASE_URL}/rewards/{rid}", headers=h)
        assert d.status_code == 200


# --------------------------------------------------------------------- #
# 6. Members management + regenerate code (only capo)
# --------------------------------------------------------------------- #
class TestMembersAndCodeRotation:
    def test_only_capo_can_regenerate_code(self, capo_ctx):
        cctx = capo_ctx
        c = _client()
        # A brand-new joiner without active member -> 403.
        tok = c.post(f"{BASE_URL}/family/join", json={"code": cctx["invite_code"]}).json()["session_token"]
        r = c.post(f"{BASE_URL}/family/regenerate-code", headers=_auth_headers(tok))
        assert r.status_code == 403, r.text

        # Capo -> 200 and code changes.
        r2 = cctx["client"].post(f"{BASE_URL}/family/regenerate-code",
                                  headers=_auth_headers(cctx["session_token"], cctx["capo_member_id"]))
        assert r2.status_code == 200 and r2.json().get("invite_code")
        assert r2.json()["invite_code"] != cctx["invite_code"]
        cctx["invite_code"] = r2.json()["invite_code"]


# --------------------------------------------------------------------- #
# 7. /api/register-push requires auth
# --------------------------------------------------------------------- #
class TestPushAuth:
    def test_register_push_unauth(self):
        r = requests.post(f"{BASE_URL}/register-push",
                          json={"user_id": "x", "platform": "web", "device_token": "t"})
        assert r.status_code == 401, r.text
