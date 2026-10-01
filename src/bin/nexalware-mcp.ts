#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { NexalwareApiError, NexalwareClient, tools } from "@nexalware/sdk";

const apiKey = process.env.NEXALWARE_API_KEY;
if (!apiKey) {
  console.error(
    "NEXALWARE_API_KEY is not set. Create a key on the Nexalware dashboard " +
      "(Settings -> API Keys), scope it to the device(s) this agent should " +
      "control, and pass it as this environment variable."
  );
  process.exit(1);
}

const client = new NexalwareClient({
  apiKey,
  baseUrl: process.env.NEXALWARE_API_URL,
});

const server = new McpServer({
  name: "nexalware",
  version: "0.1.0",
});

// One MCP tool per entry in the SDK's shared tool manifest, this file is
// deliberately thin: the manifest (name, description, schema, handler) is
// the single source of truth, this is just the adapter that speaks MCP.
for (const t of tools) {
  server.registerTool(
    t.name,
    { description: t.description, inputSchema: t.inputSchema },
    // Heterogeneous loop over tools with differing input shapes, each
    // handler's own zod schema (already enforced by registerTool itself)
    // is the real type safety here, not this callback's static type.
    async (args: Record<string, unknown>) => {
      try {
        const result = await t.handler(args as never, client);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        const message =
          err instanceof NexalwareApiError
            ? `${err.error}: ${err.message}`
            : err instanceof Error
              ? err.message
              : String(err);
        return { content: [{ type: "text" as const, text: message }], isError: true };
      }
    }
  );
}

const transport = new StdioServerTransport();
await server.connect(transport);
