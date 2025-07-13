"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const ws_1 = require("ws");
const http_1 = require("http");
const dotenv_1 = __importDefault(require("dotenv"));
const analytics_1 = require("./routes/analytics");
const automation_1 = require("./routes/automation");
const insights_1 = require("./routes/insights");
const mcp_1 = require("./routes/mcp");
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const wss = new ws_1.WebSocketServer({ server });
const PORT = process.env.PORT || 3001;
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express_1.default.json());
// Routes
app.use('/api/analytics', analytics_1.analyticsRouter);
app.use('/api/automation', automation_1.automationRouter);
app.use('/api/insights', insights_1.insightsRouter);
app.use('/api/mcp', mcp_1.mcpRouter);
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// WebSocket for real-time updates
wss.on('connection', (ws) => {
    console.log('Client connected');
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            // Handle real-time requests
            console.log('Received:', message);
        }
        catch (error) {
            console.error('Invalid message format:', error);
        }
    });
    ws.on('close', () => {
        console.log('Client disconnected');
    });
});
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`WebSocket server ready`);
});
//# sourceMappingURL=index.js.map