import { Ollama } from 'ollama';

export interface OllamaStatus {
  isRunning: boolean;
  version?: string;
  models: string[];
  error?: string;
}

export class OllamaUtils {
  private ollama: Ollama;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.ollama = new Ollama({ host: baseUrl });
  }

  async checkStatus(): Promise<OllamaStatus> {
    try {
      // Check if Ollama is running by trying to list models
      const models = await this.ollama.list();
      
      return {
        isRunning: true,
        models: models.models.map(model => model.name),
      };
    } catch (error) {
      return {
        isRunning: false,
        models: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async pullModel(modelName: string): Promise<void> {
    try {
      await this.ollama.pull({ model: modelName });
    } catch (error) {
      throw new Error(`Failed to pull model ${modelName}: ${error}`);
    }
  }

  async getModelInfo(modelName: string) {
    try {
      return await this.ollama.show({ model: modelName });
    } catch (error) {
      throw new Error(`Failed to get model info for ${modelName}: ${error}`);
    }
  }

  async deleteModel(modelName: string): Promise<void> {
    try {
      await this.ollama.delete({ model: modelName });
    } catch (error) {
      throw new Error(`Failed to delete model ${modelName}: ${error}`);
    }
  }

  async generateEmbedding(text: string, model: string = 'nomic-embed-text'): Promise<number[]> {
    try {
      const response = await this.ollama.embeddings({
        model,
        prompt: text,
      });
      return response.embedding;
    } catch (error) {
      throw new Error(`Failed to generate embedding: ${error}`);
    }
  }
}

export const ollamaUtils = new OllamaUtils(process.env.OLLAMA_BASE_URL); 