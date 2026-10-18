import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";
import worker from "../src/index.js";

const ORIGIN = "https://austria-property-mcp.example.workers.dev";

/** An MCP client whose HTTP requests go straight to the worker's fetch handler. */
async function connect(): Promise<Client> {
  const client = new Client({ name: "worker-test", version: "0" });
  const transport = new StreamableHTTPClientTransport(new URL(`${ORIGIN}/mcp`), {
    fetch: (input, init) => worker.fetch(new Request(input, init)),
  });
  await client.connect(transport);
  return client;
}

describe("worker", () => {
  it("serves MCP over stateless HTTP: list tools and call one", async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["estimate_acquisition_costs", "get_rules", "underwrite_property"]);

    const r = (await client.callTool({
      name: "estimate_acquisition_costs",
      arguments: { valuationDate: "2026-10-18", purchasePrice: 250000, broker: { commissionPct: 3, sellerPaysCommission: true }, financing: { loanAmount: 200000 } },
    })) as CallToolResult;
    expect(r.isError).toBeFalsy();
    const data = JSON.parse((r.content[1] as { text: string }).text);
    expect(data.totalCents).toBe(2_815_100);
    await client.close();
  });

  it("answers GET /mcp with 405, since there is no SSE stream", async () => {
    const res = await worker.fetch(new Request(`${ORIGIN}/mcp`, { method: "GET", headers: { Accept: "text/event-stream" } }));
    expect(res.status).toBe(405);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("answers CORS preflight", async () => {
    const res = await worker.fetch(new Request(`${ORIGIN}/mcp`, { method: "OPTIONS" }));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Headers")).toMatch(/Mcp-Protocol-Version/);
  });

  it("describes itself at / with the connect command", async () => {
    const res = await worker.fetch(new Request(`${ORIGIN}/`));
    const body = (await res.json()) as { mcpEndpoint: string; connect: { claudeCode: string } };
    expect(body.mcpEndpoint).toBe(`${ORIGIN}/mcp`);
    expect(body.connect.claudeCode).toContain("--transport http");
  });

  it("returns 404 elsewhere", async () => {
    expect((await worker.fetch(new Request(`${ORIGIN}/nope`))).status).toBe(404);
  });
});
