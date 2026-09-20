# Baseline operacional e QA data-backed

Este documento registra o checkpoint operacional da issue #114.

## Objetivo

Antes de ampliar o OpenMarket BR, provar de forma reproduzível que o núcleo atual funciona com PostgreSQL e dados oficiais, sem confundir "código implementado" com "fluxo real validado".

## Gates regulares

### Backend

```bash
cd backend
python -m pip install -e ".[dev]"
pytest
ruff check src tests
```

O workflow `.github/workflows/backend-ci.yml` executa esses checks em pull requests e pushes para `main`.

### Frontend

```bash
cd frontend
npm install
npm run lint
npm run build
```

O workflow `.github/workflows/frontend-ci.yml` deve executar **lint e build**. Build verde sozinho não substitui ESLint.

## Checkpoint com banco vazio

Com PostgreSQL disponível e `OPENMARKET_DATABASE_URL` configurada:

```bash
cd backend
alembic upgrade head
python -m openmarket_api.cli sync-ticker PETR4 --start 2025-01-01 --end 2026-12-31
```

O comando deve:

1. resolver o instrumento B3;
2. vincular a companhia CVM;
3. persistir fatos financeiros;
4. persistir metadados de documentos IPE;
5. concluir sem exigir chamadas externas durante as requisições públicas posteriores.

Para enriquecer séries financeiras históricas sem ampliar desnecessariamente a janela documental:

```bash
python -m openmarket_api.cli sync-asset PETR4 --start 2021-01-01 --end 2026-12-31
```

## Workflow data-backed

`.github/workflows/visual-smoke-data.yml` é o checkpoint manual de dados reais.

Ele:

1. sobe PostgreSQL 18 descartável;
2. aplica todas as migrations;
3. executa `sync-ticker` de ponta a ponta;
4. enriquece o histórico financeiro;
5. sobe a API;
6. valida asset, indicadores e documentos;
7. executa Playwright com `QA_REQUIRE_DATA=1`;
8. valida o Report Viewer com um documento oficial sincronizado;
9. guarda relatório Playwright e log da API como artefatos.

O workflow é manual porque B3/CVM são dependências externas e não devem tornar todo PR instável.

## Matriz mínima de rotas

O smoke visual cobre, entre outras:

- Home;
- Empresa;
- Indicadores;
- Financeiro;
- Comparador;
- Screener;
- Relatórios;
- Report Viewer de documento oficial;
- mobile;
- impressão;
- combinações representativas de tema/navegação.

## Gap conhecido: extração de conteúdo real

O pipeline atual de sincronização de documentos persiste metadados e `source_url`, porém **não baixa/processa o PDF e não cria `DocumentSection`**.

A UI já sabe exibir:

- seções;
- busca textual;
- links para página;
- conteúdo extraído.

O repository também já sabe persistir `DocumentSection`.

Entretanto, sem um processador real, um documento recém-sincronizado permanece sem seções. Portanto:

- o viewer de documento oficial pode e deve ser validado agora;
- o deep link do PDF pode ser validado;
- busca em texto extraído de um documento real **não pode ser declarada validada** ainda.

Esse gap está rastreado pela issue #117.

## Critério de encerramento da #114

A issue #114 pode encerrar quando:

- backend CI estiver verde;
- frontend lint + build estiverem verdes;
- migrations aplicarem em PostgreSQL vazio;
- `sync-ticker` estiver provado no workflow manual;
- screener e indicadores tiverem dados reais;
- documentos oficiais estiverem acessíveis no viewer;
- Playwright data-backed estiver verde;
- o gap de extração permanecer explicitamente rastreado por #117, sem alegação de que busca real foi validada.

O processamento de documentos reais não deve ser implementado como correção silenciosa dentro do baseline; é uma capacidade própria, com segurança, licenciamento e testes específicos.
