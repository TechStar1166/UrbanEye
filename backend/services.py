"""Facts/retrieval orchestration; deliberately separate from future AI interpretation."""
import re

from backend.rag.retrieve import DocumentIndex
from backend.schemas import Answer, Area

LIMITATIONS = [
    "Starter answers are deterministic facts or document excerpts, not AI-generated explanations.",
    "Silver Spring CDP totals are not Fenton Village statistics. Counts are from 2020.",
]


def answer(question: str, area: Area, index: DocumentIndex) -> Answer:
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
        evidence = index.retrieve(question, area.geo_id)
        if evidence:
            scope_notes = list(dict.fromkeys(e.document_scope.note for e in evidence if e.document_scope))
            return Answer(mode="retrieval",
                summary="Related passages from the indexed public planning document are shown below.",
                limitations=LIMITATIONS + scope_notes + [
                    "Keyword retrieval finds related excerpts; it does not produce an AI answer or establish current policy.",
                    "Only three reviewed housing passages are indexed, not the full plan.",
                ],
                evidence_ids=[e.evidence_id for e in evidence], evidence=evidence)
    return Answer(mode="insufficient_evidence",
                  summary="The available evidence is insufficient to answer this question.",
                  limitations=LIMITATIONS + [
                      "Try ‘What is the population?’ or ‘How many housing units are there?’.",
                      "The small document index covers housing diversity, affordable-housing preservation, and housing near transit.",
                  ], evidence_ids=[], evidence=[])
