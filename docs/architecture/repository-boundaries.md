# Limites entre repositórios

O ecossistema é dividido em três responsabilidades:

1. **OpenMarket BR** — produto público e open source. Contém domínio, providers, API, visualização e ferramentas reutilizáveis.
2. **Personal Investor** — aplicação privada que consome recursos do OpenMarket BR e adiciona carteira, documentos e dados pessoais. Dados privados nunca retornam ao projeto público.
3. **Fork do fundamentus-data-API** — usado apenas para acompanhar o upstream e enviar contribuições pontuais ao projeto original.

Recursos genéricos devem preferencialmente nascer no OpenMarket BR. Recursos que dependem da carteira, documentos ou credenciais do usuário pertencem ao Personal Investor.
