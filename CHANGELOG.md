# Changelog

## 0.1.0-dev

- Fundação inicial do OpenMarket BR.
- Contratos de domínio e providers.
- Registry de providers.
- API FastAPI mínima.
- Frontend Next.js mínimo.
- Docker Compose e CI.

### CVM company registry

- Primeiro provider oficial: cadastro diário de companhias abertas da CVM.
- Endpoint `GET /api/v1/companies/search?q=...`.
- Cache em memória e metadados de proveniência/licença ODbL.
