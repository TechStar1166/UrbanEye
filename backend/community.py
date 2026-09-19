"""SQLite-backed community history, comparison and storefront queries. Offline."""
from __future__ import annotations

import sqlite3
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data/urbaneye.db"

PLACE_TYPES = {"census_designated_place", "county", "state"}


def connect() -> sqlite3.Connection:
    if not DB_PATH.exists():
        raise FileNotFoundError("data/urbaneye.db is missing; run python -m scripts.build_community_db")
    db = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    return db


@lru_cache(maxsize=1)
def available() -> bool:
    return DB_PATH.exists()


def geography(db: sqlite3.Connection, geo_id: str) -> sqlite3.Row | None:
    return db.execute("SELECT * FROM geographies WHERE geo_id=?", (geo_id,)).fetchone()


def default_span(geography_type: str) -> int:
    return 1 if geography_type in PLACE_TYPES else 5


def history(geo_id: str, metric: str, span: int | None = None) -> dict | None:
    db = connect()
    try:
        area = geography(db, geo_id)
        if area is None:
            return None
        used_span = span or default_span(area["geography_type"])
        rows = db.execute(
            """SELECT year, period, estimate, moe, estimate_2024_usd, moe_2024_usd,
                      unit, low_reliability, source_id
               FROM time_series
               WHERE geo_id=? AND metric=? AND span=?
               ORDER BY year""",
            (geo_id, metric, used_span),
        ).fetchall()
        source = None
        if rows:
            source = db.execute("SELECT * FROM sources WHERE id=?", (rows[-1]["source_id"],)).fetchone()
        limitations = [
            "ACS estimates include a 90% margin of error; a large MOE means the point estimate is uncertain.",
            "Dollar figures are also provided in 2024 dollars using CPI-U so years can be compared.",
        ]
        if used_span == 5:
            limitations.append(
                "ACS 5-year vintages overlap by four years. Do not read consecutive 5-year values as a year-to-year change."
            )
        if used_span == 1:
            limitations.append("There is no 2020 ACS 1-year estimate; Census did not publish a comparable 1-year file.")
        if area["geography_type"] == "block_group":
            limitations.append(
                "Block-group counts describe the whole block group, not the Fenton Village overlay."
            )
        series = [{
            "year": row["year"],
            "period": row["period"],
            "estimate": row["estimate"],
            "moe": row["moe"],
            "estimate_2024_usd": row["estimate_2024_usd"],
            "moe_2024_usd": row["moe_2024_usd"],
            "unit": row["unit"],
            "low_reliability": bool(row["low_reliability"]),
        } for row in rows]
        return {
            "schema_version": "1.0",
            "geo_id": geo_id,
            "name": area["name"],
            "geography_type": area["geography_type"],
            "zcta": area["zcta"],
            "metric": metric,
            "span": used_span,
            "source": None if source is None else {
                "dataset": source["dataset"],
                "url": source["url"],
                "attribution": source["attribution"],
                "license": source["license"],
            },
            "series": series,
            "limitations": limitations,
        }
    finally:
        db.close()


def changes(geo_id: str, metric: str, from_year: int, to_year: int, span: int | None = None) -> dict | None:
    payload = history(geo_id, metric, span)
    if payload is None:
        return None
    by_year = {point["year"]: point for point in payload["series"]}
    start, end = by_year.get(from_year), by_year.get(to_year)
    if not start or not end or start["estimate"] is None or end["estimate"] is None:
        return {
            **{k: payload[k] for k in ("schema_version", "geo_id", "name", "geography_type", "metric", "span")},
            "from_year": from_year,
            "to_year": to_year,
            "from_estimate": None if not start else start["estimate"],
            "to_estimate": None if not end else end["estimate"],
            "absolute_change": None,
            "percent_change": None,
            "significant_90": None,
            "limitations": payload["limitations"] + ["Both years must have a published estimate to compute change."],
        }
    use_adj = start["estimate_2024_usd"] is not None and end["estimate_2024_usd"] is not None
    a = start["estimate_2024_usd"] if use_adj else start["estimate"]
    b = end["estimate_2024_usd"] if use_adj else end["estimate"]
    a_moe = start["moe_2024_usd"] if use_adj else start["moe"]
    b_moe = end["moe_2024_usd"] if use_adj else end["moe"]
    absolute = b - a
    percent = None if a == 0 else 100.0 * absolute / a
    significant = None
    if a_moe is not None and b_moe is not None:
        se = ((a_moe / 1.645) ** 2 + (b_moe / 1.645) ** 2) ** 0.5
        significant = False if se == 0 else abs(absolute) / se > 1.645
    limitations = list(payload["limitations"])
    if payload["span"] == 5:
        limitations.append("This change uses overlapping 5-year samples and should not be presented as annual growth.")
    return {
        "schema_version": "1.0",
        "geo_id": geo_id,
        "name": payload["name"],
        "geography_type": payload["geography_type"],
        "metric": metric,
        "span": payload["span"],
        "from_year": from_year,
        "to_year": to_year,
        "from_estimate": a,
        "to_estimate": b,
        "absolute_change": absolute,
        "percent_change": percent,
        "inflation_adjusted": use_adj,
        "significant_90": significant,
        "limitations": limitations,
    }


def compare(geo_ids: list[str], year: int, metrics: list[str], span: int | None = None) -> dict:
    db = connect()
    try:
        areas = []
        for geo_id in geo_ids:
            area = geography(db, geo_id)
            if area is None:
                continue
            used_span = span or default_span(area["geography_type"])
            values = {}
            for metric in metrics:
                row = db.execute(
                    """SELECT estimate, moe, estimate_2024_usd, moe_2024_usd, unit, low_reliability
                       FROM time_series WHERE geo_id=? AND metric=? AND year=? AND span=?""",
                    (geo_id, metric, year, used_span),
                ).fetchone()
                values[metric] = None if row is None else {
                    "estimate": row["estimate_2024_usd"] if row["estimate_2024_usd"] is not None else row["estimate"],
                    "moe": row["moe_2024_usd"] if row["estimate_2024_usd"] is not None else row["moe"],
                    "unit": "2024 dollars" if row["estimate_2024_usd"] is not None else row["unit"],
                    "low_reliability": bool(row["low_reliability"]),
                    "span": used_span,
                }
            areas.append({
                "geo_id": geo_id,
                "name": area["name"],
                "geography_type": area["geography_type"],
                "zcta": area["zcta"],
                "values": values,
            })
        return {
            "schema_version": "1.0",
            "year": year,
            "metrics": metrics,
            "areas": areas,
            "limitations": [
                "Each geography uses its native ACS span: 1-year for places/counties, 5-year for block groups, unless span is set.",
                "Currency comparisons use 2024 dollars.",
            ],
        }
    finally:
        db.close()


def businesses_for(geo_id: str | None = None) -> dict | None:
    db = connect()
    try:
        area = None
        if geo_id:
            area = geography(db, geo_id)
            if area is None:
                return None
        if geo_id:
            rows = db.execute(
                "SELECT * FROM businesses WHERE geo_id=? ORDER BY category, name", (geo_id,)
            ).fetchall()
        else:
            rows = db.execute("SELECT * FROM businesses ORDER BY category, name").fetchall()
        source = db.execute(
            "SELECT * FROM sources WHERE license='ODbL' ORDER BY id DESC LIMIT 1"
        ).fetchone()
        by_category: dict[str, int] = {}
        features = []
        for row in rows:
            by_category[row["category"]] = by_category.get(row["category"], 0) + 1
            features.append({
                "osm_id": row["osm_id"],
                "name": row["name"],
                "category": row["category"],
                "subcategory": row["subcategory"],
                "lat": row["lat"],
                "lon": row["lon"],
                "geo_id": row["geo_id"],
            })
        return {
            "schema_version": "1.0",
            "geo_id": geo_id,
            "name": None if area is None else area["name"],
            "total": len(features),
            "by_category": by_category,
            "features": features,
            "attribution": "© OpenStreetMap contributors",
            "license": "ODbL",
            "copyright_url": "https://www.openstreetmap.org/copyright",
            "source_date": None if source is None else source["data_date"],
            "limitations": [
                "OpenStreetMap is crowd-sourced. Counts reflect mapped storefronts, not a complete business census.",
                "Points are assigned to a whole 2020 block group by location; they are not Fenton Village-only counts.",
            ],
        }
    finally:
        db.close()


def catalog() -> dict:
    db = connect()
    try:
        metrics = [row[0] for row in db.execute(
            "SELECT DISTINCT metric FROM time_series ORDER BY metric")]
        years = [row[0] for row in db.execute(
            "SELECT DISTINCT year FROM time_series ORDER BY year")]
        n_biz = db.execute("SELECT COUNT(*) FROM businesses").fetchone()[0]
        return {
            "schema_version": "1.0",
            "metrics": metrics,
            "years": years,
            "geographies": [dict(row) for row in db.execute(
                "SELECT geo_id, name, geography_type, zcta FROM geographies ORDER BY geography_type, name")],
            "businesses": n_biz,
        }
    finally:
        db.close()
