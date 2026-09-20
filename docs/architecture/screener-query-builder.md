# Screener Query Builder 2.0

## Objetivo

O Screener continua usando o mesmo contrato de filtros simples, snapshots persistentes e Indicator Registry, mas passa a representar o workspace completo em URL.

Não existe linguagem SQL livre nem árvore arbitrária de condições nesta fase.

## Filtros

Formato preservado:

```text
filter=metric:operator:value
```

Operadores:

- `gt`
- `gte`
- `lt`
- `lte`

Exemplo:

```text
filter=roe:gte:15
filter=current_ratio:gte:1.2
```

## Lógica

Novo parâmetro:

```text
logic=and|or
```

- `and` é o default e mantém a semântica de URLs antigas;
- `or` aceita a empresa quando qualquer filtro é verdadeiro.

## Estado reproduzível

A URL pode representar:

- `q`: busca por ticker/empresa;
- `filter`: regras repetíveis;
- `logic`: AND/OR;
- `sort`;
- `direction`;
- `column`: colunas visíveis repetíveis;
- `offset`.

Ticker e Empresa são colunas estruturais obrigatórias e não precisam aparecer em `column`.

Exemplo:

```text
/screener?q=PETR&filter=current_ratio:gte:1&filter=roe:gte:15&logic=or&sort=roe&direction=desc&column=roe&column=current_ratio&column=latest_period
```

## Compatibilidade

Links antigos continuam válidos:

```text
/screener?filter=roe:gte:15
```

é equivalente a:

```text
/screener?filter=roe:gte:15&logic=and
```

As chaves públicas atuais do Screener não foram renomeadas. Indicadores associados a `FinancialMetric` continuam usando a chave financeira existente; indicadores puramente derivados usam o slug do Registry.

## Indicator Registry e Data Passport

O catálogo continua fornecendo:

- labels;
- grupos;
- unidades;
- disponibilidade anual;
- mapeamento para Data Passport.

Valores registrados permanecem navegáveis para:

```text
/ativos/{ticker}/indicadores?passport={slug}#data-passport
```

## Persistência de colunas

A seleção de colunas deixa de existir apenas no estado React. Ao aplicar a configuração, a seleção é gravada em parâmetros `column`, permitindo compartilhar e recarregar a mesma visão.

## QA

Backend:

- AND default;
- AND explícito;
- OR;
- nenhuma regra verdadeira.

Frontend data-backed:

- restauração de busca;
- duas regras;
- lógica OR;
- sort/direction;
- colunas;
- recarga da mesma URL;
- resultado real;
- colunas obrigatórias bloqueadas.
