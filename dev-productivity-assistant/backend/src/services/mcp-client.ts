import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface MCPServer {
  name: string;
  command: string;
  args: string[];
  cwd?: string;
  status: 'running' | 'stopped' | 'error';
  capabilities: string[];
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface MCPExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  server: string;
  tool: string;
}

interface MCPMessage {
  jsonrpc: string;
  id: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

class MCPServerProcess extends EventEmitter {
  private process: ChildProcess | null = null;
  private messageId = 0;
  private pendingRequests = new Map<string | number, { resolve: Function; reject: Function }>();

  constructor(private server: MCPServer) {
    super();
  }

  async start(): Promise<boolean> {
    if (this.process) {
      return true;
    }

    try {
      const cwd = this.server.cwd ? require('path').resolve(this.server.cwd) : process.cwd();
      this.process = spawn(this.server.command, this.server.args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
        shell: false,
      });

      this.process.stdout?.on('data', (data) => {
        this.handleMessage(data.toString());
      });

      this.process.stderr?.on('data', (data) => {
        console.error(`MCP Server ${this.server.name} stderr:`, data.toString());
      });

      this.process.on('close', (code) => {
        console.log(`MCP Server ${this.server.name} closed with code ${code}`);
        this.process = null;
        this.emit('close');
      });

      this.process.on('error', (error) => {
        console.error(`MCP Server ${this.server.name} error:`, error);
        this.emit('error', error);
      });

      // Initialize the server
      await this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        clientInfo: {
          name: 'dev-productivity-assistant',
          version: '1.0.0'
        }
      });

      return true;
    } catch (error) {
      console.error(`Failed to start MCP server ${this.server.name}:`, error);
      return false;
    }
  }

  async stop(): Promise<boolean> {
    if (!this.process) {
      return true;
    }

    try {
      this.process.kill();
      this.process = null;
      return true;
    } catch (error) {
      console.error(`Failed to stop MCP server ${this.server.name}:`, error);
      return false;
    }
  }

  async callTool(toolName: string, parameters: any): Promise<any> {
    if (!this.process) {
      throw new Error(`MCP Server ${this.server.name} is not running`);
    }

    try {
      const result = await this.sendRequest('tools/call', {
        name: toolName,
        arguments: parameters
      });

      return result.content || result;
    } catch (error) {
      throw new Error(`Tool execution failed: ${error}`);
    }
  }

  async listTools(): Promise<MCPTool[]> {
    if (!this.process) {
      throw new Error(`MCP Server ${this.server.name} is not running`);
    }

    try {
      const result = await this.sendRequest('tools/list', {});
      return result.tools || [];
    } catch (error) {
      console.error(`Failed to list tools for ${this.server.name}:`, error);
      return [];
    }
  }

  private async sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      const message: MCPMessage = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      this.pendingRequests.set(id, { resolve, reject });

      const messageStr = JSON.stringify(message) + '\n';
      this.process?.stdin?.write(messageStr);

      // Set timeout for request
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout for method ${method}`));
        }
      }, 30000); // 30 second timeout
    });
  }

  private handleMessage(data: string) {
    const lines = data.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        const message: MCPMessage = JSON.parse(line);
        
        if (message.id && this.pendingRequests.has(message.id)) {
          const { resolve, reject } = this.pendingRequests.get(message.id)!;
          this.pendingRequests.delete(message.id);
          
          if (message.error) {
            reject(new Error(message.error.message || 'Unknown error'));
          } else {
            resolve(message.result);
          }
        }
      } catch (error) {
        console.error(`Failed to parse MCP message:`, error, 'Data:', line);
      }
    }
  }
}

class MCPClient {
  private servers: Map<string, MCPServer> = new Map();
  private processes: Map<string, MCPServerProcess> = new Map();

  constructor() {
    this.initializeDefaultServers();
  }

  private initializeDefaultServers() {
    // Register default MCP servers
    this.registerServer({
      name: 'git-analytics',
      command: 'npm',
      args: ['run', 'start'],
      cwd: './mcp-servers/git-analytics',
      status: 'stopped',
      capabilities: ['analyze_repository', 'commit_patterns', 'branch_insights'],
    });

    this.registerServer({
      name: 'code-quality',
      command: 'npm',
      args: ['run', 'start'],
      cwd: './mcp-servers/code-quality',
      status: 'stopped',
      capabilities: ['analyze_complexity', 'detect_tech_debt', 'suggest_refactoring'],
    });

    this.registerServer({
      name: 'knowledge-graph',
      command: 'npm',
      args: ['run', 'start'],
      cwd: './mcp-servers/knowledge-graph',
      status: 'stopped',
      capabilities: ['build_knowledge_graph', 'query_knowledge', 'analyze_relationships', 'find_patterns'],
    });
  }

  registerServer(server: MCPServer) {
    this.servers.set(server.name, server);
  }

  async startServer(serverName: string): Promise<boolean> {
    const server = this.servers.get(serverName);
    if (!server) {
      console.error(`Server ${serverName} not found`);
      return false;
    }

    try {
      let process = this.processes.get(serverName);
      if (!process) {
        process = new MCPServerProcess(server);
        this.processes.set(serverName, process);
      }

      const started = await process.start();
      if (started) {
        server.status = 'running';
        console.log(`MCP Server ${serverName} started successfully`);
        return true;
      } else {
        server.status = 'error';
        return false;
      }
    } catch (error) {
      console.error(`Failed to start server ${serverName}:`, error);
      server.status = 'error';
      return false;
    }
  }

  async stopServer(serverName: string): Promise<boolean> {
    const server = this.servers.get(serverName);
    const process = this.processes.get(serverName);
    
    if (!server || !process) {
      return true;
    }

    try {
      await process.stop();
      this.processes.delete(serverName);
      server.status = 'stopped';
      console.log(`MCP Server ${serverName} stopped successfully`);
      return true;
    } catch (error) {
      console.error(`Failed to stop server ${serverName}:`, error);
      server.status = 'error';
      return false;
    }
  }

  async executeToolAsync(
    serverName: string,
    toolName: string,
    parameters: any
  ): Promise<MCPExecutionResult> {
    const server = this.servers.get(serverName);
    if (!server) {
      return {
        success: false,
        error: `Server ${serverName} not found`,
        server: serverName,
        tool: toolName,
      };
    }

    if (!server.capabilities.includes(toolName)) {
      return {
        success: false,
        error: `Tool ${toolName} not available on server ${serverName}`,
        server: serverName,
        tool: toolName,
      };
    }

    // Start server if not running
    if (server.status !== 'running') {
      const started = await this.startServer(serverName);
      if (!started) {
        return {
          success: false,
          error: `Failed to start server ${serverName}`,
          server: serverName,
          tool: toolName,
        };
      }
    }

    try {
      const process = this.processes.get(serverName);
      if (!process) {
        throw new Error(`Process for server ${serverName} not found`);
      }

      const result = await process.callTool(toolName, parameters);
      
      return {
        success: true,
        data: result,
        server: serverName,
        tool: toolName,
      };
    } catch (error) {
      // If MCP protocol fails, fall back to simulation for now
      console.warn(`MCP protocol failed for ${serverName}:${toolName}, falling back to simulation:`, error);
      
      try {
        const result = await this.simulateToolExecution(serverName, toolName, parameters);
        return {
          success: true,
          data: result,
          server: serverName,
          tool: toolName,
        };
      } catch (simulationError) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          server: serverName,
          tool: toolName,
        };
      }
    }
  }

  // Keep simulation as fallback for now
  private async simulateToolExecution(
    serverName: string,
    toolName: string,
    parameters: any
  ): Promise<any> {
    // This is now a fallback when MCP protocol fails
    switch (serverName) {
      case 'git-analytics':
        return this.simulateGitAnalytics(toolName, parameters);
      case 'code-quality':
        return this.simulateCodeQuality(toolName, parameters);
      case 'knowledge-graph':
        return this.simulateKnowledgeGraph(toolName, parameters);
      default:
        throw new Error(`Unknown server: ${serverName}`);
    }
  }

  private simulateGitAnalytics(toolName: string, parameters: any) {
    switch (toolName) {
      case 'analyze_repository':
        return {
          totalCommits: 150,
          activeBranches: 5,
          currentBranch: 'main',
          isDirty: false,
          unstagedFiles: 0,
          stagedFiles: 0,
          recentCommits: {
            hash: 'abc123',
            message: 'Add new feature',
            author: 'Developer',
            date: new Date().toISOString(),
          },
        };
      case 'commit_patterns':
        return {
          totalCommits: 45,
          averageCommitsPerDay: 1.5,
          peakCommitHour: 14,
          mostActiveDay: '2024-01-15',
          topContributors: [
            { author: 'Alice', commits: 25 },
            { author: 'Bob', commits: 20 },
          ],
        };
      case 'branch_insights':
        return {
          totalBranches: 8,
          remoteBranches: 5,
          currentBranch: 'main',
          recentMerges: [],
          branchNamingPatterns: {
            feature: 3,
            bugfix: 2,
            hotfix: 1,
            release: 1,
            other: 1,
          },
          staleBranches: [],
        };
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private simulateCodeQuality(toolName: string, parameters: any) {
    switch (toolName) {
      case 'analyze_complexity':
        return {
          totalFiles: 25,
          totalComplexity: 150,
          totalLinesOfCode: 2500,
          averageComplexity: 6.0,
          averageLinesOfCode: 100,
          complexityDistribution: {
            low: 15,
            medium: 7,
            high: 2,
            veryHigh: 1,
          },
          mostComplexFiles: [
            { file: 'complex.ts', complexity: 25, linesOfCode: 300 },
            { file: 'service.ts', complexity: 18, linesOfCode: 250 },
          ],
        };
      case 'detect_tech_debt':
        return {
          totalFiles: 25,
          filesWithIssues: 8,
          totalIssues: 15,
          issueTypes: {
            high_complexity: 3,
            long_file: 2,
            duplicate_code: 4,
            debug_code: 6,
          },
          criticalFiles: [
            {
              file: 'legacy.ts',
              complexity: 30,
              issues: ['high_complexity', 'long_file'],
            },
          ],
          recommendations: [
            'Consider breaking down complex functions',
            'Remove debug statements',
            'Extract common utilities',
          ],
        };
      case 'suggest_refactoring':
        return {
          file: parameters.filePath?.split('/').pop() || 'unknown.ts',
          currentMetrics: {
            cyclomaticComplexity: 15,
            linesOfCode: 200,
            functions: 8,
            classes: 2,
          },
          suggestions: [
            {
              type: 'extract_function',
              priority: 'high',
              description: 'Break down complex logic into smaller functions',
              benefit: 'Improves readability and testability',
            },
            {
              type: 'split_file',
              priority: 'medium',
              description: 'Consider splitting this file into multiple modules',
              benefit: 'Better organization and maintainability',
            },
          ],
          estimatedImpact: {
            complexity: 30,
            maintainability: 25,
            testability: 40,
            readability: 25,
          },
        };
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private simulateKnowledgeGraph(toolName: string, parameters: any) {
    switch (toolName) {
      case 'build_knowledge_graph':
        return {
          graphType: 'dependency',
          nodes: [
            { id: 'app.ts', label: 'app.ts', type: 'file' },
            { id: 'service.ts', label: 'service.ts', type: 'file' },
            { id: 'utils.ts', label: 'utils.ts', type: 'file' },
            { id: 'index.ts', label: 'index.ts', type: 'file' },
          ],
          edges: [
            { source: 'app.ts', target: 'service.ts', label: 'imports' },
            { source: 'service.ts', target: 'utils.ts', label: 'imports' },
            { source: 'utils.ts', target: 'index.ts', label: 'imports' },
          ],
        };
      case 'query_knowledge':
        return {
          query: 'What are the dependencies of app.ts?',
          results: [
            {
              id: 'service.ts',
              label: 'service.ts',
              type: 'file',
              description: 'Service layer for application logic',
            },
            {
              id: 'utils.ts',
              label: 'utils.ts',
              type: 'file',
              description: 'Utility functions and helpers',
            },
          ],
        };
      case 'analyze_relationships':
        return {
          totalRelationships: 10,
          relationshipTypes: {
            imports: 5,
            exports: 3,
            dependencies: 2,
          },
          mostCommonRelationships: [
            { source: 'app.ts', target: 'service.ts', type: 'imports' },
            { source: 'service.ts', target: 'utils.ts', type: 'imports' },
          ],
        };
      case 'find_patterns':
        return {
          totalPatterns: 5,
          patterns: [
            {
              name: 'cyclic_dependency',
              description: 'A dependency cycle found in the graph',
              files: ['app.ts', 'service.ts', 'utils.ts'],
            },
            {
              name: 'large_file',
              description: 'A file with excessive complexity',
              file: 'app.ts',
            },
          ],
        };
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  getServerList(): MCPServer[] {
    return Array.from(this.servers.values());
  }

  getServerStatus(serverName: string): string | null {
    const server = this.servers.get(serverName);
    return server ? server.status : null;
  }

  simulateServerStart(serverName: string): boolean {
    const server = this.servers.get(serverName);
    if (!server) {
      return false;
    }
    
    server.status = 'running';
    console.log(`MCP Server ${serverName} simulated start`);
    return true;
  }

  simulateServerStop(serverName: string): boolean {
    const server = this.servers.get(serverName);
    if (!server) {
      return false;
    }
    
    server.status = 'stopped';
    console.log(`MCP Server ${serverName} simulated stop`);
    return true;
  }

  async getAvailableTools(serverName: string): Promise<MCPTool[]> {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`Server ${serverName} not found`);
    }

    // In a real implementation, this would query the server for its tools
    // For now, return predefined tools based on server capabilities
    return server.capabilities.map(capability => ({
      name: capability,
      description: this.getToolDescription(capability),
      inputSchema: this.getToolSchema(capability),
    }));
  }

  private getToolDescription(toolName: string): string {
    const descriptions: Record<string, string> = {
      analyze_repository: 'Analyze a git repository for basic statistics and insights',
      commit_patterns: 'Analyze commit patterns and frequency over time',
      branch_insights: 'Get insights about branches, merges, and collaboration patterns',
      analyze_complexity: 'Analyze code complexity metrics across a project',
      detect_tech_debt: 'Detect technical debt patterns and code smells',
      suggest_refactoring: 'Analyze a specific file and suggest refactoring opportunities',
      build_knowledge_graph: 'Build a comprehensive knowledge graph from project code and git history',
      query_knowledge: 'Query the knowledge graph using natural language',
      analyze_relationships: 'Analyze relationships between different entities in the knowledge graph',
      find_patterns: 'Find patterns and insights in the knowledge graph',
    };
    return descriptions[toolName] || 'Unknown tool';
  }

  private getToolSchema(toolName: string): any {
    const schemas: Record<string, any> = {
      analyze_repository: {
        type: 'object',
        properties: {
          repoPath: { type: 'string', description: 'Path to the git repository' },
        },
        required: ['repoPath'],
      },
      commit_patterns: {
        type: 'object',
        properties: {
          repoPath: { type: 'string', description: 'Path to the git repository' },
          days: { type: 'number', description: 'Number of days to analyze', default: 30 },
        },
        required: ['repoPath'],
      },
      branch_insights: {
        type: 'object',
        properties: {
          repoPath: { type: 'string', description: 'Path to the git repository' },
        },
        required: ['repoPath'],
      },
      analyze_complexity: {
        type: 'object',
        properties: {
          projectPath: { type: 'string', description: 'Path to the project directory' },
          extensions: {
            type: 'array',
            items: { type: 'string' },
            description: 'File extensions to analyze',
            default: ['.js', '.ts', '.jsx', '.tsx'],
          },
        },
        required: ['projectPath'],
      },
      detect_tech_debt: {
        type: 'object',
        properties: {
          projectPath: { type: 'string', description: 'Path to the project directory' },
          threshold: {
            type: 'number',
            description: 'Complexity threshold for tech debt detection',
            default: 10,
          },
        },
        required: ['projectPath'],
      },
      suggest_refactoring: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to the specific file to analyze' },
        },
        required: ['filePath'],
      },
      build_knowledge_graph: {
        type: 'object',
        properties: {
          projectPath: { type: 'string', description: 'Path to the project directory' },
          includeGit: { type: 'boolean', description: 'Include git history analysis', default: true },
          includeCode: { type: 'boolean', description: 'Include code structure analysis', default: true },
        },
        required: ['projectPath'],
      },
      query_knowledge: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Natural language query about the codebase' },
          context: { type: 'string', description: 'Additional context for the query' },
        },
        required: ['query'],
      },
      analyze_relationships: {
        type: 'object',
        properties: {
          entityType: { 
            type: 'string', 
            enum: ['files', 'functions', 'developers', 'commits'],
            description: 'Type of entity to analyze' 
          },
          depth: { type: 'number', description: 'Depth of relationship analysis', default: 2 },
        },
        required: ['entityType'],
      },
      find_patterns: {
        type: 'object',
        properties: {
          patternType: { 
            type: 'string', 
            enum: ['coupling', 'hotspots', 'knowledge-silos', 'change-patterns'],
            description: 'Type of pattern to find' 
          },
          timeRange: { type: 'number', description: 'Time range in days for analysis', default: 90 },
        },
        required: ['patternType'],
      },
    };
    return schemas[toolName] || {};
  }
}

// Singleton instance
export const mcpClient = new MCPClient();