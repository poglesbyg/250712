"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcpRouter = void 0;
const express_1 = require("express");
const mcp_client_1 = require("../services/mcp-client");
const router = (0, express_1.Router)();
exports.mcpRouter = router;
// List available MCP servers
router.get('/servers', async (req, res) => {
    try {
        const servers = mcp_client_1.mcpClient.getServerList();
        res.json(servers);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to list MCP servers' });
    }
});
// Get available tools for a specific server
router.get('/servers/:serverName/tools', async (req, res) => {
    try {
        const { serverName } = req.params;
        const tools = await mcp_client_1.mcpClient.getAvailableTools(serverName);
        res.json(tools);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get server tools' });
    }
});
// Start MCP server
router.post('/servers/:serverName/start', async (req, res) => {
    try {
        const { serverName } = req.params;
        const success = await mcp_client_1.mcpClient.startServer(serverName);
        if (success) {
            res.json({ success: true, message: `Server ${serverName} started` });
        }
        else {
            res.status(500).json({ error: `Failed to start server ${serverName}` });
        }
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to start MCP server' });
    }
});
// Stop MCP server
router.post('/servers/:serverName/stop', async (req, res) => {
    try {
        const { serverName } = req.params;
        const success = await mcp_client_1.mcpClient.stopServer(serverName);
        if (success) {
            res.json({ success: true, message: `Server ${serverName} stopped` });
        }
        else {
            res.status(500).json({ error: `Failed to stop server ${serverName}` });
        }
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to stop MCP server' });
    }
});
// Execute MCP server tool
router.post('/execute', async (req, res) => {
    try {
        const { server, tool, parameters } = req.body;
        if (!server || !tool) {
            return res.status(400).json({ error: 'Server and tool are required' });
        }
        const result = await mcp_client_1.mcpClient.executeToolAsync(server, tool, parameters || {});
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to execute MCP tool' });
    }
});
//# sourceMappingURL=mcp.js.map