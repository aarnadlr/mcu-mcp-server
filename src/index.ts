import dotenv from "dotenv";
import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import { randomUUID } from "crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./create-server.js";

// Environment setup
dotenv.config();
const PORT = process.env.PORT || 3000;

// Initialize Express app
const app = express();

// Middleware setup
app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));
app.use(
  cors({
    origin: true,
    methods: "*",
    allowedHeaders: "Authorization, Origin, Content-Type, Accept, *",
  })
);
app.options("*", cors());

// Store server instances per session
const sessions = new Map<string, { server: any; transport: StreamableHTTPServerTransport }>();

// MCP endpoint handler
// MCP endpoint handler
const handleMcpRequest = async (req: Request, res: Response) => {
  console.log("=== Incoming MCP Request ===");
  console.log("Method:", req.method);
  console.log("Headers:", JSON.stringify(req.headers, null, 2));
  console.log("Body:", JSON.stringify(req.body, null, 2));
  console.log("Query:", JSON.stringify(req.query, null, 2));

  try {
    // Extract or generate session ID from headers or query params
    const sessionId = (req.headers['x-session-id'] as string) || 
                     (req.query.sessionId as string) || 
                     randomUUID();
    
    console.log(`Session ID: ${sessionId}`);
    
    // Get or create session
    let session = sessions.get(sessionId);
    if (!session) {
      console.log(`Creating new session: ${sessionId}`);
      const { server } = createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => sessionId, // Stateful mode with session ID
      });
      await server.connect(transport);
      session = { server, transport };
      sessions.set(sessionId, session);
      
      // Clean up session after 5 minutes of inactivity
      setTimeout(() => {
        if (sessions.has(sessionId)) {
          console.log(`Cleaning up inactive session: ${sessionId}`);
          sessions.delete(sessionId);
        }
      }, 5 * 60 * 1000);
    }
    
    // Android Studio compatibility: Return SSE stream for GET requests
    if (req.method === "GET") {
      console.log("Android Studio GET request - establishing SSE stream");
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Session-Id', sessionId);
      res.status(200);
      res.flushHeaders();
      
      const keepAlive = setInterval(() => {
        res.write(': keepalive\\n\\n');
      }, 30000);
      
      req.on('close', () => {
        clearInterval(keepAlive);
        console.log(`Android Studio SSE connection closed for session: ${sessionId}`);
      });
      
      return;
    }
    
    // Handle POST/DELETE requests with the session's transport
    await session.transport.handleRequest(req, res, req.body);
    
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
};

// MCP endpoints - handle all methods and let transport decide what's allowed
app.all("/mcp", handleMcpRequest);

// Start server
app.listen(PORT, () => {
  console.log(`MCP Streamable HTTP Server listening on port ${PORT}`);
});

// Handle server shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down server...");
  
  // Clean up all sessions
  for (const [sessionId, session] of sessions.entries()) {
    try {
      await session.transport.close();
      await session.server.close();
    } catch (error) {
      console.error(`Error closing session ${sessionId}:`, error);
    }
  }
  sessions.clear();
  
  process.exit(0);
});
