import pytest
from fastapi.testclient import TestClient

from backend.data import ROOT
from backend.main import app

client = TestClient(app)
PLACE = "2472450"
BLOCK = "240317025021"


@pytest.fixture(scope="module")
def db_ready():
    if not (ROOT / "data/urbaneye.db").exists():
        pytest.skip("community database not built")


def test_health_reports_community_db(db_ready):
    assert client.get("/health").json()["community_db"] is True


def test_place_income_history_skips_2020(db_ready):
    data = client.get(f"/areas/{PLACE}/history", params={"metric": "median_household_income"}).json()
    years = [point["year"] for point in data["series"]]
    assert data["span"] == 1
    assert 2020 not in years
    assert 2024 in years
    latest = data["series"][-1]
    assert latest["estimate"] == 115126
    assert latest["moe"] == 6806
    assert latest["estimate_2024_usd"] == 115126


def test_block_group_uses_five_year_span(db_ready):
    data = client.get(f"/areas/{BLOCK}/history", params={"metric": "median_household_income"}).json()
    assert data["span"] == 5
    assert data["zcta"] == "20910"
    assert any("overlap" in item.lower() for item in data["limitations"])


def test_compare_and_changes(db_ready):
    compared = client.get("/compare", params={
        "geo_ids": f"{PLACE},24031", "year": 2024, "metrics": "median_household_income",
    }).json()
    assert len(compared["areas"]) == 2
    silver = next(area for area in compared["areas"] if area["geo_id"] == PLACE)
    county = next(area for area in compared["areas"] if area["geo_id"] == "24031")
    assert silver["values"]["median_household_income"]["estimate"] < county["values"]["median_household_income"]["estimate"]
    change = client.get(f"/areas/{PLACE}/changes", params={
        "metric": "median_household_income", "from_year": 2021, "to_year": 2024,
    }).json()
    assert change["percent_change"] is not None
    assert change["inflation_adjusted"] is True


def test_storefronts_are_attributed(db_ready):
    pois = client.get("/pois").json()
    if pois["total"] == 0:
        pytest.skip("OSM cache not loaded")
    assert pois["attribution"].startswith("© OpenStreetMap")
    assert pois["license"] == "ODbL"
    local = client.get(f"/areas/{BLOCK}/businesses").json()
    assert local["total"] >= 0
    assert "crowd-sourced" in " ".join(local["limitations"]).lower()


def test_unknown_history_geo_is_404(db_ready):
    assert client.get("/areas/not-real/history").status_code == 404
