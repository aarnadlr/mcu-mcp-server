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

// Store active sessions for cleanup with timestamp
const activeSessions = new Map<string, { server: any; transport: StreamableHTTPServerTransport; lastActivity: number }>();

// Session timeout in milliseconds (30 minutes)
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

// MCP endpoint handler - creates new server per session
const handleMcpRequest = async (req: Request, res: Response) => {
  console.log(`${req.method} /mcp - ${req.body?.method || 'unknown'}`);

  try {
    // Get or create session ID
    const sessionId = req.headers['x-session-id'] as string || randomUUID();
    
    // Create new server and transport for this session if needed
    if (!activeSessions.has(sessionId)) {
      const { server } = createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => sessionId,
      });
      
      await server.connect(transport);
      activeSessions.set(sessionId, { server, transport, lastActivity: Date.now() });
      console.log(`Created new session: ${sessionId}`);
    }
    
    // Update last activity timestamp
    const session = activeSessions.get(sessionId)!;
    session.lastActivity = Date.now();
    const { transport } = session;
    await transport.handleRequest(req, res, req.body);
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

// Health check endpoint for Railway
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    activeSessions: activeSessions.size,
    timestamp: new Date().toISOString(),
  });
});

// MCP endpoints - handle all methods and let transport decide what's allowed
app.all("/mcp", handleMcpRequest);

// Cleanup inactive sessions periodically
const cleanupInterval = setInterval(async () => {
  const now = Date.now();
  const expiredSessions: string[] = [];
  
  for (const [sessionId, { server, transport, lastActivity }] of activeSessions.entries()) {
    if (now - lastActivity > SESSION_TIMEOUT_MS) {
      expiredSessions.push(sessionId);
      console.log(`Cleaning up expired session: ${sessionId}`);
      try {
        await transport.close();
        await server.close();
      } catch (error) {
        console.error(`Error closing session ${sessionId}:`, error);
      }
    }
  }
  
  expiredSessions.forEach(id => activeSessions.delete(id));
  
  if (expiredSessions.length > 0) {
    console.log(`Cleaned up ${expiredSessions.length} expired session(s). Active: ${activeSessions.size}`);
  }
}, 5 * 60 * 1000); // Check every 5 minutes

// Start Express server
app.listen(PORT, () => {
  console.log(`MCP Server listening on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
});

// Handle server shutdown
const shutdown = async (signal: string) => {
  console.log(`${signal} received, shutting down server...`);
  
  // Stop cleanup interval
  clearInterval(cleanupInterval);
  
  // Close all active sessions
  console.log(`Closing ${activeSessions.size} active session(s)...`);
  for (const [sessionId, { server, transport }] of activeSessions.entries()) {
    console.log(`Closing session: ${sessionId}`);
    try {
      await transport.close();
      await server.close();
    } catch (error) {
      console.error(`Error closing session ${sessionId}:`, error);
    }
  }
  
  activeSessions.clear();
  console.log("Shutdown complete");
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM")); // Railway uses SIGTERM
