// MelCAD MCP Server - stdio JSON-RPC bridge for CAD agentic operations
const { DxfDocument } = require('./src/dxf');
const { CadEngine, CAD_BLOCKS } = require('./src/cad-engine');

function listTools() {
  return [
    {
      name: 'melcad_parse_dxf',
      description: 'Parse an AutoCAD ASCII DXF string and return layers, entities, and bounding box.',
      inputSchema: {
        type: 'object',
        properties: {
          dxf: { type: 'string', description: 'AutoCAD DXF string content.' }
        },
        required: ['dxf']
      }
    },
    {
      name: 'melcad_export_svg',
      description: 'Export CAD block or entities to SVG markup.',
      inputSchema: {
        type: 'object',
        properties: {
          blockKey: { type: 'string', description: 'CAD block key, e.g. "3ft_Single_Door", "Door_90_Frame_600", "Compressor_Unit".' }
        },
        required: ['blockKey']
      }
    }
  ];
}

async function callTool(name, args) {
  if (name === 'melcad_parse_dxf') {
    const doc = DxfDocument.parse((args && args.dxf) || '');
    const bbox = CadEngine.boundingBox(doc.entities);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          tool: name,
          result: {
            layers: doc.layers.length,
            entities: doc.entities.length,
            boundingBox: bbox
          }
        })
      }],
      isError: false
    };
  }

  if (name === 'melcad_export_svg') {
    const key = (args && args.blockKey) || '3ft_Single_Door';
    const block = CAD_BLOCKS[key] || CAD_BLOCKS['3ft_Single_Door'];
    const svg = CadEngine.exportSvg(block.entities, 800, 600);
    return {
      content: [{ type: 'text', text: JSON.stringify({ tool: name, result: { svg } }) }],
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
        serverInfo: { name: 'melcad', version: '1.0.0' }
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
