"""Rebuild reviewed passages from a pinned source PDF; no model or embeddings.

Run `python -m scripts.ingest_documents --download` for an explicit source download.
The app itself uses committed chunks and never downloads PDFs at startup.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
from urllib.request import urlopen

from pypdf import PdfReader

from backend.data import ROOT
from backend.schemas import Evidence


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def extract_passage(text: str, selection: dict) -> str:
    normalized = re.sub(r"\s+", " ", text).strip()
    start, end = selection["start_char"], selection["end_char"]
    if not 0 <= start < end <= len(normalized):
        raise ValueError("Passage offsets fall outside extracted page text")
    excerpt = normalized[start:end]
    if digest(excerpt.encode()) != selection["excerpt_sha256"]:
        raise ValueError("Extracted passage changed; review the source and parser before updating offsets")
    return excerpt


def ingest(download: bool = False) -> None:
    sources = json.loads((ROOT / "documents/sources.json").read_text())
    chunks, records = [], []
    for source in sources:
        # Metadata is checked-in configuration, not user-submitted input.
        path = ROOT / "documents/raw" / source["raw_file"]
        if Path(source["raw_file"]).name != source["raw_file"]:
            raise ValueError("Source filename must not contain a path")
        if not path.exists():
            if not download:
                raise FileNotFoundError(f"Missing {path.name}; run with --download to fetch the pinned source")
            with urlopen(source["url"], timeout=60) as response:
                raw = response.read()
            if digest(raw) != source["raw_sha256"]:
                raise ValueError("Downloaded source hash changed; review before accepting a new source")
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(raw)
        if digest(path.read_bytes()) != source["raw_sha256"]:
            raise ValueError("Cached PDF does not match the reviewed source hash")
        reader = PdfReader(path)
        pages = {}
        for selection in source["passages"]:
            page = selection["pdf_page"]
            if not 1 <= page <= len(reader.pages):
                raise ValueError("Invalid PDF page")
            if reader.page_labels[page - 1] != selection["page_label"]:
                raise ValueError("Printed page label changed")
            if page not in pages:
                pages[page] = reader.pages[page - 1].extract_text() or ""
            excerpt = extract_passage(pages[page], selection)
            chunk = Evidence(
                evidence_id=f"{source['document_id']}:{selection['key']}:{selection['excerpt_sha256'][:12]}",
                type="document", title=source["title"], source=source["source"],
                url=f"{source['url']}#page={page}", date=source["date"], geo_id=source["geo_id"],
                excerpt=excerpt, page=page, page_label=selection["page_label"],
                section=selection["section"], document_scope=source["document_scope"],
            )
            chunks.append(chunk.model_dump(mode="json"))
            records.append({"evidence_id": chunk.evidence_id, "source_sha256": source["raw_sha256"],
                            "excerpt_sha256": selection["excerpt_sha256"], "pdf_page": page,
                            "start_char": selection["start_char"], "end_char": selection["end_char"]})
    if len({c["evidence_id"] for c in chunks}) != len(chunks):
        raise ValueError("Duplicate document evidence IDs")
    encoded = json.dumps(chunks, indent=2, ensure_ascii=False) + "\n"
    output = ROOT / "documents/processed"
    output.mkdir(parents=True, exist_ok=True)
    # Write only after every source and passage has passed validation.
    (output / "chunks.json").write_text(encoded, encoding="utf-8", newline="\n")
    (output / "manifest.json").write_text(json.dumps({
        "chunks_sha256": digest(encoded.encode()), "parser": "pypdf==6.1.3",
        "index": "In-memory BM25 rebuilt at API startup from committed chunks",
        "passages": records,
    }, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"Verified and extracted {len(chunks)} passages from {len(sources)} public document(s).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download", action="store_true", help="Fetch missing source PDFs explicitly")
    ingest(parser.parse_args().download)
