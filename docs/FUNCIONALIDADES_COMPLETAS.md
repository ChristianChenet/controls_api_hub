# Funcionalidades completas do Control S API Hub

Este documento descreve as funcionalidades operacionais disponiveis no Control S API Hub e o uso esperado de cada tela.

## 1. Login e usuarios

### Login

O portal administrativo e acessado pelo navegador:

```text
http://localhost:3333/
```

Usuario administrador inicial:

```text
E-mail: admin@controlsconsultoria.com.br
Senha: controls
```

### Primeiro acesso

Usuarios criados pelo administrador nao recebem senha pronta.
No primeiro acesso, o usuario informa o e-mail e o sistema solicita a criacao da propria senha.

### Usuarios

Somente administradores podem acessar a tela **Usuarios**.

Funcoes:

- criar usuario
- editar nome, e-mail, perfil e status
- excluir usuario
- controlar perfil: administrador, operador ou visualizador

## 2. Dashboard

A tela **Dashboard** apresenta visao executiva:

- APIs cadastradas
- APIs publicadas
- rascunhos
- conexoes ativas
- clientes ativos
- tokens ativos
- chamadas registradas
- erros recentes
- fluxo rapido
- APIs recentes

O filtro superior permite selecionar cliente e periodo para orientar a operacao.

## 3. Clientes

A tela **Clientes** e a base multiempresa da plataforma.

Campos principais:

- nome da empresa
- nome fantasia
- CNPJ
- codigo interno
- responsavel
- e-mail
- telefone
- ambiente
- status
- dominio principal
- subdominio da API
- observacoes

Funcoes:

- cadastrar cliente
- editar cliente
- excluir cliente
- listar clientes cadastrados

Regra: nao e possivel excluir cliente que esteja vinculado a conexoes ou APIs.

## 4. Conexoes

A tela **Conexoes** registra os bancos externos dos clientes.

Bancos suportados:

- SQL Server
- Oracle
- Firebird

Campos principais:

- nome da conexao
- cliente
- tipo de banco
- ambiente
- status
- host
- porta
- banco, service, SID ou arquivo
- usuario
- senha
- observacoes

Funcoes:

- criar conexao
- editar conexao
- testar conexao
- excluir conexao

Uso esperado:

1. Cadastre o cliente.
2. Cadastre a conexao do banco.
3. Clique em **Testar**.
4. Use essa conexao na API.

## 5. APIs

A tela **APIs** cria o cadastro funcional do endpoint.

Campos principais:

- nome da API
- cliente
- codigo interno
- versao
- metodo HTTP
- endpoint
- categoria
- conexao
- paginacao
- descricao

Funcoes:

- criar API em rascunho
- editar API
- abrir editor SQL
- publicar API
- despublicar API
- excluir API

Status:

- `rascunho`: ainda nao disponivel para consumo publico
- `publicado`: endpoint disponivel para consumo com token

## 6. Editor SQL

A tela **Editor SQL** e usada para cadastrar e testar a consulta da API.

Funcoes:

- selecionar API
- colar SQL
- salvar SQL
- testar SQL
- visualizar retorno
- inferir campos publicos pelos aliases

Padrao recomendado:

- usar SQL parametrizado
- nao usar datas fixas
- transformar aliases internos em nomes publicos em portugues e camelCase
- testar com parametros reais antes de publicar

Exemplo de parametros de teste:

```json
{
  "documentoParceiro": "12345678000190",
  "dataInicial": "2026-05-01",
  "dataFinal": "2026-05-31"
}
```

## 7. Parametros

A tela **Parametros** define como a API recebe, valida e transforma entradas.

Cada parametro pode ter:

- nome tecnico
- nome publico
- tipo
- obrigatorio
- origem: query, path, header ou body
- descricao
- exemplo
- normalizacao
- valor padrao

Exemplo:

```json
[
  {
    "nomeTecnico": "documentoParceiro",
    "nomePublico": "documentoParceiro",
    "tipo": "texto",
    "obrigatorio": false,
    "origem": "query",
    "descricao": "CPF ou CNPJ do parceiro.",
    "exemplo": "12345678000190",
    "normalizacao": "removerMascara"
  }
]
```

Regras suportadas:

- exigir ao menos um grupo de criterios
- exigir periodo completo
- limite maximo de intervalo
- quantidade maxima por pagina
- normalizacao de documento

Exemplo:

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

## 8. Tokens

O modelo operacional inicial e:

```text
1 cliente = 1 token ativo principal
```

Funcoes:

- gerar token por cliente
- editar token
- ativar ou inativar token
- excluir token
- definir expiracao opcional

Importante:

- o token completo aparece apenas na criacao
- depois, o portal exibe apenas token mascarado
- o banco guarda hash do token, nao o token aberto

Uso pelo cliente:

```http
Authorization: Bearer TOKEN_DO_CLIENTE
```

## 9. Dominios e publicacao

A tela **Dominios** define a URL publica usada na documentacao e na entrega ao cliente.

Campos:

- ambiente
- dominio principal
- subdominio da API
- URL base da API
- URL da documentacao

Exemplo:

```text
URL base da API: https://api.cliente.com.br
URL da documentacao: https://api.cliente.com.br/swagger
```

Depois de salvar, o OpenAPI passa a mostrar essa URL como servidor oficial.

## 10. Documentacao OpenAPI/Swagger

A tela **Documentacao** abre o Swagger gerado.

Enderecos:

```text
Swagger: /swagger
OpenAPI consolidado: /documentacao/openapi.json
OpenAPI por API: /api/admin/apis/ID_DA_API/openapi.json
```

A documentacao inclui:

- titulo da API
- descricao
- versao
- endpoint
- parametros
- autenticacao Bearer
- exemplos
- respostas de sucesso e erro

## 11. Logs

A tela **Logs** mostra chamadas e eventos operacionais.

Campos:

- horario
- API
- status HTTP
- latencia
- origem
- erro, quando existir

Funcoes:

- atualizar logs
- excluir log individual

## 12. Configuracoes

A tela **Configuracoes** personaliza a marca da loja integrada.

Funcoes:

- alterar nome da loja
- alterar logo da loja
- visualizar previa

Importante:

- o nome do sistema continua **Control S API Hub**
- a lateral sempre mostra Control S
- a marca da loja aparece no login e no topo direito

## 13. Fluxo completo para publicar API

```text
1. Login
2. Cadastrar cliente
3. Cadastrar conexao
4. Testar conexao
5. Criar API
6. Salvar SQL
7. Configurar parametros
8. Testar SQL
9. Configurar dominio/publicacao
10. Publicar API
11. Gerar token do cliente
12. Entregar endpoint, Swagger e token ao integrador
13. Monitorar logs
```

## 14. Como parar e iniciar no Windows

Parar nesta maquina:

```cmd
C:\Control S API Hub\PARAR_API_HUB.cmd
```

Iniciar manualmente:

```cmd
C:\Control S API Hub\scripts\start-backend-producao.cmd
```

Consultar inicializacao automatica:

```cmd
schtasks /Query /TN "ControlSAPIHub"
```

Remover inicializacao automatica:

```cmd
schtasks /Delete /TN "ControlSAPIHub" /F
```

## 15. Garantia minima antes de disponibilizar

Antes de gerar instalador, execute:

```cmd
npm.cmd run build
node scripts\testar-rotinas-operacionais.mjs
node scripts\testar-portal-http.mjs
```

O primeiro teste valida o backend internamente.
O segundo valida o portal real publicado em `http://localhost:3333`.
