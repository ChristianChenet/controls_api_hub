# Arquitetura do Control S API Hub

## Objetivo arquitetural

O Control S API Hub foi organizado para separar cadastro, governança, execução e documentação. Essa separação permite que a Control S publique APIs rapidamente sem misturar regras operacionais do portal com a engine que atende consumidores externos.

## Módulos

### 1. Frontend administrativo

Aplicação React usada por operadores da Control S e clientes autorizados. Possui dashboard, cadastro de clientes, conexões, APIs, editor SQL, parâmetros, tokens, logs, documentação, domínios e configurações.

### 2. Backend da plataforma

API administrativa em Fastify. Centraliza regras de produto, cadastro, validações, publicação, geração OpenAPI e integração com a engine.

### 3. Engine de execução

Recebe a configuração publicada da API, valida parâmetros, aplica regras de negócio, executa SQL parametrizado, transforma campos internos em campos públicos em português, pagina resultados, registra log e devolve o envelope padrão.

### 4. Módulo de conexões

Abstrai Oracle, SQL Server e Firebird. Cada banco deve evoluir com um adaptador próprio para:

- montar conexão nativa
- parametrizar consultas conforme dialeto
- tratar paginação
- testar credenciais
- aplicar timeout
- normalizar erros técnicos

### 5. Gerador OpenAPI

Gera documentação OpenAPI 3.0 em português por API e consolidada. Usa parâmetros, campos públicos, autenticação, respostas e exemplos cadastrados.

### 6. Autenticação e tokens

Controla tokens por cliente e parceiro. A estrutura está preparada para escopos, expiração, rate limit, allowlist de IP e perfis no futuro.

### 7. Domínios e publicação

Permite associar endpoint, ambiente, domínio principal, subdomínio da API e rota de documentação. O produto está preparado para instalação local, servidor do cliente ou nuvem Windows.

### 8. Logs e monitoramento

Registra chamadas, token, API, status HTTP, latência, origem, horário, payload resumido e erro padronizado.

## Fluxo de criação de API

1. Cadastrar cliente.
2. Cadastrar conexão com Oracle, SQL Server ou Firebird.
3. Criar API em rascunho.
4. Informar endpoint, método, versão, categoria e autenticação.
5. Colar SQL no editor.
6. Cadastrar parâmetros públicos em português.
7. Configurar regras de validação.
8. Testar SQL com parâmetros.
9. Inferir campos retornados.
10. Mapear aliases públicos em camelCase português.
11. Validar configuração.
12. Publicar versão.
13. Gerar OpenAPI e habilitar endpoint.

## Fluxo de publicação

1. `rascunho`: configuração editável.
2. `validado`: SQL, parâmetros e documentação aprovados.
3. `publicado`: endpoint disponível.
4. `despublicado`: endpoint bloqueado sem apagar histórico.
5. `nova versão`: clona a configuração anterior e preserva rastreabilidade.

## Contratos públicos

Todos os endpoints públicos devem usar:

- campos em português e camelCase
- mensagens em português
- envelope com `sucesso`, `meta`, `dados` e `erro`
- códigos de erro padronizados
- OpenAPI em português

## Plano de evolução

- Persistência completa com SQL Server.
- Criptografia real de credenciais com chave mestra.
- Adaptadores nativos Oracle, SQL Server e Firebird.
- Editor SQL com Monaco Editor.
- Versionamento completo de API e rollback.
- Rate limit por token.
- Allowlist de IP.
- Portal público de documentação com Swagger UI por cliente.
- Auditoria detalhada por usuário.
- Instalação como serviço Windows.
- Publicação via IIS Reverse Proxy.
