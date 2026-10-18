// Bundles the server for npm: the workspace engine is inlined, the MCP SDK and
// zod stay as regular dependencies. Type declarations come from tsc (dist/types).
import { build } from "esbuild";

await build({
  entryPoints: { cli: "src/cli.ts", server: "src/server.ts" },
  outdir: "dist",
  bundle: true,
  splitting: true,
  chunkNames: "chunks/[name]-[hash]",
  platform: "node",
  format: "esm",
  target: "node20",
  external: ["@modelcontextprotocol/sdk", "@modelcontextprotocol/sdk/*", "zod"],
  logLevel: "warning",
});
