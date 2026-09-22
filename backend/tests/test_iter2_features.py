"""Iteration 2 tests: invite code / join, notes, comments, register-push, single activity."""
import os
from datetime import datetime, timezone
from pathlib import Path

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL")
if not BASE_URL:
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().strip('"')
            break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


def h(token, mid=None):
    hdr = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    if mid:
        hdr["X-Member-Id"] = mid
    return hdr


@pytest.fixture(scope="module")
def ctx():
    """Fresh family + capo + one membro."""
    r = requests.post(f"{API}/family/create", json={
        "family_name": "TEST_FamigliaIter2",
        "capo_name": "TEST_Capo2",
        "pin": "1234",
        "avatar": "👑",
        "accent_color": "coral",
    }, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    capo = next(m for m in data["members"] if m["role"] == "capo")
    # add a membro
    r2 = requests.post(f"{API}/family/members",
        headers=h(data["session_token"], capo["member_id"]),
        json={"name": "TEST_MembroIter2", "role": "membro", "pin": "1111"})
    assert r2.status_code == 200, r2.text
    return {
        "token": data["session_token"],
        "family_id": data["family"]["family_id"],
        "invite_code": data["family"]["invite_code"],
        "capo": capo,
        "membro": r2.json(),
        "members": data["members"],
    }


# --------------------- Invite code / join / regenerate ---------------------
class TestInviteCode:
    def test_create_returns_invite_code_6chars(self, ctx):
        code = ctx["invite_code"]
        assert isinstance(code, str)
        assert len(code) == 6
        # unambiguous alphabet
        assert set(code).issubset(set("ABCDEFGHJKLMNPQRSTUVWXYZ23456789"))

    def test_join_valid_code_returns_new_token_same_family(self, ctx):
        r = requests.post(f"{API}/family/join", json={"code": ctx["invite_code"]})
        assert r.status_code == 200, r.text
        data = r.json()
        # New session token, distinct from creator's
        assert data["session_token"]
        assert data["session_token"] != ctx["token"]
        # Same family_id
        assert data["family"]["family_id"] == ctx["family_id"]
        # Members list matches (same member_ids)
        joined_ids = sorted(m["member_id"] for m in data["members"])
        r_full = requests.get(f"{API}/family", headers=h(ctx["token"])).json()
        original_ids = sorted(m["member_id"] for m in r_full["members"])
        assert joined_ids == original_ids

    def test_join_invalid_code_404(self):
        r = requests.post(f"{API}/family/join", json={"code": "ZZZZZZ"})
        assert r.status_code == 404

    def test_join_lowercase_code_normalized(self, ctx):
        r = requests.post(f"{API}/family/join", json={"code": ctx["invite_code"].lower()})
        assert r.status_code == 200

    def test_regenerate_code_capo(self, ctx):
        old = ctx["invite_code"]
        r = requests.post(f"{API}/family/regenerate-code",
                          headers=h(ctx["token"], ctx["capo"]["member_id"]))
        assert r.status_code == 200, r.text
        new_code = r.json()["invite_code"]
        assert len(new_code) == 6
        assert new_code != old
        # Old code no longer works
        r_old = requests.post(f"{API}/family/join", json={"code": old})
        assert r_old.status_code == 404
        # New code works
        r_new = requests.post(f"{API}/family/join", json={"code": new_code})
        assert r_new.status_code == 200
        ctx["invite_code"] = new_code

    def test_regenerate_code_membro_forbidden(self, ctx):
        r = requests.post(f"{API}/family/regenerate-code",
                          headers=h(ctx["token"], ctx["membro"]["member_id"]))
        assert r.status_code == 403


# --------------------- Single activity + Notes ---------------------
class TestActivityNotes:
    def test_get_activity_404(self, ctx):
        r = requests.get(f"{API}/activities/act_nonexistent", headers=h(ctx["token"]))
        assert r.status_code == 404

    def test_create_activity_with_note(self, ctx):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        r = requests.post(f"{API}/activities",
            headers=h(ctx["token"], ctx["capo"]["member_id"]),
            json={"type": "compito", "title": "TEST_ConNota",
                  "icon": "book", "points": 10,
                  "assigned_to": ctx["membro"]["member_id"],
                  "date": today, "note": "Ricorda di studiare capitolo 3"})
        assert r.status_code == 200, r.text
        act = r.json()
        assert act["note"] == "Ricorda di studiare capitolo 3"
        assert act["has_note"] is True
        assert act["comment_count"] == 0
        ctx["act"] = act
        ctx["today"] = today

    def test_get_single_activity(self, ctx):
        r = requests.get(f"{API}/activities/{ctx['act']['id']}", headers=h(ctx["token"]))
        assert r.status_code == 200
        a = r.json()
        assert a["id"] == ctx["act"]["id"]
        assert a["has_note"] is True

    def test_capo_can_edit_note(self, ctx):
        r = requests.put(f"{API}/activities/{ctx['act']['id']}",
            headers=h(ctx["token"], ctx["capo"]["member_id"]),
            json={"note": "Nota aggiornata dal capo"})
        assert r.status_code == 200
        assert r.json()["note"] == "Nota aggiornata dal capo"

    def test_membro_not_creator_forbidden_edit(self, ctx):
        # Membro didn't create this compito → 403
        r = requests.put(f"{API}/activities/{ctx['act']['id']}",
            headers=h(ctx["token"], ctx["membro"]["member_id"]),
            json={"note": "hackerato"})
        assert r.status_code == 403

    def test_creator_membro_can_edit_own_note(self, ctx):
        # Membro creates own impegno with note, edits it
        r_create = requests.post(f"{API}/activities",
            headers=h(ctx["token"], ctx["membro"]["member_id"]),
            json={"type": "impegno", "title": "TEST_MyImpegno",
                  "assigned_to": ctx["membro"]["member_id"],
                  "date": ctx["today"], "note": "iniziale"})
        assert r_create.status_code == 200, r_create.text
        own = r_create.json()
        assert own["has_note"] is True
        r_edit = requests.put(f"{API}/activities/{own['id']}",
            headers=h(ctx["token"], ctx["membro"]["member_id"]),
            json={"note": "aggiornata dal creatore"})
        assert r_edit.status_code == 200
        assert r_edit.json()["note"] == "aggiornata dal creatore"


# --------------------- Comments / Chat ---------------------
class TestComments:
    def test_list_comments_empty_initial(self, ctx):
        r = requests.get(f"{API}/activities/{ctx['act']['id']}/comments",
                         headers=h(ctx["token"]))
        assert r.status_code == 200
        assert r.json() == []

    def test_post_comment_as_membro_increments_count(self, ctx):
        r = requests.post(f"{API}/activities/{ctx['act']['id']}/comments",
            headers=h(ctx["token"], ctx["membro"]["member_id"]),
            json={"text": "Ciao, quando lo faccio?"})
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["text"] == "Ciao, quando lo faccio?"
        assert c["member_id"] == ctx["membro"]["member_id"]
        assert c["member_name"]
        assert c["member_avatar"]
        assert c["member_accent"]
        assert c["created_at"]
        # comment_count on activity increments
        a = requests.get(f"{API}/activities/{ctx['act']['id']}",
                         headers=h(ctx["token"])).json()
        assert a["comment_count"] == 1

    def test_post_comment_as_capo(self, ctx):
        r = requests.post(f"{API}/activities/{ctx['act']['id']}/comments",
            headers=h(ctx["token"], ctx["capo"]["member_id"]),
            json={"text": "Domani sera va bene"})
        assert r.status_code == 200
        a = requests.get(f"{API}/activities/{ctx['act']['id']}",
                         headers=h(ctx["token"])).json()
        assert a["comment_count"] == 2

    def test_list_comments_non_empty_ordered(self, ctx):
        r = requests.get(f"{API}/activities/{ctx['act']['id']}/comments",
                         headers=h(ctx["token"]))
        assert r.status_code == 200
        cs = r.json()
        assert len(cs) == 2
        # chronological order
        assert cs[0]["created_at"] <= cs[1]["created_at"]

    def test_empty_text_comment_rejected(self, ctx):
        r = requests.post(f"{API}/activities/{ctx['act']['id']}/comments",
            headers=h(ctx["token"], ctx["membro"]["member_id"]),
            json={"text": "   "})
        assert r.status_code == 400

    def test_comments_on_missing_activity_404(self, ctx):
        r = requests.get(f"{API}/activities/act_missing/comments",
                         headers=h(ctx["token"]))
        assert r.status_code == 404


# --------------------- Register push ---------------------
class TestRegisterPush:
    def test_register_push_placeholder_returns_skipped(self):
        r = requests.post(f"{API}/register-push",
            json={"user_id": "u1", "platform": "ios", "device_token": "tok_test"})
        assert r.status_code == 201, r.text
        assert r.json().get("status") == "skipped"

    def test_register_push_does_not_crash_with_bad_shape(self):
        # missing fields → FastAPI 422, but must not 500
        r = requests.post(f"{API}/register-push", json={"user_id": "u1"})
        assert r.status_code in (201, 422)
