# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is an Express.js server implementing the Model Context Protocol (MCP) with StreamableHTTPServerTransport. It provides weather-related tools via the National Weather Service (NWS) API and Material Design color scheme generation powered by Google's Material Color Utilities (MCU).

## Development Commands

**Build:**
```bash
pnpm run build
```
Compiles TypeScript to JavaScript in the `build/` directory and sets executable permissions.

**Development mode:**
```bash
pnpm dev
```
Runs TypeScript compiler in watch mode alongside nodemon for auto-reloading.

**Watch TypeScript only:**
```bash
pnpm run watch
```

**Start production server:**
```bash
pnpm start
```
Runs the compiled JavaScript from `build/index.js`.

**Prepare (runs automatically on install):**
```bash
pnpm run prepare
```

## Architecture

### Core Components

**`src/index.ts`** - Express application entry point
- Sets up Express server with CORS and JSON middleware
- Initializes StreamableHTTPServerTransport for stateless MCP communication
- Exposes POST `/mcp` endpoint for MCP protocol requests
- Handles server lifecycle (startup, shutdown via SIGINT)
- Port configurable via `PORT` environment variable (default: 3000)

**`src/create-server.ts`** - MCP server factory and tool definitions
- Creates McpServer instance with tool registrations
- Implements weather tools using NWS API:
  - `get-alerts`: Fetches weather alerts by 2-letter US state code
  - `get-forecast`: Fetches weather forecast by latitude/longitude coordinates
- Registers Material Design color tooling:
  - `generate_color_scheme`: Generates 10-role JSON palette from Material Color Utilities using a seed color and scheme variant
- All NWS API requests include `User-Agent: weather-app/1.0` header
- Returns structured error messages when API calls fail

**`src/tools/color-scheme.ts`** - MCU integration helpers
- Normalizes scheme categories and maps them to MCU `Scheme*` classes
- Builds dynamic color schemes from seed hex colors (light mode, neutral contrast by default)
- Extracts a curated set of 10 Material roles (primary/onPrimary/etc.) to hex codes

### Key Technical Details

- **Transport:** StreamableHTTPServerTransport with `sessionIdGenerator: undefined` for stateless operation
- **MCP Tools:** Defined using Zod schemas for parameter validation
- **Material Color Utilities:** Uses the TypeScript MCU library vendored in `material-color-utilities/typescript`
- **API Integration:** National Weather Service API (https://api.weather.gov) - only supports US locations
- **TypeScript Configuration:** Targets ES2022 with NodeNext module resolution, outputs to `build/`

## Testing the Server

Connect using [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) or any MCP client at:
```
http://localhost:3000/mcp
```

When deployed to Vercel, use the full deployment URL with `/mcp` path.

### Sample MCP Tool Invocations

**Generate a vibrant palette**
```json
{
  "method": "tools.call",
  "params": {
    "name": "generate_color_scheme",
    "arguments": {
      "seedColor": "#6200EE",
      "category": "vibrant"
    }
  }
}
```

**Request California weather alerts**
```json
{
  "method": "tools.call",
  "params": {
    "name": "get-alerts",
    "arguments": {
      "state": "CA"
    }
  }
}
```

## Important Notes

- MCU integration relies on vendored source—no additional npm install is required
- `generate_color_scheme` currently outputs light-mode palettes with neutral contrast (dynamic scheme generation)
- NWS API only supports US locations; international coordinates will fail
- The server is stateless (no session management)
- Only POST requests are accepted at `/mcp` endpoint (GET/DELETE return 405)
- Environment variables can be configured via `.env` file (uses dotenv)
