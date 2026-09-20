# Company Comparison 2.0

## Objetivo

O Comparador usa um único read-model agregado para comparar até quatro empresas sem fazer uma requisição HTTP para cada combinação empresa × métrica.

A semântica dos indicadores registrados vem exclusivamente do Indicator Registry. Métricas contábeis brutas permanecem em um contrato separado e explícito.

## API

```http
GET /api/v1/comparison
  ?ticker=PETR4
  &ticker=VALE3
  &metric=revenue
  &metric=net-margin
  &frequency=annual
```

Limites:

- 1 a 4 tickers;
- até 40 métricas;
- frequência `annual` ou `quarterly`.

A resposta contém:

- ativos solicitados e status de sincronização;
- frequência;
- uma coleção por chave de métrica;
- valor, período, moeda, natureza derivada e fonte por ticker.

## Chaves canônicas

### Indicadores do Registry

Consumidores devem usar o `slug` público do Registry, por exemplo:

- `net-margin`;
- `roe`;
- `roa`;
- `current-ratio`;
- `net-debt-to-equity`.

O endpoint rejeita aliases de `FinancialMetric` quando a métrica já pertence ao Registry. Exemplo: `net_margin` deve ser solicitado como `net-margin`.

Isso evita dois contratos públicos para o mesmo indicador.

### Métricas contábeis brutas

Métricas que não são indicadores mantêm a chave de `FinancialMetric`, por exemplo:

- `revenue`;
- `gross_profit`;
- `operating_result`;
- `net_income`;
- `total_assets`;
- `equity`;
- `cash`;
- fluxos de caixa.

## Frontend

A página `/comparar` combina:

1. catálogo do Indicator Registry para label, grupo, unidade, versão metodológica e frequências;
2. contrato explícito das métricas contábeis brutas;
3. uma única chamada ao endpoint agregado para valores.

Novos indicadores entram automaticamente na visão correspondente ao grupo do Registry.

## URL reproduzível

A comparação é reproduzida pelos parâmetros:

- `tickers`;
- `view`;
- `frequency`;
- `metrics` (repetível).

Exemplo:

```text
/comparar?tickers=PETR4,VALE3&view=profitability&frequency=annual&metrics=net-margin&metrics=roe&metrics=roa
```

## Frequência e indisponibilidade

A UI mantém a métrica selecionada mesmo quando a frequência não é suportada. Nesse caso o estado é explícito, por exemplo:

```text
ROA
—
Não suportado em trimestral
```

Ticker não sincronizado e falta de dado comparável também possuem mensagens distintas.

## Data Passport

Valores de indicadores registrados são links para:

```text
/ativos/{ticker}/indicadores?passport={slug}#data-passport
```

Métricas contábeis brutas não recebem um Passport de indicador artificial.

## Evolução

- Não duplicar labels/unidades/grupos de indicadores no Comparador.
- Novos grupos do Registry devem aparecer automaticamente.
- Evitar voltar ao padrão N×M de chamadas HTTP de séries.
- Otimizações futuras podem usar snapshots/materializações sem alterar o contrato público.
