# Indicator Registry

## Objetivo

O catálogo de indicadores é uma definição semântica compartilhada. Ele não é o motor de cálculo e não deve ser duplicado no frontend, Screener, Comparador ou futuras integrações.

## Componentes

```text
IndicatorDefinition
        │
        ▼
IndicatorRegistry
        │
        ├── IndicatorEngine
        ├── /api/v1/indicators/catalog
        ├── Screener
        ├── páginas de empresa
        └── futuro Data Passport
```

O registry vive em `openmarket_api.services.indicator_registry`. O `IndicatorEngine` recebe as definições do registry e continua responsável apenas por resolver séries e produzir valores/histórico.

## Contrato

Cada `IndicatorDefinition` contém:

- `slug`: identificador público estável;
- `metric`: métrica financeira base quando existir;
- `label` e `short_label`;
- `group` e `group_label`;
- descrição;
- unidade e formato;
- fórmula;
- dependências;
- frequências suportadas;
- capacidades de histórico/benchmark/dados de mercado;
- `methodology_version`;
- notas metodológicas opcionais.

## Compatibilidade

Slugs são contratos públicos. Alterar um slug exige estratégia explícita de compatibilidade.

Adicionar metadata é preferível a duplicar arrays de labels/unidades em consumidores. Métricas contábeis simples que não são indicadores continuam pertencendo ao contrato de `FinancialMetric`; elas não devem ser artificialmente convertidas em indicadores apenas para reutilizar o registry.

## Como adicionar um indicador

1. adicionar a definição uma vez em `INDICATOR_CATALOG`;
2. apontar para uma `FinancialMetric` existente ou implementar a série derivada;
3. declarar dependências e frequências;
4. definir a versão metodológica;
5. adicionar testes do cálculo e da definição;
6. consumidores compatíveis devem descobrir a metadata pelo catálogo, não redefini-la.

## Proveniência

O registry descreve **o que o indicador significa**. A proveniência de um valor específico — fatos usados, fontes, datas e licença — pertence ao Data Passport e será construída sobre as séries já rastreáveis.
