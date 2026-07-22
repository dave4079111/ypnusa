#!/usr/bin/env node
/**
 * YPNUS MLO MCP Server
 *
 * Provides five tools for Mortgage Loan Officer content operations:
 *   mlo_generate_content  — article → 3 compliant social posts
 *   mlo_scout_keywords    — topic → long-tail keyword ideas
 *   mlo_audit_compliance  — post → FINRA/CFPB compliance audit
 *   mlo_get_silo_nav      — URL path → breadcrumb + sibling nav data
 *   mlo_list_silos        — full silo map
 *   mlo_plan_silos        — AI-generated silo architecture
 *
 * Transport: stdio (default) or streamable HTTP (TRANSPORT=http PORT=3000)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { registerGenerateContent } from "./tools/generate-content.js";
import { registerScoutKeywords } from "./tools/scout-keywords.js";
import { registerSiloNav } from "./tools/silo-nav.js";
import { registerCompliance } from "./tools/compliance.js";
// ── Server init ─────────────────────────────────────────────────────────────
const server = new McpServer({
    name: "mlo-mcp-server",
    version: "1.0.0",
});
// Register all tools
registerGenerateContent(server);
registerScoutKeywords(server);
registerCompliance(server);
registerSiloNav(server);
// ── Transports ───────────────────────────────────────────────────────────────
async function runStdio() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("[mlo-mcp-server] Running via stdio");
}
async function runHTTP() {
    const app = express();
    app.use(express.json());
    // Health check
    app.get("/health", (_req, res) => {
        res.json({ status: "ok", server: "mlo-mcp-server", version: "1.0.0" });
    });
    // MCP endpoint — new transport per request (stateless)
    app.post("/mcp", async (req, res) => {
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true,
        });
        res.on("close", () => transport.close());
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    });
    const port = parseInt(process.env.PORT ?? "3000", 10);
    app.listen(port, "127.0.0.1", () => {
        console.error(`[mlo-mcp-server] HTTP transport listening on http://127.0.0.1:${port}/mcp`);
        console.error(`[mlo-mcp-server] Health check: http://127.0.0.1:${port}/health`);
    });
}
// ── Entry point ──────────────────────────────────────────────────────────────
const transport = process.env.TRANSPORT ?? "stdio";
if (transport === "http") {
    runHTTP().catch((err) => {
        console.error("[mlo-mcp-server] Fatal error:", err);
        process.exit(1);
    });
}
else {
    runStdio().catch((err) => {
        console.error("[mlo-mcp-server] Fatal error:", err);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map