# Control S API Hub - instalacao nova com PostgreSQL

Este guia descreve a instalacao nova do **Control S API Hub** em Windows Server, usando **PostgreSQL** como banco interno do produto.

O PostgreSQL salva as informacoes cadastradas nas telas do portal:

- usuarios
- clientes
- conexoes
- APIs
- SQL cadastrado
- status de publicacao
- identidade da loja integrada
- tokens
- logs

As bases Oracle, SQL Server e Firebird continuam sendo as fontes externas consultadas pelas APIs publicadas.

## 1. Pre-requisitos

Instale no servidor:

- Windows Server 2019 ou superior, ou Windows 10/11 Pro.
- Node.js 20 LTS ou superior.
- PostgreSQL 15 ou superior.
- Acesso administrativo ao servidor.
- Acesso de rede do servidor ate os bancos de dados do cliente.

Downloads:

- Node.js LTS: `https://nodejs.org`
- PostgreSQL Windows: `https://www.enterprisedb.com/downloads/postgres-postgresql-downloads`

## 2. Instalar PostgreSQL manualmente

Baixe o instalador oficial da EnterpriseDB:

```text
https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
```

Use preferencialmente PostgreSQL 16 ou 17 para Windows x86-64.

No instalador do PostgreSQL, use:

- **Installation Directory:** pode manter o padrao, por exemplo `C:\Program Files\PostgreSQL\17`.
- **Select Components:** marque `PostgreSQL Server`, `pgAdmin 4` e `Command Line Tools`.
- **Data Directory:** pode manter o padrao sugerido.
- **Password:** use `controls`.
- **Port:** mantenha `5432`.
- **Advanced Options / Locale:** pode manter `Default locale`.
- **Stack Builder:** se abrir no final, pode cancelar.

Senha padrao do usuario `postgres` para este projeto:

```text
controls
```

Essa senha sera usada pelo instalador/atualizador do Control S API Hub e no arquivo `.env`.

## 3. Copiar o pacote

Copie o arquivo ZIP do Control S API Hub para o servidor e extraia para:

```text
C:\Control S API Hub
```

A estrutura esperada e:

```text
C:\Control S API Hub
  apps
  docs
  scripts
  .env.example
  INSTALAR_OU_ATUALIZAR.cmd
  INSTALAR_OU_ATUALIZAR.ps1
  package.json
```

## 4. Instalar ou atualizar automaticamente

Depois de extrair o pacote, execute como Administrador:

```cmd
C:\Control S API Hub\INSTALAR_OU_ATUALIZAR.cmd
```

O instalador faz:

- verifica Node.js
- verifica PostgreSQL
- se PostgreSQL nao existir, pergunta se deseja tentar baixar automaticamente via winget
- se voce responder `N`, mostra o link da EnterpriseDB
- cria o banco `control_s_api_hub` se ele nao existir
- cria as tabelas internas do produto
- cria ou atualiza o `.env`
- instala dependencias Node.js
- libera a porta `3333` no Firewall do Windows
- cria um atalho na Area de Trabalho
- registra automaticamente a inicializacao junto com o Windows
- inicia o portal imediatamente ao final

Por padrao, o instalador cria uma tarefa do Windows chamada:

```text
ControlSAPIHub
```

Essa tarefa roda ao iniciar o servidor usando a conta `SYSTEM`, com atraso de 1 minuto para dar tempo do PostgreSQL subir.
O script de producao tambem reinicia o backend automaticamente se ele encerrar durante a inicializacao.

Para consultar:

```cmd
schtasks /Query /TN "ControlSAPIHub"
```

Para remover:

```cmd
schtasks /Delete /TN "ControlSAPIHub" /F
```

Para parar apenas nesta maquina, sem remover a inicializacao automatica:

```cmd
C:\Control S API Hub\PARAR_API_HUB.cmd
```

Se a tarefa `ControlSAPIHub` continuar registrada, o sistema volta a subir no proximo boot do Windows.

Se a janela mostrar erro, veja o log:

```text
C:\Control S API Hub\install.log
```

## 5. Configuracao do .env

O instalador cria o `.env` automaticamente. A configuracao esperada e:

```env
PRODUCT_DATABASE_PROVIDER=postgres
DATABASE_URL=postgres://postgres:controls@localhost:5432/control_s_api_hub
```

Se voce usou outra senha no PostgreSQL, altere `controls` pela senha correta.

## 6. Iniciar o sistema

O instalador ja inicia o sistema ao final e deixa configurado para subir junto com o Windows. Se quiser iniciar manualmente:

```cmd
cd /d "C:\Control S API Hub"
scripts\start-backend-producao.cmd
```

O log do backend em producao fica em:

```text
C:\Control S API Hub\logs\backend-producao.log
```

O instalador ja cria as tabelas internas no PostgreSQL:

- `hub_entidades`
- `hub_configuracoes`

Ao iniciar o backend, o sistema valida o schema e cria os dados iniciais, incluindo o usuario administrador, caso ainda nao existam.

## 7. Acessar o portal

No navegador do servidor, abra:

```text
http://localhost:3333/
```

Login padrao:

```text
E-mail: admin@controlsconsultoria.com.br
Senha: controls
```

Depois de entrar:

1. Crie os usuarios reais em **Usuarios**.
2. Configure a marca da loja integrada em **Configuracoes**.
3. Crie a conexao do banco do cliente em **Conexoes**.
4. Crie a API em **APIs**.
5. Cole e teste o SQL em **Editor SQL**.
6. Publique a API.

## 8. Acesso pela rede

O instalador libera a porta `3333`. De outro computador da rede, acesse:

```text
http://IP_DO_SERVIDOR:3333/
```

## 9. Atualizacao

Para atualizar:

1. Extraia o pacote novo.
2. Execute `INSTALAR_OU_ATUALIZAR.cmd` como Administrador.

O atualizador preserva:

- banco PostgreSQL
- dados cadastrados
- arquivo `.env`

## 10. Rodar como servico Windows

Para producao, recomenda-se usar NSSM ou WinSW.

Com NSSM:

```cmd
nssm install ControlSApiHub
```

Configure:

- Application: caminho do `node.exe`
- Arguments: `apps\backend\dist\server.js`
- Startup directory: `C:\Control S API Hub`

Depois inicie o servico pelo `services.msc`.

## 11. Solucao de problemas

### PostgreSQL nao encontrado

Instale pelo link:

```text
https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
```

Marque `Command Line Tools`, feche e abra novamente o Prompt como Administrador, e rode o instalador outra vez.

### Erro de senha no PostgreSQL

Confirme se a senha do usuario `postgres` e:

```text
controls
```

Se for outra senha, ajuste o `.env`.

Se o instalador mostrar:

```text
FATAL: autenticacao do tipo senha falhou para o usuario "postgres"
```

significa que a senha informada no instalador nao e a senha real do PostgreSQL. Rode o instalador novamente e informe a senha correta.

Se a senha foi esquecida, use uma destas opcoes:

1. Abrir o pgAdmin e alterar a senha do usuario `postgres` para `controls`.
2. Reinstalar o PostgreSQL e definir a senha `controls`.
3. Usar a senha real no instalador e deixar o `.env` com essa senha.

### Tela nao abre

Confirme se o backend esta rodando:

```cmd
scripts\start-backend-producao.cmd
```

Teste:

```text
http://localhost:3333/saude
```

### Backup

Backup:

```cmd
pg_dump -U postgres control_s_api_hub > backup_control_s_api_hub.sql
```

Restauracao:

```cmd
psql -U postgres control_s_api_hub < backup_control_s_api_hub.sql
```
