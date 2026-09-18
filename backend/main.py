from fastapi import FastAPI, HTTPException

from backend.data import LAYERS, load_areas, load_chunks
from backend.schemas import Answer, Area, Areas, AskRequest, Layer
from backend.services import answer

app = FastAPI(title="UrbanEye", version="0.1.0", description="Evidence-first community intelligence starter")
areas = load_areas()
chunks = load_chunks()
by_id = {f.properties.geo_id: f.properties for f in areas.features}


@app.get("/health")
def health():
    return {"status": "ok", "schema_version": "1.0", "areas": len(by_id),
            "document_chunks": len(chunks), "llm_enabled": False}


@app.get("/areas", response_model=Areas)
def get_areas():
    return areas


@app.get("/areas/{geo_id}", response_model=Area)
def get_area(geo_id: str):
    if geo_id not in by_id:
        raise HTTPException(404, "Unknown geographic ID")
    return by_id[geo_id]


@app.get("/layers", response_model=list[Layer])
def get_layers():
    return LAYERS


@app.post("/ask", response_model=Answer)
def ask(request: AskRequest):
    return answer(request.question, get_area(request.geo_id), chunks)
