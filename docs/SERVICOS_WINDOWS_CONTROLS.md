# Serviços Windows - Control S API Hub

## Objetivo

O Control S API Hub deve rodar no servidor como serviço do Windows, no mesmo padrão operacional dos demais serviços da Control S.

## Serviços criados

| Serviço | Função |
| --- | --- |
| `ControlSApiHub` | Backend Node.js do Control S API Hub na porta `3335`. |
| `ControlSApiHubNginx` | Nginx/proxy na porta `3333`, encaminhando para `127.0.0.1:3335`. |

## Arquitetura

```text
api.monvizo.com.br:8080
  -> firewall / NAT
  -> 192.168.1.70:3333
  -> Serviço ControlSApiHubNginx
  -> 127.0.0.1:3335
  -> Serviço ControlSApiHub
```

## Instalar ou atualizar os serviços

Execute como Administrador:

```cmd
cd /d "C:\Control S API Hub"
INSTALAR_OU_ATUALIZAR.cmd
```

O instalador:

- configura `.env`;
- cria/atualiza banco e tabelas;
- instala dependências;
- libera a porta `3333` no firewall;
- remove a tarefa agendada antiga `ControlSAPIHub`, se existir;
- cria o serviço `ControlSApiHub`;
- cria o serviço `ControlSApiHubNginx`, se o Nginx existir em `C:\nginx\nginx.exe`;
- inicia os serviços.

## Consultar status

```cmd
cd /d "C:\Control S API Hub"
powershell.exe -ExecutionPolicy Bypass -File scripts\status-servicos-windows.ps1
```

Ou pelo Windows:

```cmd
services.msc
```

## Reiniciar serviços

```powershell
Restart-Service ControlSApiHub
Restart-Service ControlSApiHubNginx
```

## Parar aplicação

```cmd
cd /d "C:\Control S API Hub"
PARAR_API_HUB.cmd
```

## Remover serviços

Execute como Administrador:

```cmd
cd /d "C:\Control S API Hub"
powershell.exe -ExecutionPolicy Bypass -File scripts\remover-servicos-windows.ps1
```

## Logs

Logs do serviço da API:

```text
C:\Control S API Hub\logs\servico-api-hub.log
C:\Control S API Hub\logs\servico-api-hub-error.log
```

## Testes

```text
http://localhost:3335/saude
http://localhost:3333/saude
http://api.monvizo.com.br:8080/saude
http://api.monvizo.com.br:8080/swagger
```

## Observação sobre NSSM

O serviço é criado usando NSSM. Se o NSSM não existir no servidor, o instalador tenta baixar automaticamente.
Se o servidor bloquear download, coloque manualmente:

```text
C:\ProgramData\ControlS\Tools\nssm\nssm.exe
```
