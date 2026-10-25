import { apiErrorBodySchema, type ApiIssue } from "@/lib/schemas/error";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly issues?: ApiIssue[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

/** Backend errors look like `{ error, message, issues? }`; anything else (proxy errors, HTML) gets a generic code. */
function parseError(status: number, body: unknown): ApiError {
  const parsed = apiErrorBodySchema.safeParse(body);
  if (parsed.success) {
    return new ApiError(status, parsed.data.error, parsed.data.message, parsed.data.issues);
  }
  const loose = (body && typeof body === "object" ? body : {}) as { code?: unknown; message?: unknown };
  const code = typeof loose.code === "string" ? loose.code : `HTTP_${status}`;
  const message = typeof loose.message === "string" ? loose.message : `Request failed (${status})`;
  return new ApiError(status, code, message);
}

/** JSON in/out against the same-origin `/api` rewrite. Throws `ApiError` on non-2xx responses. */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { method = "GET", body, headers, signal } = options;
  const res = await fetch(path, {
    method,
    signal,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
  }
  if (!res.ok) throw parseError(res.status, data);
  return data as T;
}
