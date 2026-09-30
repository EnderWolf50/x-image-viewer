# Build the zip to upload to the Chrome Web Store: dist/<name>-<version>.zip
# Only runtime files go in; store/ assets and docs stay out.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$manifest = Get-Content manifest.json -Raw | ConvertFrom-Json
$name = (Split-Path $PSScriptRoot -Leaf)
$zip = "dist/$name-$($manifest.version).zip"

New-Item -ItemType Directory -Force dist | Out-Null
if (Test-Path $zip) { Remove-Item $zip }

$files = @('manifest.json', 'icons') + (Get-ChildItem *.js -Name)
Compress-Archive -Path $files -DestinationPath $zip
Write-Host "Built $zip"
