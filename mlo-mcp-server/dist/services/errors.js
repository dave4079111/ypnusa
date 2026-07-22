import { AxiosError } from "axios";
import { ZodError } from "zod";
export function handleError(error) {
    if (error instanceof ZodError) {
        const issues = error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
        return `Validation error — ${issues}`;
    }
    if (error instanceof AxiosError) {
        if (error.response) {
            switch (error.response.status) {
                case 404: return "Error: Resource not found. Verify the identifier and try again.";
                case 403: return "Error: Permission denied. Check your API key or credentials.";
                case 429: return "Error: Rate limit hit. Wait a moment before retrying.";
                default: return `Error: API request failed with HTTP ${error.response.status}.`;
            }
        }
        if (error.code === "ECONNABORTED")
            return "Error: Request timed out. Retry in a moment.";
        return `Error: Network failure — ${error.message}`;
    }
    if (error instanceof Error)
        return `Error: ${error.message}`;
    return `Error: ${String(error)}`;
}
//# sourceMappingURL=errors.js.map