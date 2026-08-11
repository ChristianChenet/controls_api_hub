param(
  [string]$ApiServiceName = "ControlSApiHub",
  [string]$NginxServiceName = "ControlSApiHubNginx"
)

$ErrorActionPreference = "Stop"

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
  throw "NSSM nao encontrado. Remova manualmente pelo services.msc ou instale o NSSM."
}

function Remover-Servico($nssm, $nome) {
  $servico = Get-Service -Name $nome -ErrorAction SilentlyContinue
  if (!$servico) {
    Write-Host "Servico nao encontrado: $nome"
    return
  }

  Write-Host "Parando servico: $nome"
  & $nssm stop $nome | Out-Null
  Start-Sleep -Seconds 2
  Write-Host "Removendo servico: $nome"
  & $nssm remove $nome confirm | Out-Null
}

if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
  throw "Execute este script como Administrador."
}

$nssm = Encontrar-Nssm
Remover-Servico $nssm $ApiServiceName
Remover-Servico $nssm $NginxServiceName
Write-Host "Remocao concluida."
