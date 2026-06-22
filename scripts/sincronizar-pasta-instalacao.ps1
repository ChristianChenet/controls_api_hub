$ErrorActionPreference = "Stop"

$src = Resolve-Path (Join-Path $PSScriptRoot "..")
$dst = "C:\Control S API Hub"

New-Item -ItemType Directory -Force -Path $dst | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $dst "apps\backend") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $dst "apps\frontend") | Out-Null

Copy-Item -LiteralPath (Join-Path $src "package.json") -Destination $dst -Force
Copy-Item -LiteralPath (Join-Path $src "package-lock.json") -Destination $dst -Force
Copy-Item -LiteralPath (Join-Path $src "README.md") -Destination $dst -Force
Copy-Item -LiteralPath (Join-Path $src ".env.example") -Destination $dst -Force
if (Test-Path (Join-Path $src ".env.test.example")) {
  Copy-Item -LiteralPath (Join-Path $src ".env.test.example") -Destination $dst -Force
}
Copy-Item -LiteralPath (Join-Path $src "INSTALAR_OU_ATUALIZAR.ps1") -Destination $dst -Force
Copy-Item -LiteralPath (Join-Path $src "INSTALAR_OU_ATUALIZAR.cmd") -Destination $dst -Force
Copy-Item -LiteralPath (Join-Path $src "PARAR_API_HUB.cmd") -Destination $dst -Force

Copy-Item -LiteralPath (Join-Path $src "apps\backend\package.json") -Destination (Join-Path $dst "apps\backend\package.json") -Force
Copy-Item -LiteralPath (Join-Path $src "apps\backend\dist") -Destination (Join-Path $dst "apps\backend") -Recurse -Force
Copy-Item -LiteralPath (Join-Path $src "apps\frontend\dist") -Destination (Join-Path $dst "apps\frontend") -Recurse -Force
Copy-Item -LiteralPath (Join-Path $src "scripts") -Destination $dst -Recurse -Force
Copy-Item -LiteralPath (Join-Path $src "docs") -Destination $dst -Recurse -Force

Write-Host "Arquivos sincronizados em $dst"
