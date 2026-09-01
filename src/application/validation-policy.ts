export interface VerdictReport {
  issues: Array<{ severity: string }>;
}

export function classifyVerdict(report: VerdictReport): "clean" | "errors" {
  return report.issues.some((issue) => issue.severity === "error")
    ? "errors"
    : "clean";
}
