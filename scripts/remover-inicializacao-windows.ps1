$ErrorActionPreference = "Stop"
$taskName = "ControlSAPIHub"

$args = @("/Delete", "/TN", $taskName, "/F")
& schtasks.exe @args
if ($LASTEXITCODE -ne 0) {
  throw "Nao foi possivel remover a tarefa '$taskName'."
}

$wrapper = Join-Path $env:ProgramData "ControlSAPIHub\start.cmd"
if (Test-Path $wrapper) {
  Remove-Item -LiteralPath $wrapper -Force
}

Write-Host "Inicializacao automatica removida: $taskName"
