@echo off
setlocal
title Control S API Hub - Restaurar Backup PostgreSQL
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0RESTAURAR_BACKUP.ps1"
echo.
echo Processo finalizado. Se ocorreu algum erro, veja o arquivo restore.log nesta pasta.
pause
