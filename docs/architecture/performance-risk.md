# Performance & Risk Analytics

## Objetivo

A camada de Performance & Risk calcula métricas exclusivamente sobre histórico de preços persistido no PostgreSQL.

O request path não acessa B3, CVM ou qualquer fonte externa.

## Price History

Tabela:

```text
quotes
- instrument_id
- as_of
- provider
- price
- currency
- source
```

Chave única:

```text
instrument_id + as_of + provider
```

A importação é idempotente.

## COTAHIST

O primeiro importador suporta arquivo oficial B3 COTAHIST em:

- TXT;
- ZIP contendo um ou mais TXT.

Comando:

```bash
python -m openmarket_api.cli import-cotahist PETR4 /caminho/COTAHIST.2025.TXT
```

Também aceita:

```bash
python -m openmarket_api.cli import-cotahist PETR4 /caminho/cotahist.zip --start 2021-01-01 --end 2026-12-31
```

O parser utiliza o layout fixo de 245 posições e considera, nesta fase:

- registro 01;
- ticker exato;
- mercado à vista (TPMERC 010);
- data do pregão;
- moeda;
- PREULT, preço do último negócio/fechamento.

## Limitação metodológica

A própria B3 informa que a série histórica não é ajustada por:

- inflação;
- dividendos;
- bonificações;
- direitos de subscrição;
- demais proventos.

Portanto, o OpenMarket classifica esta série como:

```text
price_basis = unadjusted_close
```

As métricas são de **retorno de preço**, não de retorno total ao acionista.

## API

```http
GET /api/v1/assets/{ticker}/prices
GET /api/v1/assets/{ticker}/performance?window=1y
```

Janelas:

- `1y`;
- `3y`;
- `5y`;
- `max`.

Risk-free pode ser informado explicitamente:

```http
GET /api/v1/assets/PETR4/performance?window=3y&risk_free_rate=10.5
```

O default é 0% a.a. enquanto CDI persistido ainda não fizer parte da plataforma.

## Métricas

- retorno acumulado;
- CAGR;
- volatilidade anualizada com 252 pregões;
- drawdown máximo;
- Sharpe;
- Sortino;
- Calmar;
- melhor retorno diário;
- pior retorno diário.

## Benchmark

O endpoint aceita `benchmark={ticker}` somente quando o benchmark possui série persistida na mesma base.

Exemplo:

```http
GET /api/v1/assets/PETR4/performance?window=3y&benchmark=BOVA11
```

Nenhum benchmark é baixado automaticamente durante a requisição.

IBOV/CDI entram quando suas séries forem persistidas pelos providers correspondentes.

## Estado insuficiente

Com zero ou uma observação, a API retorna:

```text
status = insufficient_data
```

A UI mostra a instrução de importação, em vez de produzir zeros ou métricas fictícias.

## Frontend

Rota:

```text
/ativos/{ticker}/desempenho
```

A tela contém:

- cards de retorno e risco;
- curva de preço normalizada em base 100;
- curva de drawdown;
- janelas 1/3/5 anos e máximo;
- benchmark persistido quando solicitado;
- fonte, qualidade, licença e avisos metodológicos.

## Evolução

Ajuste por dividendos, CDI, IBOV e retorno total exigem séries persistidas e metodologia própria. Não devem ser inferidos a partir do COTAHIST bruto.
