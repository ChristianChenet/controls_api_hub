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

function Aguardar-Servico-Rodando($nome, $segundos = 45) {
  $limite = (Get-Date).AddSeconds($segundos)
  do {
    $servico = Get-Service -Name $nome -ErrorAction SilentlyContinue
    if ($servico -and $servico.Status -eq "Running") {
      Write-Host "Servico em execucao: $nome"
      return
    }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $limite)

  $servicoFinal = Get-Service -Name $nome -ErrorAction SilentlyContinue
  $status = if ($servicoFinal) { $servicoFinal.Status } else { "nao encontrado" }
  Falhar "O servico $nome foi criado, mas nao iniciou corretamente. Status atual: $status. Verifique os logs em C:\Control S API Hub\logs."
}

function Encontrar-Servico-Postgres() {
  $servico = Get-Service -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "postgresql*" -or $_.DisplayName -like "postgresql*" } |
    Select-Object -First 1
  return $servico
}

function Configurar-Recuperacao-Servico($nome) {
  sc.exe config $nome start= auto | Out-Null
  sc.exe config $nome start= delayed-auto | Out-Null
  sc.exe failure $nome reset= 86400 actions= restart/60000/restart/60000/restart/60000 | Out-Null
  sc.exe failureflag $nome 1 | Out-Null
}

function Encerrar-Nginx-Remanescente() {
  $processos = Get-Process -Name "nginx" -ErrorAction SilentlyContinue
  if ($processos) {
    Write-Host "Encerrando processos antigos do Nginx para liberar a porta 3333..."
    $processos | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
  }
}

function Instalar-Servico-ApiHub($nssm) {
  Escrever-Titulo "Instalando servico ControlSApiHub"

  $nodeCmd = Get-Command "node.exe" -ErrorAction SilentlyContinue
  $node = if ($nodeCmd) { $nodeCmd.Source } else { $null }
  if (!$node) { Falhar "Node.js nao encontrado no PATH. Instale Node.js antes de criar o servico." }

  $serverJs = Join-Path $InstallDir "apps\backend\dist\server.js"
  if (!(Test-Path $serverJs)) { Falhar "Backend compilado nao encontrado: $serverJs" }

  $logsDir = Join-Path $InstallDir "logs"
  New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
  $wrapperDir = Join-Path $env:ProgramData "ControlS\ControlSApiHub"
  $wrapper = Join-Path $wrapperDir "start-api-hub.cmd"
  New-Item -ItemType Directory -Force -Path $wrapperDir | Out-Null
  Set-Content -Path $wrapper -Encoding ASCII -Value @"
@echo off
cd /d "$InstallDir"
"$node" "$serverJs"
"@

  Remover-Servico-Se-Existir $nssm $ApiServiceName

  & $nssm install $ApiServiceName $wrapper | Out-Null
  & $nssm set $ApiServiceName AppDirectory $InstallDir | Out-Null
  & $nssm set $ApiServiceName AppParameters "" | Out-Null
  & $nssm set $ApiServiceName DisplayName $ApiServiceName | Out-Null
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
  Configurar-Recuperacao-Servico $ApiServiceName

  $postgres = Encontrar-Servico-Postgres
  if ($postgres) {
    Write-Host "Configurando dependencia do PostgreSQL: $($postgres.Name)"
    sc.exe config $ApiServiceName depend= $($postgres.Name) | Out-Null
  }

  Start-Service -Name $ApiServiceName
  Aguardar-Servico-Rodando $ApiServiceName
  Write-Host "Servico instalado e iniciado: $ApiServiceName"
}

function Instalar-Servico-Nginx($nssm) {
  if ($NaoInstalarNginx) { return }

  Escrever-Titulo "Instalando servico Nginx do Control S API Hub"

  $nginx = Join-Path $NginxDir "nginx.exe"
  if (!(Test-Path $nginx)) {
    Write-Host "Nginx nao encontrado em $nginx. Servico do Nginx ignorado." -ForegroundColor Yellow
    return
  }

  $testeNginx = & $nginx -p $NginxDir -t 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host ($testeNginx | Out-String) -ForegroundColor Red
    Falhar "A configuracao do Nginx nao esta valida. Corrija C:\nginx\conf\nginx.conf antes de iniciar o servico."
  }

  Remover-Servico-Se-Existir $nssm $NginxServiceName
  Encerrar-Nginx-Remanescente

  & $nssm install $NginxServiceName $nginx | Out-Null
  & $nssm set $NginxServiceName AppDirectory $NginxDir | Out-Null
  & $nssm set $NginxServiceName AppParameters "-p `"$NginxDir`" -g `"daemon off;`"" | Out-Null
  & $nssm set $NginxServiceName DisplayName $NginxServiceName | Out-Null
  & $nssm set $NginxServiceName Description "Proxy Nginx do Control S API Hub na porta 3333 encaminhando para 3335." | Out-Null
  & $nssm set $NginxServiceName AppExit Default Restart | Out-Null
  & $nssm set $NginxServiceName AppRestartDelay 10000 | Out-Null
  Configurar-Recuperacao-Servico $NginxServiceName

  sc.exe config $NginxServiceName depend= $ApiServiceName | Out-Null
  Start-Service -Name $NginxServiceName
  Aguardar-Servico-Rodando $NginxServiceName
  Write-Host "Servico instalado e iniciado: $NginxServiceName"
}

function Configurar-Tarefa-Garantia-Boot() {
  Escrever-Titulo "Configurando garantia de inicializacao"

  $bootstrapDir = Join-Path $env:ProgramData "ControlS\ControlSApiHub"
  $bootstrapPs1 = Join-Path $bootstrapDir "garantir-servicos-api-hub.ps1"
  $bootstrapCmd = Join-Path $bootstrapDir "garantir-servicos-api-hub.cmd"
  New-Item -ItemType Directory -Force -Path $bootstrapDir | Out-Null

  Set-Content -Path $bootstrapPs1 -Encoding UTF8 -Value @"
`$ErrorActionPreference = "Continue"
`$log = "$bootstrapDir\garantir-servicos-api-hub.log"
function Add-Log(`$texto) { Add-Content -LiteralPath `$log -Value ("[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), `$texto) }

New-Item -ItemType Directory -Force -Path "$bootstrapDir" | Out-Null
Add-Log "Iniciando verificacao automatica dos servicos."

`$postgres = Get-Service -ErrorAction SilentlyContinue | Where-Object { `$_.Name -like "postgresql*" -or `$_.DisplayName -like "postgresql*" } | Select-Object -First 1
if (`$postgres -and `$postgres.Status -ne "Running") {
  Add-Log "Iniciando PostgreSQL: `$(`$postgres.Name)"
  Start-Service -Name `$postgres.Name -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 12
}

`$api = Get-Service -Name "$ApiServiceName" -ErrorAction SilentlyContinue
if (!`$api) {
  Add-Log "Servico $ApiServiceName nao encontrado. Reinstalando."
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$InstallDir\scripts\instalar-servicos-windows.ps1" -InstallDir "$InstallDir" -NginxDir "$NginxDir" -ApiServiceName "$ApiServiceName" -NginxServiceName "$NginxServiceName" -BackendPort $BackendPort -PublicUrl "$PublicUrl"
  exit
}

if (`$api.Status -ne "Running") {
  Add-Log "Iniciando $ApiServiceName."
  Start-Service -Name "$ApiServiceName" -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 15
}

`$nginx = Get-Service -Name "$NginxServiceName" -ErrorAction SilentlyContinue
if (`$nginx -and `$nginx.Status -ne "Running") {
  Add-Log "Iniciando $NginxServiceName."
  Start-Service -Name "$NginxServiceName" -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 5
}

`$apiFinal = Get-Service -Name "$ApiServiceName" -ErrorAction SilentlyContinue
`$nginxFinal = Get-Service -Name "$NginxServiceName" -ErrorAction SilentlyContinue
Add-Log ("Status final: {0}={1}; {2}={3}" -f "$ApiServiceName", `$apiFinal.Status, "$NginxServiceName", `$nginxFinal.Status)
"@

  Set-Content -Path $bootstrapCmd -Encoding ASCII -Value @"
@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$bootstrapPs1"
"@

  $taskName = "ControlSApiHubGarantirServicos"
  schtasks.exe /Create /TN $taskName /SC ONSTART /DELAY 0001:00 /RU SYSTEM /RL HIGHEST /TR "`"$bootstrapCmd`"" /F | Out-Null
  schtasks.exe /Create /TN "$taskName-Manutencao" /SC MINUTE /MO 5 /RU SYSTEM /RL HIGHEST /TR "`"$bootstrapCmd`"" /F | Out-Null
  Write-Host "Tarefa de garantia configurada: $taskName"
}

function Remover-Tarefa-Antiga() {
  $taskName = "ControlSAPIHub"
  cmd.exe /c "schtasks /Query /TN `"$taskName`" >nul 2>nul"
  if ($LASTEXITCODE -eq 0) {
    Escrever-Titulo "Removendo tarefa agendada antiga"
    cmd.exe /c "schtasks /End /TN `"$taskName`" >nul 2>nul"
    cmd.exe /c "schtasks /Delete /TN `"$taskName`" /F >nul 2>nul"
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
Configurar-Tarefa-Garantia-Boot

Escrever-Titulo "Servicos configurados"
Write-Host "Consultar API Hub:  Get-Service $ApiServiceName"
Write-Host "Consultar Nginx:    Get-Service $NginxServiceName"
Write-Host "Testar Node direto: http://localhost:$BackendPort/saude"
Write-Host "Testar proxy:       http://localhost:3333/saude"
