from fastapi import Depends, FastAPI, HTTPException
from dotenv import load_dotenv

from backend.data import LAYERS, ROOT, load_areas, load_chunks
from backend.schemas import Answer, Area, Areas, AskRequest, Layer
from backend.services import answer
from backend.rag.retrieve import DocumentIndex
from backend.llm.gemini import Gemini, get_gemini

load_dotenv(ROOT / ".env", override=False)

app = FastAPI(title="UrbanEye", version="0.1.0", description="Evidence-first community intelligence starter")
areas = load_areas()
chunks = load_chunks()
document_index = DocumentIndex(chunks)
by_id = {f.properties.geo_id: f.properties for f in areas.features}


@app.get("/health")
def health(model: Gemini = Depends(get_gemini)):
    return {"status": "ok", "schema_version": "1.0", "areas": len(by_id),
            "document_chunks": len(chunks), "llm_enabled": model.enabled,
            "llm_model": model.model, "retrieval": "bm25"}


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
async def ask(request: AskRequest, model: Gemini = Depends(get_gemini)):
    area = get_area(request.geo_id)
    result = answer(request.question, area, document_index)
    return await model.explain(request.question, area, result)
