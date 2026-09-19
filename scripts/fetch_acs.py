"""Cache American Community Survey rows for the study geographies.

Run explicitly; never at application startup. The Census table-based summary files
are national and ~17 MB each, so rows are filtered while streaming and only the
handful we use is written to disk.

    python -m scripts.fetch_acs

Keyless. Files for 2018-2020 live under `prototype/`; 2021 onward under
`table-based-SF/`. That is the full keyless range, verified 2026-09-19.
"""
import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/raw/acs"

# Summary-level prefixes are part of the ACS GEO_ID and identify the geography type.
GEOGRAPHIES = {
    "1600000US2472450": "Silver Spring CDP",
    "1500000US240317024022": "Block Group 2, Census Tract 7024.02",
    "1500000US240317024023": "Block Group 3, Census Tract 7024.02",
    "1500000US240317025021": "Block Group 1, Census Tract 7025.02",
    "0500000US24031": "Montgomery County, Maryland",
    "0400000US24": "Maryland",
    "1600000US2407125": "Bethesda CDP",
    "1600000US2467675": "Rockville city",
    "1600000US2431175": "Gaithersburg city",
    "1600000US2432025": "Germantown CDP",
}

TABLES = ["b19013", "b19301", "b25003", "b17001", "b01002",
          # b01001 is fetched to derive an age 50+ share; b19083 (Gini) is published for
          # places and larger only, so block groups are simply absent from that file.
          "b01001", "b25010", "b19083"]

# The standard 1-year release was never published for 2020; Census replaced it with
# experimental estimates that are not comparable, so the year is simply absent.
ONE_YEAR_YEARS = [2018, 2019, 2021, 2022, 2023, 2024]
FIVE_YEAR_YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024]


def url_for(year: int, table: str, span: int) -> str:
    base = "https://www2.census.gov/programs-surveys/acs/summary_file"
    folder = f"{span}YRData"
    stem = f"acsdt{span}y{year}-{table}.dat"
    if year <= 2020:
        return f"{base}/{year}/prototype/{folder}/{stem}"
    return f"{base}/{year}/table-based-SF/data/{folder}/{stem}"


def fetch_table(client: httpx.Client, year: int, table: str, span: int) -> dict | None:
    """Stream one national file, keeping only the study geographies."""
    url = url_for(year, table, span)
    header, rows = None, {}
    with client.stream("GET", url) as response:
        if response.status_code != 200:
            return None
        for line in response.iter_lines():
            if header is None:
                header = line.rstrip("\n").split("|")
                continue
            geo_id = line.split("|", 1)[0]
            if geo_id in GEOGRAPHIES:
                rows[geo_id] = line.rstrip("\n").split("|")
    if not rows:
        return None
    return {"url": url, "columns": header, "rows": rows}


def main():
    import sys
    refresh = "--refresh" in sys.argv
    OUT.mkdir(parents=True, exist_ok=True)
    retrieved_at = datetime.now(UTC).isoformat()
    manifest = {
        "retrieved_at": retrieved_at,
        "dataset": "U.S. Census Bureau, American Community Survey",
        "license": "Public domain (U.S. Government work)",
        "note": ("Filtered from the national table-based summary files. Estimates carry a margin "
                 "of error at the 90% confidence level. 5-year periods overlap and consecutive "
                 "vintages must not be compared; 1-year estimates are independent samples."),
        "geographies": GEOGRAPHIES,
        "files": {},
    }

    with httpx.Client(timeout=120.0, follow_redirects=True) as client:
        for span, years in ((1, ONE_YEAR_YEARS), (5, FIVE_YEAR_YEARS)):
            for year in years:
                for table in TABLES:
                    name = f"acs{span}y{year}_{table}.json"
                    if (OUT / name).exists() and not refresh:
                        existing = json.loads((OUT / name).read_text())
                        manifest["files"][name] = {
                            "url": existing.get("url"),
                            "sha256": hashlib.sha256((OUT / name).read_bytes()).hexdigest(),
                            "geographies": len(existing.get("rows", {})),
                            "cached": True,
                        }
                        print(f"  keep {name}")
                        continue
                    result = fetch_table(client, year, table, span)
                    if result is None:
                        print(f"  skip {name} (unavailable or no matching geographies)")
                        continue
                    payload = {
                        "span": span, "year": year, "table": table.upper(),
                        "period": f"{year - span + 1}-{year}",
                        "url": result["url"], "retrieved_at": retrieved_at,
                        "columns": result["columns"], "rows": result["rows"],
                    }
                    text = json.dumps(payload, indent=2, sort_keys=True) + "\n"
                    (OUT / name).write_text(text)
                    manifest["files"][name] = {
                        "url": result["url"],
                        "sha256": hashlib.sha256(text.encode()).hexdigest(),
                        "geographies": len(result["rows"]),
                    }
                    print(f"  {name}: {len(result['rows'])} geographies")

    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"\nCached {len(manifest['files'])} ACS table-years to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
