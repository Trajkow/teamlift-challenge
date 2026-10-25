import type { FieldPath, FieldValues, UseFormSetError } from "react-hook-form";
import { ApiError } from "@/lib/api";

/**
 * Maps backend validation `issues` onto form fields. Returns true if at least one issue was attached to a field;
 * otherwise the caller should show `err.message` as a form-level error.
 */
export function applyIssues<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
  fields: readonly FieldPath<T>[],
): boolean {
  if (!(err instanceof ApiError) || !err.issues?.length) return false;
  let mapped = false;
  for (const issue of err.issues) {
    const field = String(issue.path[0] ?? "");
    if ((fields as readonly string[]).includes(field)) {
      setError(field as FieldPath<T>, { type: "server", message: issue.message });
      mapped = true;
    }
  }
  return mapped;
}
