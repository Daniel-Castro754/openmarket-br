# Report Viewer / Document Workspace

## Objetivo

Criar uma experiência web para abrir, navegar, pesquisar e analisar relatórios/documentos financeiros. O visualizador é uma camada de produto própria: primeiro o usuário consegue consumir o documento; recursos de extração, comparação e IA entram como capacidades adicionais.

## Status atual

O MVP de leitura está implementado em código:

- biblioteca com filtros por texto, ticker e tipo;
- metadados, fonte, licença e estado de processamento;
- visualização incorporada do documento oficial com fallback para nova aba;
- navegação por seções extraídas;
- busca textual client-side nas seções já processadas;
- navegação anterior/próxima e deep link por página em PDFs (`?page=N` + `#page=N`);
- links de resultados da busca e das seções para a página correspondente;
- painel de proveniência.

O pipeline de ingestão real da #117 processa PDFs CVM fora do request path, persiste texto por página e alimenta a busca e os deep links do visualizador. O workflow data-backed passa a exigir ao menos um documento real `ready` com seção paginada. A origem da CVM ainda pode bloquear `iframe` em documentos específicos ou um leitor pode ignorar o fragmento `#page=N`; por isso o fallback para nova aba permanece obrigatório.

A camada de análise estruturada e a comparação entre relatórios continuam como etapas posteriores.

## Separação de produtos

### OpenMarket BR

Recebe apenas documentos públicos ou redistribuíveis conforme licença/proveniência. O visualizador público pode exibir documentos corporativos, formulários, demonstrações, fatos relevantes e outros materiais oficiais.

### Personal Investor

Reutiliza o padrão visual e contratos públicos do OpenMarket, mas documentos privados pertencem exclusivamente ao Personal Investor. O OpenMarket não consulta arquivos, embeddings, notas ou análises privadas.

## Experiência de tela

A rota sugerida para o produto público é:

```text
/relatorios
/relatorios/{document_id}
/empresa/{ticker}/relatorios
```

Layout desktop sugerido:

```text
+----------------------+--------------------------------+----------------------+
| Biblioteca / filtros | Documento                      | Análise              |
|                      |                                |                      |
| Empresa / ticker     | PDF / HTML / texto            | Resumo executivo     |
| Tipo                 | página atual                  | Métricas extraídas   |
| Período              | busca no documento            | Tickers citados      |
| Fonte                | miniaturas / índice           | Riscos / catalisadores|
| Data                 |                                | Citações             |
+----------------------+--------------------------------+----------------------+
```

No mobile, as três áreas viram navegação por abas ou drawers para preservar espaço de leitura.

## MVP do visualizador

1. Biblioteca com filtros e busca.
2. Cabeçalho com título, companhia, ticker, tipo, período, data, fonte e licença.
3. Visualização paginada do documento.
4. Navegação por página/seção e busca textual.
5. Deep link preservando documento e página.
6. Painel de proveniência.
7. Estado de análise: não processado, processando, disponível ou falhou.

O MVP não depende de IA para funcionar.

## Camada de análise

Quando houver conteúdo processado, o painel lateral pode mostrar:

- resumo executivo;
- tese central;
- empresas e tickers mencionados;
- métricas financeiras;
- valuation e preços-alvo quando presentes no documento;
- premissas;
- catalisadores;
- riscos;
- cenário macro;
- recomendações e horizonte;
- argumentos positivos e negativos;
- citações apontando página/seção de origem.

## Comparação entre relatórios

Uma etapa posterior deve permitir selecionar dois ou mais documentos da mesma companhia e comparar:

- mudança de tese;
- mudança de preço-alvo;
- revisão de premissas;
- novos riscos e catalisadores;
- diferenças de estimativas;
- evolução temporal das recomendações.

## Modelo de dados sugerido

```text
ResearchDocument
- id
- company_id? / ticker?
- title
- document_type
- source
- source_url?
- published_at?
- reference_period?
- content_type
- page_count?
- license / redistribution_scope
- processing_status

DocumentSection
- id
- document_id
- page_start?
- page_end?
- heading?
- text

DocumentAnalysis
- document_id
- schema_version
- summary
- thesis
- metrics
- tickers
- catalysts
- risks
- recommendations
- citations
```

## Frontend e deploy

O frontend permanece em Next.js e pode ser publicado em Vercel ou plataforma equivalente. A Vercel hospeda a interface; arquivos, banco, processamento pesado e credenciais ficam no backend/armazenamento apropriado.

Para o Personal Investor, nenhuma configuração de deploy pode transformar documentos privados em conteúdo público ou colocá-los no repositório Git.
