/** Shared outbound HTTP settings and bearer-authenticated JSON calls to providers. */

export const OUTBOUND_TIMEOUT_MS = 8_000;

export interface ProviderJsonRequest {
  url: string;
  token: string;
  /** Prefixes the thrown error, e.g. `Google Calendar booking`. */
  failureLabel: string;
  method?: "GET" | "POST";
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Calls a provider API with a bearer token and a JSON body, throwing a labelled
 * error on a non-2xx response. Returns the decoded JSON payload.
 */
export async function requestProviderJson<T>({
  url,
  token,
  failureLabel,
  method = "GET",
  body,
  headers,
}: ProviderJsonRequest): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS),
  });

  if (!response.ok) throw new Error(`${failureLabel} failed (${response.status}).`);
  return (await response.json()) as T;
}
