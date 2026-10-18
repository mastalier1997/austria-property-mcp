# Release the current version: npm, Cloudflare Worker, MCP registry.
# Run from anywhere: .\scripts\release.ps1   (details: docs/releasing.md)
# Bump versions first (mcp-server package.json, SERVER_VERSION, server.json x2, worker package.json) and push.
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

function Step($name, [scriptblock]$run) {
  Write-Host "`n=== $name ===" -ForegroundColor Cyan
  & $run
  if ($LASTEXITCODE -ne 0) { throw "$name failed (exit $LASTEXITCODE)" }
}

Set-Location $root
Step "git pull"            { git pull }
Step "install + check"     { pnpm install; if ($LASTEXITCODE -eq 0) { pnpm check } }

$version = (Get-Content packages\mcp-server\package.json -Raw | ConvertFrom-Json).version
Read-Host "`nPublish $version to npm, Cloudflare and the MCP registry? Enter to go, Ctrl+C to stop"

Step "npm publish"         { Set-Location $root\packages\mcp-server; pnpm publish --access public }
Step "Worker deploy"       { Set-Location $root\packages\worker; pnpm run deploy }
Step "registry login"      { Set-Location $root\packages\mcp-server; mcp-publisher login github }
Step "registry publish"    { mcp-publisher publish }

Write-Host "`n=== Verify ===" -ForegroundColor Cyan
Write-Host "Worker : https://austria-property-mcp.jan-mastalier.workers.dev/ should show $version"
Write-Host "npm    : https://www.npmjs.com/package/austria-property-mcp"
Write-Host "Registry (isLatest):"
(Invoke-RestMethod "https://registry.modelcontextprotocol.io/v0/servers?search=io.github.mastalier1997/austria-property").servers |
  ForEach-Object { $_.server.version, $_._meta.'io.modelcontextprotocol.registry/official'.isLatest -join "  " }
Set-Location $root
