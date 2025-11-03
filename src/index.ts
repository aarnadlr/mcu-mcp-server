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


// MCP endpoint handler
const handleMcpRequest = async (req: Request, res: Response) => {
  console.log("Received MCP request:", req.method, req.body);

  try {
    // Android Studio compatibility: Return SSE stream for GET requests
    // Android Studio expects text/event-stream content type
    if (req.method === "GET") {
      console.log("Android Studio GET request - establishing SSE stream");
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.status(200);
      res.flushHeaders();
      
      // Keep connection alive - Android Studio expects this
      // The connection stays open for server-initiated messages
      const keepAlive = setInterval(() => {
        res.write(': keepalive\\n\\n');
      }, 30000);
      
      req.on('close', () => {
        clearInterval(keepAlive);
        console.log('Android Studio SSE connection closed');
      });
      
      return;
    }
    
    // Create a new server instance for each request to ensure clean state
    const { server } = createServer();
    const requestTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode
    });
    
    await server.connect(requestTransport);
    await requestTransport.handleRequest(req, res, req.body);
    
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
  process.exit(0);
});
