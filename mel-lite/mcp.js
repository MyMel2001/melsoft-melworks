// MelLite MCP Server - stdio JSON-RPC bridge for photo development operations
const FilterEngine = require('./src/filters');

function listTools() {
  return [
    {
      name: 'mellite_adjust_photo',
      description: 'Apply non-destructive photo development pipeline (exposure, contrast, saturation, white balance) to RGBA pixels.',
      inputSchema: {
        type: 'object',
        properties: {
          exposure: { type: 'number', description: 'Exposure EV (-5..5)' },
          contrast: { type: 'number', description: 'Contrast (-100..100)' },
          saturation: { type: 'number', description: 'Saturation (0..2)' },
          pixels: { type: 'array', items: { type: 'number' }, description: 'Flattened RGBA pixel values.' }
        },
        required: ['pixels']
      }
    }
  ];
}

async function callTool(name, args) {
  if (name === 'mellite_adjust_photo') {
    const pixels = args.pixels || [];
    const width = Math.max(1, Math.ceil(pixels.length / 4));
    const data = new Uint8ClampedArray(pixels.length);
    for (let i = 0; i < pixels.length; i++) data[i] = Math.max(0, Math.min(255, Number(pixels[i]) || 0));

    const image = { width, height: 1, data };
    const adjustments = {
      exposure: args.exposure || 0,
      contrast: args.contrast || 0,
      brightness: 0,
      saturation: args.saturation !== undefined ? args.saturation : 1,
      whiteBalance: { r: 1, g: 1, b: 1 },
      blur: 0,
      pixelate: 1,
      sharpen: 0
    };
    const out = FilterEngine.develop(image, adjustments);
    const mapped = [];
    for (let i = 0; i < out.data.length; i += 4) mapped.push(out.data[i], out.data[i + 1], out.data[i + 2]);
    return { content: [{ type: 'text', text: JSON.stringify({ tool: name, result: { mapped } }) }], isError: false };
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
        serverInfo: { name: 'mellite', version: '1.0.0' }
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
