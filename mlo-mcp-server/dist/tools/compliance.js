import { z } from "zod";
import { callOpenAI } from "../services/openai.js";
import { handleError } from "../services/errors.js";
const AuditInputSchema = z.object({
    content: z
        .string()
        .min(20, "Content must be at least 20 characters")
        .max(5000, "Content must not exceed 5,000 characters")
        .describe("Social media post, ad copy, or email text to audit for FINRA/CFPB compliance"),
    platform: z
        .enum(["linkedin", "instagram", "facebook", "tiktok", "email", "general"])
        .default("general")
        .describe("Target platform — affects platform-specific compliance rules"),
}).strict();
const COMPLIANCE_SYSTEM = "You are a FINRA and CFPB compliance specialist for mortgage advertising. " +
    "You review social media posts, ads, and email copy for regulatory violations. " +
    "You cite specific rule frameworks where applicable. " +
    "Return ONLY valid JSON.";
function buildAuditPrompt(content, platform) {
    return `Audit this ${platform} post for FINRA/CFPB mortgage advertising compliance.

CHECK FOR:
1. Unsubstantiated superlatives ("best rates", "lowest fees", "guaranteed approval")
2. Missing or inadequate NMLS number (must be present on all advertising)
3. Specific rate or APR claims without required disclosures
4. "Equal Housing Lender" logo/statement missing (required on all ads)
5. Misleading comparisons or fabricated urgency
6. Testimonials that imply typical results
7. Missing licensing state disclosures if state-specific claims are made
8. Language that discriminates by protected class under ECOA/FHA

CONTENT TO AUDIT:
${content}

Return ONLY valid JSON:
{
  "passed": boolean,        // true only if zero critical flags
  "score": number,          // 0–100 compliance score
  "flags": [
    {
      "issue": string,      // Short issue name
      "severity": "critical" | "warning" | "suggestion",
      "excerpt": string,    // Exact text excerpt causing the issue
      "fix": string         // Specific rewrite or fix recommendation
    }
  ],
  "summary": string,        // 1-2 sentence overall assessment
  "safe_to_post": boolean   // true only if passed=true and score>=80
}`;
}
export function registerCompliance(server) {
    server.registerTool("mlo_audit_compliance", {
        title: "Audit Post for FINRA/CFPB Compliance",
        description: `Audit social media copy, ad text, or email content for FINRA and CFPB mortgage advertising compliance.

Flags issues in three severity tiers:
- critical: must fix before posting (unsubstantiated claims, missing NMLS, APR without disclosure)
- warning: likely non-compliant, fix recommended
- suggestion: best-practice improvement

Returns a 0–100 compliance score and a safe_to_post boolean.

Args:
  - content (string, 20–5000 chars): The post, ad, or email text to audit
  - platform ("linkedin"|"instagram"|"facebook"|"tiktok"|"email"|"general", default "general"): Target platform

Returns JSON:
{
  "passed": boolean,       // Zero critical flags
  "score": number,         // 0–100 compliance score
  "flags": [
    {
      "issue": string,     // e.g. "Missing NMLS number"
      "severity": "critical" | "warning" | "suggestion",
      "excerpt": string,   // Problematic text excerpt
      "fix": string        // Specific fix recommendation
    }
  ],
  "summary": string,       // 1-2 sentence overall assessment
  "safe_to_post": boolean  // true only if score ≥ 80 and passed=true
}

Examples:
  - Audit a LinkedIn post about rate predictions → check for unsubstantiated rate claims
  - Audit an Instagram caption → check for missing NMLS and Equal Housing Lender
  - Audit generated content from mlo_generate_content before posting

Error cases:
  - "Content must be at least 20 characters" → provide more content to audit`,
        inputSchema: AuditInputSchema,
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: true,
        },
    }, async (params) => {
        try {
            const result = await callOpenAI([
                { role: "system", content: COMPLIANCE_SYSTEM },
                { role: "user", content: buildAuditPrompt(params.content, params.platform) },
            ], "gpt-4o-mini", 0.2 // Low temperature for consistent compliance analysis
            );
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                structuredContent: result,
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
//# sourceMappingURL=compliance.js.map