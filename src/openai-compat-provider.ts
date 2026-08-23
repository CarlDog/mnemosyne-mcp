// OpenAI-compatible chat-completions provider -- one class, multiple
// configured providers. `openai` points it at api.openai.com (base
// overridable via OPENAI_BASE_URL, so any compatible host -- Groq,
// Together, a local vLLM -- works without new code); `atlascloud` points
// it at Atlas Cloud's LLM API (https://api.atlascloud.ai/v1, verified
// from atlascloud-mcp's own constants.ts). Atlas deliberately goes
// DIRECT rather than through the deployed atlascloud-mcp: its atlas_chat
// tool returns a human-formatted markdown envelope ("# Chat Response...
// ## Token Usage"), which a machine caller cannot safely scrape the
// completion back out of.
//
// Mapping: systemPrompt and per-call model map directly; temperature and
// maxTokens are pass-through only (see buildChatCompletionsBody -- the
// newest OpenAI reasoning models reject the fields outright, so they are
// omitted unless the caller set them). `context` is ignored (systemPrompt
// already carries the assembled context) and `kindroidTarget` is
// Kindroid-specific.
//
// Live-verification status: the request/response shapes follow the
// OpenAI chat-completions contract (choices[0].message.content), and the
// Atlas variant's response shape is additionally confirmed against
// atlascloud-mcp's ChatCompletionResponse type (its captured contract of
// the same API). Env-gated integration tests exercise the live path
// whenever the operator sets the relevant API key.

import { llmPostJson } from "./llm-http.js";
import { log } from "./log.js";
import type { GeneratedBeat, LlmGenerateOptions, LlmProvider } from "./llm.js";

export interface OpenAICompatConfig {
  /** Provider name surfaced in logs/tool responses ("openai",
   * "atlascloud", ...). */
  name: string;
  /** API base, e.g. https://api.openai.com/v1 -- /chat/completions is
   * appended. */
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
}

/** Pure request-body assembly -- unit-testable without a network.
 * `temperature` and `max_tokens` are pass-through only: omitted unless
 * the caller set them, so each host's own defaults apply. That posture
 * exists because the newest OpenAI reasoning models 400 on the mere
 * presence of either field (`max_tokens` wants `max_completion_tokens`
 * there; `temperature` is rejected outright) -- omitting by default
 * means every model works out of the box, and an explicit value that a
 * model rejects fails loudly with the API's own message. `max_tokens`
 * keeps the compat ecosystem's universal spelling; silently branching
 * the field name per host would be worse than the clear error. */
export function buildChatCompletionsBody(
  defaultModel: string,
  opts: LlmGenerateOptions,
): Record<string, unknown> {
  return {
    model: opts.model ?? defaultModel,
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.userMessage },
    ],
    ...(opts.temperature !== undefined && { temperature: opts.temperature }),
    ...(opts.maxTokens !== undefined && { max_tokens: opts.maxTokens }),
  };
}

interface ChatCompletionsResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string } | string;
}

/** Pure response parsing -- throws with the provider's own error message
 * when one is present, else on a missing completion. */
export function extractChatCompletionText(
  provider: string,
  data: unknown,
): string {
  const res = data as ChatCompletionsResponse;
  if (res.error) {
    const msg = typeof res.error === "string" ? res.error : res.error.message;
    throw new Error(`${provider} error: ${msg ?? JSON.stringify(res.error)}`);
  }
  const content = res.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`${provider} returned no completion content`);
  }
  // Strip leading whitespace -- same lesson as OllamaProvider: a stray
  // leading space/newline gets saved into the scene and trips downstream
  // display + parsing.
  return content.replace(/^\s+/, "");
}

export class OpenAICompatProvider implements LlmProvider {
  readonly name: string;

  constructor(private readonly config: OpenAICompatConfig) {
    this.name = config.name;
  }

  async generate(opts: LlmGenerateOptions): Promise<GeneratedBeat> {
    const body = buildChatCompletionsBody(this.config.defaultModel, opts);
    const start = Date.now();
    log.info(this.name, "generate", {
      model: body.model,
      system_chars: opts.systemPrompt.length,
      user_chars: opts.userMessage.length,
    });
    const data = await llmPostJson({
      provider: this.name,
      url: `${this.config.baseUrl.replace(/\/+$/, "")}/chat/completions`,
      headers: { Authorization: `Bearer ${this.config.apiKey}` },
      body,
    });
    const text = extractChatCompletionText(this.name, data);
    log.info(this.name, "generate ok", {
      model: body.model,
      ms: Date.now() - start,
      chars: text.length,
    });
    return { text };
  }
}
