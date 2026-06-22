param(
  [string]$InstallDir = "C:\Control S API Hub",
  [string]$BackupFile = "",
  [string]$DbHost = "localhost",
  [int]$DbPort = 5432,
  [string]$DbName = "control_s_api_hub",
  [string]$DbUser = "postgres"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogPath = Join-Path $ScriptDir "restore.log"
Start-Transcript -Path $LogPath -Append | Out-Null

trap {
  Write-Host ""
  Write-Host "ERRO NA RESTAURACAO:" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host ""
  Write-Host "Log gravado em: $LogPath" -ForegroundColor Yellow
  Stop-Transcript | Out-Null
  exit 1
}

function Escrever-Titulo($texto) {
  Write-Host ""
  Write-Host "==== $texto ====" -ForegroundColor Green
}

function Falhar($texto) {
  Write-Host ""
  Write-Host $texto -ForegroundColor Red
  throw $texto
}

function Converter-SeguroParaTexto($secureString) {
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureString)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

function Encontrar-PostgresBin($executavel) {
  $cmd = Get-Command $executavel -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $candidatos = Get-ChildItem "C:\Program Files\PostgreSQL" -Filter $executavel -Recurse -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending

  if ($candidatos.Count -gt 0) {
    return $candidatos[0].FullName
  }

  return $null
}

function Selecionar-Backup($baseDir) {
  if ($BackupFile -and (Test-Path $BackupFile)) {
    return (Resolve-Path $BackupFile).Path
  }

  $backupDir = Join-Path $baseDir "backup"
  if (!(Test-Path $backupDir)) {
    $backupDir = Join-Path $InstallDir "backup"
  }

  if (!(Test-Path $backupDir)) {
    Falhar "Pasta de backup nao encontrada. Informe o caminho do arquivo com -BackupFile."
  }

  $arquivos = Get-ChildItem -LiteralPath $backupDir -Filter "*.backup" -File | Sort-Object LastWriteTime -Descending
  if ($arquivos.Count -eq 0) {
    Falhar "Nenhum arquivo .backup encontrado em: $backupDir"
  }

  Write-Host "Backups encontrados:"
  for ($i = 0; $i -lt $arquivos.Count; $i++) {
    Write-Host ("[{0}] {1}  {2:N2} KB  {3}" -f ($i + 1), $arquivos[$i].Name, ($arquivos[$i].Length / 1KB), $arquivos[$i].LastWriteTime)
  }

  $opcao = Read-Host "Digite o numero do backup para restaurar"
  $indice = [int]$opcao - 1
  if ($indice -lt 0 -or $indice -ge $arquivos.Count) {
    Falhar "Opcao de backup invalida."
  }

  return $arquivos[$indice].FullName
}

Escrever-Titulo "Control S API Hub - restauracao de backup"
Write-Host "Pasta do pacote: $ScriptDir"
Write-Host "Pasta da instalacao: $InstallDir"
Write-Host "Banco destino: ${DbHost}:${DbPort}/$DbName"

$pgRestore = Encontrar-PostgresBin "pg_restore.exe"
$createdb = Encontrar-PostgresBin "createdb.exe"
$psql = Encontrar-PostgresBin "psql.exe"

if (!$pgRestore) { Falhar "pg_restore.exe nao encontrado. Instale o PostgreSQL ou ajuste o PATH." }
if (!$createdb) { Falhar "createdb.exe nao encontrado. Instale o PostgreSQL ou ajuste o PATH." }
if (!$psql) { Falhar "psql.exe nao encontrado. Instale o PostgreSQL ou ajuste o PATH." }

$arquivoBackup = Selecionar-Backup $ScriptDir
Write-Host "Backup selecionado: $arquivoBackup"

Write-Host ""
Write-Host "Senha padrao recomendada para o PostgreSQL neste projeto: controls"
if ($env:PG_PASSWORD) {
  $senhaBanco = $env:PG_PASSWORD
} else {
  $senhaBanco = Converter-SeguroParaTexto (Read-Host "Senha do PostgreSQL para o usuario $DbUser" -AsSecureString)
  if ([string]::IsNullOrWhiteSpace($senhaBanco)) {
    $senhaBanco = "controls"
  }
}

$confirmar = Read-Host "Esta operacao substituira os dados do banco '$DbName'. Confirmar restauracao? (S/N)"
if ($confirmar -notmatch '^[sS]') {
  Write-Host "Restauracao cancelada pelo usuario." -ForegroundColor Yellow
  Stop-Transcript | Out-Null
  exit 0
}

$env:PGPASSWORD = $senhaBanco

Escrever-Titulo "Garantindo banco de destino"
$existe = & $psql -h $DbHost -p $DbPort -U $DbUser -tAc "SELECT 1 FROM pg_database WHERE datname = '$DbName';"
if ($LASTEXITCODE -ne 0) {
  Falhar "Falha ao autenticar no PostgreSQL. Verifique usuario, senha, host e porta."
}

if ($existe -ne "1") {
  Write-Host "Banco $DbName nao existe. Criando..."
  & $createdb -h $DbHost -p $DbPort -U $DbUser $DbName
  if ($LASTEXITCODE -ne 0) {
    Falhar "Nao foi possivel criar o banco $DbName."
  }
} else {
  Write-Host "Banco $DbName encontrado."
}

Escrever-Titulo "Restaurando backup"
& $pgRestore -h $DbHost -p $DbPort -U $DbUser -d $DbName --clean --if-exists --no-owner --verbose $arquivoBackup
if ($LASTEXITCODE -ne 0) {
  Falhar "A restauracao falhou. Verifique o log acima."
}

Escrever-Titulo "Restauracao concluida"
Write-Host "Backup restaurado com sucesso em: $DbName"
Write-Host "Reinicie o Control S API Hub se ele estiver aberto."
Write-Host ""
Write-Host "Log gravado em: $LogPath"
Stop-Transcript | Out-Null
