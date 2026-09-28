/**
 * 取得に失敗しても落ちないfetch。
 * Notionの混雑（429）やサーバー側の一時的なエラー（5xx）のときは、少し待って数回やり直す。
 * ここでやり直さないと、ビルド時に「用語0件」「記事0件」のページが静かに出来上がってしまう。
 */
export async function safeFetchJson<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  fallback: T,
  retries = 3
): Promise<T> {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(input, init);

      if (!res.ok) {
        const retryable = res.status === 429 || res.status >= 500;
        if (retryable && attempt < retries) {
          const header = Number(res.headers.get('retry-after'));
          const delay = Number.isFinite(header) && header > 0 ? header * 1000 : 1000 * Math.pow(2, attempt);
          console.warn(`[safeFetchJson] ${res.status} のため ${delay}ms 待って再試行します（${attempt + 1}/${retries}）: ${String(input)}`);
          await wait(delay);
          continue;
        }
        console.warn(`[safeFetchJson] 取得に失敗しました（${res.status}）: ${String(input)}`);
        return fallback;
      }

      const raw = await res.text();
      if (!raw) return fallback;

      try {
        return JSON.parse(raw) as T;
      } catch {
        console.warn(`[safeFetchJson] JSONとして読めませんでした: ${String(input)}`);
        return fallback;
      }
    } catch (e) {
      if (attempt < retries) {
        const delay = 1000 * Math.pow(2, attempt);
        console.warn(`[safeFetchJson] 通信エラーのため ${delay}ms 待って再試行します（${attempt + 1}/${retries}）: ${String(input)}`);
        await wait(delay);
        continue;
      }
      console.warn(`[safeFetchJson] 通信エラーで取得できませんでした: ${String(input)}`);
      return fallback;
    }
  }

  return fallback;
}
