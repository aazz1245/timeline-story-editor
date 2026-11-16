$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent $PSScriptRoot
$healthUrl = 'http://127.0.0.1:4174/api/health'
$ready = $false

try {
  $ready = [bool](Invoke-WebRequest -UseBasicParsing -Uri $healthUrl -TimeoutSec 1)
} catch {
  $ready = $false
}

if (-not $ready) {
  Start-Process -FilePath 'npm.cmd' -ArgumentList 'start' -WorkingDirectory $root -WindowStyle Minimized | Out-Null
  $deadline = (Get-Date).AddSeconds(20)
  while (-not $ready -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 400
    try {
      $ready = [bool](Invoke-WebRequest -UseBasicParsing -Uri $healthUrl -TimeoutSec 1)
    } catch {
      $ready = $false
    }
  }
}

if ($ready) {
  Start-Process $healthUrl | Out-Null
} else {
  Write-Warning 'Timeline service did not start within 20 seconds. Run npm start to inspect the service log.'
}
