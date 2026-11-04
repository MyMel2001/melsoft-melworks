// MelCromedia MCP Server - stdio JSON-RPC bridge for Flash vector authoring & AS3 compiler operations
const As3Engine = require('./src/as3');

function listTools() {
  return [
    {
      name: 'melcromedia_check_as3_syntax',
      description: 'Check ActionScript 3.0 source code for syntax errors and warnings.',
      inputSchema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'ActionScript 3.0 source text.' }
        },
        required: ['code']
      }
    },
    {
      name: 'melcromedia_compile_as3',
      description: 'Compile ActionScript 3.0 source text into an AVM2 ABC bytecode block.',
      inputSchema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'ActionScript 3.0 source text.' },
          blockName: { type: 'string', description: 'Name of the compiled block, e.g. "frame_1".' }
        },
        required: ['code']
      }
    }
  ];
}

async function callTool(name, args) {
  if (name === 'melcromedia_check_as3_syntax') {
    const code = (args && args.code) || '';
    const res = As3Engine.checkSyntax(code);
    return { content: [{ type: 'text', text: JSON.stringify({ tool: name, result: res }) }], isError: false };
  }

  if (name === 'melcromedia_compile_as3') {
    const code = (args && args.code) || '';
    const blockName = (args && args.blockName) || 'frame_actions';
    const compiled = As3Engine.compile(code, blockName);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          tool: name,
          result: {
            name: compiled.name,
            byteLength: compiled.byteLength,
            disassembly: compiled.disassembly.instructions
          }
        })
      }],
      isError: false
    };
  }

  return { content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${name}` }) }], isError: true };
}

async function handleRequest(message) {
  const method = message.method;
  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'melcromedia', version: '1.0.0' }
      }
    };
  }
  if (method === 'notifications/initialized') return null;
  if (method === 'ping') return { jsonrpc: '2.0', id: message.id, result: {} };
  if (method === 'tools/list') return { jsonrpc: '2.0', id: message.id, result: { tools: listTools() } };
  if (method === 'tools/call') {
    const tool = (message.params && message.params.name) || '';
    const args = (message.params && message.params.arguments) || {};
    const callResult = await callTool(tool, args);
    return { jsonrpc: '2.0', id: message.id, result: callResult };
  }
  return { jsonrpc: '2.0', id: message.id, error: { code: -32601, message: `Method not found: ${method}` } };
}

module.exports = { listTools, callTool, handleRequest };

if (require.main === module) {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
  rl.on('line', async (line) => {
    if (!line.trim()) return;
    try {
      const req = JSON.parse(line);
      const res = await handleRequest(req);
      if (res) console.log(JSON.stringify(res));
    } catch (err) {
      console.log(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }));
    }
  });
}
