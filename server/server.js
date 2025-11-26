/**
 * MCP Server for GiVi-Solution Dashboard
 *
 * This is a standalone MCP (Model Context Protocol) server that provides
 * AI tools for dashboard component generation. The main REST API is handled
 * by the Go backend (server-go/).
 *
 * Endpoints:
 *   GET  /mcp/sse     - SSE endpoint for MCP protocol
 *   POST /mcp/message - Client-to-server MCP messages
 *   GET  /health      - Health check
 */

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import mcpSSE from './mcp/mcpSSE.js';

const app = express();
const PORT = process.env.MCP_PORT || 3002;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// MCP SSE Routes
mcpSSE.setupRoutes(app);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'mcp-server',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║           GiVi-Solution MCP Server                             ║
║                                                                ║
║  MCP Endpoints:                                                ║
║    SSE:     http://localhost:${PORT}/mcp/sse                       ║
║    Message: http://localhost:${PORT}/mcp/message                   ║
║    Health:  http://localhost:${PORT}/health                        ║
║                                                                ║
║  Note: Main REST API is served by Go backend on port 3001     ║
╚════════════════════════════════════════════════════════════════╝
  `);
});
