@echo off
cd /d "%~dp0\.."
if not exist "logs" mkdir "logs"

:inicio
echo [%date% %time%] Iniciando Control S API Hub...>> "logs\backend-producao.log"
node apps\backend\dist\server.js >> "logs\backend-producao.log" 2>&1
echo [%date% %time%] Backend finalizado. Reiniciando em 10 segundos...>> "logs\backend-producao.log"
timeout /t 10 /nobreak > nul
goto inicio
