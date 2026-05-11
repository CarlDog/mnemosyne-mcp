#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { log } from "./log.js";

const INSTRUCTIONS = `MCP server for long-form storytelling on top of OpenChronicle (OC) memory.
Mnemosyne owns narrative logic; OC owns persistent memory. Together they
support continuity-aware storytelling sessions across many conversations.

Status: scaffolded, no tools yet. See ARCHITECTURE.md and STATUS.md in the
mnemosyne-mcp repo for the planned tool surface.`;

const server = new McpServer(
  {
    name: "mnemosyne-mcp",
    version: "0.0.1",
  },
  {
    instructions: INSTRUCTIONS,
  },
);

// Tool registrations land here once v0 design is settled.
// See docs/ARCHITECTURE.md §7 (Build Sequence) step 4.

await server.connect(new StdioServerTransport());
log.info("server", "mnemosyne-mcp ready", { transport: "stdio" });
