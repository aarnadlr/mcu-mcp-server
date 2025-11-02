#!/usr/bin/env node

// const SERVER_URL = 'https://mcp-with-express-git-main-daydrmai.vercel.app/mcp';
const SERVER_URL = 'https://mcu-mcp.vercel.app/mcp';

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
  
  const contentType = response.headers.get('content-type');
  console.log('Response Content-Type:', contentType);
  console.log('Response Status:', response.status);
  
  // Handle SSE response (text/event-stream)
  if (contentType && contentType.includes('text/event-stream')) {
    return new Promise((resolve, reject) => {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const messages = [];
      let timeout = null;
      
      // Set a timeout to close the stream if server doesn't close it
      const resetTimeout = () => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
          console.log('Stream timeout - closing after', messages.length, 'messages');
          reader.cancel();
          resolve(messages.length > 0 ? messages[messages.length - 1] : null);
        }, 1000); // 1 second timeout after last message
      };
      
      function readChunk() {
        reader.read().then(({ done, value }) => {
          if (done) {
            if (timeout) clearTimeout(timeout);
            console.log('Stream ended, received', messages.length, 'messages');
            // Return the last response message (should be the result)
            resolve(messages.length > 0 ? messages[messages.length - 1] : null);
            return;
          }
          
          buffer += decoder.decode(value, { stream: true });
          
          // SSE events are separated by double newlines
          const events = buffer.split('\n\n');
          
          // Keep the last partial event in the buffer
          buffer = events.pop() || '';
          
          for (const event of events) {
            if (!event.trim()) continue;
            
            const lines = event.split('\n');
            let data = null;
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                data = line.substring(6).trim();
              }
              // Ignore event:, id:, and other SSE fields
            }
            
            if (data && data !== '[DONE]') {
              // Skip non-JSON data (like endpoint URLs)
              if (!data.startsWith('{') && !data.startsWith('[')) {
                console.log('Skipping non-JSON data:', data);
                continue;
              }
              
              try {
                const msg = JSON.parse(data);
                console.log('Received message:', msg.method || (msg.result ? 'result' : 'other'));
                messages.push(msg);
                resetTimeout(); // Reset timeout after receiving a message
              } catch (e) {
                console.error('Failed to parse SSE data:', data);
              }
            }
          }
          
          readChunk();
        }).catch(reject);
      }
      
      readChunk();
    });
  }
  
  // Handle JSON response (error cases or application/json)
  const text = await response.text();
  if (text.startsWith('{')) {
    return JSON.parse(text);
  }
  
  return null;
}

async function main() {
  console.log('🎨 Testing CorePalette Colors Tool\n');
  console.log(`📡 Server URL: ${SERVER_URL}\n`);

  // Initialize the MCP server first
  console.log('Initializing MCP server...');
  const initResult = await mcpRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  });
  
  if (initResult.error) {
    console.log('❌ Initialization Error:', initResult.error.message);
    return;
  }
  console.log('✅ Server initialized\n');

  // Generate CorePalette colors with seed color #FF0062
  console.log('Generating CorePalette colors with seed color #FF0062...');
  
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
