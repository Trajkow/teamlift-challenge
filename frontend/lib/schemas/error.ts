// Mirrors the backend error body: backend/src/common/errors/db-exception.filter.ts (`ErrorBody`)
// and the `issues` array produced by backend/src/common/validation/zod-validation.pipe.ts.
import { z } from "zod";

export const apiErrorBodySchema = z.object({
  error: z.string(),
  message: z.string(),
  issues: z
    .array(z.object({ path: z.array(z.union([z.string(), z.number()])), message: z.string() }))
    .optional(),
});

export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;
export type ApiIssue = NonNullable<ApiErrorBody["issues"]>[number];
