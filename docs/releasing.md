# Releasing

How to publish the MCP server to npm, deploy the hosted endpoint on Cloudflare Workers, and list it in the official MCP registry. Each step needs your own account login, so you run them yourself.

## Every release (quick)

1. Bump the versions (mcp-server `package.json`, `SERVER_VERSION` in `src/server.ts`, `server.json` twice, worker `package.json`), update `docs/plan.md`, run `pnpm check`, commit and push.
2. Run `.scriptselease.ps1`. It pulls, installs, checks, then publishes to npm, deploys the Worker and publishes to the MCP registry, stopping at the first failure.
3. Check the three places it prints at the end. Registry "version already exists" means the earlier attempt went through; an auth error needs `mcp-publisher login github` again.

The numbered sections below are the one-time setup and the manual steps behind the script.

## 0. Local setup (once)

The history was rewritten on 2026-10-18 (noreply author email). Reset an older clone, and commit with the noreply address from now on:

```bash
git fetch
git reset --hard origin/main
git config user.email "48477843+mastalier1997@users.noreply.github.com"
pnpm install
pnpm check
```

Optional: in GitHub → Settings → Emails, turn on "Keep my email addresses private" and "Block command line pushes that expose my email".

## 1. npm

```bash
pnpm build
npm login                         # once; npm account with 2FA
cd packages/mcp-server
pnpm publish --access public      # pnpm, not npm: it rewrites workspace: dependencies
```

Check: <https://www.npmjs.com/package/austria-property-mcp>, then `npx -y austria-property-mcp` should start the server.

For each later release, bump `version` in `packages/mcp-server/package.json`, `SERVER_VERSION` in `src/server.ts` and both versions in `server.json` (tests check they match).

## 2. Cloudflare Workers (free plan)

```bash
cd packages/worker
pnpm exec wrangler login          # opens the browser; free Cloudflare account
pnpm run deploy
```

Wrangler prints the URL, e.g. `https://austria-property-mcp.<your-subdomain>.workers.dev`. Check it:

- `https://…workers.dev/` returns a JSON description.
- `claude mcp add --transport http austria-property-hosted https://…workers.dev/mcp`, then ask Claude to underwrite something.

Free-plan limits: 100,000 requests a day and 10 ms CPU per request. A calculation takes well under 1 ms. If requests ever fail with CPU errors, the Workers Paid plan raises the limit.

## 3. MCP registry

Install `mcp-publisher` (Windows PowerShell):

```powershell
$arch = if ([System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture -eq "Arm64") { "arm64" } else { "amd64" }; Invoke-WebRequest -Uri "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_windows_$arch.tar.gz" -OutFile "mcp-publisher.tar.gz"; tar xf mcp-publisher.tar.gz mcp-publisher.exe; rm mcp-publisher.tar.gz
```

After the Worker is deployed, add its URL to `packages/mcp-server/server.json`, next to `packages`:

```json
"remotes": [
  { "type": "streamable-http", "url": "https://austria-property-mcp.<your-subdomain>.workers.dev/mcp" }
]
```

Then publish (the npm package must already be on npm):

```bash
cd packages/mcp-server
mcp-publisher login github
mcp-publisher publish
```

Check: `curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.mastalier1997/austria-property"`.

The registry verifies the npm package through the `mcpName` field in `package.json`, which must equal `name` in `server.json`.
