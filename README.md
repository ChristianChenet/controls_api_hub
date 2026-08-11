# Control S API Hub

**Control S API Hub** é uma plataforma corporativa para criação, publicação, documentação e gestão de APIs empresariais.

O produto foi projetado para a Control S Consultoria operar APIs com velocidade, governança e padrão profissional, permitindo que clientes autorizados mantenham conexões, consultas SQL, parâmetros, tokens, publicações, documentação e logs pelo portal.

## Visão do produto

A solução nasce com duas frentes:

- **Portal administrativo interno:** cadastro de clientes, conexões, APIs, SQL, parâmetros, tokens, domínios, logs e publicações.
- **Portal de documentação e consumo:** documentação OpenAPI/Swagger em português, exemplos, autenticação, versões e endpoints publicados.

## Stack escolhida

- **Backend:** Node.js, TypeScript, Fastify, OpenAPI 3.0 e Swagger UI.
- **Frontend:** React, TypeScript, Vite e design system próprio com ícones Lucide.
- **Banco interno do produto:** PostgreSQL.
- **Bancos externos suportados desde a primeira versão:** Oracle, Microsoft SQL Server e Firebird.

### Decisão sobre o banco interno

Para ambientes Windows Desktop, Windows Server e nuvem Windows, o banco interno escolhido para esta versão é **PostgreSQL**. Ele armazena clientes, conexões, APIs, SQL cadastrado, usuários, tokens, logs e configurações da identidade da loja.

O instalador cria o banco `control_s_api_hub`, aplica o schema inicial e o backend cria os dados iniciais quando inicia pela primeira vez.

## Módulos entregues nesta base

1. Dashboard executivo
2. Clientes
3. Conexões Oracle, SQL Server e Firebird
4. Cadastro de APIs
5. Editor SQL
6. Parâmetros e regras de validação
7. Publicação e versionamento conceitual
8. Tokens de acesso
9. Logs e monitoramento
10. Domínios e publicação
11. Geração OpenAPI em português
12. API exemplo de parceiros/comissões

## Estrutura de pastas

```text
control-s-api-hub/
  apps/
    backend/
      src/
        config/
        data/
        database/
        domain/
        http/
        modules/
          conexoes/
          docs/
          engine/
        samples/
    frontend/
      src/
        App.tsx
        data.ts
        styles.css
  docs/
    ARQUITETURA.md
    WINDOWS.md
  scripts/
    start-backend.cmd
    start-frontend.cmd
    build.cmd
  .env.example
  package.json
```

## Instalação no servidor com PostgreSQL

Para instalação nova em servidor do cliente, use o pacote:

```text
release\ControlSApiHub-WindowsServer.zip
```

O guia completo está em:

```text
docs\INSTALACAO_NOVA_POSTGRES.md
```

Guia de uso do portal, com o fluxo esperado de operacao:

```text
docs\GUIA_DE_USO_PORTAL.md
```

Guia de tokens por cliente e parametros de API:

```text
docs\TOKENS_E_PARAMETROS.md
```

Passo a passo para criar API, publicar, configurar URL e liberar token para o cliente:

```text
docs\PASSO_A_PASSO_PUBLICAR_API.md
```

Documentacao completa das funcionalidades:

```text
docs\FUNCIONALIDADES_COMPLETAS.md
```

Documentacao final da arquitetura reestruturada, modelagem multiempresa, Swagger publico, clientes consumidores, tokens e testes isolados:

```text
docs\DOCUMENTACAO_FINAL_APLICACAO.md
```

Instalação automática:

```cmd
INSTALAR_OU_ATUALIZAR.cmd
```

Antes de executar, instale o PostgreSQL para Windows:

```text
https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
```

O instalador/atualizador copia arquivos, cria/configura `.env`, cria o banco PostgreSQL se necessário, cria as tabelas internas, instala dependências, libera firewall, cria atalho, registra serviços do Windows e inicia o portal ao final da instalação.

Por padrão, o instalador cria os serviços do Windows:

```text
ControlSApiHub
ControlSApiHubNginx
```

O serviço `ControlSApiHub` roda o backend Node.js na porta `3335`. O serviço `ControlSApiHubNginx` roda o proxy Nginx na porta `3333`, encaminhando para `127.0.0.1:3335`.

Os logs ficam em:

```text
C:\Control S API Hub\logs\servico-api-hub.log
C:\Control S API Hub\logs\servico-api-hub-error.log
```

Consultar serviços:

```cmd
powershell.exe -ExecutionPolicy Bypass -File scripts\status-servicos-windows.ps1
```

Remover serviços:

```cmd
powershell.exe -ExecutionPolicy Bypass -File scripts\remover-servicos-windows.ps1
```

Parar o Control S API Hub nesta maquina, sem remover a inicializacao automatica:

```cmd
PARAR_API_HUB.cmd
```

Esse comando encerra os serviços do Control S API Hub quando estiverem instalados.

Instalação manual:

```cmd
cd /d "C:\Control S API Hub"
scripts\criar-banco-postgres.cmd
copy .env.example .env
notepad .env
scripts\instalar-dependencias-producao.cmd
scripts\start-backend-producao.cmd
```

Depois acesse:

```text
Node direto: http://localhost:3335/
Proxy/Nginx: http://localhost:3333/
Publico: http://api.monvizo.com.br:8080/
```

## Execução local no Windows

Pré-requisitos:

- Node.js 20 LTS ou superior
- npm 10 ou superior
- PowerShell ou Prompt de Comando
- SQL Server Express/LocalDB para persistência real futura

Instalação:

```powershell
cd "C:\Control S API Hub"
copy .env.example .env
npm install
```

Rodar backend:

```powershell
npm run dev:backend
```

Rodar frontend:

```powershell
npm run dev:frontend
```

URLs locais:

- Portal administrativo: `http://localhost:5173`
- Backend administrativo direto: `http://localhost:3335/api/admin/dashboard`
- Proxy/Nginx no servidor: `http://localhost:3333/`
- Swagger publico, somente com APIs publicadas: `http://localhost:3333/swagger`
- OpenAPI publico consolidado: `http://localhost:3333/documentacao/openapi.json`
- API exemplo: `http://localhost:3333/v1/parceiros/comissoes?documentoParceiro=12345678000190`

Arquitetura recomendada no servidor:

```text
api.monvizo.com.br:8080 -> firewall -> 192.168.1.70:3333 -> Nginx -> 127.0.0.1:3335
```

## Exemplo funcional: parceiros/comissões

Endpoint:

```http
GET /v1/parceiros/comissoes
```

Parâmetros públicos:

- `documentoParceiro`
- `dataInicial`
- `dataFinal`
- `pagina`
- `quantidadePorPagina`

Regras implementadas:

- Permite consultar apenas por `documentoParceiro`.
- Permite consultar por `dataInicial` + `dataFinal`.
- Permite combinar documento e período.
- Obriga pelo menos `documentoParceiro` ou período completo.
- Se apenas uma data for enviada, retorna `PERIODO_INVALIDO`.
- Remove máscara de CPF/CNPJ antes de validar.
- Sem documento, limita o período máximo a 31 dias.

Resposta de sucesso:

```json
{
  "sucesso": true,
  "meta": {
    "pagina": 1,
    "quantidadePorPagina": 100,
    "totalRegistros": 1
  },
  "dados": []
}
```

Resposta de erro:

```json
{
  "sucesso": false,
  "erro": {
    "codigo": "FILTRO_OBRIGATORIO_NAO_INFORMADO",
    "mensagem": "Informe documentoParceiro ou o periodo completo com dataInicial e dataFinal."
  }
}
```

## Segurança prevista

- Tokens Bearer por cliente e parceiro.
- Hash de tokens com pepper.
- Senhas de conexões criptografadas.
- Consultas parametrizadas.
- Separação entre cadastro e engine de execução.
- Status de publicação antes de expor endpoints.
- Logs por API, token, status HTTP, latência e origem.
- Preparado para rate limit, allowlist de IP, perfis e auditoria avançada.

## Publicação futura com IIS

Em Windows Server, a recomendação é publicar o backend Node.js como serviço do Windows e usar IIS com URL Rewrite + ARR como reverse proxy para domínios como:

- `api.cliente.com.br`
- `api.site.com.br`
- `/documentacao`
- `/v1/...`

Detalhes em `docs/WINDOWS.md`.
