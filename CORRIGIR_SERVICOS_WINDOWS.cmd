@echo off
setlocal
cd /d "%~dp0"

echo.
echo ==== Control S API Hub - correcao definitiva dos servicos ====
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\instalar-servicos-windows.ps1"

echo.
echo Processo finalizado.
echo Consulte:
echo   http://localhost:3333/saude
echo   http://localhost:3333/swagger
echo.
pause
