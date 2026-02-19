param(
  [string]$BaseUrl = "http://localhost:5000",
  [string]$TestLoginEmail = "asistentedireccion@fenalcosantander.com.co",
  [string]$TestLoginPassword = "password123",
  [switch]$SkipMongo,
  [switch]$SkipSmoke
)

$ErrorActionPreference = 'Stop'

function Write-Step($message) {
  Write-Host "`n=== $message ===" -ForegroundColor Cyan
}

function Write-Ok($message) {
  Write-Host "[OK] $message" -ForegroundColor Green
}

function Write-Warn($message) {
  Write-Host "[WARN] $message" -ForegroundColor Yellow
}

function Write-Err($message) {
  Write-Host "[ERROR] $message" -ForegroundColor Red
}

function Test-Port5000 {
  $conn = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue
  return [bool]$conn
}

function Wait-Health([string]$url, [int]$maxAttempts = 30, [int]$sleepSeconds = 2) {
  for ($i = 1; $i -le $maxAttempts; $i++) {
    try {
      $res = Invoke-RestMethod -Method Get -Uri "$url/api/health" -TimeoutSec 4
      if ($res -and ($res.status -eq 'OK' -or $res.status -eq 'ok')) {
        return $true
      }
    } catch {
      Start-Sleep -Seconds $sleepSeconds
    }
  }
  return $false
}

try {
  $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
  Set-Location $repoRoot

  Write-Step "1) Verificando MongoDB"
  if (-not $SkipMongo) {
    $envFile = Join-Path $repoRoot '.env'
    $mongoUri = $null
    if (Test-Path $envFile) {
      $mongoLine = Get-Content $envFile | Where-Object { $_ -match '^MONGODB_URI=' } | Select-Object -First 1
      if ($mongoLine) {
        $mongoUri = ($mongoLine -replace '^MONGODB_URI=', '').Trim()
      }
    }

    if ($mongoUri -and $mongoUri -match '^mongodb\+srv://') {
      Write-Ok "MONGODB_URI usa Atlas, no se requiere servicio local"
    } else {
      $mongoService = Get-Service -Name MongoDB -ErrorAction SilentlyContinue
      if ($mongoService) {
        if ($mongoService.Status -ne 'Running') {
          Start-Service -Name MongoDB
          Write-Ok "Servicio MongoDB iniciado"
        } else {
          Write-Ok "Servicio MongoDB ya estaba corriendo"
        }
      } else {
        $mongod = Get-Process mongod -ErrorAction SilentlyContinue
        if ($mongod) {
          Write-Ok "Proceso mongod detectado"
        } else {
          Write-Warn "No se detectó servicio MongoDB ni proceso mongod (si usas Atlas, ignora este mensaje)"
        }
      }
    }
  } else {
    Write-Warn "Verificación de MongoDB omitida por parámetro"
  }

  Write-Step "2) Verificando/Iniciando servidor"
  if (-not (Test-Port5000)) {
    Write-Host "Iniciando servidor en nueva ventana..." -ForegroundColor Gray
    $command = "Set-Location '$repoRoot'; npm run dev"
    Start-Process powershell -ArgumentList @('-NoExit', '-Command', $command) | Out-Null
  } else {
    Write-Ok "Servidor ya estaba escuchando en puerto 5000"
  }

  Write-Step "3) Validando health check"
  if (-not (Wait-Health -url $BaseUrl)) {
    throw "No se pudo validar $BaseUrl/api/health dentro del tiempo esperado"
  }
  Write-Ok "Health check OK en $BaseUrl/api/health"

  if (-not $SkipSmoke) {
    Write-Step "4) Ejecutando smoke test"
    $env:TEST_BASE_URL = $BaseUrl
    $env:TEST_LOGIN_EMAIL = $TestLoginEmail
    $env:TEST_LOGIN_PASSWORD = $TestLoginPassword

    & npm run smoke
    if ($LASTEXITCODE -ne 0) {
      throw "Smoke test falló"
    }

    Write-Ok "Smoke test completado"

    Remove-Item Env:TEST_BASE_URL, Env:TEST_LOGIN_EMAIL, Env:TEST_LOGIN_PASSWORD -ErrorAction SilentlyContinue
  } else {
    Write-Warn "Smoke test omitido por parámetro"
  }

  Write-Step "5) Listo para trabajar"
  Write-Host "Frontend: $BaseUrl" -ForegroundColor White
  Write-Host "Health:   $BaseUrl/api/health" -ForegroundColor White
  Write-Ok "Arranque matutino finalizado"
} catch {
  Write-Err $_.Exception.Message
  exit 1
}
