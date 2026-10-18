/**
 * Hosted MCP endpoint on Cloudflare Workers.
 *
 * Stateless streamable HTTP: every POST to /mcp gets a fresh server and
 * transport and a plain JSON response. There are no sessions and no
 * server-initiated messages, so GET /mcp (the optional SSE stream) is 405.
 */
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServer, SERVER_NAME, SERVER_VERSION } from "austria-property-mcp";

const MCP_PATH = "/mcp";
const SOURCE = "https://github.com/mastalier1997/austria-property-mcp";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extra },
  });
}

function info(origin: string): Response {
  const endpoint = `${origin}${MCP_PATH}`;
  return json({
    name: SERVER_NAME,
    version: SERVER_VERSION,
    description:
      "MCP server for Austrian residential property: purchase costs, buy-to-let underwriting and MRG rent-cap checks, with every statutory number cited to its legal source.",
    mcpEndpoint: endpoint,
    transport: "streamable-http (stateless, JSON responses)",
    tools: ["estimate_acquisition_costs", "underwrite_property", "get_rules"],
    connect: {
      claudeCode: `claude mcp add --transport http austria-property ${endpoint}`,
      local: "npx -y austria-property-mcp",
    },
    source: SOURCE,
    license: "AGPL-3.0-only",
    disclaimer: "Calculations only, not investment, tax or legal advice.",
  });
}

export async function handleMcp(request: Request): Promise<Response> {
  if (request.method === "GET") {
    return json({ jsonrpc: "2.0", error: { code: -32000, message: "This server is stateless; use POST." }, id: null }, 405, {
      Allow: "POST",
    });
  }
  const server = createServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await server.close();
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === MCP_PATH) return withCors(await handleMcp(request));
    if (url.pathname === "/" && request.method === "GET") return withCors(info(url.origin));
    if (url.pathname === "/health") return withCors(json({ ok: true, version: SERVER_VERSION }));
    return withCors(json({ error: "Not found", mcpEndpoint: `${url.origin}${MCP_PATH}` }, 404));
  },
};
