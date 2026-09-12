# Roadmap

- [x] Fase 0: fundação, domínio, provider SDK, CI, Docker
- [ ] Fase 1: cadastro CVM de companhias
- [ ] Fase 2: DFP e ITR normalizados
- [ ] Fase 3: instrumentos/dados públicos B3
- [ ] Fase 4: Company Explorer
- [ ] Fase 5: históricos e gráficos
- [ ] Fase 6: Document Hub + painel web de visualização de relatórios corporativos
- [ ] Fase 7: screener e comparador
- [ ] Fase 8: analisador genérico de relatórios integrado ao Report Viewer
- [ ] Fase 9: notícias/eventos
- [ ] Fase 10: IA com citações dentro do workspace de documentos
- [ ] Fase 11: MCP
- [ ] Fase 12: publicação web aberta e deploy do frontend

## Report Viewer / Workspace

O painel de relatórios é uma camada própria da experiência web, separada do motor de análise. A primeira versão deve permitir abrir e navegar documentos antes de depender de IA.

### OpenMarket BR — público

- biblioteca de documentos corporativos públicos por companhia/ticker;
- filtros por tipo, período, data e fonte;
- visualização do documento com navegação por página/seção;
- metadados e proveniência sempre visíveis;
- links profundos para documento, página e companhia;
- painel lateral para resumo, métricas, riscos, eventos e citações quando a análise estiver disponível;
- integração futura com comparação entre documentos e mudança de tese ao longo do tempo.

### Personal Investor — privado

- mesma experiência visual, mas para documentos enviados pelo usuário ou selecionados em integrações autorizadas;
- relatórios privados nunca são enviados ao armazenamento público do OpenMarket;
- possibilidade de cruzar o conteúdo do relatório com carteira, posições, watchlist e notas pessoais;
- retenção de arquivo original, texto extraído, embeddings e análises deve ser configurável.

### Deploy web

O frontend em Next.js deve permanecer compatível com deploy em plataformas como Vercel. O deploy da interface não altera a separação de dados: documentos privados continuam pertencendo exclusivamente ao Personal Investor e ao seu backend/armazenamento autorizado.
