from openmarket_api.core.settings import Settings


def test_cors_origins_accept_single_environment_url(monkeypatch) -> None:
    monkeypatch.setenv("OPENMARKET_CORS_ORIGINS", "http://localhost:3000")

    settings = Settings()

    assert settings.cors_origins == ["http://localhost:3000"]


def test_cors_origins_accept_comma_separated_environment_urls(monkeypatch) -> None:
    monkeypatch.setenv(
        "OPENMARKET_CORS_ORIGINS",
        "http://localhost:3000, http://127.0.0.1:3000",
    )

    settings = Settings()

    assert settings.cors_origins == ["http://localhost:3000", "http://127.0.0.1:3000"]
