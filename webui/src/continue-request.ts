import type {
  ContinueRequest,
  Mode,
  SceneContextStrategy,
} from "./api/types.js";

export interface ContinueRequestFields {
  direction: string;
  mode: Mode;
  validate: boolean;
  strategy: SceneContextStrategy | "server-default";
  fallbackStrategy: SceneContextStrategy | "server-default";
  maxTokens: string;
  temperature: string;
  model: string;
  kindroidGroup: boolean;
  allowUser: boolean;
  groupMaxTurns: string;
}

export function buildContinueRequest(
  fields: ContinueRequestFields,
): ContinueRequest {
  const payload: ContinueRequest = {
    direction: fields.direction.trim(),
    mode: fields.mode,
    validate: fields.validate,
  };
  if (fields.strategy !== "server-default") {
    payload.scene_context_strategy = fields.strategy;
  }
  if (fields.fallbackStrategy !== "server-default") {
    payload.scene_context_fallback_strategy = fields.fallbackStrategy;
  }
  if (fields.maxTokens.trim() !== "") {
    payload.max_tokens = Number(fields.maxTokens);
  }
  if (fields.temperature.trim() !== "") {
    payload.temperature = Number(fields.temperature);
  }
  if (fields.model.trim() !== "") payload.model = fields.model.trim();
  if (fields.kindroidGroup) {
    payload.allow_user = fields.allowUser;
    if (fields.groupMaxTurns.trim() !== "") {
      payload.group_max_turns = Number(fields.groupMaxTurns);
    }
  }
  return payload;
}
