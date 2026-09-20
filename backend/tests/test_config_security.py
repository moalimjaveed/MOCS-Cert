"""Regression tests for deployment-safe configuration defaults."""

from backend.app.config import Settings


def test_cors_rejects_wildcard_origins_with_credentials():
    try:
        Settings(CORS_ORIGINS=["*"])
    except ValueError as exc:
        assert "explicit origins" in str(exc)
    else:
        raise AssertionError("Wildcard CORS origins must be rejected")


def test_environment_overrides_are_applied(monkeypatch):
    monkeypatch.setenv("MOCS_CORS_ORIGINS", "https://studio.example, https://admin.example")
    monkeypatch.setenv("MOCS_DEFAULT_HOST", "0.0.0.0")  # nosec B104 - testing env override handling
    monkeypatch.setenv("MOCS_DEFAULT_PORT", "9000")

    settings = Settings.from_environment()

    assert settings.CORS_ORIGINS == ["https://studio.example", "https://admin.example"]
    assert settings.DEFAULT_HOST == "0.0.0.0"  # nosec B104 - asserting env override result
    assert settings.DEFAULT_PORT == 9000
