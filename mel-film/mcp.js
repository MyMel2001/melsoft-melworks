// MelFilm MCP Server - stdio JSON-RPC bridge for Video NLE operations
const { MelFilmBundle } = require('./src/bundle');
const { MelFilmFfmpeg } = require('./src/ffmpeg');

function listTools() {
  return [
    {
      name: 'melfilm_bundle_save',
      description: 'Pack an Adobe post-production project file (After Effects .aepx or Premiere .prproj) XML into a ZIP bundle.',
      inputSchema: {
        type: 'object',
        properties: {
          projectName: { type: 'string', description: 'Project display name.' },
          xml: { type: 'string', description: 'Project XML content.' },
          format: { type: 'string', enum: ['aepx', 'prproj'], description: 'Bundle target format.' }
        },
        required: ['xml']
      }
    },
    {
      name: 'melfilm_build_aepx',
      description: 'Generate Adobe After Effects .aepx XML from composition layers.',
      inputSchema: {
        type: 'object',
        properties: {
          projectName: { type: 'string', description: 'Name of project' },
          compositions: { type: 'array', items: { type: 'object' }, description: 'Compositions list' }
        },
        required: ['projectName']
      }
    }
  ];
}

async function callTool(name, args) {
  if (name === 'melfilm_bundle_save') {
    const projectName = (args && args.projectName) || 'Untitled';
    const xml = (args && args.xml) || '';
    const format = (args && args.format) || 'aepx';
    const buf = (format === 'prproj')
      ? await MelFilmBundle.savePrproj(projectName, xml)
      : await MelFilmBundle.saveAepx(projectName, xml);
    return {
      content: [{ type: 'text', text: JSON.stringify({ tool: name, result: { size: buf.length, base64: buf.toString('base64') } }) }],
      isError: false
    };
  }

  if (name === 'melfilm_build_aepx') {
    const projectName = (args && args.projectName) || 'Project';
    const comps = (args && args.compositions) || [];
    const xml = MelFilmBundle.buildAepxXml(projectName, comps);
    return {
      content: [{ type: 'text', text: JSON.stringify({ tool: name, result: { xml } }) }],
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
        serverInfo: { name: 'melfilm', version: '1.0.0' }
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
