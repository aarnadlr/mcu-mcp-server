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

// Create single shared MCP server and transport for stateful operation
const { server } = createServer();
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
});

// MCP endpoint handler
const handleMcpRequest = async (req: Request, res: Response) => {
  console.log(`${req.method} /mcp - ${req.body?.method || 'unknown'}`);

  try {
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

// Connect MCP server to transport and start Express
server.connect(transport).then(() => {
  app.listen(PORT, () => {
    console.log(`MCP Server listening on port ${PORT}`);
  });
}).catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});

// Handle server shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down server...");
  await transport.close();
  await server.close();
  process.exit(0);
});
