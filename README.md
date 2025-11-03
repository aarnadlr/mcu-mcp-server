# MCU MCP Server

Model Context Protocol (MCP) server built with Express.js that exposes a tool which generates a color scheme based on a provided seed color.

## Features

This MCP server provides color-related tools.

## Testing

You can connect to the server using [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) or any other MCP client.
Be sure to include the `/mcp` path in the connection URL (e.g., `https://your-deployment.abc.app/mcp`).

## API Endpoints

- `POST /mcp`: Handles incoming messages for the MCP protocol
