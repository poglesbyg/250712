#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { glob } from 'glob';
import { readFileSync } from 'fs';
import { parse } from 'acorn';
import { simple as walk } from 'acorn-walk';
// Tool input schemas
const analyzeComplexitySchema = z.object({
    projectPath: z.string().describe('Path to the project directory'),
    extensions: z.array(z.string()).default(['.js', '.ts', '.jsx', '.tsx']).describe('File extensions to analyze'),
});
const detectTechDebtSchema = z.object({
    projectPath: z.string().describe('Path to the project directory'),
    threshold: z.number().default(10).describe('Complexity threshold for tech debt detection'),
});
const suggestRefactoringSchema = z.object({
    filePath: z.string().describe('Path to the specific file to analyze'),
});
// Available tools
const tools = [
    {
        name: 'analyze_complexity',
        description: 'Analyze code complexity metrics across a project',
        inputSchema: {
            type: 'object',
            properties: {
                projectPath: {
                    type: 'string',
                    description: 'Path to the project directory',
                },
                extensions: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'File extensions to analyze',
                    default: ['.js', '.ts', '.jsx', '.tsx'],
                },
            },
            required: ['projectPath'],
        },
    },
    {
        name: 'detect_tech_debt',
        description: 'Detect technical debt patterns and code smells',
        inputSchema: {
            type: 'object',
            properties: {
                projectPath: {
                    type: 'string',
                    description: 'Path to the project directory',
                },
                threshold: {
                    type: 'number',
                    description: 'Complexity threshold for tech debt detection',
                    default: 10,
                },
            },
            required: ['projectPath'],
        },
    },
    {
        name: 'suggest_refactoring',
        description: 'Analyze a specific file and suggest refactoring opportunities',
        inputSchema: {
            type: 'object',
            properties: {
                filePath: {
                    type: 'string',
                    description: 'Path to the specific file to analyze',
                },
            },
            required: ['filePath'],
        },
    },
];
class CodeQualityServer {
    server;
    constructor() {
        this.server = new Server({
            name: 'code-quality',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.setupToolHandlers();
    }
    setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools,
        }));
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                switch (name) {
                    case 'analyze_complexity':
                        return await this.analyzeComplexity(args);
                    case 'detect_tech_debt':
                        return await this.detectTechDebt(args);
                    case 'suggest_refactoring':
                        return await this.suggestRefactoring(args);
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error: ${errorMessage}`,
                        },
                    ],
                };
            }
        });
    }
    async analyzeComplexity(args) {
        const { projectPath, extensions } = analyzeComplexitySchema.parse(args);
        try {
            const pattern = `${projectPath}/**/*{${extensions.join(',')}}`;
            const files = await glob(pattern, { ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'] });
            const fileMetrics = {};
            let totalComplexity = 0;
            let totalLoc = 0;
            let totalFunctions = 0;
            let totalClasses = 0;
            for (const file of files) {
                try {
                    const metrics = this.analyzeFileComplexity(file);
                    fileMetrics[file] = metrics;
                    totalComplexity += metrics.cyclomaticComplexity;
                    totalLoc += metrics.linesOfCode;
                    totalFunctions += metrics.functions;
                    totalClasses += metrics.classes;
                }
                catch (error) {
                    // Skip files that can't be parsed
                    console.error(`Skipping ${file}: ${error}`);
                }
            }
            const averageComplexity = files.length > 0 ? totalComplexity / files.length : 0;
            const averageLoc = files.length > 0 ? totalLoc / files.length : 0;
            const summary = {
                totalFiles: files.length,
                totalComplexity,
                totalLinesOfCode: totalLoc,
                totalFunctions,
                totalClasses,
                averageComplexity: Math.round(averageComplexity * 100) / 100,
                averageLinesOfCode: Math.round(averageLoc * 100) / 100,
                complexityDistribution: this.getComplexityDistribution(fileMetrics),
                mostComplexFiles: this.getMostComplexFiles(fileMetrics, 10),
            };
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(summary, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            throw new Error(`Failed to analyze complexity: ${error}`);
        }
    }
    analyzeFileComplexity(filePath) {
        const content = readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').length;
        let complexity = 1; // Base complexity
        let functions = 0;
        let classes = 0;
        let dependencies = 0;
        try {
            // Count import statements
            dependencies = (content.match(/^import\s+.*$/gm) || []).length;
            dependencies += (content.match(/^const\s+.*=\s+require\(/gm) || []).length;
            // Parse AST for more detailed analysis
            const ast = parse(content, {
                ecmaVersion: 2022,
                sourceType: 'module',
                allowImportExportEverywhere: true,
                allowReturnOutsideFunction: true
            });
            walk(ast, {
                FunctionDeclaration: () => functions++,
                FunctionExpression: () => functions++,
                ArrowFunctionExpression: () => functions++,
                ClassDeclaration: () => classes++,
                IfStatement: () => complexity++,
                WhileStatement: () => complexity++,
                ForStatement: () => complexity++,
                ForInStatement: () => complexity++,
                ForOfStatement: () => complexity++,
                SwitchCase: () => complexity++,
                ConditionalExpression: () => complexity++,
                LogicalExpression: (node) => {
                    if (node.operator === '&&' || node.operator === '||')
                        complexity++;
                },
                CatchClause: () => complexity++,
            });
        }
        catch (error) {
            // Fallback to simple regex-based analysis
            complexity += (content.match(/\bif\b/g) || []).length;
            complexity += (content.match(/\bwhile\b/g) || []).length;
            complexity += (content.match(/\bfor\b/g) || []).length;
            complexity += (content.match(/\bswitch\b/g) || []).length;
            complexity += (content.match(/\bcatch\b/g) || []).length;
            functions = (content.match(/function\s+\w+/g) || []).length;
            functions += (content.match(/=>\s*{/g) || []).length;
            classes = (content.match(/class\s+\w+/g) || []).length;
        }
        return {
            cyclomaticComplexity: complexity,
            linesOfCode: lines,
            functions,
            classes,
            dependencies,
        };
    }
    getComplexityDistribution(fileMetrics) {
        const distribution = { low: 0, medium: 0, high: 0, veryHigh: 0 };
        Object.values(fileMetrics).forEach(metrics => {
            if (metrics.cyclomaticComplexity <= 5)
                distribution.low++;
            else if (metrics.cyclomaticComplexity <= 10)
                distribution.medium++;
            else if (metrics.cyclomaticComplexity <= 20)
                distribution.high++;
            else
                distribution.veryHigh++;
        });
        return distribution;
    }
    getMostComplexFiles(fileMetrics, limit) {
        return Object.entries(fileMetrics)
            .sort(([, a], [, b]) => b.cyclomaticComplexity - a.cyclomaticComplexity)
            .slice(0, limit)
            .map(([file, metrics]) => ({
            file: file.split('/').pop(),
            complexity: metrics.cyclomaticComplexity,
            linesOfCode: metrics.linesOfCode,
            functions: metrics.functions,
        }));
    }
    async detectTechDebt(args) {
        const { projectPath, threshold } = detectTechDebtSchema.parse(args);
        try {
            const pattern = `${projectPath}/**/*.{js,ts,jsx,tsx}`;
            const files = await glob(pattern, { ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'] });
            const techDebtIssues = [];
            for (const file of files) {
                try {
                    const content = readFileSync(file, 'utf-8');
                    const metrics = this.analyzeFileComplexity(file);
                    const issues = this.detectFileIssues(file, content, metrics, threshold);
                    if (issues.length > 0) {
                        techDebtIssues.push({
                            file: file.split('/').pop(),
                            fullPath: file,
                            issues,
                            complexity: metrics.cyclomaticComplexity,
                            linesOfCode: metrics.linesOfCode,
                        });
                    }
                }
                catch (error) {
                    // Skip files that can't be analyzed
                }
            }
            const summary = {
                totalFiles: files.length,
                filesWithIssues: techDebtIssues.length,
                totalIssues: techDebtIssues.reduce((sum, file) => sum + file.issues.length, 0),
                issueTypes: this.categorizeIssues(techDebtIssues),
                criticalFiles: techDebtIssues
                    .filter(file => file.complexity > threshold * 2)
                    .sort((a, b) => b.complexity - a.complexity)
                    .slice(0, 5),
                recommendations: this.generateRecommendations(techDebtIssues),
            };
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(summary, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            throw new Error(`Failed to detect tech debt: ${error}`);
        }
    }
    detectFileIssues(filePath, content, metrics, threshold) {
        const issues = [];
        // High complexity
        if (metrics.cyclomaticComplexity > threshold) {
            issues.push({
                type: 'high_complexity',
                severity: 'high',
                message: `Cyclomatic complexity (${metrics.cyclomaticComplexity}) exceeds threshold (${threshold})`,
            });
        }
        // Long files
        if (metrics.linesOfCode > 500) {
            issues.push({
                type: 'long_file',
                severity: 'medium',
                message: `File is very long (${metrics.linesOfCode} lines)`,
            });
        }
        // Too many dependencies
        if (metrics.dependencies > 20) {
            issues.push({
                type: 'high_coupling',
                severity: 'medium',
                message: `High number of dependencies (${metrics.dependencies})`,
            });
        }
        // Code smells
        if (content.includes('TODO') || content.includes('FIXME')) {
            issues.push({
                type: 'todo_fixme',
                severity: 'low',
                message: 'Contains TODO or FIXME comments',
            });
        }
        if (content.includes('console.log') && !filePath.includes('test')) {
            issues.push({
                type: 'debug_code',
                severity: 'low',
                message: 'Contains console.log statements',
            });
        }
        // Duplicate code patterns (simple heuristic)
        const lines = content.split('\n');
        const duplicateLines = lines.filter((line, index) => line.trim().length > 10 &&
            lines.indexOf(line) !== index).length;
        if (duplicateLines > 5) {
            issues.push({
                type: 'duplicate_code',
                severity: 'medium',
                message: `Potential duplicate code detected (${duplicateLines} duplicate lines)`,
            });
        }
        return issues;
    }
    categorizeIssues(techDebtFiles) {
        const categories = {};
        techDebtFiles.forEach(file => {
            file.issues.forEach((issue) => {
                categories[issue.type] = (categories[issue.type] || 0) + 1;
            });
        });
        return categories;
    }
    generateRecommendations(techDebtFiles) {
        const recommendations = [];
        if (techDebtFiles.some(f => f.issues.some((i) => i.type === 'high_complexity'))) {
            recommendations.push('Consider breaking down complex functions into smaller, more manageable pieces');
        }
        if (techDebtFiles.some(f => f.issues.some((i) => i.type === 'long_file'))) {
            recommendations.push('Split large files into multiple modules with single responsibilities');
        }
        if (techDebtFiles.some(f => f.issues.some((i) => i.type === 'high_coupling'))) {
            recommendations.push('Reduce dependencies by implementing dependency injection or facade patterns');
        }
        if (techDebtFiles.some(f => f.issues.some((i) => i.type === 'duplicate_code'))) {
            recommendations.push('Extract common code into reusable functions or utilities');
        }
        return recommendations;
    }
    async suggestRefactoring(args) {
        const { filePath } = suggestRefactoringSchema.parse(args);
        try {
            const content = readFileSync(filePath, 'utf-8');
            const metrics = this.analyzeFileComplexity(filePath);
            const suggestions = [];
            if (metrics.cyclomaticComplexity > 10) {
                suggestions.push({
                    type: 'extract_function',
                    priority: 'high',
                    description: 'Break down complex logic into smaller functions',
                    benefit: 'Improves readability and testability',
                });
            }
            if (metrics.linesOfCode > 200) {
                suggestions.push({
                    type: 'split_file',
                    priority: 'medium',
                    description: 'Consider splitting this file into multiple modules',
                    benefit: 'Better organization and maintainability',
                });
            }
            if (content.includes('if') && content.includes('else if')) {
                suggestions.push({
                    type: 'use_switch',
                    priority: 'low',
                    description: 'Consider using switch statements for multiple conditions',
                    benefit: 'Cleaner conditional logic',
                });
            }
            if (metrics.functions > 10) {
                suggestions.push({
                    type: 'group_functions',
                    priority: 'medium',
                    description: 'Group related functions into classes or modules',
                    benefit: 'Better code organization',
                });
            }
            const analysis = {
                file: filePath.split('/').pop(),
                currentMetrics: metrics,
                suggestions,
                estimatedImpact: this.estimateRefactoringImpact(suggestions),
            };
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(analysis, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            throw new Error(`Failed to analyze file for refactoring: ${error}`);
        }
    }
    estimateRefactoringImpact(suggestions) {
        const impact = {
            complexity: 0,
            maintainability: 0,
            testability: 0,
            readability: 0,
        };
        suggestions.forEach(suggestion => {
            switch (suggestion.type) {
                case 'extract_function':
                    impact.complexity += 30;
                    impact.testability += 40;
                    impact.readability += 25;
                    break;
                case 'split_file':
                    impact.maintainability += 35;
                    impact.readability += 20;
                    break;
                case 'use_switch':
                    impact.readability += 15;
                    impact.complexity += 10;
                    break;
                case 'group_functions':
                    impact.maintainability += 25;
                    impact.readability += 20;
                    break;
            }
        });
        return impact;
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Code Quality MCP server running on stdio');
    }
}
const server = new CodeQualityServer();
server.run().catch(console.error);
//# sourceMappingURL=index.js.map