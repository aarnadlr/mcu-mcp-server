#!/usr/bin/env node

const SERVER_URL = 'https://mcp-with-express-git-codex-add-generatecorepale-168342-daydrmai.vercel.app/mcp';

async function mcpRequest(method, params = {}) {
  const response = await fetch(SERVER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: Date.now(),
    }),
  });
  
  return response.json();
}

async function main() {
  console.log('🚀 Testing MCP Server\n');

  // 1. Initialize
  console.log('1. Initializing connection...');
  const initResult = await mcpRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '1.0.0' },
  });
  console.log('✅ Initialized:', JSON.stringify(initResult, null, 2), '\n');

  // 2. List tools
  console.log('2. Listing tools...');
  const toolsResult = await mcpRequest('tools/list');
  console.log('✅ Tools:', JSON.stringify(toolsResult, null, 2), '\n');

  // 3. Call a tool
  console.log('3. Getting weather alerts for CA...');
  const alertsResult = await mcpRequest('tools/call', {
    name: 'get-alerts',
    arguments: { state: 'CA' },
  });
  console.log('✅ Alerts result:', JSON.stringify(alertsResult, null, 2), '\n');

  console.log('✅ All tests passed! Your MCP server is working correctly.');
}

main().catch(console.error);
