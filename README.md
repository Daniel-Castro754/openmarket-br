# OpenMarket BR

Plataforma open source brasileira para dados, pesquisa e visualização do mercado financeiro.

## Objetivos

- integrar fontes públicas por meio de providers substituíveis;
- manter proveniência e regras de uso/licença junto de cada dado;
- expor API estável para visualizador web, screeners, documentos e IA;
- permitir contribuição comunitária sem acoplar o domínio a uma fonte específica;
- servir de base pública para aplicações privadas, sem receber dados pessoais delas.

## Estado

**Fase 1 – Market Core.** O projeto possui contratos de domínio/provider, ingestão cadastral e financeira da CVM, API, frontend mínimo, PostgreSQL, migrations Alembic, Docker Compose, testes e CI.

## Stack

- Python 3.13 + FastAPI
- Pydantic
- SQLAlchemy + Alembic
- PostgreSQL 18
- Next.js 16 + TypeScript
- Docker Compose
- Pytest + Ruff

## Rodando a API localmente

```bash
cd backend
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# Linux/macOS: source .venv/bin/activate
pip install -e ".[dev]"
alembic upgrade head
fastapi dev src/openmarket_api/main.py
```

API: `http://localhost:8000`

Health check: `GET /health`

## Docker

Suba PostgreSQL e API:

```bash
docker compose up --build -d
```

Aplique as migrations:

```bash
docker compose run --rm api alembic upgrade head
```

Para criar uma nova migration durante o desenvolvimento:

```bash
cd backend
alembic revision --autogenerate -m "descricao da mudanca"
```

## Persistência

A camada `openmarket_api.persistence` é independente dos providers. A ingestão resolve dados externos no domínio e só depois os persiste. Companhias são reconciliadas por código CVM/CNPJ e fatos contábeis usam uma chave natural para tornar sincronizações repetidas idempotentes.

## Princípios

1. O domínio não importa código de B3, CVM ou qualquer fornecedor.
2. Toda fonte entra por um Provider.
3. Dados carregam proveniência e escopo de licença.
4. A aplicação pública nunca recebe dados pessoais do Personal Investor.
5. `main` deve permanecer executável; mudanças entram por Pull Request.
6. Ingestão e persistência permanecem desacopladas.

Consulte `docs/architecture/overview.md`.
