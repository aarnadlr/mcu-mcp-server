import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createServer, toolDefinitions } from '../src/create-server.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const { server } = createServer();
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
});

// Initialize once
let isConnected = false;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed.',
      },
      id: null,
    });
  }

  try {
    // Connect server to transport if not already connected
    if (!isConnected) {
      await server.connect(transport);
      isConnected = true;
    }

    const { method, id } = req.body;

    // Handle MCP protocol methods
    if (method === 'initialize') {
      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: 'weather',
            version: '1.0.0',
          },
        },
      });
    }

    if (method === 'tools/list') {
      return res.json({
        jsonrpc: '2.0',
        id,
        result: { tools: toolDefinitions },
      });
    }

    // For tools/call and other methods, use the transport
    await transport.handleRequest(req as any, res as any, req.body);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal server error',
        },
        id: req.body?.id || null,
      });
    }
  }
}
