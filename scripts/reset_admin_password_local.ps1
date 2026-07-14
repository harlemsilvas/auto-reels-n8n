# Reset local de senha do Admin SocialBot via Docker Desktop/Windows.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File .\scripts\reset_admin_password_local.ps1
#
# Ou para outro usuario:
#   powershell -ExecutionPolicy Bypass -File .\scripts\reset_admin_password_local.ps1 -Username harlem
#
# O script pede a senha no prompt seguro, gera o hash pelo proprio backend,
# limpa tentativas/bloqueio e revoga sessoes locais do usuario.

[CmdletBinding()]
param(
  [string] $Username = "admin",
  [string] $ContainerName = "socialbot_postgres",
  [string] $DatabaseName = "n8n",
  [string] $DatabaseUser = "n8n"
)

$ErrorActionPreference = "Stop"

function Write-Log {
  param([string] $Message)
  Write-Host "[reset-admin-local] $Message"
}

function Fail {
  param([string] $Message)
  Write-Error "[reset-admin-local] ERRO: $Message"
  exit 1
}

function Require-Command {
  param([string] $CommandName)
  if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
    Fail "Comando obrigatorio nao encontrado: $CommandName"
  }
}

function Read-PlainPassword {
  param([string] $Prompt)

  $secure = Read-Host -Prompt $Prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

function Escape-SqlLiteral {
  param([string] $Value)
  return $Value.Replace("'", "''")
}

try {
  Require-Command "docker"
  Require-Command "node"

  $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
  $projectRoot = Resolve-Path (Join-Path $scriptDir "..")
  $backendDir = Join-Path $projectRoot "backend"

  if (-not (Test-Path (Join-Path $backendDir "src\modules\auth\password.service.js"))) {
    Fail "Servico de senha do backend nao encontrado em: $backendDir"
  }

  $null = docker inspect $ContainerName 2>$null
  if ($LASTEXITCODE -ne 0) {
    Fail "Container PostgreSQL nao encontrado ou Docker indisponivel: $ContainerName"
  }

  $normalizedUsername = $Username.Trim().ToLowerInvariant()
  if (-not $normalizedUsername) {
    Fail "Username nao pode ficar vazio."
  }

  $password = Read-PlainPassword "Nova senha para '$normalizedUsername' (minimo 12 caracteres)"
  $confirmation = Read-PlainPassword "Repita a nova senha"

  if ($password -ne $confirmation) {
    Fail "As senhas digitadas nao conferem."
  }

  if ($password.Length -lt 12) {
    Fail "A senha deve ter pelo menos 12 caracteres."
  }

  Push-Location $backendDir
  try {
    $hash = node -e "const { hashPassword } = require('./src/modules/auth/password.service'); hashPassword(process.argv[1]).then((hash) => process.stdout.write(hash)).catch((err) => { console.error(err); process.exit(1); });" $password
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($hash)) {
      Fail "Falha ao gerar hash de senha."
    }
  }
  finally {
    Pop-Location
  }

  $escapedUsername = Escape-SqlLiteral $normalizedUsername
  $escapedHash = Escape-SqlLiteral $hash

  $sql = @"
\set ON_ERROR_STOP on
BEGIN;

WITH target_user AS (
  SELECT id
  FROM socialbot_users
  WHERE username = '$escapedUsername'
    AND deleted_at IS NULL
  LIMIT 1
),
updated_user AS (
  UPDATE socialbot_users
  SET password_hash = '$escapedHash',
      force_password_change = FALSE,
      failed_login_attempts = 0,
      locked_until = NULL,
      active = TRUE
  WHERE id = (SELECT id FROM target_user)
  RETURNING id, username, display_name, role, active
),
revoked_sessions AS (
  UPDATE socialbot_sessions
  SET revoked_at = COALESCE(revoked_at, NOW())
  WHERE user_id = (SELECT id FROM target_user)
    AND revoked_at IS NULL
  RETURNING id
)
SELECT
  'RESET_OK|' ||
  u.username || '|' ||
  u.id::text || '|' ||
  u.role || '|' ||
  u.active::text || '|' ||
  (SELECT COUNT(*) FROM revoked_sessions)::text AS result
FROM updated_user u;

COMMIT;
"@

  $result = $sql | docker exec -i $ContainerName psql -U $DatabaseUser -d $DatabaseName -t -A

  if ($LASTEXITCODE -ne 0) {
    Fail "Falha ao atualizar senha no banco."
  }

  $resultText = ($result | Out-String).Trim()
  Write-Host $resultText

  if ($resultText -notmatch "RESET_OK\|$([regex]::Escape($normalizedUsername))\|") {
    Fail "Usuario '$normalizedUsername' nao encontrado no banco local."
  }

  Write-Log "Senha local atualizada, bloqueios limpos e sessoes revogadas."
  Write-Log "Teste login em: http://localhost:3101/api/auth/login"
}
catch {
  Fail $_.Exception.Message
}
