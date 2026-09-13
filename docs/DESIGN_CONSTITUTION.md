# Constituição de Design — OpenMarket BR

Este documento define as restrições visuais e de conteúdo que devem orientar qualquer nova tela, refino de interface ou trabalho assistido por IA no OpenMarket BR.

## 1. Identidade do produto

O OpenMarket BR é uma plataforma de pesquisa e análise financeira. A interface deve parecer uma ferramenta construída para uso recorrente por pessoas que analisam empresas, indicadores, documentos e contexto macroeconômico.

A interface deve ser:

- sóbria, densa e operacional;
- orientada a dados, período, fonte e metodologia;
- consistente entre descoberta, empresa, ferramentas e documentos;
- moderna sem depender de efeitos visuais decorativos;
- brasileira pela informação e pelo contexto, não por ornamentação.

A interface não deve parecer:

- landing page de startup;
- mockup de portfólio ou Dribbble;
- dashboard SaaS genérico;
- página institucional dominada por slogans;
- interface criada para demonstrar capacidade de IA.

## 2. Princípios obrigatórios

### Dados antes de decoração

Todo elemento deve melhorar pelo menos uma destas tarefas: localizar, comparar, entender, validar ou agir. Elementos sem função devem ser removidos.

### Clareza antes de estilo

A beleza deve vir de hierarquia, espaçamento, alinhamento e tipografia. Não de gradientes, sombras, imagens decorativas ou caixas em excesso.

### Densidade controlada

Produtos financeiros precisam mostrar bastante informação. A solução padrão deve ser organização, não esconder conteúdo em cards grandes.

### Consistência acima de criatividade local

Uma tela nova deve reutilizar padrões existentes antes de introduzir um novo componente visual.

### Proveniência como assinatura

Dados relevantes devem manter próximo o período e a origem. Estados semânticos oficiais:

- **Oficial** — fonte primária, como CVM, Banco Central ou IBGE;
- **Calculado** — derivado pelo OpenMarket BR com metodologia reproduzível;
- **Mercado** — informação dependente de fonte de mercado integrada e identificada.

## 3. Restrições contra aparência genérica de IA

São proibidos por padrão:

- hero grande sem necessidade funcional;
- frases aspiracionais ou institucionais repetidas;
- imagens arquitetônicas, abstratas ou decorativas sem função;
- múltiplos estilos de card na mesma tela;
- sombras usadas para criar hierarquia que poderia ser resolvida com borda e espaçamento;
- arredondamento exagerado;
- excesso de badges, pills e chips decorativos;
- insights narrativos que pareçam recomendação ou interpretação sem fonte;
- dados fictícios usados apenas para preencher uma composição;
- expansão de funcionalidades que não existam na arquitetura ou nas fontes atuais.

Regra prática: se três ou mais cards exibem dados da mesma natureza, avaliar primeiro tabela, lista, grid sem containers individuais ou divisores simples.

## 4. Tipografia

A interface usa uma família sans-serif como base. Serif não é linguagem padrão do produto e não deve ser introduzida em novas superfícies sem decisão explícita de design.

Escala recomendada:

- título de página: 32–40 px;
- título de seção: 18–22 px;
- título de componente: 14–16 px;
- corpo: 13–15 px;
- metadata/label: 11–12 px.

Regras:

- números usam `font-variant-numeric: tabular-nums` quando possível;
- labels devem ser curtas;
- textos explicativos devem ser funcionais;
- títulos não devem ocupar uma dobra inteira;
- evitar contraste teatral entre serif e sans.

## 5. Forma, superfície e profundidade

Escala de radius preferencial:

- controles pequenos: 4 px;
- inputs e botões: 6 px;
- cards/painéis: 6–8 px;
- superfícies grandes: máximo 10 px.

Sombras não são o mecanismo padrão de separação. Preferir:

1. diferença sutil de superfície;
2. borda de 1 px;
3. divisores;
4. espaçamento.

Sombras só devem existir quando houver sobreposição real, como menus, popovers ou modais — e mesmo nesses casos devem ser discretas.

## 6. Cor

Modo e tema de cor são independentes.

- modo define fundo, superfície, texto e bordas;
- tema define accent, hover, accent-muted e gráfico primário.

O dourado OpenMarket é accent, não preenchimento decorativo geral.

Cores semânticas devem permanecer estáveis:

- positivo;
- negativo;
- alerta;
- informação;
- Oficial;
- Calculado;
- Mercado.

Não usar cores extras apenas para tornar uma tela mais "interessante".

## 7. Hierarquia de página

O produto usa quatro famílias de página.

### A. Descoberta

Exemplos: Home.

Prioridade: busca, atalhos reais, resultados recentes, rankings e contexto. Hero deve ser curto e funcional.

### B. Empresa

Exemplo: `/ativos/[ticker]`.

Prioridade: identidade do ativo, período, KPIs, indicadores, demonstrativos, documentos e metodologia. É a superfície mais densa do produto.

### C. Ferramenta larga

Exemplos: Screener, Comparar, Rankings.

Prioridade: controles, tabela/gráfico, resultado e paginação. Marketing praticamente inexistente.

### D. Exploração documental

Exemplos: Resultados, Relatórios.

Prioridade: filtros, metadados, lista, documento e origem. O documento é mais importante que o chrome ao redor.

## 8. Componentes-base

Antes de criar novo padrão, reutilizar ou evoluir:

- AppShell;
- Header;
- Sidebar / Rail / TopNav;
- PageHeader;
- SearchBar;
- FilterBar;
- DataTable;
- MetricCard;
- StatGroup;
- ChartPanel;
- Tabs;
- SourceBadge;
- EmptyState;
- Pagination;
- Drawer / Modal.

Cada componente deve ter informação principal, ação clara e contexto de origem quando aplicável.

## 9. Conteúdo e copy

Preferir linguagem funcional.

Bom:

- `Filtrar empresas`
- `Último período disponível`
- `Metodologia`
- `Fonte: CVM`
- `47 empresas encontradas`

Evitar como texto recorrente de interface:

- `dados que geram clareza`;
- `melhores decisões começam aqui`;
- `insights inteligentes`;
- `informação para transformar sua jornada`.

Essas frases podem existir em material institucional, não como estrutura repetitiva do produto.

## 10. Restrições obrigatórias para prompts de IA

Qualquer prompt de geração ou refino de UI deve incluir estas restrições:

1. Não transformar a página em landing page.
2. Não inventar dados, preços, benchmarks, setores ou funcionalidades.
3. Não criar copy institucional genérica para preencher espaço.
4. Não multiplicar estilos de card.
5. Não usar imagem decorativa sem função de produto.
6. Manter densidade adequada a uma ferramenta financeira.
7. Priorizar tabelas, filtros, comparação, fonte e metodologia.
8. Reutilizar componentes e tokens existentes.
9. Preservar estados loading, vazio e erro.
10. Preservar Claro/Escuro e navegação Lateral/Compacta/Superior.
11. Não alterar metodologia ou semântica dos dados para melhorar composição visual.
12. Quando um dado não existe, exibir indisponibilidade real em vez de placeholder fictício.

## 11. Checklist de aprovação

Antes de aprovar uma tela, responder:

- A função da página fica clara em poucos segundos?
- Parece produto real ou mockup promocional?
- Existe espaço grande sem função?
- Há cards demais para dados que poderiam ser linhas ou colunas?
- A tipografia está dentro da escala?
- As superfícies dependem de sombra ou radius exagerado?
- Fonte, período e metodologia aparecem onde importam?
- Algum texto existe apenas para preencher a composição?
- Funciona em Lateral, Compacta e Superior?
- Funciona em Claro e Escuro?
- Há dados ou funcionalidades não suportados pela plataforma?

Se qualquer resposta indicar ornamentação acima de utilidade, a tela deve ser simplificada antes do merge.
