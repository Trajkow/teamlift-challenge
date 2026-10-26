export type ServiceAccountKey = {client_email: string; private_key: string};

function asKey(value: unknown): ServiceAccountKey | null {
  if (!value || typeof value !== 'object') return null;
  const {client_email, private_key} = value as Record<string, unknown>;
  if (typeof client_email !== 'string' || typeof private_key !== 'string') return null;
  if (!client_email || !private_key) return null;
  return {client_email, private_key};
}

/** Parses the key file contents, given as raw JSON or as base64 of it. Returns null when invalid. */
export function parseServiceAccountKey(raw: string | undefined): ServiceAccountKey | null {
  const text = raw?.trim();
  if (!text) return null;
  const attempts = [() => text, () => Buffer.from(text, 'base64').toString('utf8')];
  for (const attempt of attempts) {
    try {
      const key = asKey(JSON.parse(attempt()));
      if (key) return key;
    } catch {
      // try the next encoding
    }
  }
  return null;
}
