import pytest


@pytest.fixture(autouse=True)
def no_live_model_calls(monkeypatch):
    """Tests never spend quota or depend on a developer's local credentials."""
    monkeypatch.setenv("GEMINI_ENABLED", "false")
