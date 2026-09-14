# OpenMarket BR

Plataforma open source brasileira para dados, pesquisa e visualização do mercado financeiro.

## Objetivos

- integrar fontes públicas por meio de providers substituíveis;
- manter proveniência e regras de uso/licença junto de cada dado;
- expor API estável para visualizador web, screeners, documentos e IA;
- permitir contribuição comunitária sem acoplar o domínio a uma fonte específica;
- servir de base pública para aplicações privadas, sem receber dados pessoais delas.

## Estado

**Market Core e MVP do Report Viewer concluídos em código.** O projeto possui providers oficiais CVM/B3, resolução de ticker para companhia, ingestão de DFP/ITR, PostgreSQL, migrations Alembic, read-model de ativos, séries financeiras, indicadores derivados, Screener fundamentalista, Document Hub, provider CVM IPE, API, frontend, Docker Compose, testes e CI.

O Report Viewer já cobre biblioteca e filtros, metadados/proveniência, visualização do documento oficial, seções extraídas, busca textual, navegação por seção/página e deep links por página. A próxima fronteira de produto é a camada de análise estruturada descrita em `docs/architecture/report-viewer.md`.

**Checkpoint operacional ainda pendente:** validar o fluxo completo com documento real processado no ambiente PostgreSQL/Chromium, incluindo PDF incorporado, busca em seções extraídas e deep link por página. O código e o CI regular estão verdes, mas isso não substitui o QA data-backed do visualizador.

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

## Sincronizando um ticker ponta a ponta

O site público lê o banco local. A atualização de dados é feita separadamente pelo worker/CLI, para que uma visita à página não dispare downloads da B3 ou CVM.

Para sincronizar instrumento B3, companhia CVM, DFP/ITR e metadados de documentos IPE em um único fluxo:

```bash
cd backend
python -m openmarket_api.cli sync-ticker PETR4 --start 2025-01-01
```

O comando falha explicitamente se o ticker não puder ser vinculado a uma companhia CVM. Em caso de sucesso, o resumo final informa o código CVM, a quantidade de fatos financeiros e a quantidade de documentos sincronizados.

Os comandos separados continuam disponíveis para diagnóstico e manutenção:

```bash
python -m openmarket_api.cli sync-asset PETR4 --start 2025-01-01
python -m openmarket_api.cli sync-documents PETR4 --start 2025-01-01
```

Depois da sincronização:

```text
GET /api/v1/assets/PETR4
GET /api/v1/assets/PETR4/financials
GET /api/v1/assets/PETR4/financials?statement=DRE&consolidated=true
GET /api/v1/documents?ticker=PETR4
```

As rotas públicas são read-models do PostgreSQL e não consultam provedores externos durante a requisição.

## Docker

Suba PostgreSQL e API:

```bash
docker compose up --build -d
```

Aplique as migrations:

```bash
docker compose run --rm api alembic upgrade head
```

Execute o checkpoint ponta a ponta dentro do container:

```bash
docker compose run --rm api python -m openmarket_api.cli sync-ticker PETR4 --start 2025-01-01
```

Para criar uma nova migration durante o desenvolvimento:

```bash
cd backend
alembic revision --autogenerate -m "descricao da mudanca"
```

## Persistência

A camada `openmarket_api.persistence` é independente dos providers. A ingestão resolve dados externos no domínio e só depois os persiste. Companhias são reconciliadas por código CVM/CNPJ, instrumentos por bolsa+ticker e fatos contábeis usam uma chave natural para tornar sincronizações repetidas idempotentes.

## Princípios

1. O domínio não importa código de B3, CVM ou qualquer fornecedor.
2. Toda fonte entra por um Provider.
3. Dados carregam proveniência e escopo de licença.
4. A aplicação pública nunca recebe dados pessoais do Personal Investor.
5. `main` deve permanecer executável; mudanças entram por Pull Request.
6. Ingestão e persistência permanecem desacopladas.
7. Requisições públicas leem dados persistidos; sincronização de fontes externas ocorre fora do request path.

Consulte `docs/architecture/overview.md`.
