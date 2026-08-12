// Shared MCP CallToolResult-unwrapping logic. Both oc-client.ts and
// kindroid-client.ts call tools on remote MCP servers and need to pull a
// usable value out of the SDK's CallToolResult shape:
//   - structuredContent, when present (MCP spec >= 2024-11), is the raw JSON
//     value already -- no parsing needed.
//   - otherwise, fall back to the first "text" content block and (for JSON
//     callers) JSON.parse it.
//
// This module covers only that shared step. It does NOT cover oc-client.ts's
// separate unwrapResult<T>() helper, which peels FastMCP's {result:[...]}
// list-wrapping convention -- that's OC-specific and stays in oc-client.ts.

interface McpContentBlock {
  type: string;
  text?: string;
}

// Callers pass the SDK's CallToolResult (a union type with a rate/mode
// variant that shares no named property with a plain {content?, ...}
// shape). Typing the param with an index signature keeps assignment
// structural instead of tripping TS's "weak type" ("no properties in
// common") check that a fully-optional named-property interface would hit.
type McpResult = Record<string, unknown>;

/**
 * Find the first "text" content block with non-empty text and return it.
 * Throws if no such block exists, naming `toolName` in the error so the
 * caller can tell which tool call failed.
 */
export function extractText(result: McpResult, toolName: string): string {
  const content = (result.content ?? []) as McpContentBlock[];
  const textBlock = content.find((c) => c.type === "text" && c.text);
  if (!textBlock?.text) {
    throw new Error(`${toolName} returned no text content`);
  }
  return textBlock.text;
}

/**
 * Prefer `structuredContent` when present (the raw JSON value, not
 * stringified); otherwise extract the text content block and JSON.parse it.
 */
export function extractStructuredOrParsed<T>(
  result: McpResult,
  toolName: string,
): T {
  if (result.structuredContent !== undefined) {
    return result.structuredContent as T;
  }
  return JSON.parse(extractText(result, toolName)) as T;
}
