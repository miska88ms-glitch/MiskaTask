"""Iteration 3 backend tests: rewards, recurring dates[], impegno end_time."""
import os
import pytest
import requests
from datetime import date, timedelta

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://family-planner-133.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _mk_family(name="TEST_Iter3"):
    r = requests.post(f"{API}/family/create", json={
        "family_name": name, "capo_name": "TEST_Mamma", "pin": "1234",
        "avatar": "👑", "accent_color": "coral",
    }, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    capo = next(m for m in d["members"] if m["role"] == "capo")
    return d["session_token"], d["family"]["family_id"], capo["member_id"]


def _add_member(token, capo_id, name="TEST_Luca"):
    r = requests.post(f"{API}/family/members", json={
        "name": name, "avatar": "🐼", "accent_color": "mint", "role": "membro",
    }, headers={"Authorization": f"Bearer {token}", "X-Member-Id": capo_id}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["member_id"]


@pytest.fixture(scope="module")
def ctx():
    token, fid, capo = _mk_family("TEST_Iter3_Rewards")
    membro = _add_member(token, capo, "TEST_LucaRw")
    return {"token": token, "family_id": fid, "capo_id": capo, "membro_id": membro}


def _auth(tok, mid):
    return {"Authorization": f"Bearer {tok}", "X-Member-Id": mid}


# ---------------- Rewards ----------------
class TestRewards:
    def test_list_rewards_empty(self, ctx):
        r = requests.get(f"{API}/rewards", headers=_auth(ctx["token"], ctx["capo_id"]))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_reward_capo(self, ctx):
        r = requests.post(f"{API}/rewards",
                          json={"title": "TEST 1h videogiochi", "icon": "gift", "cost": 50},
                          headers=_auth(ctx["token"], ctx["capo_id"]))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["title"] == "TEST 1h videogiochi"
        assert data["cost"] == 50
        ctx["reward_id"] = data["id"]

    def test_create_reward_membro_403(self, ctx):
        r = requests.post(f"{API}/rewards",
                          json={"title": "TEST forbidden", "icon": "gift", "cost": 10},
                          headers=_auth(ctx["token"], ctx["membro_id"]))
        assert r.status_code == 403

    def test_update_reward_membro_403(self, ctx):
        r = requests.put(f"{API}/rewards/{ctx['reward_id']}",
                         json={"cost": 5},
                         headers=_auth(ctx["token"], ctx["membro_id"]))
        assert r.status_code == 403

    def test_update_reward_capo(self, ctx):
        r = requests.put(f"{API}/rewards/{ctx['reward_id']}",
                         json={"cost": 20},
                         headers=_auth(ctx["token"], ctx["capo_id"]))
        assert r.status_code == 200
        assert r.json()["cost"] == 20

    def test_redeem_insufficient_points(self, ctx):
        r = requests.post(f"{API}/rewards/{ctx['reward_id']}/redeem",
                          headers=_auth(ctx["token"], ctx["membro_id"]))
        assert r.status_code == 400

    def test_redeem_invalid_reward_404(self, ctx):
        r = requests.post(f"{API}/rewards/rwd_doesnotexist/redeem",
                          headers=_auth(ctx["token"], ctx["membro_id"]))
        assert r.status_code == 404

    def test_earn_and_redeem(self, ctx):
        today = date.today().isoformat()
        # capo assigns compito worth 30 to membro
        r = requests.post(f"{API}/activities", json={
            "type": "compito", "title": "TEST earn task", "icon": "star",
            "points": 30, "assigned_to": ctx["membro_id"], "date": today,
        }, headers=_auth(ctx["token"], ctx["capo_id"]))
        assert r.status_code == 200, r.text
        act_id = r.json()["id"]
        # membro completes it -> gains 30 points
        r = requests.post(f"{API}/activities/{act_id}/complete",
                          headers=_auth(ctx["token"], ctx["membro_id"]))
        assert r.status_code == 200
        # redeem 20-point reward
        r = requests.post(f"{API}/rewards/{ctx['reward_id']}/redeem",
                          headers=_auth(ctx["token"], ctx["membro_id"]))
        assert r.status_code == 200, r.text
        body = r.json()
        assert "redemption" in body and "member" in body
        assert body["member"]["points"] == 10  # 30 - 20
        assert body["redemption"]["cost"] == 20
        assert body["redemption"]["reward_title"] == "TEST 1h videogiochi"

    def test_redemptions_history(self, ctx):
        r = requests.get(f"{API}/redemptions", headers=_auth(ctx["token"], ctx["capo_id"]))
        assert r.status_code == 200
        rs = r.json()
        assert len(rs) >= 1
        latest = rs[0]
        assert latest["member_name"] == "TEST_LucaRw"
        assert latest["reward_title"] == "TEST 1h videogiochi"
        assert latest["cost"] == 20

    def test_delete_reward_membro_403(self, ctx):
        r = requests.delete(f"{API}/rewards/{ctx['reward_id']}",
                            headers=_auth(ctx["token"], ctx["membro_id"]))
        assert r.status_code == 403

    def test_delete_reward_capo(self, ctx):
        r = requests.delete(f"{API}/rewards/{ctx['reward_id']}",
                            headers=_auth(ctx["token"], ctx["capo_id"]))
        assert r.status_code == 200
        # list should no longer include it
        r = requests.get(f"{API}/rewards", headers=_auth(ctx["token"], ctx["capo_id"]))
        ids = [x["id"] for x in r.json()]
        assert ctx["reward_id"] not in ids


# ---------------- Recurring dates ----------------
class TestRecurring:
    def test_create_with_dates_array(self, ctx):
        d1 = date.today().isoformat()
        d2 = (date.today() + timedelta(days=1)).isoformat()
        d3 = (date.today() + timedelta(days=2)).isoformat()
        r = requests.post(f"{API}/activities", json={
            "type": "compito", "title": "TEST_recurring", "icon": "book",
            "points": 10, "assigned_to": ctx["membro_id"],
            "date": d1, "dates": [d1, d2, d3],
        }, headers=_auth(ctx["token"], ctx["capo_id"]))
        assert r.status_code == 200, r.text
        first = r.json()
        assert first["date"] == d1
        # verify 3 activities materialized
        r = requests.get(f"{API}/activities",
                         params={"start": d1, "end": d3},
                         headers=_auth(ctx["token"], ctx["capo_id"]))
        assert r.status_code == 200
        acts = [a for a in r.json() if a["title"] == "TEST_recurring"]
        assert len(acts) == 3
        assert sorted({a["date"] for a in acts}) == [d1, d2, d3]

    def test_single_date_no_dates_array(self, ctx):
        d = (date.today() + timedelta(days=7)).isoformat()
        r = requests.post(f"{API}/activities", json={
            "type": "compito", "title": "TEST_singledate", "icon": "star",
            "points": 5, "assigned_to": ctx["membro_id"], "date": d,
        }, headers=_auth(ctx["token"], ctx["capo_id"]))
        assert r.status_code == 200
        assert r.json()["date"] == d


# ---------------- Impegno end_time + RBAC ----------------
class TestImpegno:
    def test_membro_creates_impegno_with_end_time(self, ctx):
        d = date.today().isoformat()
        r = requests.post(f"{API}/activities", json={
            "type": "impegno", "title": "TEST calcetto", "icon": "star",
            "assigned_to": ctx["membro_id"], "date": d,
            "time": "19:00", "end_time": "20:00",
        }, headers=_auth(ctx["token"], ctx["membro_id"]))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["type"] == "impegno"
        assert data["time"] == "19:00"
        assert data["end_time"] == "20:00"
        assert data["points"] == 0

    def test_membro_cannot_create_compito(self, ctx):
        d = date.today().isoformat()
        r = requests.post(f"{API}/activities", json={
            "type": "compito", "title": "TEST forbid", "icon": "star",
            "points": 10, "assigned_to": ctx["membro_id"], "date": d,
        }, headers=_auth(ctx["token"], ctx["membro_id"]))
        assert r.status_code == 403

    def test_membro_cannot_impegno_for_other(self, ctx):
        d = date.today().isoformat()
        r = requests.post(f"{API}/activities", json={
            "type": "impegno", "title": "TEST for other", "icon": "star",
            "assigned_to": ctx["capo_id"], "date": d, "time": "10:00",
        }, headers=_auth(ctx["token"], ctx["membro_id"]))
        assert r.status_code == 403


# ---------------- Regressions ----------------
class TestRegressions:
    def test_presets_10(self, ctx):
        r = requests.get(f"{API}/presets", headers=_auth(ctx["token"], ctx["capo_id"]))
        assert r.status_code == 200
        assert len(r.json()) == 10

    def test_leaderboard(self, ctx):
        r = requests.get(f"{API}/leaderboard", headers=_auth(ctx["token"], ctx["capo_id"]))
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 2

    def test_register_push_placeholder(self, ctx):
        r = requests.post(f"{API}/register-push", json={
            "user_id": "u_test", "platform": "ios", "device_token": "tok",
        })
        assert r.status_code == 201
        assert r.json()["status"] == "skipped"

    def test_invite_code_present(self, ctx):
        r = requests.get(f"{API}/family",
                         headers=_auth(ctx["token"], ctx["capo_id"]))
        assert r.status_code == 200
        assert r.json()["family"]["invite_code"]
