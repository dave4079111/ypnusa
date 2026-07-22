export const CHARACTER_LIMIT = 25_000;
export const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
export const DEFAULT_DISCLOSURE = "NMLS #{NMLS_NUMBER} | {COMPANY_NAME} | Equal Housing Lender | " +
    "This is not a commitment to lend. Rates and terms subject to change without notice. " +
    "All loans subject to credit approval. " +
    "For licensing information, visit nmlsconsumeraccess.org.";
// Default silo structure for ypnus.com
export const DEFAULT_SILOS = {
    "/mlo-marketing": {
        label: "MLO Marketing",
        children: [
            { label: "Lead Generation", url: "/mlo-marketing/lead-generation/" },
            { label: "Compliance Tools", url: "/mlo-marketing/compliance-tools/" },
            { label: "Social Content", url: "/mlo-marketing/social-content/" },
        ],
    },
    "/mortgage-compliance": {
        label: "Mortgage Compliance",
        children: [
            { label: "Social Media Rules", url: "/mortgage-compliance/social-media-rules/" },
            { label: "NMLS Requirements", url: "/mortgage-compliance/nmls-requirements/" },
            { label: "Advertising Disclosures", url: "/mortgage-compliance/advertising-disclosures/" },
        ],
    },
    "/ai-marketing-tools": {
        label: "AI Marketing Tools",
        children: [
            { label: "Content Generator", url: "/ai-marketing-tools/content-generator/" },
            { label: "Keyword Scout", url: "/ai-marketing-tools/keyword-scout/" },
            { label: "Silo Planner", url: "/ai-marketing-tools/silo-planner/" },
        ],
    },
};
//# sourceMappingURL=constants.js.map