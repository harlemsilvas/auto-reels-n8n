# Backup PostgreSQL local do SocialBot via Docker Desktop/Windows.
#
# Uso padrão, a partir da raiz do projeto:
#   powershell -ExecutionPolicy Bypass -File .\scripts\backup_postgres_db_local.ps1
#
# Uso com parâmetros:
#   powershell -ExecutionPolicy Bypass -File .\scripts\backup_postgres_db_local.ps1 `
#     -ContainerName socialbot_postgres `
#     -DatabaseName n8n `
#     -DatabaseUser n8n `
#     -Format custom
#
# O script nao le .env e nao imprime segredos.

[CmdletBinding()]
param(
  [string] $ContainerName = "socialbot_postgres",
  [string] $DatabaseName = "n8n",
  [string] $DatabaseUser = "n8n",
  [ValidateSet("custom", "plain")]
  [string] $Format = "custom",
  [string] $BackupDir = ""
)

$ErrorActionPreference = "Stop"

function Write-Log {
  param([string] $Message)
  Write-Host "[backup-postgres-local] $Message"
}

function Fail {
  param([string] $Message)
  Write-Error "[backup-postgres-local] ERRO: $Message"
  exit 1
}

function Require-Command {
  param([string] $CommandName)
  if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
    Fail "Comando obrigatorio nao encontrado: $CommandName"
  }
}

function ConvertTo-ProcessArgument {
  param([string] $Argument)

  if ($Argument -notmatch '[\s"]') {
    return $Argument
  }

  $escaped = $Argument -replace '"', '\"'
  return '"' + $escaped + '"'
}

try {
  Require-Command "docker"

  $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
  $projectRoot = Resolve-Path (Join-Path $scriptDir "..")

  if ([string]::IsNullOrWhiteSpace($BackupDir)) {
    $BackupDir = Join-Path $projectRoot "backups\postgres-local"
  }

  $null = docker inspect $ContainerName 2>$null
  if ($LASTEXITCODE -ne 0) {
    Fail "Container PostgreSQL nao encontrado ou Docker indisponivel: $ContainerName"
  }

  New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

  $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $extension = "dump"
  $pgDumpFormat = "c"

  if ($Format -eq "plain") {
    $extension = "sql"
    $pgDumpFormat = "p"
  }

  $backupFile = Join-Path $BackupDir "${DatabaseName}_${timestamp}.${extension}"
  $metadataFile = Join-Path $BackupDir "${DatabaseName}_${timestamp}.metadata.txt"

  Write-Log "Container: $ContainerName"
  Write-Log "Banco: $DatabaseName"
  Write-Log "Usuario: $DatabaseUser"
  Write-Log "Formato: $Format"
  Write-Log "Destino: $backupFile"

  $dumpArgs = @(
    "exec",
    $ContainerName,
    "pg_dump",
    "-U", $DatabaseUser,
    "-d", $DatabaseName,
    "-F", $pgDumpFormat,
    "--no-owner",
    "--no-privileges"
  )

  $backupStream = [System.IO.File]::Open($backupFile, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
  try {
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo.FileName = "docker"
    $process.StartInfo.Arguments = ($dumpArgs | ForEach-Object {
      ConvertTo-ProcessArgument $_
    }) -join " "
    $process.StartInfo.RedirectStandardOutput = $true
    $process.StartInfo.RedirectStandardError = $true
    $process.StartInfo.UseShellExecute = $false

    [void] $process.Start()
    $process.StandardOutput.BaseStream.CopyTo($backupStream)
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    if ($process.ExitCode -ne 0) {
      if (-not [string]::IsNullOrWhiteSpace($stderr)) {
        Write-Error $stderr
      }
      Fail "pg_dump falhou com exit code $($process.ExitCode)."
    }
  }
  finally {
    $backupStream.Dispose()
  }

  $backupItem = Get-Item $backupFile
  if ($backupItem.Length -le 0) {
    Fail "Backup foi criado vazio: $backupFile"
  }

  $hash = Get-FileHash -Algorithm SHA256 -Path $backupFile
  $gitHead = ""
  $gitBranch = ""

  if (Get-Command git -ErrorAction SilentlyContinue) {
    Push-Location $projectRoot
    try {
      git rev-parse --is-inside-work-tree *> $null
      if ($LASTEXITCODE -eq 0) {
        $gitHead = git rev-parse HEAD
        $gitBranch = git rev-parse --abbrev-ref HEAD
      }
    }
    finally {
      Pop-Location
    }
  }

  $metadata = @(
    "created_at=$((Get-Date).ToString('o'))",
    "container=$ContainerName",
    "database=$DatabaseName",
    "user=$DatabaseUser",
    "format=$Format",
    "file=$backupFile",
    "size_bytes=$($backupItem.Length)",
    "sha256=$($hash.Hash)"
  )

  if (-not [string]::IsNullOrWhiteSpace($gitHead)) {
    $metadata += "git_head=$gitHead"
    $metadata += "git_branch=$gitBranch"
  }

  Set-Content -Path $metadataFile -Value $metadata -Encoding UTF8

  Write-Log "Metadados: $metadataFile"
  Write-Log "Backup concluido com sucesso."
}
catch {
  Fail $_.Exception.Message
}
