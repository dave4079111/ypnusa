export declare const CHARACTER_LIMIT = 25000;
export declare const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
export declare const DEFAULT_DISCLOSURE: string;
export declare const DEFAULT_SILOS: SiloMap;
export interface SiloChild {
    label: string;
    url: string;
}
export interface SiloPillar {
    label: string;
    children: SiloChild[];
}
export type SiloMap = Record<string, SiloPillar>;
//# sourceMappingURL=constants.d.ts.map