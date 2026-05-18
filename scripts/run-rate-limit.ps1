$ErrorActionPreference = "Stop"

$loginIp = "198.51.100.$(Get-Random -Minimum 10 -Maximum 240)"

hurl --test --variable LOGIN_IP=$loginIp tests/07_rate_limit.hurl
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
