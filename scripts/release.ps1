# Guided release: npm, Cloudflare Worker, MCP registry. Run it in your own terminal:
#   .\scripts\release.ps1        (details: docs/releasing.md)
# Bump versions first (mcp-server package.json, SERVER_VERSION, server.json x2, worker package.json) and push.
# Every step asks before it runs. Logins and one-time codes happen in this terminal; a failed step
# offers retry / skip / quit instead of aborting.
$root = Split-Path $PSScriptRoot -Parent

function Step($name, $hint, [scriptblock]$run) {
  Write-Host "`n=== $name ===" -ForegroundColor Cyan
  if ($hint) { Write-Host $hint -ForegroundColor DarkGray }
  $prompt = "[Enter] run, [s] skip, [q] quit"
  while ($true) {
    $a = Read-Host $prompt
    if ($a -eq "q") { exit 1 }
    if ($a -eq "s") { return }
    $global:LASTEXITCODE = 0
    try { & $run } catch { Write-Host $_ -ForegroundColor Red; $global:LASTEXITCODE = 1 }
    if ($LASTEXITCODE -eq 0) { return }
    Write-Host "$name failed (exit $LASTEXITCODE)." -ForegroundColor Red
    $prompt = "[Enter] retry, [s] skip, [q] quit"
  }
}

Set-Location $root
Step "1. git pull" $null { git pull }
Step "2. install + check" "pnpm install, then pnpm check (build, typecheck, tests)." {
  pnpm install; if ($LASTEXITCODE -eq 0) { pnpm check }
}

$version = (Get-Content packages\mcp-server\package.json -Raw | ConvertFrom-Json).version
Write-Host "`nVersion to release: $version" -ForegroundColor Yellow

Step "3. npm login" "Skip if 'npm whoami' already shows you. Otherwise follow the browser or code prompt." {
  npm whoami; if ($LASTEXITCODE -ne 0) { npm login }
}
Step "4. npm publish" "May ask for a one-time code (2FA). 'version already exists' means it is already published: skip." {
  Set-Location $root\packages\mcp-server; pnpm publish --access public
}
Step "5. Cloudflare login" "Skip if already logged in. Otherwise a browser window opens." {
  Set-Location $root\packages\worker; pnpm exec wrangler whoami; if ($LASTEXITCODE -ne 0) { pnpm exec wrangler login }
}
Step "6. Worker deploy" $null { Set-Location $root\packages\worker; pnpm run deploy }
Step "7. Registry login" "GitHub device flow: open the URL it prints, enter the code, approve." {
  Set-Location $root\packages\mcp-server; mcp-publisher login github
}
Step "8. Registry publish" "'version already exists' means the earlier attempt went through." {
  Set-Location $root\packages\mcp-server; mcp-publisher publish
}

Write-Host "`n=== Verify ===" -ForegroundColor Cyan
Write-Host "Worker   : https://austria-property-mcp.jan-mastalier.workers.dev/ should show $version"
Write-Host "npm      : https://www.npmjs.com/package/austria-property-mcp"
Write-Host "Registry : $version should be isLatest"
try {
  (Invoke-RestMethod "https://registry.modelcontextprotocol.io/v0/servers?search=io.github.mastalier1997/austria-property").servers |
    ForEach-Object { "  " + $_.server.version + "  isLatest=" + $_._meta.'io.modelcontextprotocol.registry/official'.isLatest }
} catch { Write-Host "  (registry lookup failed: $_). Try again in a minute." }
Set-Location $root
