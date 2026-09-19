import hashlib
import json

from scripts import prepare_storefronts as ps

AREAS = json.loads(ps.AREAS.read_text())


def square(x0, y0, x1, y1):
    return {"type": "Polygon", "coordinates": [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]]}


def one_zone(geo_id="bg1", geometry=None):
    return {"features": [{"properties": {"geo_id": geo_id, "geography_type": "block_group"},
                          "geometry": geometry or square(0, 0, 10, 10)}]}


def test_point_in_polygon_respects_outer_ring_and_holes():
    donut = {"type": "Polygon", "coordinates": [square(0, 0, 10, 10)["coordinates"][0], [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]]}
    assert ps.in_geometry(1, 1, donut)
    assert not ps.in_geometry(5, 5, donut)      # inside the hole
    assert not ps.in_geometry(11, 1, donut)     # outside


def test_point_in_multipolygon():
    multi = {"type": "MultiPolygon", "coordinates": [square(0, 0, 1, 1)["coordinates"], square(5, 5, 6, 6)["coordinates"]]}
    assert ps.in_geometry(5.5, 5.5, multi)
    assert not ps.in_geometry(3, 3, multi)


def test_build_drops_unnamed_tags_block_group_and_reads_way_centers():
    raw = {"elements": [
        {"type": "node", "id": 1, "lon": 1, "lat": 1, "tags": {"name": "A", "shop": "books", "addr:housenumber": "5", "addr:street": "Main St"}},
        {"type": "way", "id": 2, "center": {"lon": 50, "lat": 50}, "tags": {"name": "B", "amenity": "cafe"}},
        {"type": "node", "id": 3, "lon": 1, "lat": 1, "tags": {"shop": "books"}},
    ]}
    collection, stats = ps.build(raw, one_zone())
    by_name = {f["properties"]["name"]: f["properties"] for f in collection["features"]}
    assert set(by_name) == {"A", "B"}
    assert by_name["A"]["block_group_id"] == "bg1" and by_name["A"]["address"] == "5 Main St"
    assert by_name["B"]["block_group_id"] is None and by_name["B"]["address"] is None
    assert by_name["B"]["category_key"] == "amenity" and by_name["B"]["category"] == "cafe"
    assert (stats["raw_features"], stats["named_features"], stats["dropped_unnamed"], stats["inside_block_groups"]) == (3, 2, 1, 1)


def test_build_is_order_independent():
    elements = [{"type": "node", "id": i, "lon": i, "lat": i, "tags": {"name": f"S{i}", "shop": "books"}} for i in range(5)]
    forward, _ = ps.build({"elements": elements}, one_zone())
    backward, _ = ps.build({"elements": elements[::-1]}, one_zone())
    assert forward == backward


def test_bounding_box_covers_block_groups_with_padding():
    south, west, north, east = ps.bounding_box(one_zone(geometry=square(-77.03, 38.98, -77.02, 38.99)))
    assert (south, west) == (round(38.98 - ps.PAD_DEGREES, 6), round(-77.03 - ps.PAD_DEGREES, 6))
    assert (north, east) == (round(38.99 + ps.PAD_DEGREES, 6), round(-77.02 + ps.PAD_DEGREES, 6))


def test_committed_snapshot_rebuilds_identically_and_matches_manifest():
    raw_bytes = ps.RAW.read_bytes()
    collection, stats = ps.build(json.loads(raw_bytes), ps.load_study_areas())
    assert json.loads(ps.OUT.read_text()) == collection
    manifest = json.loads(ps.MANIFEST.read_text())
    assert manifest["raw_sha256"] == hashlib.sha256(raw_bytes).hexdigest()
    assert manifest["counts"] == stats
    assert manifest["license"] == "ODbL 1.0" and "OpenStreetMap" in manifest["attribution"]
    assert "not an official business registry" in manifest["limitations"]


def test_committed_snapshot_invariants():
    collection = json.loads(ps.OUT.read_text())
    south, west, north, east = json.loads(ps.SOURCE.read_text())["bbox_south_west_north_east"]
    block_groups = {f["properties"]["geo_id"] for f in AREAS["features"] if f["properties"]["geography_type"] == "block_group"}
    ids = [f["properties"]["osm_id"] for f in collection["features"]]
    assert ids and len(ids) == len(set(ids))
    for feature in collection["features"]:
        lon, lat = feature["geometry"]["coordinates"]
        assert south <= lat <= north and west <= lon <= east
        assert feature["properties"]["name"]
        assert feature["properties"]["block_group_id"] in block_groups | {None}


def test_storefront_scope_stays_fenton_when_census_coverage_expands():
    study = ps.load_study_areas()
    assert len(AREAS["features"]) > len(study["features"])
    assert {f["properties"]["geo_id"] for f in study["features"]} == ps.STUDY_AREA_IDS
    source = json.loads(ps.SOURCE.read_text())
    assert list(ps.bounding_box(study)) == source["bbox_south_west_north_east"]


def test_frontend_storefront_coverage_matches_the_snapshot_scope():
    import re
    source = (ps.ROOT / "frontend/src/lib/storefronts.ts").read_text()
    listed = re.search(r"STOREFRONT_STUDY_AREAS = \[([^\]]*)\]", source).group(1)
    assert set(re.findall(r"'(\d+)'", listed)) == ps.STUDY_AREA_IDS
