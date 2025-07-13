import { Router } from 'express';
import { z } from 'zod';
import { createLLMService } from '../services/llm';
import { mcpClient } from '../services/mcp-client';
import simpleGit from 'simple-git';
import { readFileSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

const router = Router();
const llmService = createLLMService();

const insightRequestSchema = z.object({
  type: z.enum(['productivity', 'code_quality', 'patterns', 'recommendations', 'anomalies']),
  timeRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime()
  }).optional(),
  projectPath: z.string().optional(),
  context: z.string().optional()
});

const codeAnalysisSchema = z.object({
  files: z.array(z.string()).optional(),
  projectPath: z.string().optional(),
  analysisType: z.enum(['complexity', 'patterns', 'smells', 'security', 'performance']).optional()
});

interface InsightResult {
  type: string;
  confidence: number;
  summary: string;
  details: any;
  recommendations: string[];
  actionItems: Array<{
    priority: 'high' | 'medium' | 'low';
    action: string;
    impact: string;
    effort: string;
  }>;
  timestamp: string;
}

interface CodeAnalysisResult {
  file: string;
  issues: Array<{
    type: string;
    severity: 'error' | 'warning' | 'info';
    line: number;
    message: string;
    suggestion: string;
  }>;
  metrics: {
    complexity: number;
    maintainability: number;
    testability: number;
    performance: number;
  };
  patterns: string[];
}

// Generate AI-powered insights
router.post('/generate', async (req, res) => {
  try {
    const { type, timeRange, projectPath, context } = insightRequestSchema.parse(req.body);
    
    const repoPath = projectPath || process.cwd();
    const startDate = timeRange?.start ? new Date(timeRange.start) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = timeRange?.end ? new Date(timeRange.end) : new Date();

    const insight = await generateInsight(type, repoPath, startDate, endDate, context);
    
    res.json(insight);
  } catch (error) {
    console.error('Error generating insights:', error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

// Analyze code quality with AI
router.post('/analyze-code', async (req, res) => {
  try {
    const { files, projectPath, analysisType } = codeAnalysisSchema.parse(req.body);
    
    const repoPath = projectPath || process.cwd();
    const analysis = await analyzeCodeWithAI(repoPath, files, analysisType || 'complexity');
    
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing code:', error);
    res.status(500).json({ error: 'Failed to analyze code' });
  }
});

// Get productivity recommendations
router.get('/recommendations', async (req, res) => {
  try {
    const { projectPath } = req.query;
    const repoPath = (projectPath as string) || process.cwd();
    
    const recommendations = await generateProductivityRecommendations(repoPath);
    
    res.json(recommendations);
  } catch (error) {
    console.error('Error generating recommendations:', error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

// Detect anomalies in development patterns
router.get('/anomalies', async (req, res) => {
  try {
    const { projectPath, days } = req.query;
    const repoPath = (projectPath as string) || process.cwd();
    const analyzeDays = parseInt(days as string) || 30;
    
    const anomalies = await detectAnomalies(repoPath, analyzeDays);
    
    res.json(anomalies);
  } catch (error) {
    console.error('Error detecting anomalies:', error);
    res.status(500).json({ error: 'Failed to detect anomalies' });
  }
});

// Get learning insights and skill gaps
router.get('/learning', async (req, res) => {
  try {
    const { projectPath } = req.query;
    const repoPath = (projectPath as string) || process.cwd();
    
    const learningInsights = await generateLearningInsights(repoPath);
    
    res.json(learningInsights);
  } catch (error) {
    console.error('Error generating learning insights:', error);
    res.status(500).json({ error: 'Failed to generate learning insights' });
  }
});

// Test Ollama integration
router.post('/test-ollama', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const response = await llmService.complete(prompt);
    
    res.json({
      response: response.content,
      usage: response.usage
    });
  } catch (error) {
    console.error('Error testing Ollama:', error);
    res.status(500).json({ error: 'Failed to test Ollama integration' });
  }
});

async function generateInsight(
  type: string,
  projectPath: string,
  startDate: Date,
  endDate: Date,
  context?: string
): Promise<InsightResult> {
  try {
    let analysisData: any = {};
    
    // Gather relevant data based on insight type
    switch (type) {
      case 'productivity':
        analysisData = await gatherProductivityData(projectPath, startDate, endDate);
        break;
      case 'code_quality':
        analysisData = await gatherCodeQualityData(projectPath);
        break;
      case 'patterns':
        analysisData = await gatherPatternData(projectPath, startDate, endDate);
        break;
      case 'recommendations':
        analysisData = await gatherRecommendationData(projectPath);
        break;
      case 'anomalies':
        analysisData = await gatherAnomalyData(projectPath, startDate, endDate);
        break;
    }

    // Generate AI analysis
    const aiAnalysis = await generateAIAnalysis(type, analysisData, context);
    
    return {
      type,
      confidence: aiAnalysis.confidence,
      summary: aiAnalysis.summary,
      details: aiAnalysis.details,
      recommendations: aiAnalysis.recommendations,
      actionItems: aiAnalysis.actionItems,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error generating insight:', error);
    throw error;
  }
}

async function gatherProductivityData(projectPath: string, startDate: Date, endDate: Date) {
  const git = simpleGit(projectPath);
  
  try {
    const log = await git.log({
      from: startDate.toISOString(),
      to: endDate.toISOString(),
      maxCount: 1000
    });

    const commitsByDay = new Map<string, number>();
    const commitsByHour = new Array(24).fill(0);
    const commitMessages = [];

    for (const commit of log.all) {
      const date = new Date(commit.date);
      const dayKey = date.toISOString().split('T')[0];
      const hour = date.getHours();
      
      commitsByDay.set(dayKey, (commitsByDay.get(dayKey) || 0) + 1);
      commitsByHour[hour]++;
      commitMessages.push(commit.message);
    }

    return {
      totalCommits: log.all.length,
      commitsByDay: Array.from(commitsByDay.entries()),
      commitsByHour,
      commitMessages,
      averageCommitsPerDay: log.all.length / Math.max(1, commitsByDay.size),
      workingDays: commitsByDay.size,
      peakHour: commitsByHour.indexOf(Math.max(...commitsByHour)),
      dateRange: { start: startDate, end: endDate }
    };
  } catch (error) {
    return { error: 'Failed to gather productivity data' };
  }
}

async function gatherCodeQualityData(projectPath: string) {
  try {
    const files = await glob('**/*.{js,ts,jsx,tsx,py,java,cpp,c,cs}', {
      cwd: projectPath,
      ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**']
    });

    const fileAnalysis = [];
    let totalLines = 0;
    let totalComplexity = 0;

    for (const file of files.slice(0, 50)) { // Limit to first 50 files for performance
      try {
        const content = readFileSync(join(projectPath, file), 'utf-8');
        const lines = content.split('\n');
        const complexity = calculateComplexity(content);
        
        totalLines += lines.length;
        totalComplexity += complexity;
        
        fileAnalysis.push({
          file,
          lines: lines.length,
          complexity,
          functions: extractFunctions(content),
          imports: extractImports(content),
          todos: extractTodos(content)
        });
      } catch (error) {
        continue;
      }
    }

    return {
      totalFiles: files.length,
      analyzedFiles: fileAnalysis.length,
      totalLines,
      averageComplexity: totalComplexity / Math.max(1, fileAnalysis.length),
      fileAnalysis,
      languageDistribution: analyzeLanguageDistribution(files)
    };
  } catch (error) {
    return { error: 'Failed to gather code quality data' };
  }
}

async function gatherPatternData(projectPath: string, startDate: Date, endDate: Date) {
  const git = simpleGit(projectPath);
  
  try {
    const log = await git.log({
      from: startDate.toISOString(),
      to: endDate.toISOString(),
      maxCount: 1000
    });

    const patterns = {
      commitPatterns: analyzeCommitPatterns(log.all),
      fileChangePatterns: await analyzeFileChangePatterns(git, startDate, endDate),
      workingPatterns: analyzeWorkingPatterns(log.all),
      collaborationPatterns: analyzeCollaborationPatterns(log.all)
    };

    return patterns;
  } catch (error) {
    return { error: 'Failed to gather pattern data' };
  }
}

async function gatherRecommendationData(projectPath: string) {
  try {
    const codeQuality = await gatherCodeQualityData(projectPath);
    const git = simpleGit(projectPath);
    const recentLog = await git.log({ maxCount: 100 });
    
    return {
      codeQuality,
      recentActivity: recentLog.all,
      projectStructure: await analyzeProjectStructure(projectPath),
      dependencies: await analyzeDependencies(projectPath)
    };
  } catch (error) {
    return { error: 'Failed to gather recommendation data' };
  }
}

async function gatherAnomalyData(projectPath: string, startDate: Date, endDate: Date) {
  const git = simpleGit(projectPath);
  
  try {
    const log = await git.log({
      from: startDate.toISOString(),
      to: endDate.toISOString(),
      maxCount: 1000
    });

    return {
      commitFrequency: analyzeCommitFrequency(log.all),
      commitSizes: analyzeCommitSizes(log.all),
      workingHours: analyzeWorkingHours(log.all),
      authorActivity: analyzeAuthorActivity(log.all)
    };
  } catch (error) {
    return { error: 'Failed to gather anomaly data' };
  }
}

async function generateAIAnalysis(type: string, data: any, context?: string) {
  const prompt = buildAnalysisPrompt(type, data, context);
  
  try {
    const response = await llmService.analyzeProductivity(data, prompt);
    
    // Parse AI response into structured format
    const analysis = parseAIResponse(response.content, type);
    
    return analysis;
  } catch (error) {
    console.error('Error generating AI analysis:', error);
    return generateFallbackAnalysis(type, data);
  }
}

function buildAnalysisPrompt(type: string, data: any, context?: string): string {
  const basePrompt = `You are a senior software engineering consultant analyzing a development project. 
  ${context ? `Additional context: ${context}` : ''}
  
  Please analyze the following ${type} data and provide insights in JSON format with these fields:
  - confidence: number (0-1)
  - summary: string (2-3 sentences)
  - details: object with specific findings
  - recommendations: array of strings
  - actionItems: array of objects with priority, action, impact, effort fields
  
  Data to analyze:
  ${JSON.stringify(data, null, 2)}
  
  Focus on actionable insights and practical recommendations.`;

  switch (type) {
    case 'productivity':
      return basePrompt + `
      
      Analyze productivity patterns, identify peak performance times, suggest improvements for coding efficiency, and highlight any concerning trends.`;
      
    case 'code_quality':
      return basePrompt + `
      
      Evaluate code quality metrics, identify areas for improvement, suggest refactoring opportunities, and assess technical debt.`;
      
    case 'patterns':
      return basePrompt + `
      
      Identify development patterns, workflow inefficiencies, collaboration issues, and suggest process improvements.`;
      
    case 'recommendations':
      return basePrompt + `
      
      Provide specific, actionable recommendations for improving development workflow, code quality, and team productivity.`;
      
    case 'anomalies':
      return basePrompt + `
      
      Detect unusual patterns in development activity, identify potential issues, and suggest corrective actions.`;
      
    default:
      return basePrompt;
  }
}

function parseAIResponse(response: string, type: string): any {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // If no JSON found, create structured response from text
    return {
      confidence: 0.7,
      summary: response.split('\n')[0] || 'Analysis completed',
      details: { rawResponse: response },
      recommendations: extractRecommendations(response),
      actionItems: extractActionItems(response, type)
    };
  } catch (error) {
    return generateFallbackAnalysis(type, { response });
  }
}

function extractRecommendations(text: string): string[] {
  const recommendations = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (line.includes('recommend') || line.includes('suggest') || line.includes('should')) {
      recommendations.push(line.trim());
    }
  }
  
  return recommendations.slice(0, 5);
}

function extractActionItems(text: string, type: string): any[] {
  const actionItems = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (line.includes('action') || line.includes('implement') || line.includes('fix')) {
      actionItems.push({
        priority: 'medium',
        action: line.trim(),
        impact: 'Moderate improvement expected',
        effort: 'Medium'
      });
    }
  }
  
  return actionItems.slice(0, 3);
}

function generateFallbackAnalysis(type: string, data: any): any {
  const fallbackAnalyses = {
    productivity: {
      confidence: 0.6,
      summary: 'Productivity analysis shows steady development activity with room for optimization.',
      details: { dataPoints: Object.keys(data).length },
      recommendations: [
        'Consider establishing consistent coding hours',
        'Focus on reducing context switching',
        'Implement code review processes'
      ],
      actionItems: [
        {
          priority: 'high' as const,
          action: 'Establish daily coding routine',
          impact: 'Improved consistency and productivity',
          effort: 'Low'
        }
      ]
    },
    code_quality: {
      confidence: 0.6,
      summary: 'Code quality metrics indicate areas for improvement in maintainability and complexity.',
      details: { filesAnalyzed: data.analyzedFiles || 0 },
      recommendations: [
        'Reduce function complexity',
        'Add unit tests',
        'Implement linting rules'
      ],
      actionItems: [
        {
          priority: 'high' as const,
          action: 'Refactor complex functions',
          impact: 'Better maintainability',
          effort: 'Medium'
        }
      ]
    },
    patterns: {
      confidence: 0.5,
      summary: 'Development patterns show typical workflow with some optimization opportunities.',
      details: { patternTypes: Object.keys(data).length },
      recommendations: [
        'Standardize commit messages',
        'Implement branching strategy',
        'Establish code review process'
      ],
      actionItems: [
        {
          priority: 'medium' as const,
          action: 'Create development guidelines',
          impact: 'Improved team coordination',
          effort: 'Low'
        }
      ]
    },
    recommendations: {
      confidence: 0.7,
      summary: 'Based on current project state, several improvement opportunities identified.',
      details: { analysisAreas: Object.keys(data).length },
      recommendations: [
        'Implement automated testing',
        'Set up continuous integration',
        'Establish code documentation standards'
      ],
      actionItems: [
        {
          priority: 'high' as const,
          action: 'Set up CI/CD pipeline',
          impact: 'Faster, more reliable deployments',
          effort: 'High'
        }
      ]
    },
    anomalies: {
      confidence: 0.5,
      summary: 'No significant anomalies detected in development patterns.',
      details: { dataPoints: Object.keys(data).length },
      recommendations: [
        'Continue monitoring development patterns',
        'Establish baseline metrics',
        'Set up automated alerts'
      ],
      actionItems: [
        {
          priority: 'low' as const,
          action: 'Set up monitoring dashboard',
          impact: 'Better visibility into development health',
          effort: 'Medium'
        }
      ]
    }
  };

  return fallbackAnalyses[type as keyof typeof fallbackAnalyses] || fallbackAnalyses.productivity;
}

async function analyzeCodeWithAI(
  projectPath: string,
  files?: string[],
  analysisType: string = 'complexity'
): Promise<CodeAnalysisResult[]> {
  try {
    const targetFiles = files || await glob('**/*.{js,ts,jsx,tsx}', {
      cwd: projectPath,
      ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**']
    });

    const results: CodeAnalysisResult[] = [];

    for (const file of targetFiles.slice(0, 10)) { // Limit for performance
      try {
        const content = readFileSync(join(projectPath, file), 'utf-8');
        const analysis = await analyzeFileWithAI(file, content, analysisType);
        results.push(analysis);
      } catch (error) {
        continue;
      }
    }

    return results;
  } catch (error) {
    console.error('Error analyzing code with AI:', error);
    return [];
  }
}

async function analyzeFileWithAI(
  filePath: string,
  content: string,
  analysisType: string
): Promise<CodeAnalysisResult> {
  const prompt = `Analyze this ${analysisType} in the file ${filePath}:

${content}

Provide analysis in JSON format with:
- issues: array of {type, severity, line, message, suggestion}
- metrics: {complexity, maintainability, testability, performance} (0-100 scale)
- patterns: array of identified patterns`;

  try {
    const response = await llmService.complete(prompt);
    const analysis = parseAIResponse(response.content, 'code_analysis');
    
    return {
      file: filePath,
      issues: analysis.issues || [],
      metrics: analysis.metrics || {
        complexity: calculateComplexity(content),
        maintainability: 70,
        testability: 60,
        performance: 75
      },
      patterns: analysis.patterns || []
    };
  } catch (error) {
    return {
      file: filePath,
      issues: [],
      metrics: {
        complexity: calculateComplexity(content),
        maintainability: 70,
        testability: 60,
        performance: 75
      },
      patterns: []
    };
  }
}

async function generateProductivityRecommendations(projectPath: string) {
  try {
    const data = await gatherRecommendationData(projectPath);
    const aiAnalysis = await generateAIAnalysis('recommendations', data);
    
    return {
      recommendations: aiAnalysis.recommendations,
      actionItems: aiAnalysis.actionItems,
      priority: 'high',
      categories: {
        codeQuality: aiAnalysis.recommendations.filter((r: string) => 
          r.includes('code') || r.includes('quality') || r.includes('test')
        ),
        productivity: aiAnalysis.recommendations.filter((r: string) => 
          r.includes('productivity') || r.includes('efficiency') || r.includes('workflow')
        ),
        collaboration: aiAnalysis.recommendations.filter((r: string) => 
          r.includes('team') || r.includes('collaboration') || r.includes('review')
        )
      }
    };
  } catch (error) {
    return {
      recommendations: [
        'Implement automated testing',
        'Set up code review process',
        'Establish coding standards'
      ],
      actionItems: [],
      priority: 'medium',
      categories: {
        codeQuality: ['Implement automated testing'],
        productivity: ['Set up code review process'],
        collaboration: ['Establish coding standards']
      }
    };
  }
}

async function detectAnomalies(projectPath: string, days: number) {
  try {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    
    const data = await gatherAnomalyData(projectPath, startDate, endDate);
    const aiAnalysis = await generateAIAnalysis('anomalies', data);
    
    return {
      anomalies: aiAnalysis.details.anomalies || [],
      severity: 'medium',
      timeRange: { start: startDate, end: endDate },
      recommendations: aiAnalysis.recommendations,
      confidence: aiAnalysis.confidence
    };
  } catch (error) {
    return {
      anomalies: [],
      severity: 'low',
      timeRange: { start: new Date(), end: new Date() },
      recommendations: ['Continue monitoring development patterns'],
      confidence: 0.5
    };
  }
}

async function generateLearningInsights(projectPath: string) {
  try {
    const codeData = await gatherCodeQualityData(projectPath);
    
    const prompt = `Based on this codebase analysis, identify learning opportunities and skill gaps:

${JSON.stringify(codeData, null, 2)}

Provide insights in JSON format with:
- skillGaps: array of identified skill areas needing improvement
- learningOpportunities: array of specific learning suggestions
- resources: array of recommended learning resources
- priority: priority level for each learning area`;

    const response = await llmService.complete(prompt);
    const analysis = parseAIResponse(response.content, 'learning');
    
    return {
      skillGaps: analysis.skillGaps || [
        'Unit testing',
        'Code documentation',
        'Design patterns'
      ],
      learningOpportunities: analysis.learningOpportunities || [
        'Learn Test-Driven Development',
        'Study clean code principles',
        'Practice refactoring techniques'
      ],
      resources: analysis.resources || [
        'Clean Code by Robert Martin',
        'Refactoring by Martin Fowler',
        'Test-Driven Development by Kent Beck'
      ],
      priority: analysis.priority || 'medium'
    };
  } catch (error) {
    return {
      skillGaps: ['Unit testing', 'Code documentation'],
      learningOpportunities: ['Learn TDD', 'Study clean code'],
      resources: ['Clean Code book', 'TDD tutorials'],
      priority: 'medium'
    };
  }
}

// Helper functions
function calculateComplexity(content: string): number {
  const complexityKeywords = [
    'if', 'else', 'while', 'for', 'switch', 'case', 'catch', 'try',
    'function', 'class', 'def', 'method', '&&', '||', '?'
  ];
  
  let complexity = 1;
  complexityKeywords.forEach(keyword => {
    const matches = content.match(new RegExp(`\\b${keyword}\\b`, 'g'));
    if (matches) complexity += matches.length;
  });
  
  return complexity;
}

function extractFunctions(content: string): string[] {
  const functionRegex = /function\s+(\w+)|(\w+)\s*=\s*function|(\w+)\s*=>\s*|class\s+(\w+)|def\s+(\w+)/g;
  const functions = [];
  let match;
  
  while ((match = functionRegex.exec(content)) !== null) {
    const functionName = match[1] || match[2] || match[3] || match[4] || match[5];
    if (functionName) functions.push(functionName);
  }
  
  return functions;
}

function extractImports(content: string): string[] {
  const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\)/g;
  const imports = [];
  let match;
  
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1] || match[2];
    if (importPath) imports.push(importPath);
  }
  
  return imports;
}

function extractTodos(content: string): string[] {
  const todoRegex = /\/\/\s*TODO:?\s*(.+)|\/\*\s*TODO:?\s*(.+?)\s*\*\//gi;
  const todos = [];
  let match;
  
  while ((match = todoRegex.exec(content)) !== null) {
    const todo = match[1] || match[2];
    if (todo) todos.push(todo.trim());
  }
  
  return todos;
}

function analyzeLanguageDistribution(files: string[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  
  files.forEach(file => {
    const ext = file.split('.').pop()?.toLowerCase();
    if (ext) {
      distribution[ext] = (distribution[ext] || 0) + 1;
    }
  });
  
  return distribution;
}

function analyzeCommitPatterns(commits: any[]): any {
  const patterns = {
    messageTypes: new Map<string, number>(),
    commitSizes: [],
    timePatterns: new Map<number, number>()
  };
  
  commits.forEach(commit => {
    // Analyze commit message patterns
    const message = commit.message.toLowerCase();
    const type = message.includes('fix') ? 'fix' : 
                 message.includes('feat') ? 'feature' :
                 message.includes('refactor') ? 'refactor' : 'other';
    
    patterns.messageTypes.set(type, (patterns.messageTypes.get(type) || 0) + 1);
    
    // Analyze time patterns
    const hour = new Date(commit.date).getHours();
    patterns.timePatterns.set(hour, (patterns.timePatterns.get(hour) || 0) + 1);
  });
  
  return patterns;
}

async function analyzeFileChangePatterns(git: any, startDate: Date, endDate: Date): Promise<any> {
  try {
    const log = await git.log({
      from: startDate.toISOString(),
      to: endDate.toISOString(),
      maxCount: 100
    });
    
    const fileChanges = new Map<string, number>();
    
    for (const commit of log.all) {
      try {
        const diff = await git.diffSummary([commit.hash + '~1', commit.hash]);
        diff.files.forEach((file: any) => {
          fileChanges.set(file.file, (fileChanges.get(file.file) || 0) + 1);
        });
      } catch (error) {
        // Skip if can't get diff
        continue;
      }
    }
    
    return {
      mostChangedFiles: Array.from(fileChanges.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
    };
  } catch (error) {
    return { mostChangedFiles: [] };
  }
}

function analyzeWorkingPatterns(commits: any[]): any {
  const hourlyActivity = new Array(24).fill(0);
  const dailyActivity = new Map<string, number>();
  
  commits.forEach(commit => {
    const date = new Date(commit.date);
    const hour = date.getHours();
    const day = date.getDay(); // 0 = Sunday, 6 = Saturday
    
    hourlyActivity[hour]++;
    dailyActivity.set(day.toString(), (dailyActivity.get(day.toString()) || 0) + 1);
  });
  
  return {
    peakHours: hourlyActivity.map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    workingDays: Array.from(dailyActivity.entries())
      .map(([day, count]) => ({ day: parseInt(day), count }))
      .sort((a, b) => b.count - a.count)
  };
}

function analyzeCollaborationPatterns(commits: any[]): any {
  const authors = new Map<string, number>();
  
  commits.forEach(commit => {
    const author = commit.author_name;
    authors.set(author, (authors.get(author) || 0) + 1);
  });
  
  return {
    contributors: Array.from(authors.entries())
      .map(([author, commits]) => ({ author, commits }))
      .sort((a, b) => b.commits - a.commits),
    collaborationLevel: authors.size > 1 ? 'high' : 'low'
  };
}

async function analyzeProjectStructure(projectPath: string): Promise<any> {
  try {
    const files = await glob('**/*', {
      cwd: projectPath,
      ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**']
    });
    
    const structure = {
      totalFiles: files.length,
      directories: new Set<string>(),
      fileTypes: new Map<string, number>()
    };
    
    files.forEach(file => {
      const dir = file.split('/').slice(0, -1).join('/');
      if (dir) structure.directories.add(dir);
      
      const ext = file.split('.').pop()?.toLowerCase();
      if (ext) {
        structure.fileTypes.set(ext, (structure.fileTypes.get(ext) || 0) + 1);
      }
    });
    
    return {
      totalFiles: structure.totalFiles,
      totalDirectories: structure.directories.size,
      fileTypes: Array.from(structure.fileTypes.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
    };
  } catch (error) {
    return { totalFiles: 0, totalDirectories: 0, fileTypes: [] };
  }
}

async function analyzeDependencies(projectPath: string): Promise<any> {
  try {
    const packageJsonPath = join(projectPath, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };
    
    return {
      totalDependencies: Object.keys(dependencies).length,
      dependencies: Object.keys(dependencies).slice(0, 20),
      hasPackageJson: true
    };
  } catch (error) {
    return {
      totalDependencies: 0,
      dependencies: [],
      hasPackageJson: false
    };
  }
}

function analyzeCommitFrequency(commits: any[]): any {
  const frequency = new Map<string, number>();
  
  commits.forEach(commit => {
    const date = new Date(commit.date).toISOString().split('T')[0];
    frequency.set(date, (frequency.get(date) || 0) + 1);
  });
  
  const frequencies = Array.from(frequency.values());
  const average = frequencies.reduce((sum, f) => sum + f, 0) / frequencies.length;
  
  return {
    dailyFrequency: Array.from(frequency.entries()),
    average,
    max: Math.max(...frequencies),
    min: Math.min(...frequencies)
  };
}

function analyzeCommitSizes(commits: any[]): any {
  // This would need git diff data in a real implementation
  return {
    averageSize: 50,
    largeCommits: commits.filter(c => c.message.length > 100).length,
    smallCommits: commits.filter(c => c.message.length < 20).length
  };
}

function analyzeWorkingHours(commits: any[]): any {
  const hours = commits.map(c => new Date(c.date).getHours());
  const hourCounts = new Array(24).fill(0);
  
  hours.forEach(hour => hourCounts[hour]++);
  
  return {
    distribution: hourCounts,
    peakHour: hourCounts.indexOf(Math.max(...hourCounts)),
    workingHours: hourCounts.slice(8, 18).reduce((sum, count) => sum + count, 0),
    afterHours: hourCounts.slice(18).reduce((sum, count) => sum + count, 0) + 
                hourCounts.slice(0, 8).reduce((sum, count) => sum + count, 0)
  };
}

function analyzeAuthorActivity(commits: any[]): any {
  const authors = new Map<string, any>();
  
  commits.forEach(commit => {
    const author = commit.author_name;
    if (!authors.has(author)) {
      authors.set(author, {
        commits: 0,
        firstCommit: commit.date,
        lastCommit: commit.date
      });
    }
    
    const authorData = authors.get(author);
    authorData.commits++;
    
    if (new Date(commit.date) < new Date(authorData.firstCommit)) {
      authorData.firstCommit = commit.date;
    }
    
    if (new Date(commit.date) > new Date(authorData.lastCommit)) {
      authorData.lastCommit = commit.date;
    }
  });
  
  return {
    totalAuthors: authors.size,
    authorStats: Array.from(authors.entries())
      .map(([author, stats]) => ({ author, ...stats }))
      .sort((a, b) => b.commits - a.commits)
  };
}

export { router as insightsRouter };