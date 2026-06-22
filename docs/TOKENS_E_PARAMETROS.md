# Tokens e parametros no Control S API Hub

Este documento define o modelo operacional de tokens por cliente e parametros de API.

## Modelo de token por cliente

Na primeira versao operacional, o Control S API Hub trabalha com a regra:

```text
1 cliente = 1 token ativo principal
```

O token e gerado no portal, vinculado ao cliente e entregue ao cliente ou integrador responsavel pelo consumo das APIs.

Exemplo:

```text
Cliente: Loja Integrada X
Token: cs_clienteinteg_XXXXXXXXXXXXXXXXXXXXXXXX
Status: ativo
```

O cliente usa este token em todas as APIs publicadas daquele cliente.

## Como o cliente consome uma API

Toda chamada publica deve enviar o cabecalho:

```http
Authorization: Bearer TOKEN_DO_CLIENTE
```

Exemplo:

```http
GET /v1/parceiros/comissoes?documentoParceiro=12345678000190
Authorization: Bearer cs_clienteinteg_XXXXXXXXXXXXXXXXXXXXXXXX
```

O backend valida:

1. Se o token foi informado.
2. Se o token existe.
3. Se o token esta ativo.
4. Se o token pertence ao mesmo cliente da API.
5. Se a API esta publicada.

Se o token pertencer a outro cliente, a chamada e negada.

## Geracao do token

Na tela **Tokens**:

1. Selecione o cliente.
2. Informe nome do token.
3. Informe parceiro/integrador.
4. Clique em **Gerar token**.
5. Copie o token exibido na mensagem de sucesso.

Importante:

- O token completo aparece somente na criacao.
- Depois disso, o portal exibe apenas o token mascarado.
- O banco armazena o hash do token, nao o token aberto.

## Troca de token

Como a regra inicial e um token ativo por cliente:

1. Inative ou exclua o token atual.
2. Gere um novo token.
3. Entregue o novo token ao cliente.
4. O cliente atualiza o cabecalho `Authorization`.

## Parametros da API

Cada API possui uma lista de parametros publicos.

Exemplo:

```json
[
  {
    "id": "param-documento-parceiro",
    "nomeTecnico": "documentoParceiro",
    "nomePublico": "documentoParceiro",
    "tipo": "documento",
    "obrigatorio": false,
    "origem": "query",
    "descricao": "CPF ou CNPJ do parceiro, com ou sem mascara.",
    "exemplo": "12345678000190",
    "normalizacao": "removerMascara"
  },
  {
    "id": "param-data-inicial",
    "nomeTecnico": "dataInicial",
    "nomePublico": "dataInicial",
    "tipo": "data",
    "obrigatorio": false,
    "origem": "query",
    "descricao": "Data inicial do periodo no formato AAAA-MM-DD.",
    "exemplo": "2026-05-01"
  }
]
```

## Campos principais de um parametro

- `nomeTecnico`: nome usado internamente na SQL.
- `nomePublico`: nome exposto ao consumidor da API.
- `tipo`: texto, numero, data, booleano, documento ou lista.
- `obrigatorio`: indica obrigatoriedade simples.
- `origem`: query, path, header ou body.
- `descricao`: texto exibido na documentacao OpenAPI.
- `exemplo`: exemplo exibido no Swagger.
- `normalizacao`: regra como remover mascara, maiusculo, minusculo ou trim.

## Regras condicionais

Nem toda API possui parametros obrigatorios individualmente. Algumas possuem regras condicionais.

Exemplo da API de comissoes:

```json
{
  "exigirAoMenosUmGrupo": [
    ["documentoParceiro"],
    ["dataInicial", "dataFinal"]
  ],
  "periodoObrigatorioEmConjunto": ["dataInicial", "dataFinal"],
  "limiteMaximoIntervaloDias": 31,
  "quantidadeMaximaPorPagina": 100,
  "removerMascaraDocumento": true
}
```

Esta regra significa:

- Aceita consultar por `documentoParceiro`.
- Aceita consultar por `dataInicial` + `dataFinal`.
- Aceita consultar por documento + periodo.
- Nao aceita chamada sem filtros.
- Nao aceita apenas uma das datas.
- Sem documento, limita o periodo a 31 dias.

## Relacao entre parametro e SQL

O parametro publico recebido pelo endpoint deve bater com o parametro usado na SQL.

Exemplo de URL:

```http
GET /v1/parceiros/comissoes?documentoParceiro=12345678000190
```

Exemplo na SQL:

```sql
AND (:documentoParceiro IS NULL OR documentoParceiro = :documentoParceiro)
```

O motor substitui os parametros de forma segura usando bind parameters do driver do banco.

## Documentacao automatica

Os parametros configurados alimentam automaticamente:

- Swagger/OpenAPI
- exemplos de request
- schema de resposta
- mensagens de erro
- seguranca Bearer Token

URL da documentacao:

```text
http://localhost:3333/swagger
```

OpenAPI consolidado:

```text
http://localhost:3333/documentacao/openapi.json
```

