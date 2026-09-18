"""Canonical v1 contract. Export OpenAPI and generate frontend types from this."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Evidence(Contract):
    evidence_id: str
    type: Literal["structured_data", "document"]
    title: str
    source: str
    url: HttpUrl
    date: str
    geo_id: str
    metric: str | None = None
    value: float | None = None
    unit: str | None = None
    excerpt: str | None = None
    page: int | None = Field(default=None, ge=1)
    section: str | None = None

    @model_validator(mode="after")
    def require_content(self):
        if self.type == "structured_data" and (not self.metric or not self.unit):
            raise ValueError("Structured evidence requires metric and unit")
        if self.type == "document" and not self.excerpt:
            raise ValueError("Document evidence requires an excerpt")
        return self


class Area(Contract):
    geo_id: str = Field(min_length=1)
    name: str
    geography_type: Literal["census_designated_place", "census_tract", "block_group"]
    boundary_vintage: str
    metrics: dict[str, float | None]
    evidence: list[Evidence]

    @model_validator(mode="after")
    def evidence_matches_metrics(self):
        if len({e.evidence_id for e in self.evidence}) != len(self.evidence):
            raise ValueError("Evidence IDs must be unique")
        for metric, value in self.metrics.items():
            if not any(e.type == "structured_data" and e.geo_id == self.geo_id
                       and e.metric == metric and e.value == value for e in self.evidence):
                raise ValueError(f"Missing matching evidence for {metric}")
        return self


class Geometry(Contract):
    type: Literal["Polygon", "MultiPolygon"]
    coordinates: list


class Feature(Contract):
    type: Literal["Feature"] = "Feature"
    id: str
    geometry: Geometry
    properties: Area

    @model_validator(mode="after")
    def id_matches(self):
        if self.id != self.properties.geo_id:
            raise ValueError("Feature.id must equal properties.geo_id")
        return self


class Areas(Contract):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    schema_version: Literal["1.0"] = "1.0"
    features: list[Feature]

    @model_validator(mode="after")
    def unique_ids(self):
        if len({f.id for f in self.features}) != len(self.features):
            raise ValueError("Duplicate geographic IDs")
        return self


class Layer(Contract):
    id: str
    label: str
    unit: str
    description: str


class AskRequest(Contract):
    question: str = Field(min_length=1, max_length=1000, pattern=r"\S")
    geo_id: str = Field(min_length=1)


class Answer(Contract):
    schema_version: Literal["1.0"] = "1.0"
    mode: Literal["facts", "retrieval", "insufficient_evidence", "llm"]
    summary: str
    limitations: list[str]
    evidence_ids: list[str]
    evidence: list[Evidence]

    @model_validator(mode="after")
    def valid_citations(self):
        if set(self.evidence_ids) != {e.evidence_id for e in self.evidence}:
            raise ValueError("Answer citations must match returned evidence")
        if self.mode != "insufficient_evidence" and not self.evidence:
            raise ValueError("An answer needs evidence")
        return self
