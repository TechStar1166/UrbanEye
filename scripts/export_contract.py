import json
from pathlib import Path

from backend.main import app

Path("shared/openapi.json").write_text(json.dumps(app.openapi(), indent=2) + "\n")
print("Exported canonical API contract to shared/openapi.json")
