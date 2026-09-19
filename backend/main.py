import json

from fastapi import Depends, FastAPI, HTTPException
from dotenv import load_dotenv

from backend.analysis.correlation import calculate_pearson
from backend.data import LAYERS, ROOT, load_areas, load_chunks
from backend import community as community_data
from backend.schemas import (
    Answer, Area, Areas, AskRequest, BusinessResponse, ChangeResponse, CommunityCatalog,
    CompareResponse, HistoryResponse, Layer, OverlayResponse, SegmentRequest, SegmentResponse,
    DataPoint, TransitResponse,
)
from backend.data import LAYERS, ROOT, load_areas, load_chunks, load_storefronts
from backend.schemas import Answer, Area, Areas, AskRequest, Layer, SegmentRequest, SegmentResponse, DataPoint, Storefronts
from backend.services import answer
from backend.rag.retrieve import DocumentIndex
from backend.llm.gemini import Gemini, get_gemini

load_dotenv(ROOT / ".env", override=False)

app = FastAPI(title="UrbanEye", version="0.1.0", description="Evidence-first community intelligence starter")
areas = load_areas()
chunks = load_chunks()
document_index = DocumentIndex(chunks)
by_id = {f.properties.geo_id: f.properties for f in areas.features}
storefronts = load_storefronts(set(by_id))


@app.get("/health")
def health(model: Gemini = Depends(get_gemini)):
    return {"status": "ok", "schema_version": "1.0", "areas": len(by_id),
            "document_chunks": len(chunks), "llm_enabled": model.enabled,
            "llm_model": model.model, "retrieval": "bm25",
            "community_db": community_data.available()}


@app.get("/areas", response_model=Areas)
def get_areas():
    return areas


@app.get("/areas/{geo_id}", response_model=Area)
def get_area(geo_id: str):
    if geo_id not in by_id:
        raise HTTPException(404, "Unknown geographic ID")
    return by_id[geo_id]


@app.get("/storefronts", response_model=Storefronts)
def get_storefronts():
    return storefronts


@app.get("/areas/{geo_id}/history", response_model=HistoryResponse)
def get_area_history(geo_id: str, metric: str = "median_household_income", span: int | None = None):
    payload = community_data.history(geo_id, metric, span)
    if payload is None:
        raise HTTPException(404, "Unknown geographic ID")
    return payload


@app.get("/areas/{geo_id}/changes", response_model=ChangeResponse)
def get_area_changes(geo_id: str, metric: str = "median_household_income",
                     from_year: int = 2021, to_year: int = 2024, span: int | None = None):
    payload = community_data.changes(geo_id, metric, from_year, to_year, span)
    if payload is None:
        raise HTTPException(404, "Unknown geographic ID")
    return payload


@app.get("/areas/{geo_id}/businesses", response_model=BusinessResponse)
def get_area_businesses(geo_id: str):
    payload = community_data.businesses_for(geo_id)
    if payload is None:
        raise HTTPException(404, "Unknown geographic ID")
    return payload


@app.get("/pois", response_model=BusinessResponse)
def get_pois():
    return community_data.businesses_for()


@app.get("/compare", response_model=CompareResponse)
def get_compare(geo_ids: str, year: int = 2024, metrics: str = "median_household_income",
                span: int | None = None):
    ids = [item.strip() for item in geo_ids.split(",") if item.strip()]
    if len(ids) < 2:
        raise HTTPException(422, "Provide at least two comma-separated geo_ids")
    return community_data.compare(ids, year, [item.strip() for item in metrics.split(",") if item.strip()], span)


@app.get("/places")
def get_places():
    return json.loads((ROOT / "data/processed/places.json").read_text())


@app.get("/sources")
def get_sources():
    return json.loads((ROOT / "data/processed/sources.json").read_text())


@app.get("/overlays", response_model=OverlayResponse)
def get_overlays():
    payload = community_data.overlays()
    if payload is None:
        raise HTTPException(404, "No overlay boundaries are cached")
    return payload


@app.get("/transit", response_model=TransitResponse)
def get_transit():
    payload = community_data.transit()
    if payload is None:
        raise HTTPException(404, "No transit alignment is cached")
    return payload


@app.get("/community", response_model=CommunityCatalog)
def get_community_catalog():
    return community_data.catalog()

@app.get("/layers", response_model=list[Layer])
def get_layers():
    return LAYERS


@app.post("/ask", response_model=Answer)
async def ask(request: AskRequest, model: Gemini = Depends(get_gemini)):
    area = get_area(request.geo_id)
    result = answer(request.question, area, document_index)
    return await model.explain(request.question, area, result)


@app.post("/segment", response_model=SegmentResponse)
def segment(request: SegmentRequest):
    data_points = []
    x_vals = []
    y_vals = []

    for geo_id in request.geo_ids:
        if geo_id not in by_id:
            continue

        area = by_id[geo_id]
        x_val = area.metrics.get(request.x_metric)
        y_val = area.metrics.get(request.y_metric)

        # Exclude null pairs
        if x_val is not None and y_val is not None:
            x_vals.append(x_val)
            y_vals.append(y_val)
            data_points.append(DataPoint(geo_id=geo_id, x_value=x_val, y_value=y_val))

    correlation = calculate_pearson(x_vals, y_vals)

    explanation = "Correlation measures statistical association, not causation."
    if correlation is None:
        explanation += " Correlation is undefined here due to insufficient comparable data points (< 3) or a constant variable."

    return SegmentResponse(
        x_metric=request.x_metric,
        y_metric=request.y_metric,
        correlation_coefficient=correlation,
        sample_size=len(x_vals),
        explanation=explanation,
        data_points=data_points
    )
