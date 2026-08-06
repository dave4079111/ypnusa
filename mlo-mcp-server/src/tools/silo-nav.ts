import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DEFAULT_SILOS, SiloMap, SiloPillar } from "../constants.js";
import { handleError } from "../services/errors.js";

const GetNavInputSchema = z.object({
  path: z
    .string()
    .min(1)
    .describe("URL path to match against silo prefixes, e.g. '/mlo-marketing/lead-generation/'"),
  page_title: z
    .string()
    .max(200)
    .optional()
    .describe("Current page title, used in the breadcrumb. Omit for pillar-level pages."),
}).strict();

const ListSilosInputSchema = z.object({
  response_format: z
    .enum(["json", "markdown"])
    .default("json")
    .describe("'json' for structured data, 'markdown' for human-readable outline"),
}).strict();

const PlanSiloInputSchema = z.object({
  niche: z
    .string()
    .min(5)
    .max(300)
    .describe("Describe your site's niche or target audience, e.g. 'Mortgage Loan Officer marketing for FHA/VA/conventional'"),
  pillar_count: z
    .number()
    .int()
    .min(2)
    .max(6)
    .default(3)
    .describe("Number of top-level silo pillars to generate (2–6)"),
  child_count: z
    .number()
    .int()
    .min(2)
    .max(8)
    .default(4)
    .describe("Number of child pages per pillar (2–8)"),
}).strict();

type GetNavInput   = z.infer<typeof GetNavInputSchema>;
type ListSilosInput = z.infer<typeof ListSilosInputSchema>;
type PlanSiloInput = z.infer<typeof PlanSiloInputSchema>;

function getSiloMap(): SiloMap {
  const envSilos = process.env.SILO_MAP_JSON;
  if (envSilos) {
    try {
      return JSON.parse(envSilos) as SiloMap;
    } catch {
      // Fall back to default if env value is malformed
    }
  }
  return DEFAULT_SILOS;
}

function matchSilo(path: string, silos: SiloMap): [string, SiloPillar] | null {
  const normalised = path.replace(/\/+$/, "").toLowerCase();
  for (const [prefix, pillar] of Object.entries(silos)) {
    if (normalised.startsWith(prefix.toLowerCase())) {
      return [prefix, pillar];
    }
  }
  return null;
}

function silosToMarkdown(silos: SiloMap): string {
  const lines: string[] = ["# Silo Structure", ""];
  for (const [prefix, pillar] of Object.entries(silos)) {
    lines.push(`## ${pillar.label} (${prefix}/)`);
    for (const child of pillar.children) {
      lines.push(`  - [${child.label}](${child.url})`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

export function registerSiloNav(server: McpServer): void {
  // Tool 1: Resolve a URL path → nav data
  server.registerTool(
    "mlo_get_silo_nav",
    {
      title: "Get Silo Navigation for URL",
      description: `Resolve a URL path against the configured silo structure and return the breadcrumb + sibling navigation data for that page.

Use this to programmatically generate navigation HTML, validate that a URL falls within a silo, or feed nav data into a WordPress block/shortcode renderer.

Args:
  - path (string): URL path, e.g. "/mlo-marketing/lead-generation/" or "/mortgage-compliance/"
  - page_title (string, optional): Current page title for the breadcrumb leaf node

Returns JSON:
{
  "matched": boolean,          // false if path doesn't belong to any silo
  "pillar_label": string,      // e.g. "MLO Marketing"
  "pillar_url": string,        // e.g. "/mlo-marketing/"
  "breadcrumb": [              // Ordered breadcrumb items
    { "label": string, "url": string | null }  // null url = current page (no link)
  ],
  "siblings": [                // Other pages in the same silo pillar
    { "label": string, "url": string, "is_current": boolean }
  ]
}

Examples:
  - "/mlo-marketing/lead-generation/" → breadcrumb Home > MLO Marketing > Lead Generation + siblings
  - "/unknown-path/" → { matched: false }

Error cases:
  - "path must be at least 1 character" → provide a valid path`,
      inputSchema: GetNavInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: GetNavInput) => {
      try {
        const silos = getSiloMap();
        const match = matchSilo(params.path, silos);

        if (!match) {
          const result = { matched: false };
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
            structuredContent: result,
          };
        }

        const [prefix, pillar] = match;
        const pillarUrl = prefix + "/";
        const normPath = params.path.replace(/\/+$/, "") + "/";

        const breadcrumb = [
          { label: "Home",         url: "/" },
          { label: pillar.label,   url: pillarUrl },
        ];

        if (params.page_title) {
          breadcrumb.push({ label: params.page_title, url: null as unknown as string });
        }

        const siblings = pillar.children.map(child => ({
          label:      child.label,
          url:        child.url,
          is_current: child.url.replace(/\/+$/, "/") === normPath.replace(/\/+$/, "/"),
        }));

        const result = {
          matched:      true,
          pillar_label: pillar.label,
          pillar_url:   pillarUrl,
          breadcrumb,
          siblings,
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

  // Tool 2: List the full silo map
  server.registerTool(
    "mlo_list_silos",
    {
      title: "List Silo Structure",
      description: `Return the full configured silo map — all pillar prefixes, labels, and child pages.

Use this to audit the current silo structure, populate a settings UI, or verify coverage before publishing new content.

The silo map is loaded from the SILO_MAP_JSON environment variable if set, otherwise falls back to the default YPNUS structure.

Args:
  - response_format ("json"|"markdown", default "json"): Output format

Returns JSON (default):
{
  "pillars": [
    {
      "prefix": string,    // URL prefix, e.g. "/mlo-marketing"
      "label": string,     // Human label, e.g. "MLO Marketing"
      "children": [
        { "label": string, "url": string }
      ]
    }
  ],
  "total_pillars": number,
  "total_pages": number
}`,
      inputSchema: ListSilosInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: ListSilosInput) => {
      try {
        const silos = getSiloMap();

        if (params.response_format === "markdown") {
          return {
            content: [{ type: "text" as const, text: silosToMarkdown(silos) }],
          };
        }

        const pillars = Object.entries(silos).map(([prefix, pillar]) => ({
          prefix,
          label:    pillar.label,
          children: pillar.children,
        }));

        const result = {
          pillars,
          total_pillars: pillars.length,
          total_pages:   pillars.reduce((acc, p) => acc + p.children.length, 0),
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

  // Tool 3: AI-powered silo planner
  server.registerTool(
    "mlo_plan_silos",
    {
      title: "AI Silo Planner",
      description: `Generate a recommended topic-silo architecture for a mortgage or real estate website using AI.

Returns a JSON silo map ready to paste into the SILO_MAP_JSON environment variable or WordPress plugin settings. Each pillar and child page includes an SEO-optimized URL slug and a one-line content brief.

Args:
  - niche (string, 5–300 chars): Site niche + audience, e.g. "Mortgage Loan Officer marketing for FHA/VA/conventional in Texas"
  - pillar_count (number, 2–6, default 3): Number of top-level silo pillars
  - child_count (number, 2–8, default 4): Child pages per pillar

Returns JSON:
{
  "silo_map": {             // Ready to use as SILO_MAP_JSON env value
    "/slug": {
      "label": string,
      "children": [{ "label": string, "url": string }]
    }
  },
  "briefs": {               // Content brief for each page
    "/slug": string,
    "/slug/child": string
  },
  "internal_linking_rules": string[]  // Thematic wall rules for this silo
}

Examples:
  - niche="FHA/VA mortgage officer in Phoenix", pillar_count=3 → 3-pillar silo with Phoenix-market focus
  - niche="jumbo loan specialist for high-net-worth buyers", pillar_count=4 → luxury-segment silo

Error cases:
  - "niche must be at least 5 characters" → provide a more detailed niche description`,
      inputSchema: PlanSiloInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: PlanSiloInput) => {
      try {
        const { callOpenAI: ai } = await import("../services/openai.js");

        const prompt = `You are an SEO architect specializing in mortgage and real estate websites.

Design a topic silo structure for this site niche: "${params.niche}"

Rules:
- ${params.pillar_count} top-level silo pillars
- ${params.child_count} child pages per pillar
- URL slugs must be lowercase, hyphenated, no trailing slashes in child URLs
- Pillar pages cover broad topics; child pages are narrower subtopics
- No cross-silo internal linking — each pillar is a thematic wall
- Bias toward buyer-intent and informational content types

Return ONLY valid JSON with these top-level keys:
1. silo_map: object where each key is a URL prefix (e.g. "/mlo-marketing") and value is { "label": string, "children": [{"label": string, "url": string}] }
2. briefs: object mapping each full URL path to a 1-sentence content brief
3. internal_linking_rules: array of strings describing the thematic wall rules for this architecture`;

        const result = await ai(
          [{ role: "user", content: prompt }],
          "gpt-4o-mini",
          0.6
        );

        const text = JSON.stringify(result, null, 2);
        return {
          content: [{ type: "text" as const, text }],
          structuredContent: result as Record<string, unknown>,
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
