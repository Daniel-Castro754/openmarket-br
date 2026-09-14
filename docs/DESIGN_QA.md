# QA visual — OpenMarket BR

Este checklist complementa `DESIGN_CONSTITUTION.md` e deve ser usado antes de aprovar mudanças de interface.

## Matriz mínima

Toda alteração relevante de UI deve ser verificada em:

| Eixo | Estados |
| --- | --- |
| Modo | Claro, Escuro |
| Tema de cor | OpenMarket, Ocean, Terminal |
| Navegação | Superior, Lateral, Compacta |
| Largura | Desktop amplo, desktop reduzido, tablet, mobile |

Modo, tema e navegação são independentes. Uma correção em um eixo não pode depender de alterar outro.

## Shell global

- header não sobrepõe conteúdo;
- sidebar e rail deslocam header, barra macro e conteúdo apenas uma vez;
- ao reduzir para <= 900 px, Lateral e Compacta voltam ao shell superior sem deixar offset lateral;
- dropdowns e painel de aparência não ultrapassam a altura útil da viewport;
- nenhum layout produz scroll horizontal na página inteira;
- tabelas largas usam scroll dentro do próprio painel;
- foco por teclado permanece visível;
- `prefers-reduced-motion` reduz animações e transições não essenciais.

## Aparência

- superfícies estáticas usam borda/espaçamento em vez de sombra;
- radius segue a escala da Constituição de Design;
- pills ficam restritas a estados ou elementos em que a forma comunica função;
- números relevantes usam algarismos tabulares;
- modo controla contraste/superfície e tema controla accent;
- controles nativos respeitam o `color-scheme` do modo ativo.

## Conteúdo

- nenhum valor fictício é usado para preencher composição;
- período e fonte aparecem próximos ao dado quando importam;
- `Oficial`, `Calculado` e `Mercado` preservam significado consistente;
- estados vazios e de erro explicam a indisponibilidade sem inventar substitutos;
- páginas de ferramenta não recebem slogans ou roadmap promocional para ocupar espaço.

## Páginas críticas

### Home
- busca é a ação dominante;
- entradas de pesquisa aparecem antes de conteúdo institucional;
- nenhum hero ocupa a primeira dobra sem função.

### Empresa
- ticker, período e KPIs aparecem antes de contexto secundário;
- indicadores, demonstrativos, documentos e metodologia usam a mesma linguagem visual;
- dados ausentes aparecem como indisponíveis, não como placeholders fictícios.

### Screener / Listas / Rankings / Comparar
- controles são compactos;
- tabela ou comparação domina a área útil;
- filtros ativos, universo e período permanecem visíveis;
- nenhuma ordenação ou ranking oculta sua metodologia.

### Resultados / Relatórios
- documento e metadados são mais importantes que o chrome;
- filtros e paginação permanecem funcionais em mobile;
- viewer preserva acesso à fonte original.

### Macro / Análises econômicas
- séries oficiais aparecem antes de explicações editoriais;
- descrições mecânicas não são apresentadas como recomendação;
- fonte BCB/IBGE e período ficam explícitos.

### Calculadoras
- entradas e resultados são visualmente prioritários;
- fórmula/metodologia permanece visível;
- hipóteses não são apresentadas como previsão.

### Setores
- enquanto não houver fonte setorial rastreável, a tela deve permanecer um estado metodológico curto;
- não publicar agrupamentos, medianas ou rankings setoriais inferidos.

## Critério de merge

Uma mudança visual só deve ser considerada concluída quando:

1. `frontend-ci` estiver verde;
2. `backend-ci` estiver verde quando o workflow for acionado;
3. não houver regressão funcional conhecida;
4. a alteração respeitar a Constituição de Design;
5. as combinações relevantes da matriz acima tiverem sido verificadas manualmente quando houver ambiente visual disponível.

CI valida código e build; não substitui inspeção visual. Quando não houver navegador disponível durante a implementação, registrar isso claramente e não declarar que a matriz visual foi executada.
