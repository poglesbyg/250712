"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ollamaUtils = exports.OllamaUtils = void 0;
const ollama_1 = require("ollama");
class OllamaUtils {
    constructor(baseUrl = 'http://localhost:11434') {
        this.ollama = new ollama_1.Ollama({ host: baseUrl });
    }
    async checkStatus() {
        try {
            // Check if Ollama is running by trying to list models
            const models = await this.ollama.list();
            return {
                isRunning: true,
                models: models.models.map(model => model.name),
            };
        }
        catch (error) {
            return {
                isRunning: false,
                models: [],
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    async pullModel(modelName) {
        try {
            await this.ollama.pull({ model: modelName });
        }
        catch (error) {
            throw new Error(`Failed to pull model ${modelName}: ${error}`);
        }
    }
    async getModelInfo(modelName) {
        try {
            return await this.ollama.show({ model: modelName });
        }
        catch (error) {
            throw new Error(`Failed to get model info for ${modelName}: ${error}`);
        }
    }
    async deleteModel(modelName) {
        try {
            await this.ollama.delete({ model: modelName });
        }
        catch (error) {
            throw new Error(`Failed to delete model ${modelName}: ${error}`);
        }
    }
    async generateEmbedding(text, model = 'nomic-embed-text') {
        try {
            const response = await this.ollama.embeddings({
                model,
                prompt: text,
            });
            return response.embedding;
        }
        catch (error) {
            throw new Error(`Failed to generate embedding: ${error}`);
        }
    }
}
exports.OllamaUtils = OllamaUtils;
exports.ollamaUtils = new OllamaUtils(process.env.OLLAMA_BASE_URL);
//# sourceMappingURL=ollama.js.map