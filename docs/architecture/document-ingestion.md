# Document ingestion pipeline

## Objetivo

A Fase D inicia com um pipeline reproduzível para transformar metadados públicos da CVM em texto pesquisável com rastreabilidade por página.

```text
CVM IPE metadata
      |
      v
public_documents (pending)
      |
      v
process-document / process-documents
      |
      +--> trusted CVM download
      +--> MIME / size / URL / license checks
      +--> pypdf extraction
      +--> DocumentSection per text page
      |
      v
public_documents (ready | failed)
      |
      v
API / Report Viewer / text search / page deep link
```

O processamento nunca ocorre dentro de um GET público.

## Segurança de download

`CVMDocumentContentProvider` aceita somente documentos já persistidos cuja proveniência seja `cvm-ipe-documents`.

Antes do download:

- exige licença com redistribuição `allowed` ou `attribution_required`;
- exige HTTP(S);
- rejeita credenciais embutidas na URL;
- aceita apenas hosts CVM explicitamente permitidos;
- valida cada redirect antes de segui-lo;
- limita redirects;
- aplica timeout específico de documentos;
- valida `Content-Length` quando presente;
- interrompe streaming quando excede o limite;
- valida MIME binário/PDF;
- exige assinatura real `%PDF-`.

O conteúdo bruto não é persistido no PostgreSQL. O banco guarda somente metadados de auditoria e texto extraído permitido.

## Limites

Settings:

- `OPENMARKET_DOCUMENT_TIMEOUT_SECONDS` — padrão 45 s;
- `OPENMARKET_DOCUMENT_MAX_BYTES` — padrão 30 MB;
- `OPENMARKET_DOCUMENT_MAX_PAGES` — padrão 500 páginas.

Esses limites podem ser ajustados por ambiente sem alterar código.

## Extração

A extração usa `pypdf` e preserva a página de origem.

Nesta etapa a seção mínima é determinística:

```text
Página 1 -> section(sequence=1, page_start=1, page_end=1)
Página 2 -> section(sequence=2, page_start=2, page_end=2)
...
```

Páginas sem texto extraível não geram seção.

Se nenhuma página tiver texto extraível, o documento é marcado como `failed`. OCR é uma etapa futura e não é executado automaticamente.

## Auditoria

`public_documents` registra:

- `processing_status`;
- `page_count`;
- `content_size_bytes`;
- `content_sha256`;
- `processed_at`;
- `processing_error`.

O hash identifica os bytes efetivamente processados sem armazenar o PDF original no banco.

## Idempotência

Um documento `ready` com seções existentes é ignorado por padrão.

```bash
python -m openmarket_api.cli process-document <uuid>
```

Use `--force` somente para reprocessamento explícito.

Uma nova sincronização de metadados CVM não redefine um documento `ready` para `pending` e não apaga suas seções.

## Batch

```bash
python -m openmarket_api.cli process-documents --ticker PETR4 --limit 10
```

O batch:

- tenta documentos `pending` e, por padrão, `failed`;
- continua após falha individual;
- registra cada falha no próprio documento;
- retorna erro operacional quando tentou documentos mas nenhum ficou `ready`.

Para não retentar falhas anteriores:

```bash
python -m openmarket_api.cli process-documents --ticker PETR4 --limit 10 --pending-only
```

## Busca

`GET /api/v1/documents?q=...` pesquisa:

- título;
- período;
- taxonomia CVM;
- assunto;
- heading de seção;
- texto extraído.

Isso conecta o pipeline de ingestão à biblioteca de relatórios sem embeddings.

## Report Viewer

O detalhe do documento retorna `sections` ordenadas.

O frontend usa:

- `?page=N` para a página solicitada;
- `#sec-N` para a seção extraída;
- `#page=N` no URL do PDF oficial.

A busca client-side usa o mesmo texto persistido.

## Falhas

Uma falha de download ou extração:

1. preserva metadados CVM;
2. preserva seções anteriores até existir uma nova extração válida;
3. marca `processing_status=failed`;
4. registra `processing_error`;
5. não dispara processamento dentro da API pública.

## Fora de escopo

- OCR;
- resumo por IA;
- embeddings;
- riscos/catalisadores;
- comparação semântica;
- armazenamento permanente do PDF bruto.

Essas capacidades pertencem às próximas camadas da Fase D.
