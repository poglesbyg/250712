import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { Ollama } from 'ollama';
import { z } from 'zod';

export type LLMProvider = 'anthropic' | 'openai' | 'ollama';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey?: string;
  model?: string;
  baseUrl?: string; // For Ollama
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

class LLMService {
  private anthropic?: Anthropic;
  private openai?: OpenAI;
  private ollama?: Ollama;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.initializeProvider();
  }

  private initializeProvider() {
    switch (this.config.provider) {
      case 'anthropic':
        if (!this.config.apiKey) {
          throw new Error('ANTHROPIC_API_KEY is required for Anthropic provider');
        }
        this.anthropic = new Anthropic({
          apiKey: this.config.apiKey,
        });
        break;
      case 'openai':
        if (!this.config.apiKey) {
          throw new Error('OPENAI_API_KEY is required for OpenAI provider');
        }
        this.openai = new OpenAI({
          apiKey: this.config.apiKey,
        });
        break;
      case 'ollama':
        this.ollama = new Ollama({
          host: this.config.baseUrl || 'http://localhost:11434',
        });
        break;
      default:
        throw new Error(`Unsupported LLM provider: ${this.config.provider}`);
    }
  }

  async generateCode(request: CodeGenerationRequest): Promise<LLMResponse> {
    const prompt = this.buildCodeGenerationPrompt(request);
    return this.complete(prompt);
  }

  async analyzeProductivity(data: any, context?: string): Promise<LLMResponse> {
    const prompt = this.buildProductivityAnalysisPrompt(data, context);
    return this.complete(prompt);
  }

  async generateLearningInsights(skillData: any, preferences?: any): Promise<LLMResponse> {
    const prompt = this.buildLearningInsightsPrompt(skillData, preferences);
    return this.complete(prompt);
  }

  async optimizeWorkflow(workflowData: any, goals?: string[]): Promise<LLMResponse> {
    const prompt = this.buildWorkflowOptimizationPrompt(workflowData, goals);
    return this.complete(prompt);
  }

  async explainCodeQuality(qualityData: any, file?: string): Promise<LLMResponse> {
    const prompt = this.buildCodeQualityExplanationPrompt(qualityData, file);
    return this.complete(prompt);
  }

  private async complete(prompt: string): Promise<LLMResponse> {
    try {
      if (this.config.provider === 'anthropic' && this.anthropic) {
        const response = await this.anthropic.messages.create({
          model: this.config.model || 'claude-3-haiku-20240307',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        });

        const content = response.content[0];
        if (content.type === 'text') {
          return {
            content: content.text,
            usage: {
              inputTokens: response.usage.input_tokens,
              outputTokens: response.usage.output_tokens,
              totalTokens: response.usage.input_tokens + response.usage.output_tokens,
            },
          };
        }
        throw new Error('Unexpected response format from Anthropic');
      }

      if (this.config.provider === 'openai' && this.openai) {
        const response = await this.openai.chat.completions.create({
          model: this.config.model || 'gpt-4',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        });

        const choice = response.choices[0];
        if (choice.message.content) {
          return {
            content: choice.message.content,
            usage: response.usage ? {
              inputTokens: response.usage.prompt_tokens,
              outputTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            } : undefined,
          };
        }
        throw new Error('No content in OpenAI response');
      }

      if (this.config.provider === 'ollama' && this.ollama) {
        const response = await this.ollama.chat({
          model: this.config.model || 'llama3.2',
          messages: [{ role: 'user', content: prompt }],
          stream: false,
        });

        if (response.message && response.message.content) {
          return {
            content: response.message.content,
            usage: {
              inputTokens: response.prompt_eval_count || 0,
              outputTokens: response.eval_count || 0,
              totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
            },
          };
        }
        throw new Error('No content in Ollama response');
      }

      throw new Error('No LLM provider configured');
    } catch (error) {
      throw new Error(`LLM request failed: ${error}`);
    }
  }

  private buildCodeGenerationPrompt(request: CodeGenerationRequest): string {
    return `Generate ${request.type} code for a ${request.framework} project.

Name: ${request.name}
${request.description ? `Description: ${request.description}` : ''}
${request.requirements ? `Requirements:\n${request.requirements.map(r => `- ${r}`).join('\n')}` : ''}
${request.codebase_context ? `\nCodebase Context:\n${request.codebase_context}` : ''}

Please generate clean, well-documented code that follows best practices for ${request.framework}. Include:
1. Main implementation
2. Type definitions (if TypeScript)
3. Brief usage example
4. List of any dependencies needed

Format the response as JSON with the following structure:
{
  "files": [{"path": "...", "content": "..."}],
  "dependencies": ["..."],
  "usage": "...",
  "notes": "..."
}`;
  }

  private buildProductivityAnalysisPrompt(data: any, context?: string): string {
    return `Analyze the following developer productivity data and provide insights:

Data: ${JSON.stringify(data, null, 2)}
${context ? `\nContext: ${context}` : ''}

Please provide:
1. Key productivity insights
2. Patterns and trends identified
3. Areas for improvement
4. Specific actionable recommendations
5. Productivity score (1-100) with reasoning

Focus on practical advice that can help improve development efficiency and work-life balance.`;
  }

  private buildLearningInsightsPrompt(skillData: any, preferences?: any): string {
    return `Analyze skill development data and generate personalized learning recommendations:

Skill Data: ${JSON.stringify(skillData, null, 2)}
${preferences ? `\nPreferences: ${JSON.stringify(preferences, null, 2)}` : ''}

Please provide:
1. Skill gap analysis
2. Personalized learning path
3. Recommended resources (tutorials, courses, projects)
4. Timeline estimates for skill acquisition
5. Priority ranking of skills to learn

Tailor recommendations based on current skill level and career goals.`;
  }

  private buildWorkflowOptimizationPrompt(workflowData: any, goals?: string[]): string {
    return `Analyze development workflow and suggest optimizations:

Workflow Data: ${JSON.stringify(workflowData, null, 2)}
${goals ? `\nGoals: ${goals.join(', ')}` : ''}

Please provide:
1. Current workflow analysis
2. Bottlenecks and inefficiencies identified
3. Optimization recommendations
4. Tool suggestions
5. Process improvements
6. Estimated time savings

Focus on practical changes that can be implemented immediately.`;
  }

  private buildCodeQualityExplanationPrompt(qualityData: any, file?: string): string {
    return `Explain code quality metrics and provide improvement guidance:

Quality Data: ${JSON.stringify(qualityData, null, 2)}
${file ? `\nFile: ${file}` : ''}

Please provide:
1. Explanation of quality metrics in plain language
2. What the numbers mean for code maintainability
3. Specific improvement suggestions
4. Priority ranking of issues to fix
5. Best practices to prevent similar issues

Make explanations accessible to developers of all experience levels.`;
  }
}

// Factory function to create LLM service instance
export function createLLMService(): LLMService {
  const provider = (process.env.LLM_PROVIDER as LLMProvider) || 'ollama';
  
  let apiKey: string | undefined;
  if (provider === 'anthropic') {
    apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required for Anthropic provider');
    }
  } else if (provider === 'openai') {
    apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required for OpenAI provider');
    }
  }

  return new LLMService({
    provider,
    apiKey,
    model: process.env.LLM_MODEL,
    baseUrl: process.env.OLLAMA_BASE_URL,
  });
}