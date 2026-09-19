"""Server-only Gemini adapter. Provider output never supplies source objects."""
import asyncio
import json
import os
import re
from pathlib import Path

import httpx
from pydantic import Field, ValidationError, model_validator

from backend.schemas import Answer, Area, Claim, Contract

MODEL = "gemini-3.6-flash"
SYSTEM = Path(__file__).with_name("grounding.txt").read_text()


class ModelOutput(Contract):
    supported: bool
    claims: list[Claim] = Field(max_length=4)
    limitations: list[str] = Field(max_length=4)

    @model_validator(mode="after")
    def require_claims(self):
        if self.supported != bool(self.claims):
            raise ValueError("Supported answers need claims; unsupported answers must have none")
        return self


class Gemini:
    def __init__(self, api_key: str = "", transport=None, deadline: float = 12, model: str = MODEL):
        if not re.fullmatch(r"gemini-[a-z0-9.-]+", model):
            raise ValueError("GEMINI_MODEL must be a Gemini model ID, not a URL or path")
        self.model = model
        self._api_key = api_key.strip()
        self.transport = transport
        self.deadline = deadline

    @property
    def enabled(self):
        return bool(self._api_key)

    async def explain(self, question: str, area: Area, retrieved: Answer) -> Answer:
        if retrieved.mode != "retrieval":
            return retrieved

        def fallback(reason):
            return retrieved.model_copy(update={"limitations": retrieved.limitations + [reason]})

        if not self.enabled:
            return fallback("AI explanation is not configured; showing the retrieved passages.")
        evidence = {e.evidence_id: e for e in [*retrieved.evidence, *area.evidence]}
        schema = {
            "type": "object", "additionalProperties": False,
            "properties": {
                "supported": {"type": "boolean"},
                "claims": {"type": "array", "maxItems": 4, "items": {
                    "type": "object", "additionalProperties": False,
                    "properties": {
                        "text": {"type": "string"},
                        "evidence_ids": {"type": "array", "minItems": 1,
                                         "items": {"type": "string", "enum": list(evidence)}},
                    }, "required": ["text", "evidence_ids"],
                }},
                "limitations": {"type": "array", "maxItems": 4, "items": {"type": "string"}},
            }, "required": ["supported", "claims", "limitations"],
        }
        context = {"question": question, "selected_area": {
            "geo_id": area.geo_id, "name": area.name, "geography_type": area.geography_type,
        }, "evidence": [e.model_dump(mode="json") for e in evidence.values()]}
        payload = {
            "systemInstruction": {"parts": [{"text": SYSTEM}]},
            "contents": [{"role": "user", "parts": [{"text": json.dumps(context)}]}],
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": 1200,
                "responseMimeType": "application/json", "responseJsonSchema": schema},
        }
        if self.model.startswith("gemini-2.5-"):
            payload["generationConfig"]["thinkingConfig"] = {"thinkingBudget": 0}
        elif self.model.startswith("gemini-3") and "flash" in self.model:
            payload["generationConfig"]["thinkingConfig"] = {"thinkingLevel": "MINIMAL"}
        try:
            async with asyncio.timeout(self.deadline):
                async with httpx.AsyncClient(timeout=10, transport=self.transport) as client:
                    response = await client.post(
                        f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent",
                        headers={"x-goog-api-key": self._api_key}, json=payload)
            if response.status_code in {401, 403}:
                return fallback("Gemini could not authenticate or authorize this request; showing retrieved passages.")
            if response.status_code == 404:
                return fallback(f"{self.model} is unavailable to this API project. Choose an available GEMINI_MODEL in the backend configuration; showing retrieved passages.")
            if response.status_code == 429:
                return fallback("Gemini is rate-limited or out of quota; showing retrieved passages.")
            response.raise_for_status()
            body = response.json()
            if body.get("promptFeedback", {}).get("blockReason"):
                return fallback("Gemini declined this request; showing retrieved passages.")
            candidate = body["candidates"][0]
            if candidate.get("finishReason") != "STOP":
                return fallback("Gemini did not produce a complete answer; showing retrieved passages.")
            text = "".join(p.get("text", "") for p in candidate["content"]["parts"] if not p.get("thought"))
            output = ModelOutput.model_validate_json(text)
            if not output.supported:
                return fallback("The model found insufficient evidence to answer; related passages remain available.")
            ids = list(dict.fromkeys(eid for claim in output.claims for eid in claim.evidence_ids))
            if not set(ids).issubset(evidence):
                return fallback("The model's citations could not be verified; showing retrieved passages.")
            notes = list(dict.fromkeys(e.document_scope.note for e in evidence.values() if e.document_scope))
            return Answer(mode="llm", summary=" ".join(c.text for c in output.claims), claims=output.claims,
                evidence_ids=ids, evidence=[evidence[eid] for eid in ids],
                limitations=notes + [
                    "AI explanation based on supplied evidence; citations do not by themselves prove every interpretation.",
                    "Planning recommendations date to 2022; Census counts date to 2020. They do not establish current conditions.",
                ] + output.limitations)
        except (TimeoutError, httpx.TimeoutException):
            return fallback("Gemini timed out; showing the retrieved passages.")
        except (httpx.HTTPError, ValidationError, ValueError, KeyError, IndexError, TypeError, AttributeError):
            # Never expose provider error bodies, prompts, credentials, or request headers.
            return fallback("Gemini returned an unavailable or invalid answer; showing retrieved passages.")


def get_gemini() -> Gemini:
    enabled = os.getenv("GEMINI_ENABLED", "true").lower() not in {"0", "false", "no"}
    return Gemini(os.getenv("GEMINI_API_KEY", "") if enabled else "",
                  model=os.getenv("GEMINI_MODEL", MODEL).strip() or MODEL)
