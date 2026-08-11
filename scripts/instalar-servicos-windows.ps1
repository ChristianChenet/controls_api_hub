param(
  [string]$InstallDir = "C:\Control S API Hub",
  [string]$NginxDir = "C:\nginx",
  [string]$ApiServiceName = "ControlSApiHub",
  [string]$NginxServiceName = "ControlSApiHubNginx",
  [int]$BackendPort = 3335,
  [string]$PublicUrl = "http://api.monvizo.com.br:8080",
  [switch]$NaoInstalarNginx
)

$ErrorActionPreference = "Stop"

function Escrever-Titulo($texto) {
  Write-Host ""
  Write-Host "==== $texto ====" -ForegroundColor Green
}

function Falhar($texto) {
  Write-Host $texto -ForegroundColor Red
  throw $texto
}

function Encontrar-Nssm() {
  $candidatos = @(
    (Join-Path $env:ProgramData "ControlS\Tools\nssm\nssm.exe"),
    "C:\nssm\nssm.exe",
    "C:\nssm\win64\nssm.exe"
  )

  foreach ($candidato in $candidatos) {
    if (Test-Path $candidato) { return $candidato }
  }

  $cmd = Get-Command "nssm.exe" -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  return $null
}

function Instalar-Nssm-Se-Necessario() {
  $nssm = Encontrar-Nssm
  if ($nssm) { return $nssm }

  Escrever-Titulo "Baixando NSSM para servicos do Windows"
  $toolsDir = Join-Path $env:ProgramData "ControlS\Tools"
  $downloadDir = Join-Path $toolsDir "download"
  $zipPath = Join-Path $downloadDir "nssm.zip"
  $extractDir = Join-Path $downloadDir "nssm"
  $destDir = Join-Path $toolsDir "nssm"
  New-Item -ItemType Directory -Force -Path $downloadDir, $destDir | Out-Null

  try {
    Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" -OutFile $zipPath -UseBasicParsing
    if (Test-Path $extractDir) { Remove-Item -LiteralPath $extractDir -Recurse -Force }
    Expand-Archive -LiteralPath $zipPath -DestinationPath $extractDir -Force
    $nssmExtraido = Get-ChildItem -LiteralPath $extractDir -Filter "nssm.exe" -Recurse |
      Where-Object { $_.FullName -match "\\win64\\" } |
      Select-Object -First 1
    if (!$nssmExtraido) {
      $nssmExtraido = Get-ChildItem -LiteralPath $extractDir -Filter "nssm.exe" -Recurse | Select-Object -First 1
    }
    if (!$nssmExtraido) { Falhar "NSSM nao foi encontrado apos extrair o pacote." }
    Copy-Item -LiteralPath $nssmExtraido.FullName -Destination (Join-Path $destDir "nssm.exe") -Force
  } catch {
    Falhar "Nao foi possivel baixar o NSSM automaticamente. Baixe em https://nssm.cc/download e coloque nssm.exe em C:\ProgramData\ControlS\Tools\nssm\nssm.exe"
  }

  return (Join-Path $destDir "nssm.exe")
}

function Servico-Existe($nome) {
  return [bool](Get-Service -Name $nome -ErrorAction SilentlyContinue)
}

function Remover-Servico-Se-Existir($nssm, $nome) {
  if (Servico-Existe $nome) {
    Write-Host "Atualizando servico existente: $nome"
    & $nssm stop $nome | Out-Null
    Start-Sleep -Seconds 2
    & $nssm remove $nome confirm | Out-Null
    Start-Sleep -Seconds 1
  }
}

function Instalar-Servico-ApiHub($nssm) {
  Escrever-Titulo "Instalando servico Control S API Hub"

  $nodeCmd = Get-Command "node.exe" -ErrorAction SilentlyContinue
  $node = if ($nodeCmd) { $nodeCmd.Source } else { $null }
  if (!$node) { Falhar "Node.js nao encontrado no PATH. Instale Node.js antes de criar o servico." }

  $serverJs = Join-Path $InstallDir "apps\backend\dist\server.js"
  if (!(Test-Path $serverJs)) { Falhar "Backend compilado nao encontrado: $serverJs" }

  $logsDir = Join-Path $InstallDir "logs"
  New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

  Remover-Servico-Se-Existir $nssm $ApiServiceName

  & $nssm install $ApiServiceName $node $serverJs | Out-Null
  & $nssm set $ApiServiceName AppDirectory $InstallDir | Out-Null
  & $nssm set $ApiServiceName DisplayName "Control S API Hub" | Out-Null
  & $nssm set $ApiServiceName Description "Backend Node.js do Control S API Hub na porta $BackendPort." | Out-Null
  & $nssm set $ApiServiceName Start SERVICE_AUTO_START | Out-Null
  & $nssm set $ApiServiceName AppEnvironmentExtra "NODE_ENV=production" "PORT=$BackendPort" "HOST=0.0.0.0" "APP_PUBLIC_URL=$PublicUrl" "PORTAL_PUBLIC_URL=$PublicUrl" | Out-Null
  & $nssm set $ApiServiceName AppStdout (Join-Path $logsDir "servico-api-hub.log") | Out-Null
  & $nssm set $ApiServiceName AppStderr (Join-Path $logsDir "servico-api-hub-error.log") | Out-Null
  & $nssm set $ApiServiceName AppRotateFiles 1 | Out-Null
  & $nssm set $ApiServiceName AppRotateOnline 1 | Out-Null
  & $nssm set $ApiServiceName AppRotateBytes 10485760 | Out-Null
  & $nssm set $ApiServiceName AppExit Default Restart | Out-Null
  & $nssm set $ApiServiceName AppRestartDelay 10000 | Out-Null

  & $nssm start $ApiServiceName | Out-Null
  Write-Host "Servico instalado e iniciado: $ApiServiceName"
}

function Instalar-Servico-Nginx($nssm) {
  if ($NaoInstalarNginx) { return }

  Escrever-Titulo "Instalando servico Nginx do Control S API Hub"

  $nginx = Join-Path $NginxDir "nginx.exe"
  if (!(Test-Path $nginx)) {
    Write-Host "Nginx nao encontrado em $nginx. Serviço do Nginx ignorado." -ForegroundColor Yellow
    return
  }

  Remover-Servico-Se-Existir $nssm $NginxServiceName

  & $nssm install $NginxServiceName $nginx "-p" $NginxDir | Out-Null
  & $nssm set $NginxServiceName AppDirectory $NginxDir | Out-Null
  & $nssm set $NginxServiceName DisplayName "Control S API Hub - Nginx" | Out-Null
  & $nssm set $NginxServiceName Description "Proxy Nginx do Control S API Hub na porta 3333 encaminhando para 3335." | Out-Null
  & $nssm set $NginxServiceName Start SERVICE_AUTO_START | Out-Null
  & $nssm set $NginxServiceName AppExit Default Restart | Out-Null
  & $nssm set $NginxServiceName AppRestartDelay 10000 | Out-Null

  & $nssm start $NginxServiceName | Out-Null
  Write-Host "Servico instalado e iniciado: $NginxServiceName"
}

function Remover-Tarefa-Antiga() {
  $taskName = "ControlSAPIHub"
  $consulta = schtasks.exe /Query /TN $taskName 2>$null
  if ($LASTEXITCODE -eq 0) {
    Escrever-Titulo "Removendo tarefa agendada antiga"
    schtasks.exe /End /TN $taskName 2>$null | Out-Null
    schtasks.exe /Delete /TN $taskName /F | Out-Null
    Write-Host "Tarefa agendada antiga removida: $taskName"
  }
}

if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
  Falhar "Execute este script como Administrador."
}

$nssm = Instalar-Nssm-Se-Necessario
Remover-Tarefa-Antiga
Instalar-Servico-ApiHub $nssm
Instalar-Servico-Nginx $nssm

Escrever-Titulo "Servicos configurados"
Write-Host "Consultar API Hub:  Get-Service $ApiServiceName"
Write-Host "Consultar Nginx:    Get-Service $NginxServiceName"
Write-Host "Testar Node direto: http://localhost:$BackendPort/saude"
Write-Host "Testar proxy:       http://localhost:3333/saude"
