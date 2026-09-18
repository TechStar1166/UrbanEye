"""Load and validate the committed snapshot; no network calls during startup."""
import json
from pathlib import Path

from backend.schemas import Areas, Evidence, Layer

ROOT = Path(__file__).resolve().parents[1]


def load_areas() -> Areas:
    return Areas.model_validate_json((ROOT / "data/processed/areas.geojson").read_text())


def load_chunks() -> list[Evidence]:
    chunks = [Evidence.model_validate(c) for c in json.loads(
        (ROOT / "documents/processed/chunks.json").read_text())]
    if any(c.type != "document" for c in chunks):
        raise ValueError("The document corpus may only contain document evidence")
    if len({c.evidence_id for c in chunks}) != len(chunks):
        raise ValueError("Duplicate chunk IDs")
    return chunks


LAYERS = [
    Layer(id="population", label="Population", unit="people",
          description="2020 Census total population (POP100); whole selected area."),
    Layer(id="housing_units", label="Housing units", unit="units",
          description="2020 Census housing units (HU100); not households or available homes."),
]
