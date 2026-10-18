#!/usr/bin/env node
/**
 * Runs the MCP server over stdio. stdout carries the protocol, so nothing else
 * may write to it; diagnostics go to stderr.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

const server = createServer();
await server.connect(new StdioServerTransport());
process.stderr.write("austria-property MCP server running on stdio\n");
