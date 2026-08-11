param(
  [int]$Porta = 3335
)

$ErrorActionPreference = "SilentlyContinue"

Write-Host "Parando Control S API Hub..." -ForegroundColor Green

$servicos = @("ControlSApiHub", "ControlSApiHubNginx")
foreach ($nomeServico in $servicos) {
  $servico = Get-Service -Name $nomeServico -ErrorAction SilentlyContinue
  if ($servico -and $servico.Status -ne "Stopped") {
    Write-Host "Parando servico: $nomeServico"
    Stop-Service -Name $nomeServico -Force -ErrorAction SilentlyContinue
  }
}

schtasks.exe /End /TN "ControlSAPIHub" | Out-Null

$conexoes = Get-NetTCPConnection -LocalPort $Porta -State Listen -ErrorAction SilentlyContinue
foreach ($conexao in $conexoes) {
  if ($conexao.OwningProcess) {
    Write-Host "Encerrando processo da porta ${Porta}: PID $($conexao.OwningProcess)"
    Stop-Process -Id $conexao.OwningProcess -Force -ErrorAction SilentlyContinue
  }
}

$processosCmd = Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -like '*start-backend-producao.cmd*' -or $_.CommandLine -like '*ControlSAPIHub\\start.cmd*' }

foreach ($processo in $processosCmd) {
  Write-Host "Encerrando supervisor: PID $($processo.ProcessId)"
  Stop-Process -Id $processo.ProcessId -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Seconds 1
$aindaAtivo = Get-NetTCPConnection -LocalPort $Porta -State Listen -ErrorAction SilentlyContinue
if ($aindaAtivo) {
  Write-Host "A porta $Porta ainda aparece em uso. Verifique manualmente no Gerenciador de Tarefas." -ForegroundColor Yellow
  exit 1
}

Write-Host "Control S API Hub parado nesta maquina." -ForegroundColor Green
