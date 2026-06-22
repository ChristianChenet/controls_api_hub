# Backup e restauração do Control S API Hub

Este documento registra o procedimento padrão para restaurar o banco interno PostgreSQL do Control S API Hub em um servidor Windows.

## Backup gerado

O backup deve ficar na pasta:

```text
C:\Control S API Hub\backup
```

O arquivo gerado nesta versão foi:

```text
control_s_api_hub-20260522-005315.backup
```

## Criar o banco no servidor

Execute no Prompt de Comando ou PowerShell do servidor:

```bat
set PGPASSWORD=controls
"C:\Program Files\PostgreSQL\18\bin\createdb.exe" -h localhost -p 5432 -U postgres control_s_api_hub
```

Se o banco já existir, pule esta etapa.

## Restaurar o backup

Copie o arquivo `.backup` para o servidor e execute:

```bat
set PGPASSWORD=controls
"C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" -h localhost -p 5432 -U postgres -d control_s_api_hub --clean --if-exists --no-owner --verbose "C:\Control S API Hub\backup\control_s_api_hub-20260522-005315.backup"
```

Se o PostgreSQL estiver instalado em outra pasta, ajuste apenas o caminho:

```text
C:\Program Files\PostgreSQL\18\bin
```

## Observações

- Senha padrão recomendada para o PostgreSQL neste projeto: `controls`.
- Banco interno padrão: `control_s_api_hub`.
- Usuário PostgreSQL padrão: `postgres`.
- Porta PostgreSQL padrão: `5432`.
- Após restaurar, reinicie o Control S API Hub.
