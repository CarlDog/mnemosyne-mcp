export const DEFAULT_OLLAMA_TIMEOUT_MS = 5 * 60 * 1000;

/** Classify Ollama failures without retrying ambiguous or overloaded calls. */
export function classifyOllamaHttpError(
  status: number,
  bodyText: string,
  model: string,
): Error {
  if (status === 404) {
    return new Error(
      `Ollama model "${model}" is not installed on this daemon -- model ` +
        "names must be EXACT installed tags (list them with `ollama list` " +
        "or GET /api/tags)",
    );
  }
  if (status === 400 && bodyText.includes("exceed_context_size_error")) {
    const tokens = /n_prompt_tokens\\?":\s*(\d+)/.exec(bodyText)?.[1];
    const ctx = /n_ctx\\?":\s*(\d+)/.exec(bodyText)?.[1];
    return new Error(
      `Ollama rejected the request as over the context window` +
        (tokens && ctx ? ` (${tokens} tokens vs num_ctx ${ctx})` : "") +
        ` -- this is the deliberate reject-don't-truncate contract. Raise ` +
        "OLLAMA_NUM_CTX (within the model's trained context) or trim story " +
        "context; the context-plan manifest shows what was admitted.",
    );
  }
  if (status === 429 || status === 503) {
    return new Error(
      `Ollama is overloaded (HTTP ${status}). It queues work itself, so ` +
        "this call is NOT retried automatically (a retry storm amplifies " +
        "the overload) -- wait for in-flight generations to finish and " +
        "retry manually.",
    );
  }
  return new Error(`Ollama HTTP ${status}: ${bodyText || String(status)}`);
}

export const DEFAULT_KEEP_ALIVE = "30m";

/** Convert numeric env values to the numeric keep_alive form Ollama accepts. */
export function normalizeKeepAlive(value: string): string | number {
  const trimmed = value.trim();
  return /^-?\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
}

export const MIN_GENERATION_TOKENS = 1;
export const MAX_GENERATION_TOKENS = 8192;
export const MIN_TEMPERATURE = 0;
export const MAX_TEMPERATURE = 2;
export const DEFAULT_TEMPERATURE = 0.8;
export const DEFAULT_MAX_TOKENS = 2048;

export const DEFAULT_MAX_NUM_CTX = 32_768;
const MIN_NUM_CTX = 4_096;
const EST_CHARS_PER_TOKEN = 3.5;
export const NUM_CTX_MARGIN_TOKENS = 256;

export interface NumCtxPlan {
  numCtx: number;
  estPromptTokens: number;
  capped: boolean;
}

/** Fit the Ollama context window to the request without silent truncation. */
export function computeNumCtx(
  promptChars: number,
  numPredict: number,
  maxContextWindow = DEFAULT_MAX_NUM_CTX,
): NumCtxPlan {
  const estPromptTokens = Math.ceil(promptChars / EST_CHARS_PER_TOKEN);
  const wanted = estPromptTokens + numPredict + NUM_CTX_MARGIN_TOKENS;
  const numCtx = Math.min(Math.max(MIN_NUM_CTX, wanted), maxContextWindow);
  return { numCtx, estPromptTokens, capped: numCtx < wanted };
}
