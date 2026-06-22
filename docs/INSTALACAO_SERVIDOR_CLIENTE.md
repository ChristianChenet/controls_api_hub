# Instalacao no servidor do cliente

Este modo de instalacao e o recomendado para colocar o Control S API Hub no servidor Windows onde estao os bancos Oracle, SQL Server ou Firebird.

## Pre-requisitos

- Windows Server ou Windows Desktop 64 bits.
- Node.js 20 LTS ou superior.
- PostgreSQL 15 ou superior.
- Acesso de rede do servidor ate o banco de dados do cliente.
- Driver/cliente do banco instalado quando necessario:
  - SQL Server: conexao TCP liberada, normalmente porta 1433.
  - Oracle: Oracle Instant Client quando exigido pelo ambiente.
  - Firebird: acesso ao arquivo `.FDB` ou servico Firebird liberado.

## Gerar pacote na maquina de desenvolvimento

No PowerShell:

```powershell
cd "C:\Control S API Hub"
.\scripts\gerar-pacote-windows.ps1
```

O arquivo sera gerado em:

```text
C:\Control S API Hub\release\ControlSApiHub-WindowsServer.zip
```

## Instalar no servidor do cliente

1. Copie `ControlSApiHub-WindowsServer.zip` para o servidor.
2. Extraia para:

```text
C:\Control S API Hub
```

3. Execute o instalador/atualizador como Administrador:

```cmd
C:\Control S API Hub\INSTALAR_OU_ATUALIZAR.cmd
```

O instalador cria/configura `.env`, banco PostgreSQL, tabelas, dependencias, firewall, atalho e inicializacao automatica.

Por padrao, ele cria a tarefa do Windows:

```text
ControlSAPIHub
```

Essa tarefa sobe o Control S API Hub quando o Windows ligar, usando a conta `SYSTEM`.
O backend roda em modo de supervisao simples e tenta reiniciar se o PostgreSQL ainda nao estiver pronto no boot.

Logs de producao:

```text
C:\Control S API Hub\logs\backend-producao.log
```

Instalacao manual, somente se necessario:

```cmd
cd /d "C:\Control S API Hub"
copy .env.example .env
psql -U postgres -c "CREATE DATABASE control_s_api_hub;"
scripts\instalar-dependencias-producao.cmd
scripts\start-backend-producao.cmd
```

## Publicar o portal

O backend serve o frontend e as APIs no mesmo endereco, por padrao:

```text
http://localhost:3333
```

Para producao, recomenda-se usar IIS com URL Rewrite e ARR para publicar:

- `https://api.cliente.com.br`
- `https://api.cliente.com.br/documentacao`
- `https://api.cliente.com.br/v1/...`

## Inicializacao automatica no Windows

O padrao do produto e subir automaticamente pelo Agendador de Tarefas do Windows.

Consultar:

```cmd
schtasks /Query /TN "ControlSAPIHub"
```

Remover:

```cmd
schtasks /Delete /TN "ControlSAPIHub" /F
```

Parar agora sem remover a inicializacao automatica:

```cmd
C:\Control S API Hub\PARAR_API_HUB.cmd
```

Registrar novamente:

```cmd
powershell.exe -ExecutionPolicy Bypass -File scripts\registrar-inicializacao-windows.ps1
```

## Banco interno PostgreSQL

O instalador cria o banco `control_s_api_hub` e aplica as tabelas internas:

- `hub_entidades`
- `hub_configuracoes`

Sao persistidos no PostgreSQL:

- usuarios
- clientes
- conexoes
- APIs
- SQL cadastrado
- identidade da loja
- tokens
- logs
- configuracoes de publicacao

As conexoes com Oracle, SQL Server e Firebird continuam sendo as fontes externas das APIs publicadas.
