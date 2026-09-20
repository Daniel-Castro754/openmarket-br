# Indicator Data Passport

## Objetivo

O Data Passport transforma a proveniência já carregada pelas séries financeiras em um contrato auditável por indicador. Ele responde quatro perguntas:

1. qual valor foi publicado;
2. qual fórmula/metodologia produziu esse valor;
3. quais fatos participaram do cálculo;
4. quais fontes e regras de licença se aplicam a esses fatos.

O Passport não persiste uma segunda cópia da proveniência. Ele é montado a partir de `IndicatorRegistry`, `FinancialSeriesPoint`, `SourceMetadata` e dos inputs estruturados preservados pelo motor de cálculo.

## Endpoint

```http
GET /api/v1/assets/{ticker}/indicators/{slug}/provenance?frequency=annual
```

O endpoint retorna `IndicatorDataPassport`.

## Contrato

Campos principais:

- `ticker`;
- definição canônica do indicador, incluindo `methodology_version`;
- frequência;
- status `available` ou `unavailable`;
- valor e período;
- fórmula;
- flag `derived`;
- fonte do resultado;
- `inputs` usados no cálculo;
- `input_sources`;
- regra de redistribuição;
- warnings explícitos.

Cada input auditável contém:

- métrica;
- label e unidade;
- valor;
- período;
- moeda quando aplicável;
- referência e versão do filing;
- fonte;
- flag `restricted`.

## Inputs de cálculo

`FinancialSeriesPoint.calculation_inputs` é aditivo e não exige migration. Os serviços de séries preenchem esses inputs no momento do cálculo, evitando reconstrução posterior por heurística.

Hoje isso cobre, entre outros:

- margens;
- dívida bruta e líquida;
- ROE;
- crescimento YoY;
- liquidez corrente;
- ROA;
- dívida/PL;
- patrimônio/ativos;
- crescimento do lucro.

Quando um indicador não possui dados suficientes, o Passport retorna `status=unavailable`, sem inventar inputs ou fonte.

## Licença e redistribuição

O backend diferencia proveniência interna de dados publicáveis.

Valores dos inputs são expostos quando `DataLicense.redistribution` é:

- `allowed`;
- `attribution_required`.

Para `conditional`, `internal_only` ou `unknown`, o Passport preserva os metadados da fonte, mas retorna o valor do input como `null` e marca `restricted=true`.

Isso permite auditar a origem sem redistribuir conteúdo que o contrato não autoriza.

## Datas

Duas datas não devem ser confundidas:

- `reference_date`: referência econômica/contábil da fonte;
- `retrieved_at`: momento em que o OpenMarket registrou/coletou a fonte.

A UI apresenta as duas separadamente.

## Frontend

Na página de Indicadores, o ícone de informação de cada card abre o painel Data Passport.

O painel mostra:

- definição;
- fórmula;
- versão metodológica;
- valor e período;
- natureza oficial/calculada;
- tabela dos inputs;
- provider/fonte;
- data de referência;
- data de coleta;
- licença/redistribuição;
- link para a fonte quando disponível;
- warnings de indisponibilidade ou restrição.

No Screener, valores que pertencem ao Indicator Registry recebem um link discreto para o Passport da empresa correspondente.

## Regras de evolução

- Não criar outra tabela de proveniência só para o Passport.
- Não inferir documento quando o cálculo agrega múltiplas fontes.
- Não ocultar missing provenance: retornar status/warning explícito.
- Novos indicadores derivados devem preencher `calculation_inputs`.
- Mudanças metodológicas devem incrementar `methodology_version`.
- Restrições de licença devem ser aplicadas no backend, não apenas na interface.
