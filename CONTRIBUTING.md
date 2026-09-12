# Contribuindo

Obrigado por contribuir com o OpenMarket BR.

## Fluxo

1. Crie uma branch curta a partir de `main` (`feat/...`, `fix/...`, `docs/...`).
2. Faça mudanças focadas e inclua testes.
3. Não inclua credenciais, dados pessoais, relatórios privados ou conteúdo sem permissão de redistribuição.
4. Para novo provider, documente fonte, limites, política de cache e licença/redistribuição.
5. Abra Pull Request usando o template.

## Regras arquiteturais

- `domain/` não deve importar `providers/`.
- providers convertem formatos externos para modelos do domínio.
- a API não deve expor dados quando o `DataLicense` não permitir publicação.
- qualquer campo calculado deve manter referência aos dados-fonte quando aplicável.
