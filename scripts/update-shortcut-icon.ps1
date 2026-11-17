param(
  [string]$SourceImage = (Join-Path $env:USERPROFILE 'Desktop\Gemini_Generated_Image_hz79gvhz79gvhz79.jpg'),
  [string]$ShortcutPath = (Join-Path $env:USERPROFILE 'Desktop\故事时间线.lnk'),
  [string]$IconPath = (Join-Path $PSScriptRoot '..\assets\story-timeline.ico')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$resolvedIconPath = [System.IO.Path]::GetFullPath($IconPath)
$iconDirectory = Split-Path -Parent $resolvedIconPath
New-Item -ItemType Directory -Path $iconDirectory -Force | Out-Null

$source = [System.Drawing.Image]::FromFile($SourceImage)
$sizes = @(16, 24, 32, 48, 64, 128, 256)
$frames = [System.Collections.Generic.List[byte[]]]::new()

try {
  foreach ($size in $sizes) {
    $bitmap = [System.Drawing.Bitmap]::new($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.Clear([System.Drawing.Color]::White)
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.DrawImage($source, 0, 0, $size, $size)
      $stream = [System.IO.MemoryStream]::new()
      try {
        $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
        $frames.Add($stream.ToArray())
      } finally {
        $stream.Dispose()
      }
    } finally {
      $graphics.Dispose()
      $bitmap.Dispose()
    }
  }
} finally {
  $source.Dispose()
}

$fileStream = [System.IO.File]::Create($resolvedIconPath)
$writer = [System.IO.BinaryWriter]::new($fileStream)
try {
  $writer.Write([UInt16]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]$frames.Count)
  $offset = 6 + (16 * $frames.Count)
  for ($index = 0; $index -lt $frames.Count; $index++) {
    $size = $sizes[$index]
    $writer.Write([byte]($(if ($size -eq 256) { 0 } else { $size })))
    $writer.Write([byte]($(if ($size -eq 256) { 0 } else { $size })))
    $writer.Write([byte]0)
    $writer.Write([byte]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]32)
    $writer.Write([UInt32]$frames[$index].Length)
    $writer.Write([UInt32]$offset)
    $offset += $frames[$index].Length
  }
  foreach ($frame in $frames) { $writer.Write($frame) }
} finally {
  $writer.Dispose()
  $fileStream.Dispose()
}

if (Test-Path $ShortcutPath) {
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($ShortcutPath)
  $shortcut.IconLocation = "$resolvedIconPath,0"
  $shortcut.Save()
  Write-Output "Updated shortcut icon: $ShortcutPath"
}
Write-Output "Generated icon: $resolvedIconPath"
