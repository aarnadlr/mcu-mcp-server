import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createServer } from '../src/create-server.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

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
    const { server } = createServer();
    const transport = new SSEServerTransport('/message', res);
    
    await server.connect(transport);
    await transport.handlePostMessage(req.body);
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
