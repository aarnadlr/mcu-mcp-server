#!/usr/bin/env node

const SERVER_URL = 'https://mcp-with-express-i0baawxnv-daydrmai.vercel.app/mcp';

async function mcpRequest(method, params = {}) {
  const response = await fetch(SERVER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: Date.now(),
    }),
  });
  
  // Handle both JSON and SSE response
  const text = await response.text();
  
  // If it's a plain JSON response (error cases), return it directly
  if (text.startsWith('{')) {
    return JSON.parse(text);
  }
  
  // Otherwise parse SSE format
  const lines = text.split('\n');
  let result = null;
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const jsonData = line.substring(6).trim();
      if (jsonData && jsonData !== '[DONE]') {
        result = JSON.parse(jsonData);
      }
    }
  }
  
  return result;
}

async function main() {
  console.log('🎨 Testing CorePalette Colors Tool\n');

  // 1. Initialize
  console.log('1. Initializing connection...');
  const initResult = await mcpRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'color-test-client', version: '1.0.0' },
  });
  console.log('✅ Initialized\n');

  // 2. Generate CorePalette colors with seed color #FF0062
  console.log('2. Generating CorePalette colors with seed color #FF0062...');
  const colorResult = await mcpRequest('tools/call', {
    name: 'generate_corepalette_colors',
    arguments: { seedColor: '#FF0062' },
  });
  
  if (colorResult.error) {
    console.log('❌ Error:', colorResult.error.message);
  } else if (colorResult.result?.content?.[0]?.text) {
    const colors = JSON.parse(colorResult.result.content[0].text);
    console.log('✅ CorePalette Colors:');
    console.log(JSON.stringify(colors, null, 2));
  } else {
    console.log('❌ Unexpected response format:');
    console.log(JSON.stringify(colorResult, null, 2));
  }
  
  console.log('\n✅ Test completed!');
}

main().catch(console.error);
