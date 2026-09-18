"""Replaceable lexical baseline, scoped to an exact geographic ID.

This is not an embedding/vector index. The initial corpus is intentionally empty.
"""
import re

from backend.schemas import Evidence

STOP_WORDS = {"a", "an", "the", "in", "this", "area", "what", "do", "does", "say", "about",
              "is", "are", "of", "and", "to", "for", "planning", "documents"}


def retrieve(question: str, geo_id: str, chunks: list[Evidence], limit: int = 3) -> list[Evidence]:
    terms = set(re.findall(r"[a-z]+", question.lower())) - STOP_WORDS
    scored = []
    for chunk in chunks:
        if chunk.geo_id != geo_id:
            continue
        words = set(re.findall(r"[a-z]+", f"{chunk.title} {chunk.excerpt}".lower()))
        score = len(terms & words)
        if score:
            scored.append((score, chunk))
    return [chunk for _, chunk in sorted(scored, key=lambda item: (-item[0], item[1].evidence_id))[:limit]]
