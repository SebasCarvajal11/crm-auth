$ErrorActionPreference = "Stop"

$loginIp = "198.51.100.$(Get-Random -Minimum 10 -Maximum 240)"
$baseUrl = if ($env:AUTH_RATE_LIMIT_BASE_URL) { $env:AUTH_RATE_LIMIT_BASE_URL } else { "http://localhost:18080" }

hurl --test --variable LOGIN_IP=$loginIp --variable base_url=$baseUrl tests/07_rate_limit.hurl
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
