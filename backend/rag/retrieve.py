"""Small, deterministic BM25 index with reviewed geographic scope and abstention.

This lexical index is built once at API startup. It is not an embedding index and
does not establish that a passage fully answers a question.
"""
import math
import re
from collections import Counter, defaultdict

from backend.schemas import Evidence

STOP_WORDS = set("""a an the in this that area what do does say says about is are of and to for
    how where should here there with on at by from it its as be can tell me us please
    planning documents document plan plans according recommendations recommend goals
    silver spring fenton village downtown adjacent communities options exist""".split())
ALIASES = {
    "homes": "housing", "home": "housing", "houses": "housing",
    "affordability": "affordable", "diverse": "diversity",
    "preservation": "preserve", "preserving": "preserve", "preserves": "preserve",
    "built": "build", "building": "build", "buildings": "build",
    "families": "family", "seniors": "senior", "types": "type", "units": "unit",
}


def terms(text: str) -> list[str]:
    return [ALIASES.get(word, word) for word in re.findall(r"[a-z]+", text.lower())
            if word not in STOP_WORDS]


def applies_to(chunk: Evidence, geo_id: str) -> bool:
    return chunk.geo_id == geo_id or (
        chunk.document_scope is not None and geo_id in chunk.document_scope.context_geo_ids)


class DocumentIndex:
    def __init__(self, chunks: list[Evidence]):
        self.chunks = tuple(chunks)
        if any(c.type != "document" for c in self.chunks):
            raise ValueError("Only document evidence can be indexed")
        if len({c.evidence_id for c in self.chunks}) != len(self.chunks):
            raise ValueError("Duplicate document evidence IDs")
        self.postings: dict[str, dict[int, int]] = defaultdict(dict)
        self.lengths = []
        for i, chunk in enumerate(self.chunks):
            tokens = terms(f"{chunk.section or ''} {chunk.excerpt}")
            self.lengths.append(len(tokens))
            for token, frequency in Counter(tokens).items():
                self.postings[token][i] = frequency
        self.average_length = sum(self.lengths) / len(self.chunks) if self.chunks else 1

    def retrieve(self, question: str, geo_id: str, limit: int = 3) -> list[Evidence]:
        query = set(terms(question))
        if not query or limit <= 0:
            return []
        scores: dict[int, float] = defaultdict(float)
        matches: Counter[int] = Counter()
        n = len(self.chunks)
        for token in sorted(query):
            postings = self.postings.get(token, {})
            inverse_frequency = math.log(1 + (n - len(postings) + 0.5) / (len(postings) + 0.5))
            for i, frequency in postings.items():
                if not applies_to(self.chunks[i], geo_id):
                    continue
                length_ratio = self.lengths[i] / (self.average_length or 1)
                scores[i] += inverse_frequency * frequency * 2.2 / (frequency + 1.2 * (0.25 + 0.75 * length_ratio))
                matches[i] += 1
        # Do not retrieve a passage just because one generic topic word overlaps.
        ranked = [i for i in scores if matches[i] / len(query) >= 0.6]
        ranked.sort(key=lambda i: (-scores[i], self.chunks[i].evidence_id))
        return [self.chunks[i] for i in ranked[:limit]]


def retrieve(question: str, geo_id: str, chunks: list[Evidence], limit: int = 3) -> list[Evidence]:
    """Convenience entry point for offline evaluation; API reuses its startup index."""
    return DocumentIndex(chunks).retrieve(question, geo_id, limit)
