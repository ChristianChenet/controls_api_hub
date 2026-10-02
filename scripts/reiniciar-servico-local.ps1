$ErrorActionPreference = 'Stop'

if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] 'Administrator')) {
  throw 'Execute este script como Administrador.'
}

Restart-Service -Name 'ControlSApiHub' -Force
(Get-Service -Name 'ControlSApiHub').WaitForStatus('Running', [TimeSpan]::FromSeconds(30))
Write-Host 'Servico local ControlSApiHub reiniciado com sucesso.'
