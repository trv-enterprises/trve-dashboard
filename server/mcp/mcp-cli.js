#!/usr/bin/env node

/**
 * MCP CLI Server for Langflow
 * Provides stdio-based MCP server that proxies to our HTTP server
 */

import axios from 'axios';

const MCP_SERVER_URL = 'http://localhost:3001';
const MCP_MESSAGE_URL = `${MCP_SERVER_URL}/mcp/message`;

let messageId = 1;

/**
 * Send JSON-RPC message to HTTP server
 */
async function sendMessage(method, params = {}) {
  try {
    const response = await axios.post(MCP_MESSAGE_URL, {
      jsonrpc: '2.0',
      id: messageId++,
      method,
      params
    });

    return response.data.result;
  } catch (error) {
    console.error(JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: error.message
      }
    }));
    process.exit(1);
  }
}

/**
 * Handle incoming JSON-RPC request from stdin
 */
async function handleRequest(request) {
  const { jsonrpc, id, method, params } = request;

  if (jsonrpc !== '2.0') {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32600,
        message: 'Invalid JSON-RPC version'
      }
    };
  }

  try {
    const result = await sendMessage(method, params);

    return {
      jsonrpc: '2.0',
      id,
      result
    };
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: error.message
      }
    };
  }
}

/**
 * Read JSON-RPC messages from stdin
 */
function setupStdio() {
  let buffer = '';

  process.stdin.setEncoding('utf8');

  process.stdin.on('data', async (chunk) => {
    buffer += chunk;

    // Try to parse complete JSON messages
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        try {
          const request = JSON.parse(line);
          const response = await handleRequest(request);
          console.log(JSON.stringify(response));
        } catch (error) {
          console.error(JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: -32700,
              message: 'Parse error: ' + error.message
            }
          }));
        }
      }
    }
  });

  process.stdin.on('end', () => {
    process.exit(0);
  });
}

// Start the stdio server
setupStdio();

// Send server info on startup
console.error('MCP CLI Server for GiVi-Solution Dashboard');
console.error(`Proxying to: ${MCP_SERVER_URL}`);
