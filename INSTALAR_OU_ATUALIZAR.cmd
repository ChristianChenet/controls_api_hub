@echo off
setlocal
title Control S API Hub - Instalador / Atualizador
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0INSTALAR_OU_ATUALIZAR.ps1"
echo.
echo Processo finalizado. Se ocorreu algum erro, veja o arquivo install.log nesta pasta.
pause
