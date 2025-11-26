/**
 * MCP SSE (Server-Sent Events) Transport
 * Implements MCP protocol over SSE for real-time communication
 */

import mcpServer from './mcpServer.js';

class MCPSSETransport {
  constructor() {
    this.clients = new Map();
    this.messageId = 0;
  }

  /**
   * Setup SSE routes
   */
  setupRoutes(app) {
    // SSE endpoint for MCP protocol
    app.get('/mcp/sse', (req, res) => {
      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');

      // Generate client ID
      const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Store client connection
      this.clients.set(clientId, res);

      // Send initial connection message
      this.sendMessage(res, {
        jsonrpc: '2.0',
        method: 'connection.established',
        params: {
          clientId,
          serverInfo: {
            name: 'GiVi-Solution MCP Server',
            version: '1.0.0',
            capabilities: {
              tools: true,
              datasources: true,
              components: true,
              caching: true
            }
          }
        }
      });

      // Handle client disconnect
      req.on('close', () => {
        this.clients.delete(clientId);
        console.log(`MCP SSE client disconnected: ${clientId}`);
      });

      console.log(`MCP SSE client connected: ${clientId}`);
    });

    // POST endpoint for client-to-server messages
    app.post('/mcp/message', async (req, res) => {
      try {
        const { jsonrpc, id, method, params } = req.body;

        console.log(`[MCP] Received request: method=${method}, id=${id}`);
        if (params) {
          console.log(`[MCP] Request params:`, JSON.stringify(params, null, 2));
        }

        if (jsonrpc !== '2.0') {
          console.error(`[MCP] Invalid JSON-RPC version: ${jsonrpc}`);
          return res.status(400).json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32600,
              message: 'Invalid JSON-RPC version'
            }
          });
        }

        // Handle different MCP methods
        let result;
        switch (method) {
          case 'initialize':
            result = await this.handleInitialize(params);
            console.log(`[MCP] Initialize result:`, result);
            break;

          case 'tools/list':
            result = await this.handleListTools();
            console.log(`[MCP] Tools list: ${result.tools.length} tools`);
            break;

          case 'tools/call':
            result = await this.handleToolCall(params);
            console.log(`[MCP] Tool call result:`, result);
            break;

          default:
            console.error(`[MCP] Method not found: ${method}`);
            return res.status(400).json({
              jsonrpc: '2.0',
              id,
              error: {
                code: -32601,
                message: `Method not found: ${method}`
              }
            });
        }

        // Send successful response
        console.log(`[MCP] Sending success response for ${method}`);
        res.json({
          jsonrpc: '2.0',
          id,
          result
        });
      } catch (error) {
        console.error(`[MCP] Error handling request:`, error);
        console.error(`[MCP] Error stack:`, error.stack);
        res.status(500).json({
          jsonrpc: '2.0',
          id: req.body.id,
          error: {
            code: -32603,
            message: error.message,
            data: { stack: error.stack }
          }
        });
      }
    });
  }

  /**
   * Handle initialize request
   */
  async handleInitialize(params) {
    return {
      protocolVersion: '2024-11-05',
      serverInfo: {
        name: 'GiVi-Solution MCP Server',
        version: '1.0.0'
      },
      capabilities: {
        tools: {}
      }
    };
  }

  /**
   * Handle list tools request
   */
  async handleListTools() {
    const tools = mcpServer.getToolDefinitions();
    return { tools };
  }

  /**
   * Handle tool call request
   */
  async handleToolCall(params) {
    const { name, arguments: args } = params;
    const result = await mcpServer.handleToolCall(name, args || {});

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.result;
  }

  /**
   * Send SSE message to client
   */
  sendMessage(res, data) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    res.write(message);
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(data) {
    for (const [clientId, res] of this.clients) {
      this.sendMessage(res, data);
    }
  }
}

const mcpSSE = new MCPSSETransport();
export default mcpSSE;
