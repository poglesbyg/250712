"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.automationRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const llm_1 = require("../services/llm");
const mcp_client_1 = require("../services/mcp-client");
const router = (0, express_1.Router)();
exports.automationRouter = router;
const codeGenerationSchema = zod_1.z.object({
    type: zod_1.z.enum(['component', 'api', 'test', 'config']),
    framework: zod_1.z.string(),
    name: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    requirements: zod_1.z.array(zod_1.z.string()).optional(),
    options: zod_1.z.record(zod_1.z.unknown()).optional()
});
const gitWorkflowSchema = zod_1.z.object({
    action: zod_1.z.enum(['analyze', 'optimize', 'cleanup']),
    repoPath: zod_1.z.string(),
    options: zod_1.z.record(zod_1.z.unknown()).optional()
});
// Generate boilerplate code
router.post('/generate', async (req, res) => {
    try {
        const requestData = codeGenerationSchema.parse(req.body);
        const llmService = (0, llm_1.createLLMService)();
        const response = await llmService.generateCode(requestData);
        try {
            const generatedCode = JSON.parse(response.content);
            res.json({
                ...generatedCode,
                usage: response.usage
            });
        }
        catch (parseError) {
            // If JSON parsing fails, return the raw content
            res.json({
                files: [{ path: `${requestData.name}.generated`, content: response.content }],
                instructions: 'Generated code (manual formatting may be needed)',
                dependencies: [],
                usage: response.usage
            });
        }
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'Invalid request parameters', details: error.errors });
        }
        else {
            res.status(500).json({ error: 'Code generation failed' });
        }
    }
});
// Automate git workflows
router.post('/git-workflow', async (req, res) => {
    try {
        const { action, repoPath, options } = gitWorkflowSchema.parse(req.body);
        const actions = [];
        let analysisData = {};
        // First, analyze the repository
        const repoAnalysis = await mcp_client_1.mcpClient.executeToolAsync('git-analytics', 'analyze_repository', { repoPath });
        if (repoAnalysis.success) {
            analysisData = repoAnalysis.data;
            actions.push('Repository analyzed');
        }
        switch (action) {
            case 'analyze':
                // Get commit patterns and branch insights
                const [commitPatterns, branchInsights] = await Promise.all([
                    mcp_client_1.mcpClient.executeToolAsync('git-analytics', 'commit_patterns', { repoPath }),
                    mcp_client_1.mcpClient.executeToolAsync('git-analytics', 'branch_insights', { repoPath })
                ]);
                actions.push('Commit patterns analyzed');
                actions.push('Branch insights generated');
                res.json({
                    success: true,
                    actions,
                    data: {
                        repository: analysisData,
                        commitPatterns: commitPatterns.success ? commitPatterns.data : null,
                        branchInsights: branchInsights.success ? branchInsights.data : null
                    },
                    message: 'Git analysis completed'
                });
                break;
            case 'optimize':
                // Analyze repository and provide optimization suggestions
                const llmService = (0, llm_1.createLLMService)();
                const optimizationResponse = await llmService.optimizeWorkflow(analysisData, ['improve git workflow', 'optimize branching strategy']);
                actions.push('Workflow optimization suggestions generated');
                res.json({
                    success: true,
                    actions,
                    data: {
                        repository: analysisData,
                        suggestions: optimizationResponse.content
                    },
                    message: 'Git workflow optimization completed'
                });
                break;
            case 'cleanup':
                // Get branch insights to identify stale branches
                const cleanupInsights = await mcp_client_1.mcpClient.executeToolAsync('git-analytics', 'branch_insights', { repoPath });
                actions.push('Cleanup analysis completed');
                res.json({
                    success: true,
                    actions,
                    data: {
                        repository: analysisData,
                        cleanupOpportunities: cleanupInsights.success ? cleanupInsights.data : null
                    },
                    message: 'Git cleanup analysis completed'
                });
                break;
            default:
                res.status(400).json({ error: 'Unknown workflow action' });
        }
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'Invalid request parameters', details: error.errors });
        }
        else {
            res.status(500).json({ error: 'Workflow automation failed' });
        }
    }
});
//# sourceMappingURL=automation.js.map