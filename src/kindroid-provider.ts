// Kindroid-backed LlmProvider -- generator only (see ARCHITECTURE.md /
// STATUS.md: the validator role always stays on Ollama, since a
// companion-chat model is a poor fit for "return JSON matching this
// schema").
//
// Unlike OllamaProvider, Kindroid has no system-prompt, temperature, or
// max_tokens concept: kindroid_send_message is a stateful chat tied to one
// AI's own persona/memory on Kindroid's servers, not a stateless completion
// call. The design choice here (confirmed with the operator) is to lean on
// the dedicated storytelling kin's own native memory for continuity rather
// than re-injecting mnemosyne's OC-assembled context (rules/style/
// characters/locations/recent scenes/lore/worldbuilding) into every message
// -- so `systemPrompt`, `temperature`, and `maxTokens` are deliberately
// ignored here. mnemo_continue still builds that context unconditionally
// because the optional validator pass needs it regardless of which
// generator produced the beat.

import type { KindroidClient } from "./kindroid-client.js";
import type { LlmGenerateOptions, LlmProvider } from "./llm.js";

export interface KindroidProviderConfig {
  /** The dedicated storytelling kin: a raw ai_id or a kindroid-mcp
   * registered friendly name (resolved server-side). */
  aiId: string;
}

export class KindroidProvider implements LlmProvider {
  readonly name = "kindroid";

  constructor(
    private readonly client: KindroidClient,
    private readonly config: KindroidProviderConfig,
  ) {}

  async generate(opts: LlmGenerateOptions): Promise<string> {
    // opts.model repurposes as a per-call kin override, mirroring how it
    // overrides OllamaProvider's defaultModel.
    const aiId = opts.model ?? this.config.aiId;
    return this.client.sendMessage(aiId, opts.userMessage);
  }
}
