<#
.SYNOPSIS
  Build the fork and install it as a portable app.

.DESCRIPTION
  Runs a production build, then mirrors dist\GitHubDesktop-win32-x64 into the
  install folder. Refuses to run while the installed app is open, since files
  in use can't be replaced and a half copied install won't start.

.EXAMPLE
  yarn fork:install
  yarn fork:install -SkipBuild
  yarn fork:install -InstallDir D:\Tools\GitHubDesktop
#>
param(
  [string]$InstallDir = 'C:\Apps\GitHubDesktop-win32-x64',
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist\GitHubDesktop-win32-x64'
$installDirFull = [System.IO.Path]::GetFullPath($InstallDir)

function Get-RunningInstall {
  Get-Process GitHubDesktop -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -and $_.Path.StartsWith($installDirFull, 'OrdinalIgnoreCase') }
}

if (Get-RunningInstall) {
  throw "GitHub Desktop is running from $installDirFull. Quit it (including from the system tray) and try again."
}

if (-not $SkipBuild) {
  Write-Host 'Building...'
  Push-Location $root
  try {
    yarn build:prod
    if ($LASTEXITCODE -ne 0) { throw "Build failed with exit code $LASTEXITCODE" }
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path (Join-Path $dist 'GitHubDesktop.exe'))) {
  throw "No build found at $dist. Run without -SkipBuild."
}

# The build can take a while, so check again before replacing any files.
if (Get-RunningInstall) {
  throw "GitHub Desktop was started from $installDirFull during the build. Quit it and run with -SkipBuild."
}

Write-Host "Installing to $installDirFull..."
robocopy $dist $installDirFull /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
# robocopy exit codes below 8 mean success
if ($LASTEXITCODE -ge 8) { throw "Copying failed (robocopy exit code $LASTEXITCODE)" }

$built = Get-FileHash (Join-Path $dist 'resources\app\renderer.js')
$installed = Get-FileHash (Join-Path $installDirFull 'resources\app\renderer.js')
if ($built.Hash -ne $installed.Hash) { throw 'The installed files do not match the build.' }

$version = (Get-Item (Join-Path $installDirFull 'GitHubDesktop.exe')).VersionInfo.ProductVersion
Write-Host "Installed GitHub Desktop $version to $installDirFull" -ForegroundColor Green
$global:LASTEXITCODE = 0
