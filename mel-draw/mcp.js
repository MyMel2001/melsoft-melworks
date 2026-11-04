// MelDraw MCP Server - stdio JSON-RPC bridge for Image & PSD operations
const FilterEngine = require('./src/filters');

function listTools() {
  return [
    {
      name: 'meldraw_apply_curves',
      description: 'Apply curves point mapping to RGBA pixel values.',
      inputSchema: {
        type: 'object',
        properties: {
          points: { type: 'array', items: { type: 'object' } },
          channel: { type: 'string', enum: ['rgb', 'r', 'g', 'b'], default: 'rgb' },
          pixels: { type: 'array', items: { type: 'number' }, description: 'Flattened RGBA pixel values.' }
        },
        required: ['points', 'pixels']
      }
    },
    {
      name: 'meldraw_apply_filters',
      description: 'Apply pixel filter (brightness/contrast/invert/grayscale/sepia/threshold/sharpen/blur) to RGBA pixel values.',
      inputSchema: {
        type: 'object',
        properties: {
          filter: { type: 'string', enum: ['brightness', 'contrast', 'invert', 'grayscale', 'sepia', 'threshold', 'sharpen', 'blur'] },
          brightness: { type: 'number' },
          contrast: { type: 'number' },
          threshold: { type: 'number' },
          pixels: { type: 'array', items: { type: 'number' } }
        },
        required: ['filter', 'pixels']
      }
    }
  ];
}

async function callTool(name, args) {
  if (name === 'meldraw_apply_curves') {
    const points = args.points || [];
    const channel = args.channel || 'rgb';
    const pixels = args.pixels || [];
    const width = Math.max(1, Math.ceil(pixels.length / 4));
    const data = new Uint8ClampedArray(pixels.length);
    for (let i = 0; i < pixels.length; i++) data[i] = Math.max(0, Math.min(255, Number(pixels[i]) || 0));

    const out = FilterEngine.applyCurves({ width, height: 1, data }, { points }, channel);
    const mapped = [];
    for (let i = 0; i < out.data.length; i += 4) mapped.push(out.data[i], out.data[i + 1], out.data[i + 2]);
    return { content: [{ type: 'text', text: JSON.stringify({ tool: name, result: { mapped } }) }], isError: false };
  }

  if (name === 'meldraw_apply_filters') {
    const filter = args.filter || 'grayscale';
    const pixels = args.pixels || [];
    const width = Math.max(1, Math.ceil(pixels.length / 4));
    const data = new Uint8ClampedArray(pixels.length);
    for (let i = 0; i < pixels.length; i++) data[i] = Math.max(0, Math.min(255, Number(pixels[i]) || 0));

    const imageData = { width, height: 1, data };
    let out;
    if (filter === 'grayscale') out = FilterEngine.applyGrayscale(imageData);
    else if (filter === 'sepia') out = FilterEngine.applySepia(imageData);
    else if (filter === 'invert') out = FilterEngine.applyInvert(imageData);
    else if (filter === 'brightness') out = FilterEngine.applyBrightness(imageData, args.brightness || 0);
    else if (filter === 'contrast') out = FilterEngine.applyContrast(imageData, args.contrast || 0);
    else if (filter === 'threshold') out = FilterEngine.applyThreshold(imageData, args.threshold !== undefined ? args.threshold : 128);
    else if (filter === 'sharpen') out = FilterEngine.applySharpen(imageData);
    else if (filter === 'blur') out = FilterEngine.applyBlur(imageData);
    else out = imageData;

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
        serverInfo: { name: 'meldraw', version: '1.0.0' }
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
