// Google Gemini provider -- direct HTTP against the generateContent
// endpoint, no SDK (matching the repo's Ollama convention).
// Full-fidelity mapping: systemPrompt (systemInstruction), temperature +
// maxTokens (generationConfig), and per-call model (in the URL path) all
// map directly; `context` is ignored (systemPrompt already carries it)
// and `kindroidTarget` is Kindroid-specific.
//
// The API key travels in the x-goog-api-key HEADER, never as the ?key=
// query parameter the docs also allow -- secrets don't belong in URLs
// (they leak into logs and error messages; this repo's security rules
// forbid it). The model id is URL-path-interpolated and therefore
// URL-encoded (api-integration rule: encode every interpolated path
// segment).
//
// Live-verification status: documented contract, exercised by an
// env-gated integration test whenever GEMINI_API_KEY is set.

import { llmPostJson } from "./llm-http.js";
import { log } from "./log.js";
import type { GeneratedBeat, LlmGenerateOptions, LlmProvider } from "./llm.js";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";

export interface GeminiConfig {
  apiKey: string;
  defaultModel: string;
}

/** Pure request-body assembly -- unit-testable without a network.
 * generationConfig fields are pass-through only (omitted unless the
 * caller set them): on Gemini 2.5 models, THINKING tokens count against
 * maxOutputTokens, so a modest hard default could be silently consumed
 * by thought and yield an empty reply (finishReason MAX_TOKENS) --
 * Gemini's own defaults budget for this; a caller-supplied cap is a
 * deliberate choice that fails loudly if too tight. */
export function buildGeminiBody(
  opts: LlmGenerateOptions,
): Record<string, unknown> {
  const generationConfig: Record<string, unknown> = {
    ...(opts.temperature !== undefined && { temperature: opts.temperature }),
    ...(opts.maxTokens !== undefined && { maxOutputTokens: opts.maxTokens }),
  };
  return {
    systemInstruction: { parts: [{ text: opts.systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: opts.userMessage }] }],
    ...(Object.keys(generationConfig).length > 0 && { generationConfig }),
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { message?: string };
  promptFeedback?: { blockReason?: string };
}

/** Pure response parsing. A safety-blocked prompt returns no candidates
 * but does carry promptFeedback.blockReason -- surface it rather than a
 * generic "no content", since the fix (rephrase, or a different
 * provider) is completely different from a transport problem. */
export function extractGeminiText(data: unknown): string {
  const res = data as GeminiResponse;
  if (res.error) {
    throw new Error(`gemini error: ${res.error.message ?? "unknown"}`);
  }
  if (res.promptFeedback?.blockReason) {
    throw new Error(
      `gemini blocked the prompt (${res.promptFeedback.blockReason}) -- ` +
        "rephrase the direction or use a different provider for this content",
    );
  }
  const text = (res.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("");
  if (!text) {
    const finish = res.candidates?.[0]?.finishReason;
    throw new Error(
      `gemini returned no text content${finish ? ` (finishReason: ${finish})` : ""}`,
    );
  }
  // Strip leading whitespace -- same lesson as OllamaProvider: a stray
  // leading space/newline gets saved into the scene and trips downstream
  // display + parsing.
  return text.replace(/^\s+/, "");
}

export class GeminiProvider implements LlmProvider {
  readonly name = "gemini";

  constructor(private readonly config: GeminiConfig) {}

  async generate(opts: LlmGenerateOptions): Promise<GeneratedBeat> {
    const model = opts.model ?? this.config.defaultModel;
    const body = buildGeminiBody(opts);
    const start = Date.now();
    log.info(this.name, "generate", {
      model,
      system_chars: opts.systemPrompt.length,
      user_chars: opts.userMessage.length,
    });
    const data = await llmPostJson({
      provider: this.name,
      url: `${GEMINI_BASE_URL}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      headers: { "x-goog-api-key": this.config.apiKey },
      body,
    });
    const text = extractGeminiText(data);
    log.info(this.name, "generate ok", {
      model,
      ms: Date.now() - start,
      chars: text.length,
    });
    return { text };
  }
}
