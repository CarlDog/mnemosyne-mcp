#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { log } from "./log.js";
import { OcClient } from "./oc-client.js";
import { registerTools } from "./tools/index.js";

const OC_URL = process.env.OC_URL;
if (!OC_URL) {
  log.error("startup", "OC_URL environment variable is required");
  process.exit(1);
}

let ocUrl: URL;
try {
  ocUrl = new URL(OC_URL);
} catch (err) {
  log.error("startup", "OC_URL is not a valid URL", {
    value: OC_URL,
    msg: (err as Error).message,
  });
  process.exit(1);
}

const oc = new OcClient(ocUrl);
try {
  await oc.connect();
} catch (err) {
  log.error("startup", "failed to connect to OpenChronicle", {
    url: OC_URL,
    msg: (err as Error).message,
  });
  process.exit(1);
}

const INSTRUCTIONS = `MCP server for long-form storytelling on top of OpenChronicle (OC) memory.
Mnemosyne owns narrative logic; OC owns persistent memory. Each Mnemosyne
story is one OC project bearing a Mnemosyne story marker memory; other
OC projects are not visible through this MCP.

v0 surface so far:
- mnemo_story_list — list Mnemosyne stories
- mnemo_story_use(name_or_id, create_if_missing?) — set active story
- mnemo_save_entity(type, name, content, pinned?, extra_tags?) — write a
  character/location/rule/style/scene/lore/worldbuilding entry to the
  active story. Overwrites by (type, name).
- mnemo_recall(query?, type?, limit?) — semantic recall over the active
  story's entities.

Continuation tool (Phase C) to follow.`;

const server = new McpServer(
  { name: "mnemosyne-mcp", version: "0.0.1" },
  { instructions: INSTRUCTIONS },
);

registerTools(server, oc);

await server.connect(new StdioServerTransport());
log.info("server", "mnemosyne-mcp ready", { transport: "stdio" });
