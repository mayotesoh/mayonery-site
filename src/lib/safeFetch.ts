export async function safeFetchJson<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  fallback: T
): Promise<T> {
  try {
    const res = await fetch(input, init);
    if (!res.ok) return fallback;

    const raw = await res.text();
    if (!raw) return fallback;

    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  } catch {
    return fallback;
  }
}
