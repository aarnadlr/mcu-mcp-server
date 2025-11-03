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
  console.log("=== Incoming MCP Request ===");
  console.log("Method:", req.method);
  console.log("Headers:", JSON.stringify(req.headers, null, 2));
  console.log("Body:", JSON.stringify(req.body, null, 2));
  console.log("Query:", JSON.stringify(req.query, null, 2));

  try {
    // Handle DELETE requests (session cleanup) - just return success
    if (req.method === "DELETE") {
      console.log("DELETE request - acknowledging session cleanup");
      res.status(200).json({ ok: true });
      return;
    }
    
    // Handle GET requests (not used in stateless mode)
    if (req.method === "GET") {
      console.log("GET request - not supported in stateless mode");
      res.status(405).json({ error: "GET not supported in stateless mode" });
      return;
    }
    
    // For POST requests: create fresh server instance per request
    console.log("Creating fresh server instance for stateless request");
    const { server } = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(), // Generate session ID per request
    });
    
    await server.connect(transport);
    
    // Check if this is an initialize request
    const body = req.body;
    if (body && body.method === 'initialize') {
      console.log("Initialize request detected");
    } else {
      console.log("Non-initialize request:", body?.method);
    }
    
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

// Start server
app.listen(PORT, () => {
  console.log(`MCP Streamable HTTP Server listening on port ${PORT}`);
});

// Handle server shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down server...");
  process.exit(0);
});
