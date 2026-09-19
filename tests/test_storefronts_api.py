import json

from fastapi.testclient import TestClient

from backend.data import ROOT
from backend.main import app

client = TestClient(app)


def test_storefronts_endpoint_serves_the_committed_snapshot_with_attribution():
    body = client.get("/storefronts").json()
    manifest = json.loads((ROOT / "data/processed/storefronts_manifest.json").read_text())
    assert len(body["storefronts"]) == manifest["counts"]["named_features"]
    assert body["license"] == "ODbL 1.0" and "OpenStreetMap contributors" in body["attribution"]
    assert "not an official business registry" in body["limitations"]
    assert body["retrieved_at"] == manifest["retrieved_at"]


def test_storefronts_are_unique_named_and_tied_to_real_block_groups():
    body = client.get("/storefronts").json()
    area_ids = {f["id"] for f in client.get("/areas").json()["features"]}
    ids = [s["osm_id"] for s in body["storefronts"]]
    assert len(ids) == len(set(ids))
    assert all(s["name"] for s in body["storefronts"])
    assert all(s["block_group_id"] in area_ids | {None} for s in body["storefronts"])
    assert any(s["block_group_id"] for s in body["storefronts"])


def test_layers_still_match_area_metrics():
    # Storefronts are their own endpoint; /layers must keep matching the Census metric keys.
    layer_ids = {layer["id"] for layer in client.get("/layers").json()}
    metric_keys = set(client.get("/areas").json()["features"][0]["properties"]["metrics"])
    assert layer_ids == metric_keys
