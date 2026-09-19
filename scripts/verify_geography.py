"""Re-derive the Fenton Village block group selection from the cached boundaries.

Not part of the build or the application: `scripts/prepare_data.py` must stay
dependency-free and deterministic. Run this when the study boundary or the block
group vintage changes, then update data/raw/fenton_village_source.json.

    python -m pip install shapely
    python -m scripts.verify_geography
"""
import json
from pathlib import Path

from shapely.geometry import shape

from scripts.prepare_data import FENTON_VILLAGE_BLOCK_GROUPS

ROOT = Path(__file__).resolve().parents[1]


def verify():
    boundary = shape(json.loads(
        (ROOT / "data/raw/fenton_village_overlay.geojson").read_text())["features"][0]["geometry"])
    block_groups = json.loads(
        (ROOT / "data/raw/fenton_village_blockgroups_census2020.geojson").read_text())["features"]

    selected, covered = set(), 0.0
    for feature in block_groups:
        geo_id = str(feature["properties"]["GEOID"])
        polygon = shape(feature["geometry"])
        overlap = polygon.intersection(boundary).area
        if overlap <= 0:
            print(f"{geo_id}: does NOT intersect the study boundary")
            continue
        selected.add(geo_id)
        covered += overlap
        print(f"{geo_id}: {100 * overlap / boundary.area:5.1f}% of the study area, "
              f"{100 * overlap / polygon.area:5.1f}% of the block group")

    if selected != FENTON_VILLAGE_BLOCK_GROUPS:
        raise ValueError(f"Cached block groups {selected} do not match the expected selection")
    print(f"{len(selected)} block groups cover {100 * covered / boundary.area:.1f}% of the study area. "
          "Counts describe whole block groups, never the study area.")


if __name__ == "__main__":
    verify()
