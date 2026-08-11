param(
  [string]$InstallDir = "C:\Control S API Hub",
  [string]$DbHost = "localhost",
  [int]$DbPort = 5432,
  [string]$DbName = "control_s_api_hub",
  [string]$DbUser = "postgres",
  [string]$BackendPort = "3335",
  [string]$ProxyPort = "3333",
  [string]$PublicUrl = "http://api.monvizo.com.br:8080",
  [switch]$NaoCriarBanco,
  [switch]$NaoCriarAtalho,
  [switch]$NaoConfigurarInicializacao,
  [switch]$NaoInstalarServico
)

$ErrorActionPreference = "Stop"
$LogPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "install.log"
Start-Transcript -Path $LogPath -Append | Out-Null

trap {
  Write-Host ""
  Write-Host "ERRO NA INSTALACAO/ATUALIZACAO:" -ForegroundColor Red
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

function Tem-Comando($nome) {
  return [bool](Get-Command $nome -ErrorAction SilentlyContinue)
}

function Converter-SeguroParaTexto($secureString) {
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureString)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

function Escape-DatabaseUrlPassword($senha) {
  return [uri]::EscapeDataString($senha)
}

function Copiar-ArquivosAplicacao($origem, $destino) {
  Escrever-Titulo "Copiando arquivos da aplicacao"
  New-Item -ItemType Directory -Force -Path $destino | Out-Null

  $origemResolvida = (Resolve-Path $origem).Path.TrimEnd('\')
  $destinoResolvido = (Resolve-Path $destino).Path.TrimEnd('\')
  if ($origemResolvida -ieq $destinoResolvido) {
    Write-Host "Origem e destino sao a mesma pasta. Copia ignorada; usando arquivos locais."
    return
  }

  $itens = @("apps", "docs", "scripts", "package.json", "package-lock.json", "README.md", ".env.example")
  foreach ($item in $itens) {
    $origemItem = Join-Path $origem $item
    if (Test-Path $origemItem) {
      Copy-Item $origemItem (Join-Path $destino $item) -Recurse -Force
    }
  }
}

function Garantir-Node() {
  Escrever-Titulo "Verificando Node.js"
  if (Tem-Comando "node.exe" -and Tem-Comando "npm.cmd") {
    node --version
    return
  }

  if (Tem-Comando "winget.exe") {
    Write-Host "Node.js nao encontrado. Tentando instalar Node.js LTS via winget..."
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    if (Tem-Comando "node.exe" -and Tem-Comando "npm.cmd") { return }
  }

  Falhar "Node.js nao foi encontrado. Instale Node.js 20 LTS e execute este instalador novamente."
}

function Encontrar-Psql() {
  if (Tem-Comando "psql.exe") { return "psql.exe" }

  $candidatos = Get-ChildItem "C:\Program Files\PostgreSQL" -Filter "psql.exe" -Recurse -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending

  if ($candidatos.Count -gt 0) {
    return $candidatos[0].FullName
  }

  return $null
}

function Atualizar-Path-Sessao() {
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

function Instalar-Postgres-Winget($senhaBanco) {
  if (!(Tem-Comando "winget.exe")) {
    Write-Host "winget nao encontrado neste servidor."
    return $false
  }

  Escrever-Titulo "Instalando PostgreSQL automaticamente"
  Write-Host "Essa etapa pode demorar alguns minutos, dependendo da internet e politicas do servidor."

  $ids = @(
    "PostgreSQL.PostgreSQL.17",
    "PostgreSQL.PostgreSQL.16",
    "PostgreSQL.PostgreSQL.15",
    "PostgreSQL.PostgreSQL"
  )

  foreach ($id in $ids) {
    Write-Host "Tentando pacote winget: $id"
    $override = "--mode unattended --unattendedmodeui none --superpassword `"$senhaBanco`" --serverport $DbPort"
    winget install --id $id -e --accept-package-agreements --accept-source-agreements --override $override
    Atualizar-Path-Sessao

    $psql = Encontrar-Psql
    if ($psql) {
      Write-Host "PostgreSQL instalado/encontrado com sucesso."
      return $true
    }
  }

  return $false
}

function Garantir-Postgres($senhaBanco) {
  Escrever-Titulo "Verificando PostgreSQL"
  Atualizar-Path-Sessao
  $psql = Encontrar-Psql
  if ($psql) {
    $versao = & $psql --version
    Write-Host $versao
    return $psql
  }

  Write-Host "PostgreSQL nao encontrado no PATH."
  $tentarInstalar = Read-Host "Deseja tentar baixar e instalar o PostgreSQL automaticamente via winget? (S/N)"

  if ($tentarInstalar -match '^[sS]') {
    $instalou = Instalar-Postgres-Winget $senhaBanco
    if ($instalou) {
      $psql = Encontrar-Psql
      if ($psql) {
        $versao = & $psql --version
        Write-Host $versao
        return $psql
      }
    }
    Write-Host "Nao foi possivel instalar/encontrar o PostgreSQL automaticamente." -ForegroundColor Yellow
  }

  Write-Host ""
  Write-Host "Instale o PostgreSQL manualmente antes de executar este instalador:" -ForegroundColor Yellow
  Write-Host "https://www.enterprisedb.com/downloads/postgres-postgresql-downloads" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Durante a instalacao:"
  Write-Host "- mantenha a porta 5432"
  Write-Host "- usuario padrao: postgres"
  Write-Host "- anote a senha definida para o usuario postgres"
  Write-Host ""
  Write-Host "Depois de instalar, feche e abra novamente o Prompt como Administrador e execute INSTALAR_OU_ATUALIZAR.cmd."
  Falhar "Nao foi possivel continuar sem PostgreSQL."
}

function Criar-Env($destino, $senhaBanco) {
  Escrever-Titulo "Configurando .env"
  $envPath = Join-Path $destino ".env"
  $envExample = Join-Path $destino ".env.example"
  if (!(Test-Path $envPath)) {
    Copy-Item $envExample $envPath -Force
  }

  $senhaUrl = Escape-DatabaseUrlPassword $senhaBanco
  $databaseUrl = "postgres://${DbUser}:${senhaUrl}@${DbHost}:${DbPort}/${DbName}"
  $conteudo = Get-Content $envPath -Raw

  if ($conteudo -match "DATABASE_URL=") {
    $conteudo = $conteudo -replace "DATABASE_URL=.*", "DATABASE_URL=$databaseUrl"
  } else {
    $conteudo += "`r`nDATABASE_URL=$databaseUrl`r`n"
  }

  if ($conteudo -match "PORT=") {
    $conteudo = $conteudo -replace "PORT=.*", "PORT=$BackendPort"
  } else {
    $conteudo += "PORT=$BackendPort`r`n"
  }

  if ($conteudo -match "APP_PUBLIC_URL=") {
    $conteudo = $conteudo -replace "APP_PUBLIC_URL=.*", "APP_PUBLIC_URL=$PublicUrl"
  } else {
    $conteudo += "APP_PUBLIC_URL=$PublicUrl`r`n"
  }

  if ($conteudo -match "PORTAL_PUBLIC_URL=") {
    $conteudo = $conteudo -replace "PORTAL_PUBLIC_URL=.*", "PORTAL_PUBLIC_URL=$PublicUrl"
  } else {
    $conteudo += "PORTAL_PUBLIC_URL=$PublicUrl`r`n"
  }

  if ($conteudo -match "PRODUCT_DATABASE_PROVIDER=") {
    $conteudo = $conteudo -replace "PRODUCT_DATABASE_PROVIDER=.*", "PRODUCT_DATABASE_PROVIDER=postgres"
  } else {
    $conteudo += "PRODUCT_DATABASE_PROVIDER=postgres`r`n"
  }

  Set-Content -Path $envPath -Value $conteudo -Encoding UTF8
}

function Criar-Banco-Se-Necessario($psql, $senhaBanco) {
  if ($NaoCriarBanco) {
    Write-Host "Criacao do banco ignorada por parametro."
    return
  }

  Escrever-Titulo "Verificando banco PostgreSQL"
  $env:PGPASSWORD = $senhaBanco
  $consulta = "SELECT 1 FROM pg_database WHERE datname = '$DbName';"
  $existe = & $psql -h $DbHost -p $DbPort -U $DbUser -tAc $consulta
  if ($LASTEXITCODE -ne 0) {
    Falhar "Falha ao autenticar no PostgreSQL com o usuario '$DbUser'. Verifique se a senha informada esta correta. Para este projeto, a senha recomendada do usuario postgres e 'controls'."
  }

  if ($existe -eq "1") {
    Write-Host "Banco $DbName ja existe."
  } else {
    Write-Host "Criando banco $DbName..."
    & $psql -h $DbHost -p $DbPort -U $DbUser -c "CREATE DATABASE $DbName;"
    if ($LASTEXITCODE -ne 0) {
      Falhar "Nao foi possivel criar o banco '$DbName'. Verifique permissao do usuario '$DbUser' e a senha do PostgreSQL."
    }
  }
}

function Criar-Schema-Se-Necessario($psql, $senhaBanco, $destino) {
  if ($NaoCriarBanco) {
    Write-Host "Criacao do schema ignorada por parametro."
    return
  }

  Escrever-Titulo "Criando estrutura do banco"
  $schemaPath = Join-Path $destino "scripts\postgres-schema.sql"
  if (!(Test-Path $schemaPath)) {
    Falhar "Arquivo de schema nao encontrado: $schemaPath"
  }

  $env:PGPASSWORD = $senhaBanco
  & $psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -f $schemaPath
  if ($LASTEXITCODE -ne 0) {
    Falhar "Nao foi possivel criar/atualizar as tabelas do banco '$DbName'."
  }
  Write-Host "Banco $DbName validado com tabelas do Control S API Hub."
}

function Instalar-Dependencias($destino) {
  Escrever-Titulo "Instalando dependencias Node.js"
  Push-Location $destino
  npm.cmd install --omit=dev --workspaces --include-workspace-root
  Pop-Location
}

function Criar-Atalho-Inicializacao($destino) {
  if ($NaoCriarAtalho) { return }
  Escrever-Titulo "Criando atalho de inicializacao"
  $cmd = Join-Path $destino "scripts\start-backend-producao.cmd"
  $desktop = [Environment]::GetFolderPath("Desktop")
  $atalhoPath = Join-Path $desktop "Control S API Hub.lnk"
  $shell = New-Object -ComObject WScript.Shell
  $atalho = $shell.CreateShortcut($atalhoPath)
  $atalho.TargetPath = $cmd
  $atalho.WorkingDirectory = $destino
  $atalho.IconLocation = "shell32.dll,220"
  $atalho.Save()
  Write-Host "Atalho criado em: $atalhoPath"
}

function Configurar-Inicializacao-Windows($destino) {
  if ($NaoConfigurarInicializacao) { return }

  Escrever-Titulo "Configurando inicializacao automatica padrao"

  $cmd = Join-Path $destino "scripts\start-backend-producao.cmd"
  if (!(Test-Path $cmd)) {
    Falhar "Script de inicializacao nao encontrado: $cmd"
  }

  $taskName = "ControlSAPIHub"
  $wrapperDir = Join-Path $env:ProgramData "ControlSAPIHub"
  $wrapper = Join-Path $wrapperDir "start.cmd"

  New-Item -ItemType Directory -Force -Path $wrapperDir | Out-Null
  Set-Content -Path $wrapper -Encoding ASCII -Value @"
@echo off
cd /d "$destino"
call "$cmd"
"@

  $taskRun = $wrapper
  $args = @("/Create", "/TN", $taskName, "/SC", "ONSTART", "/DELAY", "0001:00", "/RU", "SYSTEM", "/RL", "HIGHEST", "/TR", $taskRun, "/F")
  & schtasks.exe @args | Out-Host
  if ($LASTEXITCODE -ne 0) {
    Falhar "Nao foi possivel registrar a tarefa de inicializacao automatica. Execute o instalador como Administrador."
  }

  Write-Host "Inicializacao automatica configurada: Tarefa do Windows '$taskName'."
  Write-Host "O Control S API Hub sera iniciado automaticamente quando o Windows ligar."
  Write-Host "Para consultar: schtasks /Query /TN `"$taskName`""
  Write-Host "Para remover: schtasks /Delete /TN `"$taskName`" /F"
}

function Configurar-Servicos-Windows($destino) {
  if ($NaoInstalarServico) { return $false }

  Escrever-Titulo "Configurando servicos do Windows"
  $scriptServico = Join-Path $destino "scripts\instalar-servicos-windows.ps1"
  if (!(Test-Path $scriptServico)) {
    Falhar "Script de servico nao encontrado: $scriptServico"
  }

  powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptServico -InstallDir $destino -BackendPort $BackendPort -PublicUrl $PublicUrl
  if ($LASTEXITCODE -ne 0) {
    Falhar "Nao foi possivel configurar os servicos do Windows."
  }
  return $true
}

function Iniciar-Agora($destino) {
  Escrever-Titulo "Iniciando Control S API Hub agora"

  $portaEmUso = $false
  try {
    $portaEmUso = [bool](Get-NetTCPConnection -LocalPort $BackendPort -State Listen -ErrorAction SilentlyContinue)
  } catch {
    $netstat = netstat -ano | Select-String ":$BackendPort "
    $portaEmUso = [bool]$netstat
  }

  if ($portaEmUso) {
    Write-Host "A porta $BackendPort ja esta em uso. O Control S API Hub aparenta estar iniciado."
    return
  }

  $cmd = Join-Path $destino "scripts\start-backend-producao.cmd"
  Start-Process -FilePath $cmd -WorkingDirectory $destino -WindowStyle Hidden
  Start-Sleep -Seconds 2
  Write-Host "Control S API Hub iniciado em segundo plano."
}

function Liberar-Firewall() {
  Escrever-Titulo "Configurando firewall"
  $ruleName = "Control S API Hub Proxy $ProxyPort"
  $existe = netsh advfirewall firewall show rule name="$ruleName" 2>$null | Out-String
  if ($LASTEXITCODE -ne 0 -or $existe -match "No rules match") {
    netsh advfirewall firewall add rule name="$ruleName" dir=in action=allow protocol=TCP localport=$ProxyPort | Out-Null
  }
  Write-Host "Porta $ProxyPort liberada para entrada TCP do Nginx/proxy."
  Write-Host "O backend Node roda internamente na porta $BackendPort."
}

$origem = Split-Path -Parent $MyInvocation.MyCommand.Path
if ((Split-Path -Leaf $origem) -eq "scripts") {
  $origem = Resolve-Path (Join-Path $origem "..")
}

Escrever-Titulo "Control S API Hub - instalador/atualizador"
Write-Host "Origem: $origem"
Write-Host "Destino: $InstallDir"

Garantir-Node

if ($env:PG_PASSWORD) {
  $senhaBanco = $env:PG_PASSWORD
} else {
  Write-Host "Senha padrao recomendada para o PostgreSQL neste projeto: controls"
  $senhaBanco = Converter-SeguroParaTexto (Read-Host "Senha do PostgreSQL para o usuario $DbUser" -AsSecureString)
  if ([string]::IsNullOrWhiteSpace($senhaBanco)) {
    $senhaBanco = "controls"
  }
}

$psql = Garantir-Postgres $senhaBanco

Copiar-ArquivosAplicacao $origem $InstallDir
Criar-Banco-Se-Necessario $psql $senhaBanco
Criar-Schema-Se-Necessario $psql $senhaBanco $InstallDir
Criar-Env $InstallDir $senhaBanco
Instalar-Dependencias $InstallDir
Liberar-Firewall
Criar-Atalho-Inicializacao $InstallDir
$servicoConfigurado = Configurar-Servicos-Windows $InstallDir
if (!$servicoConfigurado) {
  Configurar-Inicializacao-Windows $InstallDir
  Iniciar-Agora $InstallDir
}

Escrever-Titulo "Instalacao/atualizacao concluida"
Write-Host "Para iniciar agora:"
Write-Host "cd /d `"$InstallDir`""
Write-Host "powershell.exe -ExecutionPolicy Bypass -File scripts\status-servicos-windows.ps1"
Write-Host ""
Write-Host "Depois acesse:"
Write-Host "Interno Node: http://localhost:$BackendPort/"
Write-Host "Proxy no servidor: http://localhost:$ProxyPort/"
Write-Host "Publico: $PublicUrl/"
Write-Host ""
Write-Host "Log gravado em: $LogPath"
Stop-Transcript | Out-Null
