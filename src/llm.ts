// LLM provider abstraction. v0 ships Ollama only. Adding Botify or
// Anthropic later is a new class implementing LlmProvider — and a
// runtime selection mechanism (env var) will appear naturally then.
// Don't pre-build it.

import { log } from "./log.js";

export interface LlmGenerateOptions {
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
  /** Override the provider's default model for this call. */
  model?: string;
}

export interface LlmProvider {
  readonly name: string;
  generate(opts: LlmGenerateOptions): Promise<string>;
}

export interface OllamaConfig {
  url: string;
  defaultModel: string;
}

const OLLAMA_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_TEMPERATURE = 0.8;
const DEFAULT_MAX_TOKENS = 2048;

interface OllamaChatResponse {
  message?: { role?: string; content?: string };
  error?: string;
  done?: boolean;
}

export class OllamaProvider implements LlmProvider {
  readonly name = "ollama";

  constructor(private readonly config: OllamaConfig) {}

  async generate(opts: LlmGenerateOptions): Promise<string> {
    const model = opts.model ?? this.config.defaultModel;
    const url = new URL("/api/chat", this.config.url);

    const body = {
      model,
      messages: [
        { role: "system", content: opts.systemPrompt },
        { role: "user", content: opts.userMessage },
      ],
      stream: false,
      options: {
        temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
        num_predict: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
      },
    };

    const start = Date.now();
    log.info("ollama", "generate", {
      model,
      system_chars: opts.systemPrompt.length,
      user_chars: opts.userMessage.length,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Ollama HTTP ${res.status}: ${text || res.statusText}`);
      }

      const data = (await res.json()) as OllamaChatResponse;
      if (data.error) {
        throw new Error(`Ollama error: ${data.error}`);
      }
      const content = data.message?.content;
      if (!content) {
        throw new Error("Ollama returned no message content");
      }

      log.info("ollama", "generate ok", {
        model,
        ms: Date.now() - start,
        chars: content.length,
      });
      return content;
    } catch (err) {
      log.error("ollama", "generate error", {
        model,
        ms: Date.now() - start,
        msg: (err as Error).message,
      });
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
