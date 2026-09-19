# Retrieval storage

Reserved for a rebuildable local embedding index. Never commit credentials or large
generated indexes. The starter uses `backend/rag/retrieve.py` over the checked-in
`documents/processed/chunks.json` (three reviewed housing passages). An in-memory
BM25 inverted index is built once at API startup; it needs neither an embedding
provider nor a separate database. Rebuild excerpts with `python -m scripts.ingest_documents`.
