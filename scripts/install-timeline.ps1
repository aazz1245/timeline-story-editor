param(
  [string]$InstallDirectory = (Join-Path $env:LOCALAPPDATA 'Timeline Story Editor')
)

$ErrorActionPreference = 'Stop'
$sourceRoot = Split-Path -Parent $PSScriptRoot

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  throw '未找到 Node.js/npm。请先安装 Node.js 18 或更高版本。'
}

New-Item -ItemType Directory -Path $InstallDirectory -Force | Out-Null
Copy-Item -Path (Join-Path $sourceRoot '*') -Destination $InstallDirectory -Recurse -Force -Exclude @('data', 'node_modules', 'dist', '.git')
New-Item -ItemType Directory -Path (Join-Path $InstallDirectory 'data') -Force | Out-Null
New-Item -ItemType File -Path (Join-Path $InstallDirectory 'data\.gitkeep') -Force | Out-Null

Push-Location $InstallDirectory
try {
  npm.cmd install --omit=optional
  npm.cmd run build
} finally {
  Pop-Location
}

$shortcutPath = Join-Path $env:USERPROFILE 'Desktop\故事时间线.lnk'
$launcher = Join-Path $InstallDirectory 'scripts\start-timeline.ps1'
$icon = Join-Path $InstallDirectory 'assets\story-timeline.ico'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = (Get-Command pwsh.exe -ErrorAction Stop).Source
$shortcut.Arguments = "-NoLogo -NoProfile -ExecutionPolicy Bypass -File `"$launcher`""
$shortcut.WorkingDirectory = $InstallDirectory
$shortcut.IconLocation = "$icon,0"
$shortcut.Description = '启动故事时间线本机应用'
$shortcut.Save()

Write-Output "已安装到: $InstallDirectory"
Write-Output "桌面快捷方式: $shortcutPath"
