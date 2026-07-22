export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}
export interface OpenAIResponse {
    choices: Array<{
        message: {
            content: string;
        };
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
export declare function callOpenAI<T>(messages: ChatMessage[], model?: string, temperature?: number): Promise<T>;
export declare function getCached<T>(key: string): T | undefined;
export declare function setCache(key: string, value: unknown, ttlMs: number): void;
//# sourceMappingURL=openai.d.ts.map