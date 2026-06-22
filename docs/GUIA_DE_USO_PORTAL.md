# Guia de uso do Control S API Hub

Este guia explica o uso esperado do portal administrativo do **Control S API Hub** para criar conexoes, cadastrar APIs, testar SQL no banco do cliente, publicar endpoints e consultar a documentacao gerada.

## Acesso inicial

1. Acesse o portal pelo navegador:

```text
http://localhost:3333/
```

No servidor do cliente, troque `localhost` pelo IP ou dominio configurado:

```text
http://IP_DO_SERVIDOR:3333/
```

2. Entre com o usuario administrador inicial:

```text
E-mail: admin@controlsconsultoria.com.br
Senha: controls
```

3. Depois do login, somente usuarios com perfil **admin** conseguem cadastrar novos usuarios.

## Usuarios

A tela **Usuarios** aparece apenas para administradores.

Uso esperado:

1. Clique em **Usuarios** no menu lateral.
2. Informe nome, e-mail e perfil.
3. Clique em **Criar usuario**.
4. O administrador nao define senha para o usuario.
5. No primeiro acesso, o proprio usuario informa a nova senha.

Perfis iniciais:

- **admin:** pode gerenciar usuarios e operar o portal.
- **operador:** pode operar conexoes, APIs, SQL e publicacao.
- **visualizador:** perfil reservado para consulta e auditoria futura.

Acoes disponiveis:

- **Criar usuario:** cria acesso com primeiro acesso pendente.
- **Editar:** altera nome, e-mail, perfil e status.
- **Excluir:** remove o usuario, exceto o proprio usuario logado.

## Clientes

A tela **Clientes** permite cadastrar, editar e excluir empresas atendidas pelo hub.

Uso esperado:

1. Clique em **Clientes**.
2. Cadastre empresa, nome fantasia, CNPJ, responsavel, contatos, dominio e subdominio.
3. Clique em **Cadastrar cliente**.
4. Use **Editar** para atualizar dados cadastrais e dominios.
5. Use **Excluir** apenas se o cliente nao possuir conexoes ou APIs vinculadas.

Importante:

- Cliente com conexao ou API vinculada nao pode ser excluido.
- O cliente e usado como base para conexoes, APIs, tokens e publicacao.

## Conexoes

A tela **Conexoes** registra os bancos externos usados pelas APIs.

Bancos suportados desde a primeira versao:

- Oracle
- Microsoft SQL Server
- Firebird

Uso esperado:

1. Clique em **Conexoes**.
2. Preencha nome, tipo do banco, ambiente, host, porta, banco/service/arquivo, usuario e senha.
3. Clique em **Salvar conexao**.
4. Clique em **Testar** para validar se o portal consegue conectar ao banco.
5. Use **Editar** para corrigir host, porta, usuario, senha ou ambiente.
6. Use **Excluir** quando a conexao nao estiver mais em uso.

Importante:

- Uma conexao vinculada a uma API nao pode ser excluida.
- Para excluir uma conexao em uso, edite ou exclua as APIs que dependem dela primeiro.
- O teste de conexao usa o driver do tipo selecionado e tenta chegar no banco real.

## Criacao de APIs

A tela **APIs** cria o cadastro funcional da API.

Uso esperado:

1. Clique em **APIs**.
2. Preencha:
   - Nome da API
   - Codigo interno
   - Versao
   - Metodo HTTP
   - Endpoint
   - Categoria
   - Conexao
   - Descricao
3. Clique em **Criar rascunho**.
4. O portal abre o **Editor SQL** para cadastrar a consulta.

Acoes disponiveis na lista:

- **Editar:** altera dados da API.
- **SQL:** abre o editor SQL da API.
- **Publicar:** publica a API quando o SQL estiver salvo.
- **Despublicar:** retira a API do catalogo publico.
- **Excluir:** remove a API e o endpoint.

## Editor SQL

O **Editor SQL** e o centro operacional da ferramenta.

Uso esperado:

1. Selecione a API.
2. Cole ou escreva a consulta SQL.
3. Use aliases publicos em portugues e camelCase.
4. Clique em **Salvar SQL**.
5. Informe parametros de teste em JSON.
6. Clique em **Testar**.
7. O portal executa a consulta no banco da conexao vinculada.
8. Confira o resultado retornado.
9. Clique em **Publicar**.

Exemplo de parametros de teste:

```json
{
  "documentoParceiro": "12345678000190",
  "dataInicial": "2026-01-01",
  "dataFinal": "2026-01-31"
}
```

Padrao recomendado para nomes publicos:

```sql
SELECT
  TIT.FORNECEDOR AS codigoParceiro,
  FORN.NOME AS nomeParceiro,
  COALESCE(fis.CPF, jur.CNPJ) AS documentoParceiro,
  PVC.PEDIDO AS pedido,
  PVC.DATA_EMISSAO AS dataPedido,
  PVC.VALOR_TOTAL AS valorPedido
FROM ...
```

Boas praticas:

- Nao use datas fixas no SQL.
- Use parametros, como `:documentoParceiro`, `:dataInicial` e `:dataFinal`.
- Evite `SELECT *`.
- Use aliases publicos em portugues e camelCase.
- Restrinja a consulta para evitar retornos grandes.
- Teste a consulta antes de publicar.

## Publicacao

Uma API nasce como **rascunho**.

Para publicar:

1. Crie a API.
2. Salve o SQL.
3. Teste o SQL no banco.
4. Clique em **Publicar**.

Depois de publicada, a API fica disponivel no endpoint configurado, por exemplo:

```text
http://localhost:3333/v1/parceiros/comissoes
```

Para retirar do ar:

1. Abra a tela **APIs**.
2. Clique em **Despublicar**.

## Tokens

A tela **Tokens** controla acessos por parceiro ou cliente.

Uso esperado:

1. Clique em **Tokens**.
2. Informe nome, cliente, parceiro, status e observacao.
3. Clique em **Gerar token**.
4. Copie o token exibido na mensagem de sucesso no momento da criacao.
5. Use **Editar** para ativar, inativar ou atualizar observacoes.
6. Use **Excluir** para remover um token que nao deve mais consumir APIs.

Importante:

- O token completo so aparece no momento da criacao.
- Depois disso, a lista mostra apenas o token mascarado.
- A regra operacional inicial e um token ativo principal por cliente.
- O token so consome APIs publicadas do mesmo cliente.
- Para trocar o token do cliente, inative ou exclua o atual e gere outro.

## Documentacao OpenAPI e Swagger

A documentacao e gerada automaticamente a partir das APIs cadastradas.

URLs principais:

```text
http://localhost:3333/swagger
http://localhost:3333/documentacao/openapi.json
```

Para uma API especifica, a tela **Documentacao** mostra o link do JSON OpenAPI individual.

A documentacao publica deve seguir estes padroes:

- Titulos em portugues.
- Campos publicos em portugues e camelCase.
- Exemplos de request e response em portugues.
- Mensagens de erro em portugues.
- Envelope padrao de sucesso e erro.

## Logs

A tela **Logs** mostra chamadas executadas pelo portal e pelas APIs publicadas.

Campos exibidos:

- Data e hora
- API
- Status HTTP
- Latencia
- Origem da chamada

Uso esperado:

1. Teste SQL ou consuma um endpoint publicado.
2. Abra **Logs**.
3. Verifique status, tempo de resposta e origem.

Acoes disponiveis:

- **Atualizar:** recarrega os registros.
- **Excluir:** remove um registro individual quando fizer sentido para limpeza operacional.

## Identidade da loja

A tela **Configuracoes** permite personalizar a marca da loja integrada.

Uso esperado:

1. Clique em **Configuracoes**.
2. Informe nome da loja.
3. Informe URL ou base64 do logo.
4. Clique em **Aplicar marca**.

Importante:

- O nome do sistema continua **Control S API Hub**.
- A lateral sempre usa a marca Control S.
- A marca da loja aparece no login e no topo direito do portal.

## Fluxo recomendado de implantacao no cliente

1. Instalar Node.js.
2. Instalar PostgreSQL com senha `controls`.
3. Executar `INSTALAR_OU_ATUALIZAR.cmd`.
4. O instalador ja registra a inicializacao automatica no Windows e inicia o backend.
5. Acessar `http://localhost:3333/`.
6. Entrar como admin.
7. Criar usuarios.
8. Cadastrar conexao com o banco do cliente.
9. Testar conexao.
10. Criar API.
11. Salvar SQL.
12. Testar SQL.
13. Publicar API.
14. Validar Swagger.
15. Entregar endpoint para consumo.

## Erros comuns

### Failed to fetch

O frontend nao conseguiu acessar o backend.

Verifique:

- Se `scripts\start-backend-producao.cmd` esta rodando.
- Se a porta 3333 esta liberada.
- Se o navegador esta acessando o IP correto.

### Senha do PostgreSQL invalida

O instalador usa a senha configurada no `.env`.

Padrao recomendado:

```text
controls
```

Se a senha instalada no PostgreSQL for diferente, edite:

```text
C:\Control S API Hub\.env
```

### Conexao em uso

Uma conexao nao pode ser excluida se existir API vinculada a ela.

Resolucao:

1. Edite a API para usar outra conexao, ou
2. Exclua a API, e depois
3. Exclua a conexao.

### SQL nao informado

Uma API so pode ser publicada depois que o SQL for salvo.

Resolucao:

1. Abra **Editor SQL**.
2. Selecione a API.
3. Cole a consulta.
4. Clique em **Salvar SQL**.
5. Publique a API.
