#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import simpleGit from 'simple-git';
import { z } from 'zod';
// Tool input schemas
const analyzeRepoSchema = z.object({
    repoPath: z.string().describe('Path to the git repository'),
});
const commitPatternsSchema = z.object({
    repoPath: z.string().describe('Path to the git repository'),
    days: z.number().default(30).describe('Number of days to analyze'),
});
const branchInsightsSchema = z.object({
    repoPath: z.string().describe('Path to the git repository'),
});
// Available tools
const tools = [
    {
        name: 'analyze_repository',
        description: 'Analyze a git repository for basic statistics and insights',
        inputSchema: {
            type: 'object',
            properties: {
                repoPath: {
                    type: 'string',
                    description: 'Path to the git repository',
                },
            },
            required: ['repoPath'],
        },
    },
    {
        name: 'commit_patterns',
        description: 'Analyze commit patterns and frequency over time',
        inputSchema: {
            type: 'object',
            properties: {
                repoPath: {
                    type: 'string',
                    description: 'Path to the git repository',
                },
                days: {
                    type: 'number',
                    description: 'Number of days to analyze',
                    default: 30,
                },
            },
            required: ['repoPath'],
        },
    },
    {
        name: 'branch_insights',
        description: 'Get insights about branches, merges, and collaboration patterns',
        inputSchema: {
            type: 'object',
            properties: {
                repoPath: {
                    type: 'string',
                    description: 'Path to the git repository',
                },
            },
            required: ['repoPath'],
        },
    },
];
class GitAnalyticsServer {
    server;
    constructor() {
        this.server = new Server({
            name: 'git-analytics',
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
                    case 'analyze_repository':
                        return await this.analyzeRepository(args);
                    case 'commit_patterns':
                        return await this.analyzeCommitPatterns(args);
                    case 'branch_insights':
                        return await this.analyzeBranchInsights(args);
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
    async analyzeRepository(args) {
        const { repoPath } = analyzeRepoSchema.parse(args);
        const git = simpleGit(repoPath);
        try {
            const status = await git.status();
            const log = await git.log({ maxCount: 100 });
            const branches = await git.branch();
            const remotes = await git.getRemotes(true);
            const stats = {
                totalCommits: log.total,
                activeBranches: branches.all.length,
                currentBranch: branches.current,
                isDirty: !status.isClean(),
                unstagedFiles: status.files.filter(f => f.index === ' ').length,
                stagedFiles: status.files.filter(f => f.working_dir === ' ').length,
                remotes: remotes.map(r => ({ name: r.name, url: r.refs.fetch })),
                recentCommits: log.latest ? {
                    hash: log.latest.hash,
                    message: log.latest.message,
                    author: log.latest.author_name,
                    date: log.latest.date,
                } : null,
            };
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(stats, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            throw new Error(`Failed to analyze repository: ${error}`);
        }
    }
    async analyzeCommitPatterns(args) {
        const { repoPath, days } = commitPatternsSchema.parse(args);
        const git = simpleGit(repoPath);
        try {
            const since = new Date();
            since.setDate(since.getDate() - days);
            const log = await git.log({
                since: since.toISOString(),
            });
            // Group commits by day and hour
            const commitsByDay = {};
            const commitsByHour = {};
            const commitsByAuthor = {};
            log.all.forEach(commit => {
                const date = new Date(commit.date);
                const day = date.toISOString().split('T')[0];
                const hour = date.getHours();
                commitsByDay[day] = (commitsByDay[day] || 0) + 1;
                commitsByHour[hour] = (commitsByHour[hour] || 0) + 1;
                commitsByAuthor[commit.author_name] = (commitsByAuthor[commit.author_name] || 0) + 1;
            });
            const patterns = {
                totalCommits: log.all.length,
                averageCommitsPerDay: log.all.length / days,
                peakCommitHour: Object.entries(commitsByHour)
                    .sort(([, a], [, b]) => b - a)[0]?.[0] || 0,
                mostActiveDay: Object.entries(commitsByDay)
                    .sort(([, a], [, b]) => b - a)[0]?.[0] || null,
                topContributors: Object.entries(commitsByAuthor)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([author, commits]) => ({ author, commits })),
                commitsByDay,
                commitsByHour,
            };
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(patterns, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            throw new Error(`Failed to analyze commit patterns: ${error}`);
        }
    }
    async analyzeBranchInsights(args) {
        const { repoPath } = branchInsightsSchema.parse(args);
        const git = simpleGit(repoPath);
        try {
            const branches = await git.branch(['-a']);
            const log = await git.log();
            // Analyze branch patterns
            const localBranches = branches.all.filter(b => !b.includes('remotes/'));
            const remoteBranches = branches.all.filter(b => b.includes('remotes/'));
            // Get merge commits
            const mergeCommits = log.all.filter(commit => commit.message.toLowerCase().includes('merge'));
            const insights = {
                totalBranches: localBranches.length,
                remoteBranches: remoteBranches.length,
                currentBranch: branches.current,
                recentMerges: mergeCommits.slice(0, 10).map(commit => ({
                    hash: commit.hash.substring(0, 8),
                    message: commit.message,
                    author: commit.author_name,
                    date: commit.date,
                })),
                branchNamingPatterns: this.analyzeBranchNaming(localBranches),
                staleBranches: await this.findStaleBranches(git, localBranches),
            };
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(insights, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            throw new Error(`Failed to analyze branch insights: ${error}`);
        }
    }
    analyzeBranchNaming(branches) {
        const patterns = {
            feature: branches.filter(b => b.includes('feature')).length,
            bugfix: branches.filter(b => b.includes('bugfix') || b.includes('fix')).length,
            hotfix: branches.filter(b => b.includes('hotfix')).length,
            release: branches.filter(b => b.includes('release')).length,
            develop: branches.filter(b => b.includes('develop') || b.includes('dev')).length,
            other: 0,
        };
        patterns.other = branches.length - Object.values(patterns).reduce((a, b) => a + b, 0);
        return patterns;
    }
    async findStaleBranches(git, branches) {
        const staleThreshold = new Date();
        staleThreshold.setDate(staleThreshold.getDate() - 30); // 30 days ago
        const staleBranches = [];
        for (const branch of branches) {
            if (branch === 'main' || branch === 'master' || branch === 'develop')
                continue;
            try {
                const log = await git.log([branch, '--max-count=1']);
                if (log.latest && new Date(log.latest.date) < staleThreshold) {
                    staleBranches.push({
                        name: branch,
                        lastCommit: log.latest.date,
                        author: log.latest.author_name,
                    });
                }
            }
            catch (error) {
                // Branch might not exist locally, skip
            }
        }
        return staleBranches;
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Git Analytics MCP server running on stdio');
    }
}
const server = new GitAnalyticsServer();
server.run().catch(console.error);
//# sourceMappingURL=index.js.map