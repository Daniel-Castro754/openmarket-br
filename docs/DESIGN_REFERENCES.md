# Referências de design do OpenMarket BR

A interface usa referências de produto para hierarquia e organização, sem copiar identidade visual proprietária.

## Padrões adotados

- Home orientada a descoberta, com pesquisa de ticker, áreas de ranking e atalhos para pesquisa fundamentalista.
- Página de ativo com cabeçalho compacto, navegação por seções, indicadores principais e histórico financeiro.
- Painel de leituras rápidas derivadas exclusivamente dos dados financeiros já presentes no OpenMarket.
- Área reservada para consenso de casas de análise com distribuição compra/neutro/venda e faixa de preços-alvo.
- Eventos e comunicados oficiais integrados ao overview do ativo via Document Hub.
- Painel macroeconômico com juros, inflação, câmbio e atividade, além das expectativas Focus.
- Faixa macro global no produto para que a análise de empresas não fique desconectada do ciclo econômico.

## Referência Oceans14

O Oceans14 é usado como referência funcional, não como fonte de dados nem como interface a ser copiada. Recursos públicos descritos por referências indexadas e materiais de terceiros incluem:

- indicadores fundamentalistas e históricos de resultados;
- histórico de dividendos e agenda de proventos;
- comparador de ações e rankings;
- histórico de P/L e gráficos de cotação versus lucro;
- cotações ajustadas, inclusive leitura dolarizada;
- painel de macroeconomia.

Para o OpenMarket, esses padrões viram funcionalidades próprias com dados oficiais ou licenciados. A primeira implementação é `/macroeconomia`, alimentada por séries SGS do Banco Central e expectativas da Pesquisa Focus.

### Próximos padrões úteis a incorporar

1. Comparador reproduzível entre empresas usando os mesmos indicadores e períodos contábeis.
2. Agenda de dividendos/proventos somente quando houver fonte oficial/licenciada com eventos corporativos.
3. Histórico de múltiplos, incluindo P/L, com metodologia explícita e tratamento de prejuízos.
4. Gráfico preço versus lucro para separar expansão de múltiplo de crescimento operacional.
5. Cotações ajustadas por proventos, desdobramentos e grupamentos; visão em BRL e USD quando a fonte de preços permitir redistribuição.

## Limites de dados

O OpenMarket não exibe recomendações, preços-alvo ou cotações fictícias. Os componentes correspondentes permanecem em estado sem dados até que exista uma fonte integrada com proveniência, metodologia e direitos de uso adequados.

Rankings também só devem exibir posições quando houver um universo mínimo de ativos sincronizados e uma metodologia reproduzível. Recursos inspirados em sites terceiros nunca dependem de scraping desses sites quando existe uma fonte primária oficial ou licenciada disponível.
