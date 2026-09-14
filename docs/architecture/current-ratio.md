# Liquidez Corrente

A Liquidez Corrente do OpenMarket BR é um indicador derivado das demonstrações financeiras consolidadas da CVM.

## Fórmula

`Liquidez Corrente = Ativo Circulante / Passivo Circulante`

A unidade é múltiplo (`x`), sem multiplicação por 100.

## Contas usadas

- Ativo Circulante: demonstração `BPA`, código CVM `1.01`.
- Passivo Circulante: demonstração `BPP`, código CVM `2.01`.

O cálculo usa valores do mesmo período, mesma moeda e mesmo arquivamento/versão. Passivo Circulante igual a zero produz indicador indisponível.

## Salvaguarda de classificação

Os códigos `1.01` e `2.01` não são tratados isoladamente como prova suficiente do conceito contábil. Alguns planos de demonstração, especialmente de instituições financeiras, podem reutilizar esses códigos para rubricas diferentes.

Por isso o OpenMarket BR só aceita os valores quando, além do código, o rótulo normalizado da conta é exatamente:

- `Ativo Circulante` para `1.01`;
- `Passivo Circulante` para `2.01`.

Se os rótulos não forem compatíveis, a Liquidez Corrente fica indisponível em vez de publicar um número semanticamente incorreto.

## Frequência

Como BPA e BPP representam saldos em uma data, não há média ou derivação de trimestre para a fórmula:

- anual: DFP do encerramento do exercício;
- trimestral: ITR ou DFP correspondente ao fechamento do período.

## Proveniência

Os dois saldos de entrada preservam a fonte oficial CVM. O ponto calculado é marcado como `openmarket-derived` e mantém as fontes de entrada para auditoria.
