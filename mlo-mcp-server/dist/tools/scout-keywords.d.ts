import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export interface Keyword {
    keyword: string;
    intent: "Informational" | "Commercial" | "Transactional" | "Navigational";
    difficulty: "Easy" | "Medium" | "Hard";
    angle: string;
}
export declare function registerScoutKeywords(server: McpServer): void;
//# sourceMappingURL=scout-keywords.d.ts.map