// Pure tests for MCP CallToolResult unwrapping. No OC, no Ollama required.

import { describe, it, expect } from "vitest";
import { extractText, extractStructuredOrParsed } from "../src/mcp-result.js";

describe("mcp-result — isError handling (both helpers)", () => {
  // The MCP SDK reports tool-handler failures as a NORMAL result with
  // isError: true and the message as a plain-text block — Client.callTool
  // does not throw. Without these checks, extractText hands error prose
  // back as if it were the reply, and extractStructuredOrParsed turns
  // "Error: chat not found" into an unrelated JSON SyntaxError.
  it("extractText throws the error text instead of returning it as a reply", () => {
    const result = {
      isError: true,
      content: [{ type: "text", text: "Error: chat not found" }],
    };
    expect(() => extractText(result, "send_message")).toThrow(
      "send_message failed: Error: chat not found",
    );
  });

  it("extractStructuredOrParsed throws the error text, not a JSON SyntaxError — even when structuredContent is present", () => {
    const plain = {
      isError: true,
      content: [{ type: "text", text: "Error: chat not found" }],
    };
    expect(() => extractStructuredOrParsed(plain, "send_message")).toThrow(
      /send_message failed: Error: chat not found/,
    );

    const withStructured = {
      isError: true,
      structuredContent: { anything: true },
      content: [{ type: "text", text: "upstream 500" }],
    };
    expect(() =>
      extractStructuredOrParsed(withStructured, "some_tool"),
    ).toThrow(/some_tool failed: upstream 500/);
  });

  it("an isError result with no text block still throws, with a placeholder detail", () => {
    expect(() => extractText({ isError: true }, "some_tool")).toThrow(
      /some_tool failed: \(no error detail returned\)/,
    );
  });
});

describe("mcp-result — extractText", () => {
  it("returns the text of the first text content block", () => {
    const result = {
      content: [{ type: "text", text: "hello world" }],
    };
    expect(extractText(result, "some_tool")).toBe("hello world");
  });

  it("skips non-text blocks and finds the first text block after them", () => {
    const result = {
      content: [
        { type: "image", text: undefined },
        { type: "text", text: "the real payload" },
      ],
    };
    expect(extractText(result, "some_tool")).toBe("the real payload");
  });

  it("throws naming the tool when content is missing", () => {
    const result = {};
    expect(() => extractText(result, "some_tool")).toThrow(
      "some_tool returned no text content",
    );
  });

  it("throws naming the tool when content has no text blocks", () => {
    const result = { content: [{ type: "image" }] };
    expect(() => extractText(result, "some_tool")).toThrow(
      "some_tool returned no text content",
    );
  });

  it("throws naming the tool when the text block's text is empty", () => {
    const result = { content: [{ type: "text", text: "" }] };
    expect(() => extractText(result, "some_tool")).toThrow(
      "some_tool returned no text content",
    );
  });
});

describe("mcp-result — extractStructuredOrParsed", () => {
  it("uses structuredContent directly when present, without touching content", () => {
    const result = {
      structuredContent: { foo: "bar" },
      // A deliberately broken content block -- if extractStructuredOrParsed
      // fell back to it, this would throw or return the wrong value.
      content: [{ type: "text", text: "not json{{{" }],
    };
    expect(extractStructuredOrParsed(result, "some_tool")).toEqual({
      foo: "bar",
    });
  });

  it("parses the text content block when structuredContent is absent", () => {
    const result = {
      content: [{ type: "text", text: '{"foo":"bar"}' }],
    };
    expect(extractStructuredOrParsed(result, "some_tool")).toEqual({
      foo: "bar",
    });
  });

  it("throws naming the tool when structuredContent is absent and text content is missing", () => {
    const result = {};
    expect(() => extractStructuredOrParsed(result, "some_tool")).toThrow(
      "some_tool returned no text content",
    );
  });

  it("throws naming the tool when structuredContent is absent and text content is empty", () => {
    const result = { content: [{ type: "text", text: "" }] };
    expect(() => extractStructuredOrParsed(result, "some_tool")).toThrow(
      "some_tool returned no text content",
    );
  });
});
