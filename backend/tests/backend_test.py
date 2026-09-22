"""Backend integration tests for FamigliaTask."""
import os
from datetime import datetime, timezone

import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") if os.environ.get("EXPO_PUBLIC_BACKEND_URL") else None
if not BASE_URL:
    # Fallback: pull from frontend/.env
    from pathlib import Path
    env_path = Path("/app/frontend/.env")
    for line in env_path.read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
            break

API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def capo_ctx():
    """Create a family and return session token + capo member."""
    r = requests.post(f"{API}/family/create", json={
        "family_name": "TEST_Famiglia",
        "capo_name": "TEST_Mamma",
        "pin": "1234",
        "avatar": "👑",
        "accent_color": "coral",
    }, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "session_token" in data
    capo = next(m for m in data["members"] if m["role"] == "capo")
    return {
        "token": data["session_token"],
        "family_id": data["family"]["family_id"],
        "capo": capo,
    }


def h(token, member_id=None):
    hdr = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    if member_id:
        hdr["X-Member-Id"] = member_id
    return hdr


# ---------------- Auth / Family ----------------
class TestAuthFamily:
    def test_create_family_returns_token_and_capo(self, capo_ctx):
        assert capo_ctx["token"]
        assert capo_ctx["capo"]["role"] == "capo"
        assert capo_ctx["capo"]["has_pin"] is True

    def test_auth_me(self, capo_ctx):
        r = requests.get(f"{API}/auth/me", headers=h(capo_ctx["token"]))
        assert r.status_code == 200
        data = r.json()
        assert data["family"]["family_id"] == capo_ctx["family_id"]
        assert len(data["members"]) >= 1

    def test_get_family(self, capo_ctx):
        r = requests.get(f"{API}/family", headers=h(capo_ctx["token"]))
        assert r.status_code == 200
        assert r.json()["family"]["family_id"] == capo_ctx["family_id"]

    def test_auth_me_no_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_auth_me_bad_token(self):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer wrong_token_xyz"})
        assert r.status_code == 401


# ---------------- Members ----------------
class TestMembers:
    def test_capo_adds_member(self, capo_ctx):
        r = requests.post(f"{API}/family/members",
            headers=h(capo_ctx["token"], capo_ctx["capo"]["member_id"]),
            json={"name": "TEST_Luca", "avatar": "🐼", "accent_color": "mint", "role": "membro", "pin": "1111"})
        assert r.status_code == 200, r.text
        m = r.json()
        assert m["name"] == "TEST_Luca"
        assert m["has_pin"] is True
        capo_ctx["luca"] = m

    def test_membro_cannot_add_member(self, capo_ctx):
        r = requests.post(f"{API}/family/members",
            headers=h(capo_ctx["token"], capo_ctx["luca"]["member_id"]),
            json={"name": "TEST_Nope", "role": "membro"})
        assert r.status_code == 403

    def test_verify_pin_correct(self, capo_ctx):
        r = requests.post(f"{API}/family/members/{capo_ctx['luca']['member_id']}/verify-pin",
            headers=h(capo_ctx["token"]), json={"pin": "1111"})
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_verify_pin_wrong(self, capo_ctx):
        r = requests.post(f"{API}/family/members/{capo_ctx['luca']['member_id']}/verify-pin",
            headers=h(capo_ctx["token"]), json={"pin": "9999"})
        assert r.status_code == 401

    def test_update_member_self(self, capo_ctx):
        luca_id = capo_ctx["luca"]["member_id"]
        r = requests.put(f"{API}/family/members/{luca_id}",
            headers=h(capo_ctx["token"], luca_id),
            json={"accent_color": "azure", "name": "TEST_Luca2"})
        assert r.status_code == 200, r.text
        assert r.json()["accent_color"] == "azure"
        # verify persistence via GET /family
        fam = requests.get(f"{API}/family", headers=h(capo_ctx["token"])).json()
        luca = next(m for m in fam["members"] if m["member_id"] == luca_id)
        assert luca["accent_color"] == "azure"
        assert luca["name"] == "TEST_Luca2"

    def test_member_cannot_edit_other(self, capo_ctx):
        # Add a second member (Anna) via capo
        r = requests.post(f"{API}/family/members",
            headers=h(capo_ctx["token"], capo_ctx["capo"]["member_id"]),
            json={"name": "TEST_Anna", "role": "membro"})
        assert r.status_code == 200
        anna = r.json()
        capo_ctx["anna"] = anna
        # Luca tries editing Anna
        r2 = requests.put(f"{API}/family/members/{anna['member_id']}",
            headers=h(capo_ctx["token"], capo_ctx["luca"]["member_id"]),
            json={"name": "TEST_Hack"})
        assert r2.status_code == 403

    def test_cannot_delete_capo(self, capo_ctx):
        r = requests.delete(f"{API}/family/members/{capo_ctx['capo']['member_id']}",
            headers=h(capo_ctx["token"], capo_ctx["capo"]["member_id"]))
        assert r.status_code == 400

    def test_membro_cannot_delete(self, capo_ctx):
        r = requests.delete(f"{API}/family/members/{capo_ctx['anna']['member_id']}",
            headers=h(capo_ctx["token"], capo_ctx["luca"]["member_id"]))
        assert r.status_code == 403

    def test_capo_soft_deletes_member(self, capo_ctx):
        r = requests.delete(f"{API}/family/members/{capo_ctx['anna']['member_id']}",
            headers=h(capo_ctx["token"], capo_ctx["capo"]["member_id"]))
        assert r.status_code == 200
        # Verify anna is not in members list
        fam = requests.get(f"{API}/family", headers=h(capo_ctx["token"])).json()
        ids = [m["member_id"] for m in fam["members"]]
        assert capo_ctx["anna"]["member_id"] not in ids


# ---------------- Activities ----------------
class TestActivities:
    def test_capo_creates_compito(self, capo_ctx):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        r = requests.post(f"{API}/activities",
            headers=h(capo_ctx["token"], capo_ctx["capo"]["member_id"]),
            json={"type": "compito", "title": "TEST_Studia",
                  "icon": "book", "points": 20,
                  "assigned_to": capo_ctx["luca"]["member_id"],
                  "date": today})
        assert r.status_code == 200, r.text
        act = r.json()
        assert act["type"] == "compito"
        assert act["points"] == 20
        assert act["assigned_to"] == capo_ctx["luca"]["member_id"]
        capo_ctx["act"] = act
        capo_ctx["today"] = today

    def test_membro_forbidden_compito(self, capo_ctx):
        r = requests.post(f"{API}/activities",
            headers=h(capo_ctx["token"], capo_ctx["luca"]["member_id"]),
            json={"type": "compito", "title": "TEST_HackCompito", "points": 5,
                  "assigned_to": capo_ctx["luca"]["member_id"],
                  "date": capo_ctx["today"]})
        assert r.status_code == 403

    def test_membro_can_create_impegno_for_self(self, capo_ctx):
        r = requests.post(f"{API}/activities",
            headers=h(capo_ctx["token"], capo_ctx["luca"]["member_id"]),
            json={"type": "impegno", "title": "TEST_Piano",
                  "assigned_to": capo_ctx["luca"]["member_id"],
                  "date": capo_ctx["today"]})
        assert r.status_code == 200, r.text
        assert r.json()["points"] == 0

    def test_membro_cannot_create_impegno_for_other(self, capo_ctx):
        r = requests.post(f"{API}/activities",
            headers=h(capo_ctx["token"], capo_ctx["luca"]["member_id"]),
            json={"type": "impegno", "title": "TEST_ForCapo",
                  "assigned_to": capo_ctx["capo"]["member_id"],
                  "date": capo_ctx["today"]})
        assert r.status_code == 403

    def test_complete_awards_points(self, capo_ctx):
        act_id = capo_ctx["act"]["id"]
        r = requests.post(f"{API}/activities/{act_id}/complete",
            headers=h(capo_ctx["token"], capo_ctx["luca"]["member_id"]))
        assert r.status_code == 200
        assert r.json()["status"] == "done"
        # Verify leaderboard reflects
        lb = requests.get(f"{API}/leaderboard", headers=h(capo_ctx["token"])).json()
        luca = next(m for m in lb if m["member_id"] == capo_ctx["luca"]["member_id"])
        assert luca["points"] == 20

    def test_uncomplete_removes_points(self, capo_ctx):
        act_id = capo_ctx["act"]["id"]
        r = requests.post(f"{API}/activities/{act_id}/uncomplete",
            headers=h(capo_ctx["token"], capo_ctx["luca"]["member_id"]))
        assert r.status_code == 200
        assert r.json()["status"] == "todo"
        lb = requests.get(f"{API}/leaderboard", headers=h(capo_ctx["token"])).json()
        luca = next(m for m in lb if m["member_id"] == capo_ctx["luca"]["member_id"])
        assert luca["points"] == 0

    def test_list_activities_range(self, capo_ctx):
        d = capo_ctx["today"]
        r = requests.get(f"{API}/activities?start={d}&end={d}", headers=h(capo_ctx["token"]))
        assert r.status_code == 200
        items = r.json()
        assert any(a["id"] == capo_ctx["act"]["id"] for a in items)

    def test_update_activity_capo(self, capo_ctx):
        r = requests.put(f"{API}/activities/{capo_ctx['act']['id']}",
            headers=h(capo_ctx["token"], capo_ctx["capo"]["member_id"]),
            json={"points": 30})
        assert r.status_code == 200
        assert r.json()["points"] == 30

    def test_membro_cannot_update_others_activity(self, capo_ctx):
        r = requests.put(f"{API}/activities/{capo_ctx['act']['id']}",
            headers=h(capo_ctx["token"], capo_ctx["luca"]["member_id"]),
            json={"points": 5})
        assert r.status_code == 403

    def test_delete_activity_capo(self, capo_ctx):
        r = requests.delete(f"{API}/activities/{capo_ctx['act']['id']}",
            headers=h(capo_ctx["token"], capo_ctx["capo"]["member_id"]))
        assert r.status_code == 200
        # Verify soft delete: not in list
        d = capo_ctx["today"]
        items = requests.get(f"{API}/activities?start={d}&end={d}", headers=h(capo_ctx["token"])).json()
        assert not any(a["id"] == capo_ctx["act"]["id"] for a in items)


# ---------------- Leaderboard / Presets ----------------
class TestLeaderboardPresets:
    def test_leaderboard_sorted(self, capo_ctx):
        r = requests.get(f"{API}/leaderboard", headers=h(capo_ctx["token"]))
        assert r.status_code == 200
        lb = r.json()
        pts = [m["points"] for m in lb]
        assert pts == sorted(pts, reverse=True)

    def test_presets_10(self, capo_ctx):
        r = requests.get(f"{API}/presets", headers=h(capo_ctx["token"]))
        assert r.status_code == 200
        assert len(r.json()) == 10
