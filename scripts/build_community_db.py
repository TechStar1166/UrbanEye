"""Build data/urbaneye.db from cached Census, ACS, OSM and BLS files. Offline."""
from __future__ import annotations

import hashlib
import json
import math
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data/urbaneye.db"
ACS_DIR = ROOT / "data/raw/acs"
CPI_PATH = ROOT / "data/raw/bls/cpi_u_annual.json"

CENSUS_SENTINEL = 1_000_000_000
CURRENCY_METRICS = {"median_household_income", "per_capita_income"}
CPI_BASE_YEAR = 2024

# Latest ACS 5-year snapshot joined onto /areas so choropleth and /segment stay
# in the layers==metrics contract. 5-year is used for every map geography so
# the CDP is comparable with block groups. Do not chart consecutive 5-year
# vintages as annual change; /history keeps the 1-year place series.
ACS_AREA_METRICS = {
    "median_household_income": ("USD", "Median household income"),
    "age_50_plus_pct": ("percent", "Share of residents age 50 and over"),
    "avg_household_size": ("people per household", "Average household size"),
    "renter_occupied_pct": ("percent", "Renter-occupied housing units"),
}

# Comparison geographies that are not served as map areas and so carry no geometry.
CONTEXT_GEOGRAPHIES = {
    "24031": ("Montgomery County, Maryland", "county"),
    "24": ("Maryland", "state"),
    "2407125": ("Bethesda CDP", "census_designated_place"),
    "2467675": ("Rockville city", "census_designated_place"),
    "2431175": ("Gaithersburg city", "census_designated_place"),
    "2432025": ("Germantown CDP", "census_designated_place"),
}


def geography_names() -> dict[str, tuple[str, str]]:
    """Served areas plus context geographies, so every map selection has estimates."""
    areas = json.loads((ROOT / "data/processed/areas.geojson").read_text())
    names = {geo_id: value for geo_id, value in CONTEXT_GEOGRAPHIES.items()}
    for feature in areas["features"]:
        properties = feature["properties"]
        names[properties["geo_id"]] = (properties["name"], properties["geography_type"])
    return names


GEOGRAPHY_NAMES = geography_names()

# Primary ZIP Code Tabulation Area for the Fenton Village study block groups.
ZCTA_BY_GEO = {
    "240317024022": "20910",
    "240317024023": "20910",
    "240317025021": "20910",
    "2472450": "20910",
}
FENTON_STUDY_BLOCK_GROUPS = {"240317024022", "240317024023", "240317025021"}

FOOD_AMENITIES = {"restaurant", "cafe", "bar", "pub", "fast_food"}

SCHEMA = """
CREATE TABLE sources (
    id INTEGER PRIMARY KEY,
    dataset TEXT NOT NULL,
    url TEXT,
    retrieved_at TEXT,
    data_date TEXT,
    license TEXT,
    attribution TEXT,
    notes TEXT
);
CREATE TABLE geographies (
    geo_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    geography_type TEXT NOT NULL,
    boundary_vintage TEXT,
    geometry_json TEXT,
    parent_geo_id TEXT,
    zcta TEXT
);
CREATE INDEX idx_geo_type ON geographies(geography_type);
CREATE TABLE metrics (
    geo_id TEXT NOT NULL,
    metric TEXT NOT NULL,
    estimate REAL,
    moe REAL,
    source_id INTEGER,
    FOREIGN KEY(geo_id) REFERENCES geographies(geo_id),
    FOREIGN KEY(source_id) REFERENCES sources(id),
    PRIMARY KEY(geo_id, metric)
);
CREATE TABLE time_series (
    geo_id TEXT NOT NULL,
    metric TEXT NOT NULL,
    year INTEGER NOT NULL,
    span INTEGER NOT NULL,
    period TEXT NOT NULL,
    estimate REAL,
    moe REAL,
    estimate_2024_usd REAL,
    moe_2024_usd REAL,
    inflation_adjusted INTEGER NOT NULL DEFAULT 0,
    unit TEXT NOT NULL,
    low_reliability INTEGER NOT NULL DEFAULT 0,
    source_id INTEGER,
    FOREIGN KEY(geo_id) REFERENCES geographies(geo_id),
    FOREIGN KEY(source_id) REFERENCES sources(id),
    PRIMARY KEY(geo_id, metric, year, span)
);
CREATE INDEX idx_ts_geo_metric ON time_series(geo_id, metric);
CREATE INDEX idx_ts_year ON time_series(year);
CREATE TABLE businesses (
    osm_id TEXT PRIMARY KEY,
    name TEXT,
    category TEXT NOT NULL,
    subcategory TEXT,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    geo_id TEXT,
    source_id INTEGER,
    FOREIGN KEY(geo_id) REFERENCES geographies(geo_id),
    FOREIGN KEY(source_id) REFERENCES sources(id)
);
CREATE INDEX idx_biz_category ON businesses(category);
CREATE INDEX idx_biz_geo ON businesses(geo_id);
"""


def census_geo_id(acs_geo_id: str) -> str:
    """Strip ACS summary-level prefix; keep the identifier used by /areas."""
    if "US" in acs_geo_id:
        return acs_geo_id.split("US", 1)[1]
    return acs_geo_id


def parse_number(value) -> float | None:
    if value in (None, "", "."):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    # Census/ACS missing-value sentinels are large |n| codes such as -666666666.
    if not math.isfinite(number) or abs(number) >= 200_000_000:
        return None
    return number


def field_index(columns: list[str], table: str, number: int, kind: str) -> int | None:
    n = f"{number:03d}"
    wanted = {f"{table}_{kind}{n}", f"{table}_{n}{kind}"}
    for i, column in enumerate(columns):
        if column.lstrip("#") in wanted:
            return i
    return None


def row_pair(columns, row, table, number) -> tuple[float | None, float | None]:
    e_i = field_index(columns, table, number, "E")
    m_i = field_index(columns, table, number, "M")
    estimate = parse_number(row[e_i]) if e_i is not None and e_i < len(row) else None
    moe = parse_number(row[m_i]) if m_i is not None and m_i < len(row) else None
    return estimate, moe


# B01001 is "sex by age". Cells 16-25 are males 50 and over, 40-49 females 50 and over.
AGE_50_PLUS_CELLS = list(range(16, 26)) + list(range(40, 50))


def sum_cells(columns, row, table, numbers) -> tuple[float | None, float | None]:
    """Aggregate estimates; combine their MOEs as the root sum of squares."""
    total, variance, seen = 0.0, 0.0, False
    for number in numbers:
        estimate, moe = row_pair(columns, row, table, number)
        if estimate is None:
            continue
        seen = True
        total += estimate
        if moe is not None:
            variance += moe ** 2
    if not seen:
        return None, None
    return total, math.sqrt(variance) if variance else None


def ratio_moe(num, num_moe, den, den_moe) -> float | None:
    """Census approximation for a derived proportion, returned as percentage points."""
    if None in (num, den) or den == 0:
        return None
    num_moe = 0.0 if num_moe is None else num_moe
    den_moe = 0.0 if den_moe is None else den_moe
    rate = num / den
    inner = num_moe ** 2 - (rate ** 2) * (den_moe ** 2)
    if inner < 0:
        inner = num_moe ** 2 + (rate ** 2) * (den_moe ** 2)
    return 100.0 * math.sqrt(inner) / den


def to_2024_dollars(value: float | None, year: int, cpi: dict[int, float]) -> float | None:
    if value is None or year not in cpi or CPI_BASE_YEAR not in cpi:
        return None
    return value * (cpi[CPI_BASE_YEAR] / cpi[year])


def point_in_ring(lon: float, lat: float, ring: list) -> bool:
    inside = False
    j = len(ring) - 1
    for i, point in enumerate(ring):
        xi, yi = point[0], point[1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-16) + xi:
            inside = not inside
        j = i
    return inside


def point_in_geometry(lon: float, lat: float, geometry: dict) -> bool:
    polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
    for polygon in polygons:
        if not polygon:
            continue
        if point_in_ring(lon, lat, polygon[0]) and all(
                not point_in_ring(lon, lat, hole) for hole in polygon[1:]):
            return True
    return False


def categorize(tags: dict) -> tuple[str, str]:
    amenity = tags.get("amenity")
    shop = tags.get("shop")
    office = tags.get("office")
    if amenity in FOOD_AMENITIES:
        return "food", f"amenity:{amenity}"
    if amenity:
        return "service", f"amenity:{amenity}"
    if shop in {"hairdresser", "beauty", "car_repair"}:
        return "service", f"shop:{shop}"
    if shop:
        return "retail", f"shop:{shop}"
    if office:
        return "office", f"office:{office}"
    return "other", "other"


def connect() -> sqlite3.Connection:
    if DB_PATH.exists():
        DB_PATH.unlink()
    db = sqlite3.connect(DB_PATH)
    db.execute("PRAGMA foreign_keys = ON")
    db.executescript(SCHEMA)
    return db


def add_source(db, **fields) -> int:
    cur = db.execute(
        """INSERT INTO sources (dataset, url, retrieved_at, data_date, license, attribution, notes)
           VALUES (:dataset, :url, :retrieved_at, :data_date, :license, :attribution, :notes)""",
        {key: fields.get(key) for key in
         ("dataset", "url", "retrieved_at", "data_date", "license", "attribution", "notes")},
    )
    return cur.lastrowid


def load_geographies(db, areas_source_id: int):
    areas = json.loads((ROOT / "data/processed/areas.geojson").read_text())
    for feature in areas["features"]:
        props = feature["properties"]
        geo_id = props["geo_id"]
        db.execute(
            """INSERT INTO geographies
               (geo_id, name, geography_type, boundary_vintage, geometry_json, parent_geo_id, zcta)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (geo_id, props["name"], props["geography_type"], props["boundary_vintage"],
             json.dumps(feature["geometry"]), "2472450" if geo_id != "2472450" else "24031",
             ZCTA_BY_GEO.get(geo_id)),
        )
        for metric, value in props["metrics"].items():
            db.execute(
                "INSERT INTO metrics (geo_id, metric, estimate, moe, source_id) VALUES (?, ?, ?, ?, ?)",
                (geo_id, metric, value, None, areas_source_id),
            )
    for geo_id, (name, geography_type) in GEOGRAPHY_NAMES.items():
        exists = db.execute("SELECT 1 FROM geographies WHERE geo_id=?", (geo_id,)).fetchone()
        if exists:
            continue
        parent = "24031" if geography_type != "state" else None
        db.execute(
            """INSERT INTO geographies
               (geo_id, name, geography_type, boundary_vintage, geometry_json, parent_geo_id, zcta)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (geo_id, name, geography_type, None, None, parent, ZCTA_BY_GEO.get(geo_id)),
        )


def metric_from_table(table: str, columns: list[str], row: list[str]):
    """Yield (metric, estimate, moe, unit) derived from one ACS table row."""
    if table == "B19013":
        estimate, moe = row_pair(columns, row, table, 1)
        yield "median_household_income", estimate, moe, "USD"
    elif table == "B19301":
        estimate, moe = row_pair(columns, row, table, 1)
        yield "per_capita_income", estimate, moe, "USD"
    elif table == "B01002":
        estimate, moe = row_pair(columns, row, table, 1)
        yield "median_age", estimate, moe, "years"
    elif table == "B25003":
        total, total_moe = row_pair(columns, row, table, 1)
        renter, renter_moe = row_pair(columns, row, table, 3)
        pct = None if None in (renter, total) or total == 0 else 100.0 * renter / total
        yield "renter_occupied_pct", pct, ratio_moe(renter, renter_moe, total, total_moe), "percent"
    elif table == "B17001":
        total, total_moe = row_pair(columns, row, table, 1)
        poor, poor_moe = row_pair(columns, row, table, 2)
        pct = None if None in (poor, total) or total == 0 else 100.0 * poor / total
        yield "poverty_rate", pct, ratio_moe(poor, poor_moe, total, total_moe), "percent"
    elif table == "B01001":
        total, total_moe = row_pair(columns, row, table, 1)
        older, older_moe = sum_cells(columns, row, table, AGE_50_PLUS_CELLS)
        pct = None if None in (older, total) or total == 0 else 100.0 * older / total
        yield "age_50_plus_pct", pct, ratio_moe(older, older_moe, total, total_moe), "percent"
    elif table == "B25010":
        estimate, moe = row_pair(columns, row, table, 1)
        yield "avg_household_size", estimate, moe, "people per household"
    elif table == "B19083":
        # Published for places and larger only; block groups are absent from the file.
        estimate, moe = row_pair(columns, row, table, 1)
        yield "gini_index", estimate, moe, "index 0-1"


def load_acs(db, cpi: dict[int, float]):
    for path in sorted(ACS_DIR.glob("acs*.json")):
        if path.name == "manifest.json":
            continue
        payload = json.loads(path.read_text())
        table, year, span = payload["table"], payload["year"], payload["span"]
        unit_override = None
        if table in {"B19013", "B19301"}:
            unit_override = f"{year} dollars"
        source_id = add_source(
            db, dataset=f"ACS {span}-year {payload['period']}",
            url=payload["url"], retrieved_at=payload["retrieved_at"],
            data_date=str(year), license="Public domain (U.S. Government work)",
            attribution="U.S. Census Bureau, American Community Survey",
            notes=path.name,
        )
        for acs_id, row in payload["rows"].items():
            geo_id = census_geo_id(acs_id)
            if geo_id not in GEOGRAPHY_NAMES:
                continue
            if db.execute("SELECT 1 FROM geographies WHERE geo_id=?", (geo_id,)).fetchone() is None:
                continue
            for metric, estimate, moe, unit in metric_from_table(table, payload["columns"], row):
                if unit_override and metric in CURRENCY_METRICS:
                    unit = unit_override
                adj = to_2024_dollars(estimate, year, cpi) if metric in CURRENCY_METRICS else None
                adj_moe = to_2024_dollars(moe, year, cpi) if metric in CURRENCY_METRICS else None
                low = 0
                if estimate is not None and moe is not None and estimate != 0 and abs(moe / estimate) > 0.30:
                    low = 1
                db.execute(
                    """INSERT OR REPLACE INTO time_series
                       (geo_id, metric, year, span, period, estimate, moe,
                        estimate_2024_usd, moe_2024_usd, inflation_adjusted, unit,
                        low_reliability, source_id)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (geo_id, metric, year, span, payload["period"], estimate, moe,
                     adj, adj_moe, 0, unit, low, source_id),
                )


def load_osm(db):
    raw_path = ROOT / "data/raw/osm/fenton_village_pois.json"
    source_path = ROOT / "data/raw/osm/source.json"
    if not raw_path.exists():
        print("OSM cache missing; run python -m scripts.fetch_osm")
        return 0
    source = json.loads(source_path.read_text()) if source_path.exists() else {}
    source_id = add_source(
        db, dataset="OpenStreetMap Overpass",
        url=source.get("url"), retrieved_at=source.get("retrieved_at"),
        data_date=(source.get("retrieved_at") or "")[:10],
        license="ODbL", attribution="© OpenStreetMap contributors",
        notes=source.get("note"),
    )
    payload = json.loads(raw_path.read_text())
    polygons = []
    for row in db.execute(
            "SELECT geo_id, geometry_json FROM geographies WHERE geography_type='block_group'"):
        if row[1]:
            polygons.append((row[0], json.loads(row[1])))
    count = 0
    for element in payload.get("elements", []):
        tags = element.get("tags") or {}
        lat = element.get("lat") or (element.get("center") or {}).get("lat")
        lon = element.get("lon") or (element.get("center") or {}).get("lon")
        if lat is None or lon is None:
            continue
        category, subcategory = categorize(tags)
        geo_id = next((gid for gid, geom in polygons if point_in_geometry(lon, lat, geom)), None)
        osm_id = f"{element.get('type', 'node')}/{element['id']}"
        db.execute(
            """INSERT OR REPLACE INTO businesses
               (osm_id, name, category, subcategory, lat, lon, geo_id, source_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (osm_id, tags.get("name"), category, subcategory, lat, lon, geo_id, source_id),
        )
        count += 1
    return count


def write_geometry_exports():
    """Map overlays that carry no statistics: a zoning boundary and a rail alignment."""
    out = ROOT / "data/processed"

    boundary_raw = json.loads((ROOT / "data/raw/fenton_village_overlay.geojson").read_text())
    boundary_source = json.loads((ROOT / "data/raw/fenton_village_boundary_source.json").read_text())
    overlays = {
        "type": "FeatureCollection",
        "schema_version": "1.0",
        "attribution": "Montgomery County Planning Department",
        "license": "Public data, Montgomery County Planning Department",
        "source_url": boundary_source["url"],
        "retrieved_at": boundary_source["retrieved_at"],
        "limitations": [
            "The Fenton Village (FV) Overlay Zone is a zoning boundary, not a statistical area.",
            "It carries no population, housing or income values and must not be clicked through "
            "to counts. Block group values describe whole block groups, not this boundary.",
        ],
        "features": [{
            "type": "Feature",
            "id": "fenton-village-overlay",
            "geometry": feature["geometry"],
            "properties": {
                "name": "Fenton Village (FV) Overlay Zone",
                "kind": "zoning_overlay",
                "legal_definition": boundary_source.get("legal_definition"),
                "carries_statistics": False,
            },
        } for feature in boundary_raw["features"]],
    }
    (out / "overlays.geojson").write_text(json.dumps(overlays, indent=2) + "\n")

    transit_path = ROOT / "data/raw/osm/purple_line.json"
    if not transit_path.exists():
        return len(overlays["features"]), 0
    transit_raw = json.loads(transit_path.read_text())
    transit_source = json.loads((ROOT / "data/raw/osm/transit_source.json").read_text())
    features = []
    for way in transit_raw.get("ways", []):
        coordinates = [[point["lon"], point["lat"]] for point in way.get("geometry", [])]
        if len(coordinates) < 2:
            continue
        tags = way.get("tags") or {}
        features.append({
            "type": "Feature",
            "id": f"way/{way['id']}",
            "geometry": {"type": "LineString", "coordinates": coordinates},
            "properties": {
                "name": tags.get("name", "Purple Line"),
                "status": "under_construction" if tags.get("railway") == "construction" else tags.get("railway"),
                "mode": tags.get("construction", tags.get("railway")),
                "opening_date": tags.get("opening_date"),
                "tunnel": tags.get("tunnel") == "yes",
                "bridge": tags.get("bridge") == "yes",
            },
        })
    transit = {
        "type": "FeatureCollection",
        "schema_version": "1.0",
        "name": "Purple Line alignment",
        "status": "under_construction",
        "attribution": "© OpenStreetMap contributors",
        "license": "ODbL",
        "copyright_url": "https://www.openstreetmap.org/copyright",
        "retrieved_at": transit_source["retrieved_at"],
        "routes": [{"osm_id": relation["id"], "name": (relation.get("tags") or {}).get("name")}
                   for relation in transit_raw.get("relations", [])],
        "limitations": [
            "OpenStreetMap tags this alignment route=construction. It is not operating service.",
            "Proximity to the alignment does not establish current transit access.",
        ],
        "features": features,
    }
    (out / "transit.geojson").write_text(json.dumps(transit, indent=2) + "\n")
    return len(overlays["features"]), len(features)


def round_metric(metric: str, value: float | None) -> float | None:
    if value is None:
        return None
    if metric.endswith("_pct") or metric == "avg_household_size":
        return round(value, 2)
    if metric in CURRENCY_METRICS:
        return round(value)
    return value


def stable_moe(value: float | None) -> float | None:
    """Normalize derived MOEs so JSON exports are stable across platforms."""
    if value is None:
        return None
    return round(value, 12)


def attach_acs_to_areas(db: sqlite3.Connection) -> None:
    """Write the 2024 ACS 5-year snapshot onto each /areas feature with matching evidence.

    prepare_data.py only emits Census 2020 counts. Run this after load_acs so
    GET /layers can list ACS indicators without breaking the layers==metrics test.
    """
    from backend.schemas import Areas

    placeholders = ",".join("?" for _ in ACS_AREA_METRICS)
    rows = db.execute(
        f"""SELECT t.geo_id, t.metric, t.estimate, t.moe, t.unit, t.low_reliability,
                   s.url, s.retrieved_at, s.dataset
            FROM time_series t JOIN sources s ON s.id = t.source_id
            WHERE t.year=2024 AND t.span=5 AND t.metric IN ({placeholders})""",
        tuple(ACS_AREA_METRICS),
    ).fetchall()
    by_geo: dict[str, dict[str, sqlite3.Row]] = {}
    for row in rows:
        by_geo.setdefault(row[0], {})[row[1]] = row

    path = ROOT / "data/processed/areas.geojson"
    areas = json.loads(path.read_text())
    fallback_url = "https://www.census.gov/programs-surveys/acs"
    attached = 0
    for feature in areas["features"]:
        props = feature["properties"]
        geo_id = props["geo_id"]
        name = props["name"]
        props["evidence"] = [
            item for item in props["evidence"]
            if not str(item.get("evidence_id", "")).startswith("acs5y2024:")
        ]
        geo_rows = by_geo.get(geo_id, {})
        for metric, (unit, label) in ACS_AREA_METRICS.items():
            row = geo_rows.get(metric)
            estimate = None if row is None else round_metric(metric, row[2])
            moe = None if row is None else round_metric(metric, row[3])
            low = False if row is None else bool(row[5])
            props["metrics"][metric] = estimate
            if estimate is None:
                excerpt = (
                    f"No published ACS 5-year 2020-2024 {label.lower()} for this geography."
                )
            else:
                moe_text = "not published" if moe is None else f"± {moe:,.2f}".replace(".00", "")
                excerpt = (
                    f"ACS 5-year 2020-2024 {label.lower()}: {estimate}. "
                    f"90% margin of error {moe_text}. "
                    "This describes the whole published Census unit, not the Fenton Village overlay."
                )
                if low:
                    excerpt += " Flagged low reliability because the margin of error exceeds 30% of the estimate."
            props["evidence"].append({
                "evidence_id": f"acs5y2024:{geo_id}:{metric}",
                "type": "structured_data",
                "title": f"ACS 5-year 2020-2024 {label} — {name}",
                "source": "U.S. Census Bureau, American Community Survey",
                "url": (None if row is None else row[6]) or fallback_url,
                "date": "2020-2024",
                "retrieved_at": None if row is None else row[7],
                "geo_id": geo_id,
                "metric": metric,
                "value": estimate,
                "unit": unit if row is None else row[4] or unit,
                "excerpt": excerpt,
                "page": None,
                "section": None,
                "page_label": None,
                "document_scope": None,
            })
            if estimate is not None:
                attached += 1
    Areas.model_validate(areas)
    path.write_text(json.dumps(areas, indent=2) + "\n")
    print(f"Attached {attached} ACS 5-year 2024 values to {len(areas['features'])} map areas")


def write_json_exports(db):
    history = []
    for row in db.execute(
            """SELECT geo_id, metric, year, span, period, estimate, moe,
                      estimate_2024_usd, moe_2024_usd, unit, low_reliability
               FROM time_series ORDER BY geo_id, metric, span, year"""):
        history.append({
            "geo_id": row[0], "metric": row[1], "year": row[2], "span": row[3],
            "period": row[4],
            "estimate": round(row[5], 5) if row[5] is not None else None,
            "moe": round(row[6], 5) if row[6] is not None else None,
            "estimate_2024_usd": round(row[7], 5) if row[7] is not None else None,
            "moe_2024_usd": round(row[8], 5) if row[8] is not None else None,
            "unit": row[9], "low_reliability": bool(row[10]),
        })
    out = ROOT / "data/processed"
    (out / "income_history.json").write_text(json.dumps({
        "schema_version": "1.0",
        "description": "ACS estimates for visualization. Use 1-year series for place trends; "
                       "5-year series for block groups. Consecutive 5-year vintages overlap.",
        "rows": history,
    }, indent=2) + "\n")
    snapshot = []
    for row in db.execute(
            """SELECT t.geo_id, g.name, t.metric, t.year, t.span, t.estimate, t.moe,
                      t.estimate_2024_usd, t.unit, t.low_reliability
               FROM time_series t JOIN geographies g USING(geo_id)
               WHERE (t.span=1 AND t.year=2024) OR (t.span=5 AND t.year=2024)
               ORDER BY t.geo_id, t.metric, t.span"""):
        snapshot.append({
            "geo_id": row[0], "name": row[1], "metric": row[2], "year": row[3],
            "span": row[4],
            "estimate": round(row[5], 5) if row[5] is not None else None,
            "moe": round(row[6], 5) if row[6] is not None else None,
            "estimate_2024_usd": round(row[7], 5) if row[7] is not None else None,
            "unit": row[8],
            "low_reliability": bool(row[9]),
        })
    (out / "community_metrics.json").write_text(json.dumps({
        "schema_version": "1.0", "latest_year": 2024, "rows": snapshot,
    }, indent=2) + "\n")


def build():
    cpi = {int(year): value for year, value in json.loads(CPI_PATH.read_text())["annual"].items()}
    db = connect()
    census_source = json.loads((ROOT / "data/raw/source.json").read_text())
    areas_source_id = add_source(
        db, dataset=census_source["dataset"], url=census_source["url"],
        retrieved_at=census_source["retrieved_at"], data_date=census_source["data_date"],
        license="Public domain (U.S. Government work)",
        attribution="U.S. Census Bureau TIGERweb Census 2020",
        notes="POP100 and HU100 for whole published units",
    )
    load_geographies(db, areas_source_id)
    load_acs(db, cpi)
    pois = load_osm(db)
    attach_acs_to_areas(db)
    write_json_exports(db)
    n_overlays, n_transit = write_geometry_exports()
    db.commit()
    n_geo = db.execute("SELECT COUNT(*) FROM geographies").fetchone()[0]
    n_ts = db.execute("SELECT COUNT(*) FROM time_series").fetchone()[0]
    n_biz = db.execute("SELECT COUNT(*) FROM businesses").fetchone()[0]
    db.close()
    digest = hashlib.sha256(DB_PATH.read_bytes()).hexdigest()
    print(f"Wrote {DB_PATH.relative_to(ROOT)} ({n_geo} geographies, {n_ts} time-series rows, "
          f"{n_biz} businesses; sha256 {digest[:12]}…)")
    print(f"Wrote {n_overlays} zoning overlay feature(s) and {n_transit} transit segment(s)")
    if pois == 0:
        print("Business table empty until OSM is fetched.")


if __name__ == "__main__":
    build()
