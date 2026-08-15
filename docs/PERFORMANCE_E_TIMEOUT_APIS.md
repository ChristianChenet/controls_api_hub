# Performance e timeout das APIs publicadas

## Comportamento padrão

As APIs publicadas mantêm o comportamento compatível com as integrações existentes:

- paginação padrão continua sendo aplicada após a execução da consulta;
- APIs existentes não passam a usar paginação no banco automaticamente;
- timeout padrão de execução pública: 120 segundos;
- timeout máximo aceito por configuração: 300 segundos.

## Como aumentar timeout de uma API

Na configuração da API, use uma destas opções:

```json
{
  "timeoutSegundos": 120
}
```

ou:

```json
{
  "regras": {
    "timeoutMs": 120000
  }
}
```

## Paginação no banco SQL Server

Para endpoints grandes, é possível ativar paginação no SQL Server por API:

```json
{
  "regras": {
    "paginacaoNoBanco": true,
    "quantidadeMaximaPorPagina": 500,
    "timeoutMs": 120000
  }
}
```

Essa opção é desligada por padrão para não alterar o comportamento de APIs já em uso.

## Recomendações para consultas grandes

- Use filtro incremental por `ultimaAlteracao`.
- Garanta índice no campo usado como filtro de alteração.
- Garanta `ORDER BY` estável na consulta quando usar paginação.
- Para primeira carga, use janelas menores de data quando possível.
- Para procedures, implemente paginação dentro da própria procedure.
