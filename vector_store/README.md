# Retrieval storage

Reserved for a rebuildable local embedding index. Never commit credentials or large
generated indexes. The starter uses `backend/rag/retrieve.py` over the checked-in
`documents/processed/chunks.json` (initially empty), not a vector database.
