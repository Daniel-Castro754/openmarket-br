# Data Platform

## Objetivo

A Fase C consolida fontes externas como providers observáveis e separa definitivamente:

```text
external source -> sync/worker -> PostgreSQL -> public API
```

A API pública não usa BCB, IBGE, B3 ou CVM como fallback durante uma requisição.

## Provider Registry 2.0

Todos os providers implementam `Provider` e expõem `healthcheck()` para workers e diagnóstico.

O registry descreve capabilities sem conhecer persistência:

- `company_search`;
- `instrument_search`;
- `quotes`;
- `financial_statements`;
- `documents`;
- `macro_snapshot`;
- `consumer_insights`.

Providers macro oficiais nesta etapa:

- `bcb-macro`;
- `ibge-consumer`.

O endpoint:

```http
GET /api/v1/meta/providers
```

combina descriptors do registry com o último estado de sincronização persistido. Ele não executa healthchecks externos.

## Snapshots

`provider_snapshots` mantém um read-model atual por:

```text
dataset + provider
```

Datasets iniciais:

- `macro` -> `MacroSnapshot` do Banco Central;
- `consumer_insights` -> `ConsumerInsightSnapshot` do IBGE.

Uma nova sincronização substitui o snapshot atual do mesmo provider/dataset. O histórico analítico continua dentro das séries contidas no payload.

## Sync runs

`provider_sync_runs` registra cada tentativa:

- provider;
- dataset;
- status `success` ou `failed`;
- início;
- fim;
- quantidade de itens;
- erro, quando houver.

Se uma fonte externa falhar:

1. a execução é registrada como `failed`;
2. o último snapshot válido não é sobrescrito;
3. a API continua servindo o último snapshot persistido.

## CLI

Sincronizar somente Banco Central:

```bash
python -m openmarket_api.cli sync-macro
```

Sincronizar somente IBGE:

```bash
python -m openmarket_api.cli sync-consumer-insights
```

Sincronizar ambos:

```bash
python -m openmarket_api.cli sync-data-platform
```

Em Docker:

```bash
docker compose run --rm api python -m openmarket_api.cli sync-data-platform
```

## Read models públicos

```http
GET /api/v1/macro
GET /api/v1/insights/consumer
```

Essas rotas consultam apenas PostgreSQL.

Se ainda não existir snapshot, retornam `503` com estado explícito de não sincronizado. Elas não tentam baixar os dados durante o GET.

## Saúde operacional

Liveness:

```http
GET /health
```

É barato e não consulta banco ou providers.

Readiness:

```http
GET /ready
```

Valida apenas a conectividade com PostgreSQL.

Provider status:

```http
GET /api/v1/meta/providers
```

Retorna capabilities e últimos sync runs persistidos.

## Healthcheck de provider

`provider.healthcheck()` continua existindo para workers, manutenção e diagnósticos explícitos.

Ele não é chamado automaticamente por:

- `/health`;
- `/ready`;
- `/api/v1/meta/providers`;
- rotas de dados públicas.

Isso evita que uma indisponibilidade externa torne o OpenMarket indisponível mesmo com dados válidos em cache persistido.
