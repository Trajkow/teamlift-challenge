const STORAGE_KEY = "slot.hostKey";

/** The host key lives only in this browser. Storage can be blocked, so every access is guarded. */
export function getHostKey(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setHostKey(key: string | null) {
  try {
    if (key) window.localStorage.setItem(STORAGE_KEY, key);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: the key just won't be remembered.
  }
}
