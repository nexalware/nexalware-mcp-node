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

for (const t of tools) {
  server.registerTool(
    t.name,
    { description: t.description, inputSchema: t.inputSchema },

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
