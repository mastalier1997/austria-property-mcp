import { existsSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";

const cli = join(import.meta.dirname, "../dist/cli.js");

// Runs against the built server (CI builds before testing).
describe.skipIf(!existsSync(cli))("built server over stdio", () => {
  it("starts, lists tools and answers a call", async () => {
    const client = new Client({ name: "stdio-test", version: "0" });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [cli], stderr: "ignore" }));
    try {
      const { tools } = await client.listTools();
      expect(tools).toHaveLength(3);
      const r = (await client.callTool({
        name: "estimate_acquisition_costs",
        arguments: { valuationDate: "2026-10-18", purchasePrice: 250000, broker: "none" },
      })) as CallToolResult;
      expect(r.isError).toBeFalsy();
      const data = JSON.parse((r.content[1] as { text: string }).text);
      expect(data.lineItems[0]).toMatchObject({ id: "grest", amountCents: 875_000 });
    } finally {
      await client.close();
    }
  });
});
