# Unified Company Event model

## Objetivo

`CompanyEvent` é o read-model temporal da companhia.

Ele não substitui documentos, demonstrações financeiras ou outras fontes canônicas. Seu papel é oferecer uma timeline única e estável para:

- eventos e comunicados;
- Document Analysis;
- Change Detection;
- Research Workspace;
- futuras integrações públicas da API/MCP.

## Fonte canônica

Na primeira versão:

```text
PublicDocument (CVM)
        |
        v
CompanyEvent projection
        |
        v
/api/v1/assets/{ticker}/events
        |
        v
Asset timeline
```

O vínculo é preservado por `source_document_id`.

O Report Viewer continua sendo o destino para leitura da evidência original.

## Identidade e idempotência

Eventos derivados de documento usam:

```text
natural_key = cvm-document:{document_id}
```

Além disso, `source_document_id` é único.

Projetar o mesmo documento novamente atualiza o evento existente, sem duplicar a timeline.

## Tipos

`event_type` descreve a natureza estrutural do evento:

- `material_fact`;
- `earnings`;
- `filing`;
- `presentation`;
- `annual_report`;
- `governance`;
- `document`.

Novas origens poderão adicionar tipos no futuro sem alterar os documentos existentes.

## Categorias

`category` é a classificação de navegação/pesquisa:

- `results`;
- `material`;
- `governance`;
- `finance`;
- `operations`;
- `calendar`;
- `regulatory`;
- `other`.

A classificação é calculada no backend usando primeiro o `DocumentType` estruturado e depois os campos oficiais da CVM. O título é apenas fallback.

Assim o frontend não mantém uma taxonomia concorrente da timeline.

## Data do evento

A projeção usa:

1. `published_at`;
2. `source.reference_date` como fallback.

Se nenhuma data rastreável existir, o documento não gera evento até que uma data esteja disponível.

Nenhuma data é inferida artificialmente.

## Proveniência

Cada evento preserva:

- `source_document_id`;
- `source_url`;
- `source_classification`;
- `SourceMetadata`;
- `origin`.

A primeira origem é `cvm_document`.

## Sincronização

`sync-documents` projeta eventos na mesma transação dos metadados CVM.

Documentos existentes podem ser backfillados:

```bash
python -m openmarket_api.cli project-events --ticker PETR4
```

O comando é idempotente.

## API

```http
GET /api/v1/assets/PETR4/events
```

Filtros:

- `category`;
- `event_type`;
- `start`;
- `end`;
- `limit`;
- `offset`.

A rota consulta apenas PostgreSQL.

## Frontend

`/ativos/{ticker}/eventos` consome a API unificada.

A timeline:

- agrupa eventos por mês;
- filtra por categoria;
- mostra classificação/proveniência;
- abre `/relatorios/{source_document_id}` quando o evento deriva de documento.

## Evolução

Document Analysis poderá acrescentar análises ligadas ao mesmo evento sem alterar a identidade temporal.

Change Detection poderá comparar análises/documentos sucessivos e publicar mudanças usando `CompanyEvent` como eixo cronológico.

Outras fontes futuras poderão criar eventos com novos valores de `origin`, mantendo a mesma API de timeline.
