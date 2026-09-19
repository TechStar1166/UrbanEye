"""Storefront points for the Fenton Village study geography, from OpenStreetMap. Run from repo root.

    python -m scripts.prepare_storefronts            # rebuild from the cached raw response (no network)
    python -m scripts.prepare_storefronts --refresh  # download once from Overpass, then rebuild

The application never downloads at startup; this snapshot is committed like the Census data.
Data (c) OpenStreetMap contributors, ODbL 1.0. Volunteer-mapped: incomplete, possibly stale,
and not an official business registry.
"""
import argparse
import hashlib
import json
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/raw/storefronts_overpass.json"
SOURCE = ROOT / "data/raw/storefronts_source.json"
AREAS = ROOT / "data/processed/areas.geojson"
OUT = ROOT / "data/processed/storefronts.geojson"
MANIFEST = ROOT / "data/processed/storefronts_manifest.json"

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
USER_AGENT = "UrbanEye-BayHacks-2026/0.1 (hackathon data snapshot)"
PAD_DEGREES = 0.002  # about 200 m of context around the block groups
AMENITIES = ["restaurant", "cafe", "fast_food", "bar", "pub", "pharmacy", "bank", "ice_cream", "food_court"]


def ring_points(geometry):
    polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
    return [point for polygon in polygons for ring in polygon for point in ring]


def study_area_ids_and_geometries(areas: dict) -> list[tuple[str, dict]]:
    return [(f["properties"]["geo_id"], f["geometry"]) for f in areas["features"]
            if f["properties"]["geography_type"] == "block_group"]


def bounding_box(areas: dict) -> tuple[float, float, float, float]:
    """(south, west, north, east) of the block groups, padded. Deterministic from areas.geojson."""
    points = [p for _, geometry in study_area_ids_and_geometries(areas) for p in ring_points(geometry)]
    if not points:
        raise ValueError("No block groups found in areas.geojson")
    lons, lats = [p[0] for p in points], [p[1] for p in points]
    return (round(min(lats) - PAD_DEGREES, 6), round(min(lons) - PAD_DEGREES, 6),
            round(max(lats) + PAD_DEGREES, 6), round(max(lons) + PAD_DEGREES, 6))


def overpass_query(bbox: tuple[float, float, float, float]) -> str:
    box = ",".join(str(v) for v in bbox)
    amenity = "|".join(AMENITIES)
    return (f'[out:json][timeout:60];\n(\n  nwr["shop"]({box});\n'
            f'  nwr["amenity"~"^({amenity})$"]({box});\n);\nout center tags;\n')


def in_ring(lon: float, lat: float, ring: list) -> bool:
    inside = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def in_geometry(lon: float, lat: float, geometry: dict) -> bool:
    """Ray casting; the first ring of each polygon is the outer boundary, the rest are holes."""
    polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
    return any(in_ring(lon, lat, [tuple(p[:2]) for p in polygon[0]])
               and not any(in_ring(lon, lat, [tuple(p[:2]) for p in hole]) for hole in polygon[1:])
               for polygon in polygons)


def address(tags: dict) -> str | None:
    parts = [tags.get("addr:housenumber"), tags.get("addr:street")]
    return " ".join(p for p in parts if p) or None


def build(raw: dict, areas: dict) -> tuple[dict, dict]:
    """Named storefronts as GeoJSON points, tagged with the block group they fall in. Pure function."""
    zones = study_area_ids_and_geometries(areas)
    features, unnamed = [], 0
    for element in raw["elements"]:
        tags = element.get("tags", {})
        if not tags.get("name"):
            unnamed += 1
            continue
        point = (element.get("lon"), element.get("lat")) if "lon" in element else (
            element["center"]["lon"], element["center"]["lat"])
        key = "shop" if "shop" in tags else "amenity"
        block_group = next((geo_id for geo_id, geometry in zones if in_geometry(point[0], point[1], geometry)), None)
        features.append({"type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(point[0], 6), round(point[1], 6)]},
            "properties": {"osm_id": f"{element['type']}/{element['id']}", "name": tags["name"],
                           "category_key": key, "category": tags[key], "address": address(tags),
                           "block_group_id": block_group}})
    features.sort(key=lambda f: f["properties"]["osm_id"])
    stats = {"raw_features": len(raw["elements"]), "named_features": len(features), "dropped_unnamed": unnamed,
             "inside_block_groups": sum(1 for f in features if f["properties"]["block_group_id"]),
             "by_block_group": dict(sorted(Counter(f["properties"]["block_group_id"] for f in features
                                                   if f["properties"]["block_group_id"]).items())),
             "by_category": dict(Counter(f"{f['properties']['category_key']}={f['properties']['category']}"
                                         for f in features).most_common())}
    return {"type": "FeatureCollection", "features": features}, stats


def refresh(areas: dict):
    bbox = bounding_box(areas)
    query = overpass_query(bbox)
    request = urllib.request.Request(OVERPASS_URL, data=urllib.parse.urlencode({"data": query}).encode(),
                                     headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=90) as response:
        body = response.read()
    parsed = json.loads(body)
    if "elements" not in parsed:
        raise ValueError("Unexpected Overpass response")
    RAW.write_bytes(body)
    SOURCE.write_text(json.dumps({
        "dataset": "OpenStreetMap via the Overpass API", "endpoint": OVERPASS_URL, "query": query,
        "bbox_south_west_north_east": bbox, "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "osm_data_timestamp": parsed.get("osm3s", {}).get("timestamp_osm_base"),
        "license": "ODbL 1.0", "attribution": "(c) OpenStreetMap contributors"}, indent=2) + "\n")


def prepare():
    areas = json.loads(AREAS.read_text())
    source = json.loads(SOURCE.read_text())
    raw_bytes = RAW.read_bytes()
    collection, stats = build(json.loads(raw_bytes), areas)
    OUT.write_text(json.dumps(collection, indent=1) + "\n")
    MANIFEST.write_text(json.dumps({
        "dataset": source["dataset"], "license": source["license"], "attribution": source["attribution"],
        "query": source["query"], "bbox_south_west_north_east": source["bbox_south_west_north_east"],
        "retrieved_at": source["retrieved_at"], "osm_data_timestamp": source["osm_data_timestamp"],
        "raw_file": "data/raw/storefronts_overpass.json", "raw_sha256": hashlib.sha256(raw_bytes).hexdigest(),
        "transform": "scripts/prepare_storefronts.py; named features only; point = node position or way/relation "
                     "center; block_group_id from point-in-polygon against areas.geojson block groups, null if outside",
        "counts": stats,
        "limitations": "Volunteer-mapped OpenStreetMap data: incomplete, possibly out of date, inconsistently "
                       "categorized, and not an official business registry. Counts describe mapped features, "
                       "not all businesses. Do not compare with the challenge brief's 240+ figure."},
        indent=2) + "\n")
    print(f"{stats['named_features']} named storefronts ({stats['inside_block_groups']} inside the block groups)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--refresh", action="store_true", help="download a fresh Overpass snapshot first")
    args = parser.parse_args()
    if args.refresh:
        refresh(json.loads(AREAS.read_text()))
    prepare()
