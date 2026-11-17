$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent $PSScriptRoot
$healthUrl = 'http://127.0.0.1:4174/api/health'
$appUrl = 'http://127.0.0.1:4174/'
$expectedDataDirectory = [System.IO.Path]::GetFullPath((Join-Path $root 'data')).TrimEnd('\')
$ready = $false

try {
  $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 1
  $actualDataDirectory = if ($health.dataDirectory) { [System.IO.Path]::GetFullPath([string]$health.dataDirectory).TrimEnd('\') } else { '' }
  $ready = [bool]$health.ok -and $actualDataDirectory.Equals($expectedDataDirectory, [System.StringComparison]::OrdinalIgnoreCase)
} catch {
  $ready = $false
}

if (-not $ready) {
  try {
    Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort 4174 -State Listen -ErrorAction Stop |
      Select-Object -ExpandProperty OwningProcess -Unique |
      ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
  } catch { }
  Start-Process -FilePath 'npm.cmd' -ArgumentList 'start' -WorkingDirectory $root -WindowStyle Minimized | Out-Null
  $deadline = (Get-Date).AddSeconds(20)
  while (-not $ready -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 400
    try {
      $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 1
      $actualDataDirectory = if ($health.dataDirectory) { [System.IO.Path]::GetFullPath([string]$health.dataDirectory).TrimEnd('\') } else { '' }
      $ready = [bool]$health.ok -and $actualDataDirectory.Equals($expectedDataDirectory, [System.StringComparison]::OrdinalIgnoreCase)
    } catch {
      $ready = $false
    }
  }
}

if ($ready) {
  Start-Process $appUrl | Out-Null
} else {
  Write-Warning 'Timeline service did not start within 20 seconds. Run npm start to inspect the service log.'
}
