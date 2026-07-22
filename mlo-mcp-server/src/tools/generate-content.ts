import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callOpenAI } from "../services/openai.js";
import { handleError } from "../services/errors.js";
import { DEFAULT_DISCLOSURE } from "../constants.js";

const InputSchema = z.object({
  article: z
    .string()
    .min(50, "Article must be at least 50 characters")
    .max(8000, "Article must not exceed 8,000 characters")
    .describe("Raw article, newsletter, or market update text to repurpose into social posts"),
  disclosure: z
    .string()
    .max(1000)
    .optional()
    .describe(
      "Override the compliance disclosure footer. Omit to use the server default. " +
      "Must include NMLS number and Equal Housing Lender language."
    ),
  tone_notes: z
    .string()
    .max(300)
    .optional()
    .describe(
      "Optional tone guidance appended to each generation prompt, e.g. " +
      "'Keep it casual, avoid jargon' or 'Target first-time homebuyers.'"
    ),
  model: z
    .enum(["gpt-4o-mini", "gpt-4o"])
    .default("gpt-4o-mini")
    .describe("OpenAI model to use. gpt-4o produces higher quality at higher cost."),
}).strict();

type Input = z.infer<typeof InputSchema>;

interface GeneratedPosts {
  linkedin: string;
  instagram: string;
  tiktok: string;
}

const SYSTEM_PROMPT =
  "You are a licensed mortgage marketing specialist who writes FINRA/CFPB-compliant " +
  "social media content for Loan Officers. " +
  "You write in plain, engaging language. " +
  "You NEVER make promises about guaranteed rates, guaranteed approvals, or specific loan terms. " +
  "You NEVER use superlatives like 'best' or 'cheapest' without substantiation. " +
  "You NEVER fabricate market data — only use data present in the provided article. " +
  "Return ONLY valid JSON.";

function buildUserPrompt(article: string, toneNotes?: string): string {
  const toneClause = toneNotes ? `\n\nTone guidance: ${toneNotes}` : "";
  return `Based on this article, generate three distinct social media posts for a Mortgage Loan Officer.

Return ONLY valid JSON with exactly these keys: linkedin, instagram, tiktok.

POST RULES:
- linkedin: 150–300 words. Professional, educational, thought-leader tone. 2–3 relevant hashtags. No emojis in body.
- instagram: 80–150 words. Conversational, warm, relatable. 5–8 hashtags. 1–2 emojis allowed. End with a soft CTA.
- tiktok: 30–45 second spoken script with [VISUAL CUE] stage directions in brackets at key moments. Strong hook in first 3 seconds. One clear CTA at end.

Do NOT include any compliance disclosure — it is appended separately.
Do NOT invent statistics or rates not present in the article.
${toneClause}

ARTICLE:
${article}`;
}

export function registerGenerateContent(server: McpServer): void {
  server.registerTool(
    "mlo_generate_content",
    {
      title: "Generate Compliant Social Posts",
      description: `Convert a mortgage article or newsletter into three platform-optimized, FINRA/CFPB-compliant social media posts (LinkedIn, Instagram, TikTok/Reel script).

Each post is tailored to platform norms and has a mandatory compliance disclosure appended. The tool never fabricates market data — it only uses facts present in the input article.

Args:
  - article (string, 50–8000 chars): Raw article, newsletter, or market update text
  - disclosure (string, optional): Override compliance footer. Default includes NMLS placeholder text.
  - tone_notes (string, optional): Tone guidance, e.g. "casual, avoid jargon" or "target first-time buyers"
  - model ("gpt-4o-mini" | "gpt-4o", default "gpt-4o-mini"): OpenAI model

Returns JSON:
{
  "linkedin":   string,   // Full LinkedIn post with disclosure appended
  "instagram":  string,   // Full Instagram caption with hashtags and disclosure
  "tiktok":     string,   // Full TikTok/Reel script with stage directions and disclosure
  "disclosure_used": string  // The exact disclosure appended
}

Examples:
  - Paste a weekly rate update email → get 3 ready-to-post pieces of content
  - Paste a lender bulletin about a new DPA program → get education-focused posts
  - Don't use for content unrelated to mortgage/real estate (use a general writing tool instead)

Error cases:
  - "OPENAI_API_KEY environment variable is not set" → set the env var
  - "Article must be at least 50 characters" → provide more content
  - "OpenAI rate limit exceeded" → wait and retry`,
      inputSchema: InputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: Input) => {
      try {
        const disclosureText = params.disclosure ?? DEFAULT_DISCLOSURE;

        const posts = await callOpenAI<GeneratedPosts>(
          [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user",   content: buildUserPrompt(params.article, params.tone_notes) },
          ],
          params.model,
          0.7
        );

        if (!posts.linkedin || !posts.instagram || !posts.tiktok) {
          throw new Error(
            "Generated response is missing one or more post fields (linkedin, instagram, tiktok)."
          );
        }

        const result = {
          linkedin:        posts.linkedin  + "\n\n" + disclosureText,
          instagram:       posts.instagram + "\n\n" + disclosureText,
          tiktok:          posts.tiktok    + "\n\n" + disclosureText,
          disclosure_used: disclosureText,
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: handleError(err) }],
        };
      }
    }
  );
}
