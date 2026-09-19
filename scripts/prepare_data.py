"""Deterministically normalize the cached official Census response. Run from repo root."""
import hashlib
import json
from pathlib import Path

from backend.schemas import Area, Areas, Evidence, Feature, Geometry

ROOT = Path(__file__).resolve().parents[1]

METRIC_FIELDS = [("population", "POP100", "people"), ("housing_units", "HU100", "units")]

# Whole 2020 block groups intersecting the Fenton Village (FV) Overlay Zone.
FENTON_VILLAGE_BLOCK_GROUPS = {"240317024022", "240317024023", "240317025021"}


def tract_label(props):
    """TIGER stores a 6-digit tract code; census tracts are published as 7025.02."""
    tract = str(props["TRACT"]).zfill(6)
    base, suffix = tract[:4].lstrip("0"), tract[4:]
    return base if suffix == "00" else f"{base}.{suffix}"


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

    # Fenton Village study area. These are whole block groups selected by intersecting
    # the adopted FV Overlay Zone, not a clip of the district boundary; see
    # data/raw/fenton_village_source.json for the selection method and overlap shares.
    bg_path = ROOT / "data/raw/fenton_village_blockgroups_census2020.geojson"
    bg_source = json.loads((ROOT / "data/raw/fenton_village_source.json").read_text())
    bg_raw = json.loads(bg_path.read_text())
    if bg_raw.get("exceededTransferLimit"):
        raise ValueError("Incomplete block group response")
    if {str(f["properties"]["GEOID"]) for f in bg_raw["features"]} != FENTON_VILLAGE_BLOCK_GROUPS:
        raise ValueError("Unexpected Fenton Village block group IDs")
    for feature in sorted(bg_raw["features"], key=lambda f: f["properties"]["GEOID"]):
        props = feature["properties"]
        # TIGER names every block group "Block Group 1"; qualify it so the map and
        # evidence panel cannot show two areas with the same label.
        name = f"Block Group {props['BLKGRP']}, Census Tract {tract_label(props)}"
        features.append(build_feature(props, feature["geometry"], bg_source, "block_group", name))

    boundary_path = ROOT / "data/raw/fenton_village_overlay.geojson"
    boundary_source = json.loads((ROOT / "data/raw/fenton_village_boundary_source.json").read_text())

    output = ROOT / "data/processed"
    output.mkdir(parents=True, exist_ok=True)
    (output / "areas.geojson").write_text(Areas(features=features).model_dump_json(indent=2) + "\n")
    (output / "manifest.json").write_text(json.dumps({
        **source, "schema_version": "1.0", "raw_sha256": hashlib.sha256(raw_path.read_bytes()).hexdigest(),
        "geography_scope": "Silver Spring CDP, Maryland; not Fenton Village",
        "fields": {"population": "POP100", "housing_units": "HU100"},
        "transform": "scripts/prepare_data.py; no boundary simplification; negative counts become null",
        "fenton_village_study_boundary": {
            **boundary_source, "raw_sha256": hashlib.sha256(boundary_path.read_bytes()).hexdigest(),
            "published_as_an_area": "No. The study boundary selects block groups; it carries no counts "
                                    "and is not served by /areas.",
        },
        "fenton_village_block_groups": {
            **bg_source, "raw_sha256": hashlib.sha256(bg_path.read_bytes()).hexdigest(),
            "geography_scope": "Whole 2020 block groups intersecting the Fenton Village (FV) Overlay Zone; "
                               "counts describe each block group, not the study boundary",
            "contains_cdp_overlap": "These block groups lie inside the Silver Spring CDP polygon. "
                                    "Never add their counts to the CDP totals.",
        },
    }, indent=2) + "\n")
    levels = {f.properties.geography_type for f in features}
    print(f"Validated {len(features)} real area(s) across {len(levels)} geographic level(s), "
          "two sourced metrics each.")


if __name__ == "__main__":
    prepare()
