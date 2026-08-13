$ErrorActionPreference = "Stop"

$raiz = Resolve-Path (Join-Path $PSScriptRoot "..")
$release = Join-Path $raiz "release"
$versao = Get-Date -Format "yyyyMMdd-HHmmss"
$pacote = Join-Path $release "ControlSApiHub-WindowsServer-$versao"
$zip = Join-Path $release "ControlSApiHub-WindowsServer-$versao.zip"

New-Item -ItemType Directory -Force -Path $pacote | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $pacote "apps\backend") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $pacote "apps\frontend") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $pacote "scripts") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $pacote "docs") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $pacote "backup") | Out-Null

Push-Location $raiz
npm.cmd run build
Pop-Location

Copy-Item (Join-Path $raiz "package.json") $pacote -Force
if (Test-Path (Join-Path $raiz "package-lock.json")) {
  Copy-Item (Join-Path $raiz "package-lock.json") $pacote -Force
}
Copy-Item (Join-Path $raiz ".env.example") $pacote -Force
Copy-Item (Join-Path $raiz "README.md") $pacote -Force
Copy-Item (Join-Path $raiz "INSTALAR_OU_ATUALIZAR.ps1") $pacote -Force
Copy-Item (Join-Path $raiz "INSTALAR_OU_ATUALIZAR.cmd") $pacote -Force
Copy-Item (Join-Path $raiz "RESTAURAR_BACKUP.ps1") $pacote -Force
Copy-Item (Join-Path $raiz "RESTAURAR_BACKUP.cmd") $pacote -Force
Copy-Item (Join-Path $raiz "PARAR_API_HUB.cmd") $pacote -Force
Copy-Item (Join-Path $raiz "CORRIGIR_SERVICOS_WINDOWS.cmd") $pacote -Force

Copy-Item (Join-Path $raiz "apps\backend\package.json") (Join-Path $pacote "apps\backend\package.json") -Force
Copy-Item (Join-Path $raiz "apps\frontend\package.json") (Join-Path $pacote "apps\frontend\package.json") -Force
Copy-Item (Join-Path $raiz "apps\backend\dist") (Join-Path $pacote "apps\backend\dist") -Recurse -Force
Copy-Item (Join-Path $raiz "apps\frontend\dist") (Join-Path $pacote "apps\frontend\dist") -Recurse -Force

Copy-Item (Join-Path $raiz "scripts\*") (Join-Path $pacote "scripts") -Recurse -Force
Copy-Item (Join-Path $raiz "docs\*") (Join-Path $pacote "docs") -Recurse -Force
if (Test-Path (Join-Path $raiz "backup")) {
  Copy-Item (Join-Path $raiz "backup\*") (Join-Path $pacote "backup") -Recurse -Force -ErrorAction SilentlyContinue
}

tar.exe -a -c -f $zip -C $pacote .
Write-Host "Pacote gerado em: $zip"
