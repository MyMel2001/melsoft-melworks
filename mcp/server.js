// MelSoft MCP Server - stdio JSON-RPC bridge so AI agents can drive the suite
// Protocol: MCP stdio transport (JSON-RPC 2.0, newline-delimited JSON)
const path = require('path');
const { createRequire } = require('module');

const melOfficeRequire = createRequire(path.join(__dirname, '..', 'mel-office', 'package.json'));
const XlsxSpreadsheet = melOfficeRequire('./src/xlsx');
const melDrawRequire = createRequire(path.join(__dirname, '..', 'mel-draw', 'package.json'));
const FilterEngine = melDrawRequire('./src/filters');

function listTools() {
  return [
    {
      name: 'meloffice_evaluate_formula',
      description: 'Evaluate a spreadsheet formula (e.g. =SUM(B2:B5), =B2*C2) against a MelOffice cell map.',
      inputSchema: {
        type: 'object',
        properties: {
          formula: { type: 'string', description: 'Formula text, with or without leading "=". Example: "SUM(B2:B5)" or "=SUM(B2:B5)".' },
          cells: {
            type: 'object',
            description: 'Optional cell map: { "A1": { "value": 10 }, "B2": { "formula": "A1*2" } }'
          }
        },
        required: ['formula']
      }
    },
    {
      name: 'meldraw_apply_curves',
      description: 'Apply a Photoshop-style curves point mapping to RGBA pixel values.',
      inputSchema: {
        type: 'object',
        properties: {
          points: {
            type: 'array',
            items: {
              type: 'object',
              properties: { input: { type: 'number' }, output: { type: 'number' } },
              required: ['input', 'output']
            }
          },
          channel: { type: 'string', enum: ['rgb', 'r', 'g', 'b'], default: 'rgb' },
          pixels: { type: 'array', items: { type: 'number' }, description: 'Flattened RGBA pixel values.' }
        },
        required: ['points', 'pixels']
      }
    }
  ];
}

function callTool(name, args) {
  if (name === 'meloffice_evaluate_formula') {
    const formula = (args && args.formula) || '';
    const cells = (args && args.cells) || {};
    const sheet = new XlsxSpreadsheet({ cells });
    const value = sheet.evaluateFormula(formula);
    return { content: [{ type: 'text', text: JSON.stringify({ tool: name, result: { value } }) }], isError: false };
  }

  if (name === 'meldraw_apply_curves') {
    const points = args.points || [];
    const channel = args.channel || 'rgb';
    const pixels = args.pixels || [];
    const width = Math.max(1, Math.ceil(pixels.length / 4));
    const height = 1;
    const data = new Uint8ClampedArray(pixels.length);
    for (let i = 0; i < pixels.length; i++) data[i] = Math.max(0, Math.min(255, Number(pixels[i]) || 0));

    const imageData = { width, height, data };
    const out = FilterEngine.applyCurves(imageData, { points }, channel);

    const mapped = [];
    for (let i = 0; i < out.data.length; i += 4) {
      mapped.push(out.data[i], out.data[i + 1], out.data[i + 2]);
    }
    return { content: [{ type: 'text', text: JSON.stringify({ tool: name, result: { mapped } }) }], isError: false };
  }

  return { content: [{ type: 'text', text: JSON.stringify({ tool: name, result: { error: `Unknown tool: ${name}` } }) }], isError: true };
}

function handleRequest(message) {
  const method = message.method;
  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'melsoft', version: '1.0.0' }
      }
    };
  }
  if (method === 'notifications/initialized') return null;
  if (method === 'ping') return { jsonrpc: '2.0', id: message.id, result: {} };
  if (method === 'tools/list') {
    return { jsonrpc: '2.0', id: message.id, result: { tools: listTools() } };
  }
  if (method === 'tools/call') {
    const tool = (message.params && message.params.name) || '';
    const args = (message.params && message.params.arguments) || {};
    const callResult = callTool(tool, args);
    return { jsonrpc: '2.0', id: message.id, result: callResult };
  }
  return { jsonrpc: '2.0', id: message.id, error: { code: -32601, message: `Method not found: ${method}` } };
}

function createMcpServer() {
  return { handleRequest, listTools, callTool };
}

if (require.main === module) {
  let buffer = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buffer += chunk;
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      let response = null;
      try {
        response = handleRequest(JSON.parse(line));
      } catch (err) {
        response = { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } };
      }
      if (response) process.stdout.write(JSON.stringify(response) + '\n');
    }
  });
  process.stdin.on('end', () => process.exit(0));
}

module.exports = { createMcpServer, handleRequest, listTools, callTool };
