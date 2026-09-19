"""Cache the Purple Line alignment from OpenStreetMap.

Run explicitly; never at application startup.

    python -m scripts.fetch_transit

The line is still tagged route=construction in OSM. It is cached and served as an
alignment under construction, never as operating transit service.

ODbL: © OpenStreetMap contributors. https://www.openstreetmap.org/copyright
"""
import hashlib
import json
import time
from datetime import UTC, datetime
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/raw/osm"

# Montgomery/Prince George's corridor containing the whole alignment.
BBOX = (38.95, -77.15, 39.05, -76.88)
AREA = f'({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]})'
# Asking for relation tags and member geometry in one request times out on the public
# endpoint, so the two halves are requested separately and stitched together here.
RELATION_QUERY = f'[out:json][timeout:180];relation["name"~"Purple Line",i]{AREA};out tags;'
GEOMETRY_QUERY = f'[out:json][timeout:180];relation["name"~"Purple Line",i]{AREA};way(r);out geom;'
OVERPASS = "https://overpass-api.de/api/interpreter"


def run(client: httpx.Client, query: str, attempts: int = 3) -> dict:
    for attempt in range(1, attempts + 1):
        response = client.post(OVERPASS, data={"data": query})
        if response.status_code == 200:
            return response.json()
        if attempt == attempts:
            response.raise_for_status()
        print(f"  overpass returned {response.status_code}; retrying ({attempt}/{attempts - 1})")
        time.sleep(5 * attempt)
    raise RuntimeError("unreachable")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    retrieved_at = datetime.now(UTC).isoformat()
    with httpx.Client(timeout=200.0, follow_redirects=True,
                      headers={"User-Agent": "UrbanEye/0.1 (hackathon research)"}) as client:
        relation_payload = run(client, RELATION_QUERY)
        geometry_payload = run(client, GEOMETRY_QUERY)
    payload = {
        "relations": relation_payload.get("elements", []),
        "ways": geometry_payload.get("elements", []),
        "osm3s": relation_payload.get("osm3s", {}),
    }

    relations = payload["relations"]
    statuses = sorted({(el.get("tags") or {}).get("route", "unknown") for el in relations})
    source = {
        "url": OVERPASS,
        "queries": {"relations": RELATION_QUERY, "geometry": GEOMETRY_QUERY},
        "bbox": {"south": BBOX[0], "west": BBOX[1], "north": BBOX[2], "east": BBOX[3]},
        "retrieved_at": retrieved_at,
        "dataset": "OpenStreetMap Overpass API",
        "license": "ODbL",
        "attribution": "© OpenStreetMap contributors",
        "copyright_url": "https://www.openstreetmap.org/copyright",
        "route_values": statuses,
        "status_note": ("OSM tags these relations route=construction. Present the alignment as "
                        "under construction; it is not operating transit service and implies no "
                        "current transit access."),
        "relation_count": len(relations),
        "way_count": len(payload["ways"]),
    }
    raw_path = OUT / "purple_line.json"
    raw_path.write_text(json.dumps(payload, indent=2) + "\n")
    source["raw_sha256"] = hashlib.sha256(raw_path.read_bytes()).hexdigest()
    (OUT / "transit_source.json").write_text(json.dumps(source, indent=2) + "\n")
    names = [(el.get("tags") or {}).get("name") for el in relations]
    print(f"Cached {len(relations)} relation(s) and {len(payload['ways'])} way(s) "
          f"to {raw_path.relative_to(ROOT)}: {names}")
    print(f"route values: {statuses}")


if __name__ == "__main__":
    main()
