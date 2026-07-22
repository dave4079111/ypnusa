import axios, { AxiosError } from "axios";
import { OPENAI_API_URL } from "../constants.js";
/**
 * Call OpenAI chat completions with JSON response format.
 * Returns parsed JSON or throws a descriptive error.
 */
export async function callOpenAI(messages, model = "gpt-4o-mini", temperature = 0.7) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY environment variable is not set. " +
            "Set it before starting the server: export OPENAI_API_KEY=sk-...");
    }
    try {
        const response = await axios.post(OPENAI_API_URL, {
            model,
            messages,
            temperature,
            response_format: { type: "json_object" },
        }, {
            timeout: 60_000,
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
        });
        const raw = response.data.choices[0]?.message?.content;
        if (!raw)
            throw new Error("OpenAI returned an empty response.");
        try {
            return JSON.parse(raw);
        }
        catch {
            throw new Error(`OpenAI returned invalid JSON: ${raw.slice(0, 200)}`);
        }
    }
    catch (err) {
        if (err instanceof AxiosError) {
            const status = err.response?.status;
            const msg = err.response?.data?.error?.message ?? err.message;
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
const cache = new Map();
export function getCached(key) {
    const entry = cache.get(key);
    if (!entry)
        return undefined;
    if (Date.now() > entry.expires) {
        cache.delete(key);
        return undefined;
    }
    return entry.value;
}
export function setCache(key, value, ttlMs) {
    cache.set(key, { value, expires: Date.now() + ttlMs });
}
//# sourceMappingURL=openai.js.map