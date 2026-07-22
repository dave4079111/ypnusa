import { z } from "zod";
import { callOpenAI, getCached, setCache } from "../services/openai.js";
import { handleError } from "../services/errors.js";
const CACHE_TTL_MS = 24 * 60 * 60 * 1_000; // 24 hours
const InputSchema = z.object({
    topic: z
        .string()
        .min(3, "Topic must be at least 3 characters")
        .max(200, "Topic must not exceed 200 characters")
        .describe("Mortgage or real estate topic to research, e.g. 'VA home loans' or 'first-time buyer FHA'"),
    count: z
        .number()
        .int()
        .min(5)
        .max(20)
        .default(10)
        .describe("Number of keyword ideas to return (5–20, default 10)"),
    difficulty_filter: z
        .enum(["Easy", "Medium", "Hard", "all"])
        .default("all")
        .describe("Filter results by competition difficulty. 'all' returns mixed difficulties."),
    intent_filter: z
        .enum(["Informational", "Commercial", "Transactional", "Navigational", "all"])
        .default("all")
        .describe("Filter by search intent. 'all' returns all intents."),
    response_format: z
        .enum(["json", "markdown"])
        .default("json")
        .describe("'json' for programmatic use, 'markdown' for human-readable table"),
}).strict();
function buildPrompt(topic, count) {
    return `You are an SEO specialist for mortgage and real estate professionals.

Generate ${count} high-intent, long-tail keyword ideas related to: "${topic}"

Focus on keywords a Mortgage Loan Officer's potential borrowers would actually search for on Google.
Prioritize question-based and comparison keywords that signal buying intent but are specific enough to rank for without huge domain authority.

Return ONLY valid JSON with a single key "keywords" whose value is an array of ${count} objects, each with:
- keyword (string): exact long-tail keyword phrase (4–10 words ideally)
- intent (string): one of "Informational", "Commercial", "Transactional", "Navigational"
- difficulty (string): one of "Easy", "Medium", "Hard" — estimate based on specificity and competition
- angle (string): 1-sentence content angle or hook that makes this keyword rankable (max 120 chars)

Bias toward "Easy" and "Medium" difficulty — the user is likely a small-to-mid MLO site.
Do NOT include generic single-word or two-word keywords.`;
}
function formatMarkdown(keywords, topic) {
    const lines = [
        `# Keyword Scout: "${topic}"`,
        "",
        `| # | Keyword | Intent | Difficulty | Content Angle |`,
        `|---|---------|--------|------------|---------------|`,
    ];
    keywords.forEach((kw, i) => {
        lines.push(`| ${i + 1} | ${kw.keyword} | ${kw.intent} | ${kw.difficulty} | ${kw.angle} |`);
    });
    return lines.join("\n");
}
export function registerScoutKeywords(server) {
    server.registerTool("mlo_scout_keywords", {
        title: "Scout Long-Tail Keywords",
        description: `Research high-volume, low-competition long-tail keywords for a mortgage or real estate topic.

Returns keyword ideas with search intent classification, competition difficulty, and a content angle for each — optimized for Mortgage Loan Officer websites with low-to-mid domain authority.

Results are cached per topic for 24 hours to reduce API costs.

Args:
  - topic (string, 3–200 chars): Mortgage or real estate topic, e.g. "VA home loans" or "FHA first-time buyer"
  - count (number, 5–20, default 10): Number of keyword ideas to return
  - difficulty_filter ("Easy"|"Medium"|"Hard"|"all", default "all"): Filter by competition level
  - intent_filter ("Informational"|"Commercial"|"Transactional"|"Navigational"|"all", default "all"): Filter by search intent
  - response_format ("json"|"markdown", default "json"): Output format

Returns JSON (default):
{
  "topic": string,
  "total": number,
  "keywords": [
    {
      "keyword": string,       // e.g. "how to qualify for VA loan with bad credit"
      "intent": string,        // "Informational" | "Commercial" | "Transactional" | "Navigational"
      "difficulty": string,    // "Easy" | "Medium" | "Hard"
      "angle": string          // Content angle / hook
    }
  ]
}

Examples:
  - "VA home loans" → 10 long-tail VA loan keywords with intent + difficulty
  - "FHA first-time buyer", difficulty_filter="Easy" → only easy-to-rank keywords
  - "self employed mortgage", response_format="markdown" → formatted table

Error cases:
  - "Topic must be at least 3 characters" → provide a longer topic
  - "OPENAI_API_KEY environment variable is not set" → set the env var`,
        inputSchema: InputSchema,
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
        },
    }, async (params) => {
        try {
            const cacheKey = `kw:${params.topic.toLowerCase()}:${params.count}`;
            let keywords = getCached(cacheKey);
            if (!keywords) {
                const result = await callOpenAI([{ role: "user", content: buildPrompt(params.topic, params.count) }], "gpt-4o-mini", 0.5);
                keywords = result.keywords ?? [];
                setCache(cacheKey, keywords, CACHE_TTL_MS);
            }
            // Apply filters
            if (params.difficulty_filter !== "all") {
                keywords = keywords.filter(k => k.difficulty === params.difficulty_filter);
            }
            if (params.intent_filter !== "all") {
                keywords = keywords.filter(k => k.intent === params.intent_filter);
            }
            const structured = {
                topic: params.topic,
                total: keywords.length,
                keywords,
            };
            const text = params.response_format === "markdown"
                ? formatMarkdown(keywords, params.topic)
                : JSON.stringify(structured, null, 2);
            return {
                content: [{ type: "text", text }],
                structuredContent: structured,
            };
        }
        catch (err) {
            return {
                isError: true,
                content: [{ type: "text", text: handleError(err) }],
            };
        }
    });
}
//# sourceMappingURL=scout-keywords.js.map