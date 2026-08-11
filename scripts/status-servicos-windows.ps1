$servicos = @("ControlSApiHub", "ControlSApiHubNginx")

foreach ($nome in $servicos) {
  $servico = Get-Service -Name $nome -ErrorAction SilentlyContinue
  if ($servico) {
    Write-Host "$($servico.Name) - $($servico.Status) - $($servico.DisplayName)"
  } else {
    Write-Host "$nome - nao instalado"
  }
}

Write-Host ""
Write-Host "Testes recomendados:"
Write-Host "  http://localhost:3335/saude"
Write-Host "  http://localhost:3333/saude"
Write-Host "  http://api.monvizo.com.br:8080/saude"
