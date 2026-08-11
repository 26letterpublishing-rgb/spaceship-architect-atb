$ErrorActionPreference = "Stop"
$node = "C:\Users\zombi\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if (-not (Test-Path $node)) {
  $node = "node"
}
Set-Location $PSScriptRoot
$localFiles = Join-Path (Split-Path $PSScriptRoot -Parent) "SA-ATB Local Development Files"
$env:NODE_PATH = Join-Path $localFiles "node_modules"
$env:SA_LOCAL_DATA_DIR = Join-Path $localFiles "campaign-data"
& $node ".\server.js"
