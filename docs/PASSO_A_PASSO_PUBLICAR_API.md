# Passo a passo para criar, publicar e entregar uma API ao cliente

Este guia descreve o fluxo operacional recomendado para usar o Control S API Hub em um servidor Windows com PostgreSQL.

## 1. Acessar o portal

1. Abra o navegador no servidor ou em uma maquina da rede.
2. Acesse:

```text
http://localhost:3333/
```

ou, de outra maquina:

```text
http://IP_DO_SERVIDOR:3333/
```

3. Entre com o usuario administrador inicial:

```text
E-mail: admin@controlsconsultoria.com.br
Senha: controls
```

## 2. Cadastrar o cliente

1. Acesse **Clientes**.
2. Preencha empresa, nome fantasia, CNPJ, responsavel, ambiente, dominio principal e subdominio da API.
3. Clique em **Salvar cliente**.

Esse cadastro sera usado para vincular conexoes, APIs e token fixo do cliente.

## 3. Criar a conexao com o banco do cliente

1. Acesse **Conexoes**.
2. Clique em nova conexao e selecione o cliente.
3. Escolha o tipo de banco:

- SQL Server
- Oracle
- Firebird

4. Informe host, porta, banco/service/SID ou arquivo Firebird, usuario e senha.
5. Clique em **Salvar conexao**.
6. Na lista, clique em **Testar**.

Se o teste falhar, revise host, porta, firewall do banco, usuario, senha e driver do banco externo.

## 4. Criar a API

1. Acesse **APIs**.
2. Informe:

- Nome da API
- Cliente
- Codigo interno
- Versao
- Metodo HTTP
- Endpoint publico, por exemplo `/v1/parceiros/comissoes`
- Categoria
- Conexao utilizada
- Descricao

3. Clique em **Criar rascunho**.

## 5. Subir e testar o SQL

1. Acesse **Editor SQL**.
2. Selecione a API criada.
3. Cole o SQL parametrizado.
4. Use parametros com nomes tecnicos, por exemplo:

```sql
WHERE (:documentoParceiro IS NULL OR COALESCE(fis.CPF, jur.CNPJ) = :documentoParceiro)
  AND (:dataInicial IS NULL OR PVC.DATA_EMISSAO >= :dataInicial)
  AND (:dataFinal IS NULL OR PVC.DATA_EMISSAO < :dataFinalMaisUmDia)
```

5. Clique em **Salvar SQL**.
6. Em parametros de teste, informe um JSON:

```json
{
  "documentoParceiro": "12345678000190"
}
```

7. Clique em **Testar**.

O teste executa a consulta no banco da conexao selecionada e retorna o envelope padrao:

```json
{
  "sucesso": true,
  "meta": {
    "pagina": 1,
    "quantidadePorPagina": 100,
    "totalRegistros": 0
  },
  "dados": []
}
```

## 6. Configurar parametros e regras

1. Acesse **Parametros**.
2. Selecione a API.
3. Configure a lista de parametros em JSON.

Exemplo para a API de comissoes:

```json
[
  {
    "nomeTecnico": "documentoParceiro",
    "nomePublico": "documentoParceiro",
    "tipo": "texto",
    "obrigatorio": false,
    "origem": "query",
    "descricao": "CPF ou CNPJ do parceiro, com ou sem mascara.",
    "exemplo": "12345678000190",
    "normalizacao": "removerMascara"
  },
  {
    "nomeTecnico": "dataInicial",
    "nomePublico": "dataInicial",
    "tipo": "data",
    "obrigatorio": false,
    "origem": "query",
    "descricao": "Data inicial do periodo no formato AAAA-MM-DD.",
    "exemplo": "2026-05-01"
  },
  {
    "nomeTecnico": "dataFinal",
    "nomePublico": "dataFinal",
    "tipo": "data",
    "obrigatorio": false,
    "origem": "query",
    "descricao": "Data final do periodo no formato AAAA-MM-DD.",
    "exemplo": "2026-05-31"
  }
]
```

4. Configure as regras:

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

5. Clique em **Salvar parametros**.

## 7. Configurar a URL publica

1. Acesse **Dominios**.
2. Informe o ambiente: local, homologacao ou producao.
3. Preencha:

- Dominio principal: `cliente.com.br`
- Subdominio da API: `api.cliente.com.br`
- URL base da API: `https://api.cliente.com.br`
- URL da documentacao: `https://api.cliente.com.br/swagger`

4. Clique em **Salvar URL publica**.

Essa URL sera usada na documentacao OpenAPI/Swagger. Para acesso externo real, configure DNS/IIS/Proxy apontando para o servidor onde o Control S API Hub esta rodando na porta 3333.

## 8. Publicar a API

1. Acesse **APIs** ou **Editor SQL**.
2. Clique em **Publicar**.
3. A API passara para status `publicado`.

Endpoint final esperado:

```text
https://api.cliente.com.br/v1/parceiros/comissoes
```

## 9. Gerar token fixo do cliente

1. Acesse **Tokens**.
2. Informe:

- Nome: `Token principal do cliente`
- Cliente
- Parceiro: nome do cliente ou integrador
- Status: `ativo`
- Expiracao: deixe em branco para token fixo sem vencimento

3. Clique em **Gerar token**.
4. Copie o token completo exibido na mensagem de sucesso.

Importante: o token completo aparece somente no momento da criacao. Depois disso o portal mostra apenas o token mascarado.

Por padrao operacional, use um token ativo principal por cliente. Se precisar trocar, exclua ou inative o token anterior e gere outro.

## 10. Entregar ao cliente ou integrador

Entregue:

- URL base da API
- Endpoint
- Token Bearer
- Link do Swagger
- Exemplos de request

Exemplo em PowerShell:

```powershell
$headers = @{ Authorization = "Bearer TOKEN_DO_CLIENTE" }
Invoke-RestMethod -Uri "https://api.cliente.com.br/v1/parceiros/comissoes?documentoParceiro=12345678000190" -Headers $headers
```

Exemplo com periodo:

```powershell
$headers = @{ Authorization = "Bearer TOKEN_DO_CLIENTE" }
Invoke-RestMethod -Uri "https://api.cliente.com.br/v1/parceiros/comissoes?dataInicial=2026-05-01&dataFinal=2026-05-31" -Headers $headers
```

## 11. Consultar documentacao

Swagger:

```text
https://api.cliente.com.br/swagger
```

OpenAPI consolidado:

```text
https://api.cliente.com.br/documentacao/openapi.json
```

OpenAPI de uma API especifica:

```text
http://IP_DO_SERVIDOR:3333/api/admin/apis/ID_DA_API/openapi.json
```

## 12. Acompanhar logs

1. Acesse **Logs**.
2. Confira horario, API, status HTTP, latencia, origem e erro.
3. Use os logs para validar consumo do cliente e diagnosticar falhas de token, parametros ou SQL.

## Fluxo resumido

```text
Cliente -> Conexao -> API -> SQL -> Parametros -> Dominios -> Publicar -> Token -> Entrega ao cliente
```
