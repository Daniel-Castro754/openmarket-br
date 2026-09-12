# Provider CVM — cadastro de companhias

Fonte: `Cias Abertas: Informação Cadastral`, publicada pela CVM e atualizada diariamente.

O provider baixa o CSV oficial, normaliza registros para `Company` e mantém cache de seis horas por processo. O domínio recebe a proveniência e a política ODbL junto do objeto.

## Endpoint

```http
GET /api/v1/companies/search?q=petrobras
```

## Próximas extensões CVM

1. DFP anual;
2. ITR trimestral;
3. IPE/documentos corporativos;
4. persistência incremental no PostgreSQL.
