"""Facts/retrieval orchestration; deliberately separate from future AI interpretation."""
import re

from backend.rag.retrieve import retrieve
from backend.schemas import Answer, Area, Evidence

LIMITATIONS = [
    "Starter answers are deterministic facts or document excerpts, not AI-generated explanations.",
    "Silver Spring CDP totals are not Fenton Village statistics. Counts are from 2020.",
]


def answer(question: str, area: Area, chunks: list[Evidence]) -> Answer:
    # A deliberately narrow intent allowlist prevents unrelated or analytical
    # questions from receiving a misleading canned population answer.
    normalized = re.sub(r"[?.!]", "", question.lower()).strip()
    normalized = re.sub(r"\s+", " ", normalized)
    metric = None
    if re.fullmatch(r"(what is the population|how many people live)( here| in this area)?", normalized):
        metric = "population"
    elif re.fullmatch(r"(how many housing units( are there)?|what is the housing unit count)( here| in this area)?", normalized):
        metric = "housing_units"
    if metric:
        evidence = [e for e in area.evidence if e.metric == metric and e.value is not None]
        if evidence:
            fact = evidence[0]
            return Answer(mode="facts", summary=f"{area.name}: {fact.value:,.0f} {fact.unit} ({fact.date}).",
                          limitations=LIMITATIONS, evidence_ids=[fact.evidence_id], evidence=[fact])
    if not metric:
        evidence = retrieve(question, area.geo_id, chunks)
        if evidence:
            return Answer(mode="retrieval", summary="Retrieved passages:\n" + "\n".join(
                f"[{e.evidence_id}] {e.excerpt}" for e in evidence), limitations=LIMITATIONS,
                evidence_ids=[e.evidence_id for e in evidence], evidence=evidence)
    return Answer(mode="insufficient_evidence",
                  summary="The available evidence is insufficient to answer this question.",
                  limitations=LIMITATIONS + [
                      "Try ‘What is the population?’ or ‘How many housing units are there?’.",
                      "No public planning document is bundled yet; document RAG remains a team task.",
                  ], evidence_ids=[], evidence=[])
