import { Router } from 'express';
import { mcpClient } from '../services/mcp-client';

const router = Router();

// List available MCP servers
router.get('/servers', async (req, res) => {
  try {
    const servers = mcpClient.getServerList();
    res.json(servers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list MCP servers' });
  }
});

// Get available tools for a specific server
router.get('/servers/:serverName/tools', async (req, res) => {
  try {
    const { serverName } = req.params;
    const tools = await mcpClient.getAvailableTools(serverName);
    res.json(tools);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get server tools' });
  }
});

// Start MCP server
router.post('/servers/:serverName/start', async (req, res) => {
  try {
    const { serverName } = req.params;
    // Simulate server start for now
    const success = mcpClient.simulateServerStart(serverName);
    
    if (success) {
      res.json({ success: true, message: `Server ${serverName} started` });
    } else {
      res.status(500).json({ error: `Failed to start server ${serverName}` });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to start MCP server' });
  }
});

// Stop MCP server
router.post('/servers/:serverName/stop', async (req, res) => {
  try {
    const { serverName } = req.params;
    // Simulate server stop for now
    const success = mcpClient.simulateServerStop(serverName);
    
    if (success) {
      res.json({ success: true, message: `Server ${serverName} stopped` });
    } else {
      res.status(500).json({ error: `Failed to stop server ${serverName}` });
    }
  } catch (error) {
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

    const result = await mcpClient.executeToolAsync(server, tool, parameters || {});
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to execute MCP tool' });
  }
});

export { router as mcpRouter };