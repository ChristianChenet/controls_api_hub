# Control S API Hub - Documentacao final da aplicacao

## Visao geral

O **Control S API Hub** e a plataforma corporativa da Control S Consultoria para criar, testar, publicar, documentar e operar APIs empresariais a partir de consultas SQL controladas.

O produto foi reorganizado para seguir a estrutura correta de negocio:

- **Empresa:** cliente da Control S, dona das conexoes, APIs, dominios, publicacoes, clientes consumidores e logs.
- **Usuario:** pessoa que acessa o portal administrativo e opera dentro de uma ou mais empresas.
- **Cliente consumidor:** parceiro, integrador, marketplace ou terceiro que recebe um token fixo para consumir APIs publicadas.
- **Conexao:** cadastro tecnico de acesso a Oracle, SQL Server ou Firebird, sempre vinculado a uma empresa.
- **API:** endpoint corporativo da empresa, com SQL, parametros, regras, preview, publicacao e documentacao no mesmo contexto.
- **Publicacao:** somente APIs validadas, ativas e publicadas entram no endpoint publico e no Swagger publico.
- **Log:** trilha de chamadas administrativas e publicas, filtrada por empresa.

Fluxo operacional correto:

1. Cadastrar empresa.
2. O sistema cria automaticamente um usuario padrao vinculado a empresa.
3. Selecionar a empresa no contexto do login.
4. Cadastrar conexao da empresa.
5. Testar a conexao.
6. Criar API em rascunho.
7. Escrever e salvar SQL dentro da API.
8. Definir parametros e regras no contexto da API.
9. Validar a configuracao.
10. Publicar a API.
11. Conferir URL local, URL publica e Swagger.
12. Cadastrar cliente consumidor.
13. Copiar o token gerado para o cliente consumidor.
14. Consumir a API com `Authorization: Bearer TOKEN`.

## Arquitetura final

O backend Fastify foi reorganizado em tres superficies claras:

- **Portal administrativo interno:** rotas `/api/admin/*`, usadas pelo frontend e protegidas por sessao.
- **Engine publica de execucao:** rotas `/v1/*`, usadas por integradores com token.
- **Swagger publico dinamico:** `/documentacao/openapi.json` e `/swagger`, gerados apenas a partir de APIs publicadas e ativas.

O Swagger publico nao usa o Swagger automatico das rotas administrativas. Ele e montado pela classe `OpenApiGenerator` com base nos cadastros publicados. Rotas como `/api/admin`, `/api/auth`, `/saude` e telas do portal nao aparecem na documentacao publica.

## Modelagem

As entidades principais ficam persistidas no PostgreSQL interno em `hub_entidades`, com `tipo`, `id` e JSONB. Essa estrategia manteve compatibilidade com a versao anterior e permitiu evoluir a modelagem sem quebrar instalacoes existentes.

Entidades usadas:

- `clientes`: representa **Empresa**.
- `usuarios`: usuarios do portal.
- `usuariosEmpresas`: vinculo explicito entre usuario e empresa.
- `clientesConsumidores`: clientes que consomem APIs e possuem token.
- `conexoes`: conexoes Oracle, SQL Server e Firebird.
- `apis`: API, SQL, parametros, regras, campos e publicacao.
- `tokens`: tokens de acesso por cliente consumidor.
- `logs`: logs das requisicoes administrativas e publicas.

Campos importantes por entidade:

- Empresa: `nomeEmpresa`, `nomeFantasia`, `cnpj` opcional, `dominioApi`, `subdominioApi`, `urlBaseLocal`, `ambiente`, `status`.
- Usuario: `nome`, `email`, `senhaHash`, `perfil`, `status`, `primeiroAcesso`.
- Usuario x empresa: `usuarioId`, `empresaId`, `perfil`, `empresaPadrao`, `ativo`.
- Cliente consumidor: `empresaId`, `nomeCliente`, `emailResponsavel`, `tokenMascarado`, `tokenHash`, `status`, `dataExpiracaoToken`.
- API: `empresaId`, `conexaoId`, `nome`, `metodoHttp`, `endpoint`, `sqlBase`, `parametros`, `regras`, `status`, `ativa`, `publicadaEm`.
- Log: `empresaId`, `apiId`, `clienteConsumidorId`, `metodoHttp`, `endpoint`, `statusHttp`, `tempoRespostaMs`, `parametrosRecebidos`, `totalRegistros`.

## Backend

Principais rotas administrativas:

- `POST /api/auth/login`: login e selecao automatica de empresa quando houver apenas uma.
- `POST /api/auth/selecionar-empresa`: troca de empresa quando o usuario esta vinculado a mais de uma.
- `GET/POST/PUT/DELETE /api/admin/empresas`: cadastro de empresas.
- `GET/POST/PUT/DELETE /api/admin/usuarios`: usuarios do portal, restrito a administradores.
- `GET/POST/PUT/DELETE /api/admin/conexoes`: conexoes por empresa.
- `POST /api/admin/conexoes/:id/testar`: teste real de conexao.
- `GET/POST/PUT/DELETE /api/admin/apis`: cadastro de APIs.
- `PUT /api/admin/apis/:id/sql`: SQL dentro da API.
- `PUT /api/admin/apis/:id/parametros`: parametros dentro da API.
- `POST /api/admin/apis/:id/testar-sql`: execucao real de SQL.
- `POST /api/admin/apis/:id/validar`: validacao antes da publicacao.
- `POST /api/admin/apis/:id/publicar`: publica API e gera URLs.
- `POST /api/admin/apis/:id/despublicar`: remove API do catalogo publico.
- `GET/POST/PUT/DELETE /api/admin/clientes-consumidores`: clientes consumidores e token fixo.
- `POST /api/admin/clientes-consumidores/:id/regenerar-token`: troca segura de token.
- `GET /api/admin/logs`: logs filtrados por empresa.
- `GET /documentacao/openapi.json`: OpenAPI publico somente com APIs publicadas.
- `GET /swagger`: Swagger publico.

## Frontend

O portal segue o padrao visual corporativo Control S/Fiscal Hub:

- menu lateral escuro recolhivel;
- contexto do produto no topo;
- marca do cliente integrada no canto direito;
- cards executivos;
- tabelas compactas;
- botoes pequenos;
- rodape institucional obrigatorio.

Menu operacional:

- Dashboard
- Empresas
- Usuarios
- Conexoes
- APIs
- Editor SQL
- Parametros
- Documentacao
- Clientes consumidores
- Tokens
- Logs
- Dominios
- Configuracoes

A tela **Clientes consumidores** e o ponto recomendado para gerar token fixo para integradores. A tela **Tokens** permanece como visao tecnica/compatibilidade.

## Banco de dados

Banco principal recomendado:

```text
control_s_api_hub
```

Banco de testes isolado:

```text
control_s_api_hub_test
```

Os testes automatizados derrubam e recriam apenas `control_s_api_hub_test`. A base principal da instalacao nao e usada pelos testes.

Arquivo de exemplo para testes:

```text
.env.test.example
```

## Execucao local

```cmd
cd /d "C:\Control S API Hub"
scripts\start-backend-producao.cmd
```

Acesso:

```text
http://localhost:3333/
```

Saude:

```text
http://localhost:3333/saude
```

Swagger publico:

```text
http://localhost:3333/swagger
```

OpenAPI publico:

```text
http://localhost:3333/documentacao/openapi.json
```

## Publicacao por dominio

O dominio pertence a empresa. Configure em **Dominios**:

- dominio principal;
- subdominio da API;
- URL base local;
- ambiente.

Exemplos:

```text
Local:  http://localhost:3333/v1/parceiros/comissoes
Publico: https://api.empresa.com.br/v1/parceiros/comissoes
Swagger: https://api.empresa.com.br/swagger
```

Em Windows Server, recomenda-se usar IIS com ARR e URL Rewrite apontando o dominio publico para a porta `3333`.

## Tokens e consumo

Modelo adotado:

- cada **cliente consumidor** recebe um token proprio;
- o token pertence a uma empresa;
- o token e armazenado como hash;
- o portal mostra o token completo apenas no momento da criacao ou regeneracao;
- chamadas publicas devem enviar:

```http
Authorization: Bearer TOKEN_DO_CLIENTE
```

Exemplo de erro:

```json
{
  "sucesso": false,
  "erro": {
    "codigo": "TOKEN_INVALIDO",
    "mensagem": "Token invalido, inativo ou sem permissao para esta API."
  }
}
```

## Testes

Comandos:

```cmd
npm.cmd run build
node scripts\testar-rotinas-operacionais.mjs
```

O comando `testar-rotinas-operacionais.mjs` agora chama a bateria isolada `testar-integracao-isolado.mjs`.

Cobertura atual:

- login com empresa selecionada;
- cadastro de empresa sem CNPJ;
- criacao automatica de usuario padrao;
- vinculo usuario x empresa;
- troca de empresa;
- dashboard filtrado por empresa;
- cadastro de conexao;
- teste de conexao para Oracle, SQL Server e Firebird com retorno claro;
- cadastro de API;
- SQL dentro da API;
- parametros dentro da API;
- validacao;
- publicacao com URL local e publica;
- cadastro de cliente consumidor;
- geracao e regeneracao de token;
- logs filtrados;
- Swagger publico somente com APIs publicadas;
- remocao da API do Swagger apos despublicar.

Confirmacao critica:

```text
Os testes nao usam a base default control_s_api_hub.
Os testes usam e recriam somente control_s_api_hub_test.
```

## Operacao diaria

1. Entrar no portal com usuario administrador.
2. Conferir empresa ativa no contexto.
3. Cadastrar ou selecionar a empresa.
4. Criar conexao da empresa.
5. Testar conexao.
6. Criar API em rascunho.
7. Salvar SQL na API.
8. Configurar parametros.
9. Testar SQL.
10. Validar API.
11. Publicar API.
12. Abrir Swagger publico.
13. Cadastrar cliente consumidor.
14. Copiar token para o integrador.
15. Monitorar logs.

## Escopo HTTP da primeira versao

Nesta versao, o Control S API Hub publica somente APIs de consulta com metodo **GET**.

Essa decisao e intencional porque o motor atual foi desenhado para expor consultas SQL parametrizadas, com filtros por query string, token por cliente consumidor, envelope padronizado e Swagger de consulta.

APIs **POST** devem entrar em uma etapa futura com outro desenho tecnico, incluindo:

- schema formal de body;
- validacao de payload;
- controle de idempotencia;
- execucao transacional;
- auditoria reforcada;
- controle de permissao por operacao;
- rollback e tratamento de comandos de escrita ou procedures.

Enquanto esse modulo nao existir, o portal bloqueia metodos diferentes de GET para evitar publicacao de APIs com comportamento incompleto.

## Limitacoes atuais

- O teste real de SQL depende dos drivers nativos instalados no Windows (`mssql`, `oracledb`, `node-firebird`) e dos clients exigidos pelo banco.
- O Swagger publico usa CDN do Swagger UI na tela HTML; o JSON OpenAPI funciona localmente sem CDN.
- O hash de senha foi introduzido mantendo compatibilidade com o admin antigo `controls`; no primeiro login a senha antiga e migrada para hash.

## Evolucao recomendada

- Criar instalador MSI/NSIS com interface grafica.
- Adicionar RBAC por tela e permissao por API.
- Adicionar rate limit por cliente consumidor.
- Adicionar allowlist de IP por token.
- Adicionar historico versionado completo de publicacoes.
- Adicionar editor SQL com Monaco Editor.
- Adicionar auditoria administrativa detalhada.
- Publicar Swagger UI local sem dependencia de CDN.

## Rodape institucional

Todas as telas devem manter:

```text
CONTROL S CONSULTORIA — Direitos Reservados | CNPJ: 21.421.411/0001-20
```
