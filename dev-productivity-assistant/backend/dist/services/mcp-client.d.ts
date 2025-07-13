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
declare class MCPClient {
    private servers;
    private processes;
    constructor();
    private initializeDefaultServers;
    registerServer(server: MCPServer): void;
    startServer(serverName: string): Promise<boolean>;
    stopServer(serverName: string): Promise<boolean>;
    executeToolAsync(serverName: string, toolName: string, parameters: any): Promise<MCPExecutionResult>;
    private simulateToolExecution;
    private simulateGitAnalytics;
    private simulateCodeQuality;
    getServerList(): MCPServer[];
    getServerStatus(serverName: string): string | null;
    getAvailableTools(serverName: string): Promise<MCPTool[]>;
    private getToolDescription;
    private getToolSchema;
}
export declare const mcpClient: MCPClient;
export {};
//# sourceMappingURL=mcp-client.d.ts.map