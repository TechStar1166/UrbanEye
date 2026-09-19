"""Deterministically normalize the cached official Census response. Run from repo root."""
import hashlib
import json
from pathlib import Path

from backend.schemas import Area, Areas, Evidence, Feature, Geometry

ROOT = Path(__file__).resolve().parents[1]

METRIC_FIELDS = [("population", "POP100", "people"), ("housing_units", "HU100", "units")]


def tract_label(props: dict) -> str:
    """Format a 6-digit TIGER TRACT code as a human-readable label (e.g. '702501' → '7025.01')."""
    raw = str(props["TRACT"])
    if len(raw) == 6:
        return f"{raw[:4]}.{raw[4:]}"
    return raw

def build_feature(props, geometry, source, geography_type, name):
    """One validated feature. Counts always describe the whole unit, never a clipped area."""
    geo_id = str(props["GEOID"])
    metrics, evidence = {}, []
    for metric, field, unit in METRIC_FIELDS:
        value = props.get(field)
        # Null stays null; negative Census sentinels are missing, never zero.
        value = None if value is None or float(value) < 0 else float(value)
        metrics[metric] = value
        evidence.append(Evidence(
            evidence_id=f"census2020:{geo_id}:{metric}", type="structured_data",
            title=f"2020 Census {field} — {name}", source=source["dataset"],
            url=source["url"], date=source["data_date"], geo_id=geo_id,
            metric=metric, value=value, unit=unit,
            retrieved_at=source.get("retrieved_at") or source.get("downloaded_at"),
        ))
        
    # Derived rate metric: population density (people per sq mile)
    pop = props.get("POP100")
    arealand = props.get("AREALAND")
    if pop is not None and arealand and float(arealand) > 0:
        sq_mi = float(arealand) / 2589988.11
        density = round(float(pop) / sq_mi, 1)
        metrics["population_density"] = density
        evidence.append(Evidence(
            evidence_id=f"census2020:{geo_id}:population_density", type="structured_data",
            title=f"2020 Census Derived Density — {name}", source=source["dataset"],
            url=source["url"], date=source["data_date"], geo_id=geo_id,
            metric="population_density", value=density, unit="people per sq mi",
            retrieved_at=source.get("retrieved_at") or source.get("downloaded_at"),
        ))

    return Feature(id=geo_id, geometry=Geometry.model_validate(geometry),
        properties=Area(geo_id=geo_id, name=name, geography_type=geography_type,
            boundary_vintage=source["boundary_vintage"], metrics=metrics, evidence=evidence))


def prepare():
    raw_path = ROOT / "data/raw/silver_spring_census2020.geojson"
    source = json.loads((ROOT / "data/raw/source.json").read_text())
    raw = json.loads(raw_path.read_text())
    if raw.get("exceededTransferLimit") or len(raw.get("features", [])) != 1:
        raise ValueError("Expected exactly one complete Silver Spring CDP feature")
    features = []
    for feature in raw["features"]:
        props = feature["properties"]
        if str(props["GEOID"]) != "2472450":
            raise ValueError("Unexpected geographic ID")
        features.append(build_feature(props, feature["geometry"], source,
                                      "census_designated_place", props["NAME"]))

    # Complete intersecting block-group snapshot; retain full geometries and counts.
    # The raw source manifest records the exact spatial query and returned IDs.
    bg_path = ROOT / "data/raw/silver_spring_blockgroups_census2020.geojson"
    bg_source = json.loads((ROOT / "data/raw/silver_spring_blockgroups_source.json").read_text())
    bg_raw = json.loads(bg_path.read_text())
    expected = set(bg_source["geoids"])
    if bg_raw.get("exceededTransferLimit"):
        raise ValueError("Incomplete block group response")
    if {str(f["properties"]["GEOID"]) for f in bg_raw["features"]} != expected:
        raise ValueError("Unexpected Silver Spring block group IDs")
    for feature in bg_raw["features"]:
        props = feature["properties"]
        # TIGER names every block group "Block Group 1"; qualify it so the map and
        # evidence panel cannot show two areas with the same label.
        name = f"Block Group {props['BLKGRP']}, Census Tract {tract_label(props)}"
        features.append(build_feature(props, feature["geometry"], bg_source, "block_group", name))

    output = ROOT / "data/processed"
    output.mkdir(parents=True, exist_ok=True)
    (output / "areas.geojson").write_text(Areas(features=features).model_dump_json(indent=2) + "\n")
    (output / "manifest.json").write_text(json.dumps({
        **source, "schema_version": "1.0", "raw_sha256": hashlib.sha256(raw_path.read_bytes()).hexdigest(),
        "geography_scope": "Silver Spring CDP, Maryland; not Fenton Village",
        "fields": {"population": "POP100", "housing_units": "HU100"},
        "transform": "scripts/prepare_data.py; no boundary simplification; negative counts become null",
        "silver_spring_block_groups": {
            **bg_source, "raw_sha256": hashlib.sha256(bg_path.read_bytes()).hexdigest(),
            "geography_scope": "Whole 2020 block groups intersecting the Silver Spring CDP; "
                               "counts describe each block group, not the district boundary",
            "contains_cdp_overlap": "Groups can cross or touch the CDP boundary. "
                                    "Never add their counts to the CDP totals.",
        },
    }, indent=2) + "\n")
    from scripts.prepare_map_context import build
    build()
    levels = {f.properties.geography_type for f in features}
    print(f"Validated {len(features)} real area(s) across {len(levels)} geographic level(s), "
          "two sourced metrics each.")

if __name__ == "__main__":
    prepare()
