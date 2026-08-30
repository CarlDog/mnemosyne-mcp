import type { ContinueResponse } from "./api/types.js";

export function canonStatusLabel(result: ContinueResponse): string {
  if (result.memory_id) return "saved to canon";
  if (result.canon_write_outcome === "unknown") return "canon write unknown";
  return "not saved";
}

export function contextEntityCount(
  result: ContinueResponse,
): number | undefined {
  if (result.context_summary) {
    return Object.values(result.context_summary).reduce(
      (sum, count) => sum + count,
      0,
    );
  }
  if (result.context_plan) {
    return Object.values(result.context_plan.sections).reduce(
      (sum, section) => sum + (section?.included ?? 0),
      0,
    );
  }
  return undefined;
}
