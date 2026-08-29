// Botify-backed LlmProvider -- generator only, same posture as
// KindroidProvider (the validator role always stays on Ollama; a
// companion-chat model is a poor fit for "return JSON matching this
// schema").
//
// Botify is a stateful character-chat service: the bot's persona and the
// chat's server-side history carry story continuity, so systemPrompt /
// temperature / maxTokens / model have no Botify equivalent and are
// ignored -- exactly the Kindroid trade-off, documented there. What is
// NOT ignored is `context`: the shared companion-message builder folds
// keyphrase-matched story entities plus recent scenes into the message
// text (the only channel Botify has), so story-specific facts the bot's
// own persona can't know still reach it. kindroidTarget is ignored too --
// it's Kindroid-specific by definition; Botify's target is the configured
// chat id (a server-wide default, like Kindroid's Phase 6 form; per-story
// Botify binding would be a marker-schema bump and is deliberately not
// built until real use asks for it).

import {
  buildCompanionMessage,
  selectCompanionMemoryIds,
} from "./companion-message.js";
import type { BotifyClient } from "./botify-client.js";
import type { GeneratedBeat, LlmGenerateOptions, LlmProvider } from "./llm.js";

export interface BotifyProviderConfig {
  /** The dedicated storytelling chat (a Botify chat UUID -- an existing
   * chat thread with the bot). */
  defaultChatId: string;
  /** Operator display name for the outgoing-message provenance header
   * (MNEMO_USER_NAME). Falls back to DEFAULT_USER_NAME when unset. */
  userName?: string;
}

export class BotifyProvider implements LlmProvider {
  readonly name = "botify";

  constructor(
    private readonly client: BotifyClient,
    private readonly config: BotifyProviderConfig,
  ) {}

  /** Non-mutating readiness probe: connect() performs the MCP handshake
   * plus bounded required-tool discovery -- it never posts a message to a
   * conversation (docs/NEMOCLAW_ADOPTION_ASSESSMENT.md §3). */
  async checkReady(): Promise<void> {
    await this.client.connect();
  }

  async generate(opts: LlmGenerateOptions): Promise<GeneratedBeat> {
    const message = buildCompanionMessage(
      opts.userMessage,
      opts.context,
      undefined,
      this.config.userName,
    );
    const selection = selectCompanionMemoryIds(opts.userMessage, opts.context);
    return {
      text: await this.client.sendMessage(this.config.defaultChatId, message),
      ...(selection !== undefined && { context_selection: selection }),
    };
  }
}
