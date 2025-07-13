import { Router } from 'express';
import { createLLMService } from '../services/llm';
import { ollamaUtils } from '../utils/ollama';

const router = Router();

// Get learning recommendations
router.get('/learning', async (req, res) => {
  try {
    // TODO: Analyze skill gaps and generate personalized recommendations
    const recommendations = {
      skillGaps: [],
      suggestedTutorials: [],
      practiceProjects: [],
      learningPath: []
    };

    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate learning insights' });
  }
});

// Get development environment optimization suggestions
router.get('/environment', async (req, res) => {
  try {
    // TODO: Analyze development setup and suggest optimizations
    const optimizations = {
      ideSettings: [],
      extensions: [],
      buildOptimizations: [],
      workflowImprovements: []
    };

    res.json(optimizations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to analyze environment' });
  }
});

// Get code quality insights
router.get('/code-quality', async (req, res) => {
  try {
    // TODO: Integrate with Code Quality MCP server
    const insights = {
      complexity: 0,
      maintainability: 0,
      techDebt: [],
      refactoringSuggestions: []
    };

    res.json(insights);
  } catch (error) {
    res.status(500).json({ error: 'Failed to analyze code quality' });
  }
});

// Test Ollama integration
router.post('/test-ollama', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const llmService = createLLMService();
    const response = await llmService.analyzeProductivity(
      { testData: 'Testing Ollama integration' },
      `User prompt: ${prompt}`
    );

    res.json({
      success: true,
      provider: process.env.LLM_PROVIDER || 'ollama',
      model: process.env.LLM_MODEL || 'llama3.2',
      response: response.content,
      usage: response.usage
    });
  } catch (error) {
    console.error('Ollama test error:', error);
    res.status(500).json({ 
      error: 'Failed to test Ollama integration',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get Ollama status and available models
router.get('/ollama/status', async (req, res) => {
  try {
    const status = await ollamaUtils.checkStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to check Ollama status',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Pull a new model
router.post('/ollama/pull', async (req, res) => {
  try {
    const { model } = req.body;
    
    if (!model) {
      return res.status(400).json({ error: 'Model name is required' });
    }

    await ollamaUtils.pullModel(model);
    res.json({ success: true, message: `Model ${model} pulled successfully` });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to pull model',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get model information
router.get('/ollama/model/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const info = await ollamaUtils.getModelInfo(name);
    res.json(info);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get model info',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export { router as insightsRouter };