"""Cache OpenStreetMap storefronts for the Fenton Village study bbox.

Run explicitly; never at application startup.

    python -m scripts.fetch_osm

ODbL: © OpenStreetMap contributors. https://www.openstreetmap.org/copyright
"""
import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/raw/osm"

# Slightly padded Fenton Village (FV) Overlay Zone envelope (south, west, north, east).
BBOX = (38.9889, -77.0267, 38.9959, -77.0229)
QUERY = f"""[out:json][timeout:60];
(
  node["shop"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["shop"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  node["office"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["office"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  node["amenity"~"restaurant|cafe|bar|pub|fast_food|bank|pharmacy|clinic|dentist|marketplace"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["amenity"~"restaurant|cafe|bar|pub|fast_food|bank|pharmacy|clinic|dentist|marketplace"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
);
out center tags;
"""
OVERPASS = "https://overpass-api.de/api/interpreter"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    retrieved_at = datetime.now(UTC).isoformat()
    with httpx.Client(timeout=90.0, follow_redirects=True,
                      headers={"User-Agent": "UrbanEye/0.1 (hackathon research)"}) as client:
        response = client.post(OVERPASS, data={"data": QUERY})
        response.raise_for_status()
        payload = response.json()
    source = {
        "url": OVERPASS,
        "query": QUERY,
        "bbox": {"south": BBOX[0], "west": BBOX[1], "north": BBOX[2], "east": BBOX[3]},
        "retrieved_at": retrieved_at,
        "dataset": "OpenStreetMap Overpass API",
        "license": "ODbL",
        "attribution": "© OpenStreetMap contributors",
        "copyright_url": "https://www.openstreetmap.org/copyright",
        "note": "Crowd-sourced mapped storefronts, not a complete census of businesses.",
        "element_count": len(payload.get("elements", [])),
    }
    pois_path = OUT / "fenton_village_pois.json"
    source_path = OUT / "source.json"
    pois_path.write_text(json.dumps(payload, indent=2) + "\n")
    source["raw_sha256"] = hashlib.sha256(pois_path.read_bytes()).hexdigest()
    source_path.write_text(json.dumps(source, indent=2) + "\n")
    print(f"Cached {source['element_count']} OSM elements to {pois_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
