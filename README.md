# OpenMarket BR

Plataforma open source brasileira para dados, pesquisa e visualização do mercado financeiro.

## Objetivos

- integrar fontes públicas por meio de providers substituíveis;
- manter proveniência e regras de uso/licença junto de cada dado;
- expor API estável para visualizador web, screeners, documentos e IA;
- permitir contribuição comunitária sem acoplar o domínio a uma fonte específica;
- servir de base pública para aplicações privadas, sem receber dados pessoais delas.

## Estado

**Fase 0 – Fundação.** O projeto já possui contratos de domínio/provider, API de saúde, registry de providers, frontend mínimo, Docker Compose, testes e CI.

## Stack

- Python 3.13 + FastAPI
- Pydantic
- PostgreSQL 18
- Next.js 16 + TypeScript
- Docker Compose
- Pytest

## Rodando a API localmente

```bash
cd backend
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# Linux/macOS: source .venv/bin/activate
pip install -e ".[dev]"
fastapi dev src/openmarket_api/main.py
```

API: `http://localhost:8000`

Health check: `GET /health`

## Docker

```bash
docker compose up --build
```

## Princípios

1. O domínio não importa código de B3, CVM ou qualquer fornecedor.
2. Toda fonte entra por um Provider.
3. Dados carregam proveniência e escopo de licença.
4. A aplicação pública nunca recebe dados pessoais do Personal Investor.
5. `main` deve permanecer executável; mudanças entram por Pull Request.

Consulte `docs/architecture/overview.md`.
