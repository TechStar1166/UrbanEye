"""Load and validate the committed snapshot; no network calls during startup."""
import hashlib
import json
from pathlib import Path

from backend.schemas import Areas, Evidence, Layer, Storefront, Storefronts

ROOT = Path(__file__).resolve().parents[1]


def load_areas() -> Areas:
    return Areas.model_validate_json((ROOT / "data/processed/areas.geojson").read_text())


def load_chunks() -> list[Evidence]:
    path = ROOT / "documents/processed/chunks.json"
    raw = path.read_bytes()
    manifest = json.loads((path.parent / "manifest.json").read_text())
    if hashlib.sha256(raw).hexdigest() != manifest["chunks_sha256"]:
        raise ValueError("Document chunks differ from their ingestion manifest; rebuild and review")
    chunks = [Evidence.model_validate(c) for c in json.loads(raw)]
    if any(c.type != "document" for c in chunks):
        raise ValueError("The document corpus may only contain document evidence")
    if len({c.evidence_id for c in chunks}) != len(chunks):
        raise ValueError("Duplicate chunk IDs")
    return chunks


def load_storefronts(area_ids: set[str]) -> Storefronts:
    """Committed OpenStreetMap snapshot; verified against its manifest, no network calls."""
    manifest = json.loads((ROOT / "data/processed/storefronts_manifest.json").read_text())
    raw = (ROOT / manifest["raw_file"]).read_bytes()
    if hashlib.sha256(raw).hexdigest() != manifest["raw_sha256"]:
        raise ValueError("Storefront raw data differs from its manifest; rebuild and review")
    collection = json.loads((ROOT / "data/processed/storefronts.geojson").read_text())
    items = []
    for feature in collection["features"]:
        lon, lat = feature["geometry"]["coordinates"]
        items.append(Storefront(lon=lon, lat=lat, **feature["properties"]))
    if len({i.osm_id for i in items}) != len(items):
        raise ValueError("Duplicate storefront IDs")
    if any(i.block_group_id is not None and i.block_group_id not in area_ids for i in items):
        raise ValueError("Storefront references an unknown block group")
    return Storefronts(source=manifest["dataset"], license=manifest["license"], attribution=manifest["attribution"],
                       retrieved_at=manifest["retrieved_at"], osm_data_timestamp=manifest["osm_data_timestamp"],
                       limitations=manifest["limitations"], storefronts=items)


LAYERS = [
    Layer(id="population", label="Population", unit="people",
          description="2020 Census total population (POP100); whole selected area."),
    Layer(id="housing_units", label="Housing units", unit="units",
          description="2020 Census housing units (HU100); not households or available homes."),
]
