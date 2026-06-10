$ErrorActionPreference = "Stop"

# Esperar a que el servicio esté saludable y Redis listo
$healthUrl = "http://localhost:3000/api/v1/health"
Write-Host "Waiting for auth service health check at $healthUrl ..."
for ($i = 0; $i -lt 30; $i++) {
    try {
        $response = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 1
        if ($response.status -eq "ok") {
            Write-Host "Auth service is healthy and Redis connection is ready."
            break
        }
    } catch {
        # Ignorar errores y reintentar
    }
    Start-Sleep -Seconds 1
}

$loginIp = "198.51.100.$(Get-Random -Minimum 10 -Maximum 240)"
$baseUrl = if ($env:AUTH_RATE_LIMIT_BASE_URL) { $env:AUTH_RATE_LIMIT_BASE_URL } else { "http://localhost:18080" }

hurl --test --variable LOGIN_IP=$loginIp --variable base_url=$baseUrl tests/07_rate_limit.hurl
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
