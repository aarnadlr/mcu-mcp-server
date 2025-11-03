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

// Initialize transport in stateless mode
// Note: GET requests won't work in stateless mode per MCP spec
// Android Studio should use POST requests for all operations
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined, // Stateless mode
});

// MCP endpoint handler
const handleMcpRequest = async (req: Request, res: Response) => {
  console.log("Received MCP request:", req.method, req.body);

  try {
    // Android Studio compatibility: Return 200 OK for GET requests immediately
    // Android Studio expects GET to succeed when "starting" the MCP server
    if (req.method === "GET") {
      console.log("Android Studio GET request - returning 200 OK");
      res.status(200).json({
        jsonrpc: "2.0",
        result: {
          status: "ready",
          message: "MCP server is ready"
        },
        id: null
      });
      return;
    }
    
    // Let the transport handle POST/DELETE requests
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

// MCP endpoints - handle all methods and let transport decide what's allowed
app.all("/mcp", handleMcpRequest);

const { server } = createServer();

// Server setup
const setupServer = async () => {
  try {
    await server.connect(transport);
    console.log("Server connected successfully");
    
    // Auto-initialize the transport for Android Studio compatibility
    // This bypasses the normal initialization handshake
    (transport as any)._initialized = true;
    console.log("Transport pre-initialized for Android Studio");
  } catch (error) {
    console.error("Failed to set up the server:", error);
    throw error;
  }
};

// Start server
setupServer()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`MCP Streamable HTTP Server listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });

// Handle server shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down server...");
  try {
    console.log(`Closing transport`);
    await transport.close();
  } catch (error) {
    console.error(`Error closing transport:`, error);
  }

  try {
    await server.close();
    console.log("Server shutdown complete");
  } catch (error) {
    console.error("Error closing server:", error);
  }
  process.exit(0);
});
