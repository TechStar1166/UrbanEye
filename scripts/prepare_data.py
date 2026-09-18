"""Deterministically normalize the cached official Census response. Run from repo root."""
import hashlib
import json
from pathlib import Path

from backend.schemas import Area, Areas, Evidence, Feature, Geometry

ROOT = Path(__file__).resolve().parents[1]


def prepare():
    raw_path = ROOT / "data/raw/silver_spring_census2020.geojson"
    source = json.loads((ROOT / "data/raw/source.json").read_text())
    raw = json.loads(raw_path.read_text())
    if raw.get("exceededTransferLimit") or len(raw.get("features", [])) != 1:
        raise ValueError("Expected exactly one complete Silver Spring CDP feature")
    features = []
    for feature in raw["features"]:
        props = feature["properties"]
        geo_id = str(props["GEOID"])
        if geo_id != "2472450":
            raise ValueError("Unexpected geographic ID")
        metrics, evidence = {}, []
        for metric, field, unit in [("population", "POP100", "people"),
                                    ("housing_units", "HU100", "units")]:
            value = props.get(field)
            # Null stays null; negative Census sentinels are missing, never zero.
            value = None if value is None or float(value) < 0 else float(value)
            metrics[metric] = value
            evidence.append(Evidence(
                evidence_id=f"census2020:{geo_id}:{metric}", type="structured_data",
                title=f"2020 Census {field} — {props['NAME']}", source=source["dataset"],
                url=source["url"], date=source["data_date"], geo_id=geo_id,
                metric=metric, value=value, unit=unit,
            ))
        features.append(Feature(id=geo_id, geometry=Geometry.model_validate(feature["geometry"]),
            properties=Area(geo_id=geo_id, name=props["NAME"], geography_type="census_designated_place",
                boundary_vintage=source["boundary_vintage"], metrics=metrics, evidence=evidence)))
    output = ROOT / "data/processed"
    output.mkdir(parents=True, exist_ok=True)
    (output / "areas.geojson").write_text(Areas(features=features).model_dump_json(indent=2) + "\n")
    (output / "manifest.json").write_text(json.dumps({
        **source, "schema_version": "1.0", "raw_sha256": hashlib.sha256(raw_path.read_bytes()).hexdigest(),
        "geography_scope": "Silver Spring CDP, Maryland; not Fenton Village",
        "fields": {"population": "POP100", "housing_units": "HU100"},
        "transform": "scripts/prepare_data.py; no boundary simplification; negative counts become null",
    }, indent=2) + "\n")
    print(f"Validated {len(features)} real area(s), two sourced metrics each.")


if __name__ == "__main__":
    prepare()
