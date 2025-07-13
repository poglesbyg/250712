export type LLMProvider = 'anthropic' | 'openai' | 'ollama';
export interface LLMConfig {
    provider: LLMProvider;
    apiKey?: string;
    model?: string;
    baseUrl?: string;
}
export interface LLMResponse {
    content: string;
    usage?: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    };
}
export interface CodeGenerationRequest {
    type: 'component' | 'api' | 'test' | 'config';
    framework: string;
    name: string;
    description?: string;
    requirements?: string[];
    codebase_context?: string;
}
export interface AnalysisRequest {
    type: 'productivity' | 'learning' | 'optimization';
    data: Record<string, any>;
    context?: string;
}
declare class LLMService {
    private anthropic?;
    private openai?;
    private ollama?;
    private config;
    constructor(config: LLMConfig);
    private initializeProvider;
    generateCode(request: CodeGenerationRequest): Promise<LLMResponse>;
    analyzeProductivity(data: any, context?: string): Promise<LLMResponse>;
    generateLearningInsights(skillData: any, preferences?: any): Promise<LLMResponse>;
    optimizeWorkflow(workflowData: any, goals?: string[]): Promise<LLMResponse>;
    explainCodeQuality(qualityData: any, file?: string): Promise<LLMResponse>;
    complete(prompt: string): Promise<LLMResponse>;
    private buildCodeGenerationPrompt;
    private buildProductivityAnalysisPrompt;
    private buildLearningInsightsPrompt;
    private buildWorkflowOptimizationPrompt;
    private buildCodeQualityExplanationPrompt;
}
export declare function createLLMService(): LLMService;
export {};
//# sourceMappingURL=llm.d.ts.map