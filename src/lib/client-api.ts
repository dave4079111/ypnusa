/**
 * Browser-side helper for the app's JSON API routes.
 *
 * Every client widget was repeating the same `fetch` incantation (POST,
 * content-type header, `JSON.stringify`, `res.json()` cast). `postJson`
 * returns both the response and the decoded body so callers keep their own
 * status/envelope handling.
 */

export interface JsonPostResult<T> {
  response: Response;
  data: T | null;
}

export async function postJson<T>(
  url: string,
  body: unknown,
  init?: Omit<RequestInit, "method" | "body">,
): Promise<JsonPostResult<T>> {
  const response = await fetch(url, {
    ...init,
    method: "POST",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => null)) as T | null;
  return { response, data };
}
