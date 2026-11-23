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

O Report Viewer já cobre biblioteca e filtros, metadados/proveniência, visualização do documento oficial, navegação/deep links por página e, **quando existem `DocumentSection` persistidas**, seções extraídas e busca textual.

A sincronização oficial atual (`sync-ticker` / `sync-documents`) persiste metadados CVM e o link do documento, mas ainda não baixa/processa o PDF para gerar `DocumentSection` automaticamente. Essa lacuna está rastreada na issue #117 e é pré-requisito para declarar busca textual validada com documento real.

O checkpoint operacional reproduzível está documentado em `docs/qa/BASELINE.md`. O workflow manual `visual-smoke-data` usa PostgreSQL e dados oficiais para validar migrations, sincronização end-to-end, read-models, Screener e abertura do documento oficial no Report Viewer.

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

Depois de sincronizar os metadados CVM, o conteúdo PDF é processado explicitamente fora das requisições públicas:

```bash
python -m openmarket_api.cli process-documents --ticker PETR4 --limit 10
python -m openmarket_api.cli process-document <document_uuid>
```

A timeline corporativa é projetada automaticamente durante `sync-documents`. Para documentos já persistidos, o backfill é explícito e idempotente:

```bash
python -m openmarket_api.cli project-events --ticker PETR4
```

A API unificada fica em `GET /api/v1/assets/{ticker}/events`.

O pipeline valida origem/licença/tamanho/MIME, extrai texto por página com `pypdf` e persiste `DocumentSection` para busca e Report Viewer. Veja `docs/architecture/document-ingestion.md`.


Os dados macroeconômicos BCB e de consumo/conjuntura IBGE também são sincronizados fora do request path:

```bash
python -m openmarket_api.cli sync-data-platform
```

Isso persiste os snapshots usados por `/api/v1/macro` e `/api/v1/insights/consumer`. O estado operacional dos providers fica disponível em `/api/v1/meta/providers`, enquanto `/ready` valida somente o PostgreSQL.


Para adicionar histórico oficial de preços a um ticker já sincronizado, baixe um arquivo COTAHIST da B3 e importe o TXT ou ZIP localmente:

```bash
python -m openmarket_api.cli import-cotahist PETR4 /caminho/COTAHIST.2025.TXT
```

A série COTAHIST é armazenada como preço de fechamento não ajustado por inflação ou proventos. A aba `Desempenho & risco` calcula retorno de preço, CAGR, volatilidade, drawdown, Sharpe, Sortino e Calmar apenas sobre esses dados persistidos.


Depois da sincronização:

```text
GET /api/v1/assets/PETR4
GET /api/v1/assets/PETR4/financials
GET /api/v1/assets/PETR4/financials?statement=DRE&consolidated=true
GET /api/v1/documents?ticker=PETR4
```

As rotas públicas são read-models do PostgreSQL e não consultam provedores externos durante a requisição.

## Desenvolvimento local completo

As páginas de ativos, listas, Screener, relatórios, indicadores e desempenho dependem da API em `http://localhost:8000`. Rodar apenas `npm run dev` sobe o frontend, mas não sobe PostgreSQL nem FastAPI.

No primeiro terminal, a partir da raiz do repositório:

```bash
docker compose up --build -d
docker compose run --rm api alembic upgrade head
```

Confirme a API antes de abrir as telas de dados:

```text
http://localhost:8000/health
```

No segundo terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:3000`

Se a API estiver parada, o frontend exibe uma tela de recuperação em vez de depender do overlay de erro do Next.js.

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
