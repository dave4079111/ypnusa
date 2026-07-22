import axios, { AxiosError } from "axios";
import { OPENAI_API_URL } from "../constants.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenAIResponse {
  choices: Array<{
    message: { content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Call OpenAI chat completions with JSON response format.
 * Returns parsed JSON or throws a descriptive error.
 */
export async function callOpenAI<T>(
  messages: ChatMessage[],
  model: string = "gpt-4o-mini",
  temperature: number = 0.7
): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY environment variable is not set. " +
      "Set it before starting the server: export OPENAI_API_KEY=sk-..."
    );
  }

  try {
    const response = await axios.post<OpenAIResponse>(
      OPENAI_API_URL,
      {
        model,
        messages,
        temperature,
        response_format: { type: "json_object" },
      },
      {
        timeout: 60_000,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const raw = response.data.choices[0]?.message?.content;
    if (!raw) throw new Error("OpenAI returned an empty response.");

    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new Error(`OpenAI returned invalid JSON: ${raw.slice(0, 200)}`);
    }
  } catch (err) {
    if (err instanceof AxiosError) {
      const status = err.response?.status;
      const msg = (err.response?.data as { error?: { message?: string } })?.error?.message ?? err.message;
      switch (status) {
        case 401:
          throw new Error("OpenAI authentication failed. Check your OPENAI_API_KEY.");
        case 429:
          throw new Error("OpenAI rate limit exceeded. Please wait and retry.");
        case 503:
          throw new Error("OpenAI is temporarily unavailable. Please retry in a moment.");
        default:
          throw new Error(`OpenAI API error (${status ?? "network"}): ${msg}`);
      }
    }
    throw err;
  }
}

/** Simple in-process cache with TTL for keyword results */
const cache = new Map<string, { value: unknown; expires: number }>();

export function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) { cache.delete(key); return undefined; }
  return entry.value as T;
}

export function setCache(key: string, value: unknown, ttlMs: number): void {
  cache.set(key, { value, expires: Date.now() + ttlMs });
}
