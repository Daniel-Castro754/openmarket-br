# Arquitetura

## Contexto

OpenMarket BR é o produto público. Personal Investor é um produto privado separado. O OpenMarket nunca consulta o banco privado do Personal Investor.

## Camadas

```text
Web / API / Worker
        |
Application services
        |
Domain Core
        ^
        |
Provider adapters
        |
B3 / CVM / ANBIMA / APIs externas
```

### Domain Core

Define entidades e regras que não conhecem detalhes de HTTP, HTML, CSV ou fornecedores.

### Providers

Adaptadores externos implementam contratos estáveis e normalizam dados para o domínio.

### Proveniência

Valores externos devem carregar `SourceMetadata`. O metadado registra provider, fonte, data de referência, data de coleta, qualidade e licença.

### Política de publicação

A existência de um dado no backend não significa que ele pode ser redistribuído publicamente. Serviços de saída devem considerar `DataLicense.redistribution` antes de expor dados.

## Dependência com Personal Investor

A direção permitida é:

```text
OpenMarket -> Personal Investor
```

Nunca:

```text
Personal Investor -> OpenMarket public data store
```

O Personal Investor pode consumir uma versão da API/pacote OpenMarket, mas seus dados privados não retornam ao projeto público.
