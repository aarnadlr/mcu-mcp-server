# Express MCP Server on Vercel

Model Context Protocol (MCP) server built with Express.js that provides weather data tools.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/git/external?repository-url=https://github.com/vercel-labs/express-mcp&project-name=express-mcp&repository-name=express-mcp)

### Clone and run locally

```bash
git clone https://github.com/vercel-labs/express-mcp
pnpm i
pnpm dev
```

## Features

This MCP server provides weather-related tools:

- **get-alerts**: Get weather alerts for a US state (requires 2-letter state code)
- **get-forecast**: Get weather forecast for a location (requires latitude/longitude)

## Testing

You can connect to the server using [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) or any other MCP client.
Be sure to include the `/mcp` path in the connection URL (e.g., `https://your-deployment.vercel.app/mcp`).

## API Endpoints

- `POST /mcp`: Handles incoming messages for the MCP protocol
