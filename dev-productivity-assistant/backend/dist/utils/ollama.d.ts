export interface OllamaStatus {
    isRunning: boolean;
    version?: string;
    models: string[];
    error?: string;
}
export declare class OllamaUtils {
    private ollama;
    constructor(baseUrl?: string);
    checkStatus(): Promise<OllamaStatus>;
    pullModel(modelName: string): Promise<void>;
    getModelInfo(modelName: string): Promise<import("ollama").ShowResponse>;
    deleteModel(modelName: string): Promise<void>;
    generateEmbedding(text: string, model?: string): Promise<number[]>;
}
export declare const ollamaUtils: OllamaUtils;
//# sourceMappingURL=ollama.d.ts.map