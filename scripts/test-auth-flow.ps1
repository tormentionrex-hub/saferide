<#
.SYNOPSIS
    Smoke test del flujo de autenticación SafeRide contra el backend en vivo.

.DESCRIPTION
    Cubre los casos del checklist de seguridad:
      - Caso feliz: login + /auth/me con token válido
      - Petición sin token → 401
      - Petición con accessToken corrupto → 401
      - /auth/refresh con refreshToken corrupto → 401
      - /auth/refresh con refreshToken válido → 200 y rota el token
      - /auth/refresh reutilizando el refreshToken viejo (post-rotación) → 401
      - /auth/me con accessToken nuevo (post-refresh) → 200
      - /auth/logout invalida el refreshToken en BD
      - /auth/refresh con el refreshToken post-logout → 401

    No modifica el estado del backend más allá de la rotación del refreshToken
    del usuario y el logout final. NO toca JWT_SECRET ni nada compartido entre
    usuarios. La sesión del usuario quedará cerrada al final.

.PARAMETER Email
    Email del usuario de testing.

.PARAMETER Password
    Password del usuario de testing.

.PARAMETER ApiUrl
    URL base del backend. Default: http://192.168.0.7:8080/api/v1

.EXAMPLE
    .\test-auth-flow.ps1 -Email test@intel.com -Password "Demo1234"

.NOTES
    Recomendado usar un usuario dedicado de testing. La sesión queda cerrada al
    finalizar la suite (último paso es /auth/logout).
#>

param(
    [Parameter(Mandatory=$true)][string]$Email,
    [Parameter(Mandatory=$true)][string]$Password,
    [string]$ApiUrl = "http://192.168.0.7:8080/api/v1"
)

# Detalles operativos
$ErrorActionPreference = "Stop"
$script:results = @()
$mobileHeaders = @{
    "Content-Type"  = "application/json"
    "X-Client-Type" = "mobile"
}

function Invoke-MobileRequest {
    param(
        [string]$Uri,
        [string]$Method = "GET",
        [object]$Body = $null,
        [hashtable]$ExtraHeaders = $null
    )
    $headers = $mobileHeaders.Clone()
    if ($ExtraHeaders) {
        foreach ($k in $ExtraHeaders.Keys) { $headers[$k] = $ExtraHeaders[$k] }
    }
    $params = @{
        Uri        = $Uri
        Method     = $Method
        Headers    = $headers
        TimeoutSec = 10
    }
    if ($Body) {
        $params.Body = ($Body | ConvertTo-Json -Compress)
    }
    # Windows PowerShell 5.1 lanza excepcion ante 4xx/5xx. Capturamos y
    # construimos una respuesta sintetica con StatusCode + Content para que el
    # script trate los errores HTTP como datos, no como excepciones.
    try {
        $resp = Invoke-WebRequest @params -UseBasicParsing
        return [PSCustomObject]@{
            StatusCode = [int]$resp.StatusCode
            Content    = $resp.Content
        }
    } catch {
        $webResp = $_.Exception.Response
        $code = -1
        $body = $_.Exception.Message
        if ($webResp) {
            try { $code = [int]$webResp.StatusCode } catch { $code = -1 }
            try {
                $stream = $webResp.GetResponseStream()
                $stream.Position = 0
                $reader = New-Object System.IO.StreamReader($stream)
                $body = $reader.ReadToEnd()
                $reader.Close()
            } catch {}
        }
        return [PSCustomObject]@{
            StatusCode = $code
            Content    = $body
        }
    }
}

function Test-Case {
    param(
        [string]$Name,
        [int]$ExpectedStatus,
        [scriptblock]$Action
    )
    Write-Host ""
    Write-Host "[$Name]" -ForegroundColor Cyan
    $actualStatus = -1
    $bodyPreview  = ""
    try {
        $response = & $Action
        $actualStatus = [int]$response.StatusCode
        if ($response.Content) {
            $bodyPreview = $response.Content
            if ($bodyPreview.Length -gt 200) { $bodyPreview = $bodyPreview.Substring(0, 200) + "..." }
        }
    } catch {
        $actualStatus = -1
        $bodyPreview  = $_.Exception.Message
    }
    $pass = ($actualStatus -eq $ExpectedStatus)
    $script:results += [PSCustomObject]@{
        Test     = $Name
        Expected = $ExpectedStatus
        Got      = $actualStatus
        Pass     = $pass
    }
    if ($pass) {
        Write-Host "  PASS  HTTP $actualStatus" -ForegroundColor Green
    } else {
        Write-Host "  FAIL  expected $ExpectedStatus, got $actualStatus" -ForegroundColor Red
    }
    if ($bodyPreview) {
        Write-Host "  body: $bodyPreview" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "=== SafeRide auth flow smoke test ===" -ForegroundColor Yellow
Write-Host "API: $ApiUrl"
Write-Host "User: $Email"

# Step 0 - Login (no es Test-Case porque necesitamos los tokens para los demás)
Write-Host ""
Write-Host "[Login]" -ForegroundColor Cyan
$loginResp = Invoke-MobileRequest -Uri "$ApiUrl/auth/login" -Method POST -Body @{
    email    = $Email
    password = $Password
}
if ($loginResp.StatusCode -ne 200) {
    Write-Host "  FAIL  login devolvio $($loginResp.StatusCode)" -ForegroundColor Red
    Write-Host $loginResp.Content
    exit 1
}
$loginData    = ($loginResp.Content | ConvertFrom-Json).data
$accessToken  = $loginData.accessToken
$refreshToken = $loginData.refreshToken
if (-not $accessToken -or -not $refreshToken) {
    Write-Host "  FAIL  login no devolvio accessToken/refreshToken" -ForegroundColor Red
    exit 1
}
Write-Host "  PASS  tokens obtenidos" -ForegroundColor Green

# 1 - /auth/me con accessToken valido
Test-Case "auth/me con accessToken valido" 200 {
    Invoke-MobileRequest -Uri "$ApiUrl/auth/me" -ExtraHeaders @{Authorization="Bearer $accessToken"}
}

# 2 - /auth/me sin token
Test-Case "auth/me sin token" 401 {
    Invoke-MobileRequest -Uri "$ApiUrl/auth/me"
}

# 3 - /auth/me con accessToken corrupto (firma rota)
$brokenAccess = $accessToken.Substring(0, $accessToken.Length - 5) + "ZZZZZ"
Test-Case "auth/me con accessToken corrupto" 401 {
    Invoke-MobileRequest -Uri "$ApiUrl/auth/me" -ExtraHeaders @{Authorization="Bearer $brokenAccess"}
}

# 4 - /auth/refresh con refreshToken corrupto
$brokenRefresh = $refreshToken.Substring(0, $refreshToken.Length - 5) + "ZZZZZ"
Test-Case "auth/refresh con refreshToken corrupto" 401 {
    Invoke-MobileRequest -Uri "$ApiUrl/auth/refresh" -Method POST -Body @{
        refreshToken = $brokenRefresh
    }
}

# 5 - /auth/refresh con refreshToken valido → 200, captura nuevos tokens
Write-Host ""
Write-Host "[auth/refresh con refreshToken valido]" -ForegroundColor Cyan
$refreshOkResp = Invoke-MobileRequest -Uri "$ApiUrl/auth/refresh" -Method POST -Body @{
    refreshToken = $refreshToken
}
$expected = 200; $got = [int]$refreshOkResp.StatusCode
$pass = ($got -eq $expected)
$script:results += [PSCustomObject]@{ Test="auth/refresh con refreshToken valido"; Expected=$expected; Got=$got; Pass=$pass }
if ($pass) {
    $refreshData    = ($refreshOkResp.Content | ConvertFrom-Json).data
    $newAccessToken  = $refreshData.accessToken
    $newRefreshToken = $refreshData.refreshToken
    Write-Host "  PASS  HTTP 200 - tokens rotados" -ForegroundColor Green
} else {
    Write-Host "  FAIL  HTTP $got" -ForegroundColor Red
    Write-Host $refreshOkResp.Content
    exit 1
}

# 6 - reuso del refreshToken viejo despues de la rotacion → 401
Test-Case "auth/refresh con refreshToken VIEJO (post-rotacion)" 401 {
    Invoke-MobileRequest -Uri "$ApiUrl/auth/refresh" -Method POST -Body @{
        refreshToken = $refreshToken
    }
}

# 7 - /auth/me con el nuevo accessToken → 200
Test-Case "auth/me con accessToken NUEVO (post-refresh)" 200 {
    Invoke-MobileRequest -Uri "$ApiUrl/auth/me" -ExtraHeaders @{Authorization="Bearer $newAccessToken"}
}

# 8 - /auth/logout con accessToken NUEVO → 200
Test-Case "auth/logout con accessToken NUEVO" 200 {
    Invoke-MobileRequest -Uri "$ApiUrl/auth/logout" -Method POST -ExtraHeaders @{Authorization="Bearer $newAccessToken"}
}

# 9 - /auth/refresh con el refreshToken post-logout → 401 (server invalido el refresh)
Test-Case "auth/refresh con refreshToken POST-LOGOUT" 401 {
    Invoke-MobileRequest -Uri "$ApiUrl/auth/refresh" -Method POST -Body @{
        refreshToken = $newRefreshToken
    }
}

# Resumen final
Write-Host ""
Write-Host "=== RESUMEN ===" -ForegroundColor Yellow
$script:results | Format-Table -AutoSize
$failed = ($script:results | Where-Object { -not $_.Pass }).Count
$total  = $script:results.Count
if ($failed -eq 0) {
    Write-Host "OK  $total/$total casos pasaron" -ForegroundColor Green
} else {
    Write-Host "FAIL  $failed/$total casos fallaron" -ForegroundColor Red
    exit 2
}
