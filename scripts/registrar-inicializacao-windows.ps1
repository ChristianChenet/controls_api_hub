param(
  [string]$InstallDir = "C:\Control S API Hub"
)

$ErrorActionPreference = "Stop"
$cmd = Join-Path $InstallDir "scripts\start-backend-producao.cmd"

if (!(Test-Path $cmd)) {
  throw "Script de inicializacao nao encontrado: $cmd"
}

$taskName = "ControlSAPIHub"
$wrapperDir = Join-Path $env:ProgramData "ControlSAPIHub"
$wrapper = Join-Path $wrapperDir "start.cmd"

New-Item -ItemType Directory -Force -Path $wrapperDir | Out-Null
Set-Content -Path $wrapper -Encoding ASCII -Value @"
@echo off
cd /d "$InstallDir"
call "$cmd"
"@

$taskRun = $wrapper

$args = @("/Create", "/TN", $taskName, "/SC", "ONSTART", "/DELAY", "0001:00", "/RU", "SYSTEM", "/RL", "HIGHEST", "/TR", $taskRun, "/F")
& schtasks.exe @args
if ($LASTEXITCODE -ne 0) {
  throw "Nao foi possivel registrar a tarefa de inicializacao automatica. Execute como Administrador."
}

Write-Host "Inicializacao automatica configurada: $taskName"
Write-Host "O Control S API Hub sera iniciado automaticamente quando o Windows ligar."
Write-Host "Consultar: schtasks /Query /TN `"$taskName`""
Write-Host "Remover: schtasks /Delete /TN `"$taskName`" /F"
