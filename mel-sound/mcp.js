// MelSound MCP Server - stdio JSON-RPC bridge for DAW operations
const { MelSoundProject } = require('./src/project');
const { MelWav } = require('./src/wav');

function listTools() {
  return [
    {
      name: 'melsound_project_summary',
      description: 'Summarize a MelSound DAW project (BPM, tracks, instruments, duration) from its JSON.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: 'Serialized MelSound project JSON string.' }
        },
        required: ['project']
      }
    },
    {
      name: 'melsound_render_tone',
      description: 'Render a synthesized sine tone WAV buffer of given frequency and duration.',
      inputSchema: {
        type: 'object',
        properties: {
          frequency: { type: 'number', description: 'Frequency in Hz (e.g. 440 for A4)' },
          duration: { type: 'number', description: 'Duration in seconds (e.g. 1.0)' }
        },
        required: ['frequency']
      }
    }
  ];
}

async function callTool(name, args) {
  if (name === 'melsound_project_summary') {
    const raw = (args && args.project) || '{}';
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const proj = new MelSoundProject(parsed);
    const summary = proj.getSummary();
    return { content: [{ type: 'text', text: JSON.stringify({ tool: name, result: summary }) }], isError: false };
  }

  if (name === 'melsound_render_tone') {
    const freq = (args && args.frequency) || 440;
    const dur = (args && args.duration) || 1.0;
    const sampleRate = 44100;
    const numSamples = Math.floor(sampleRate * dur);
    const pcm = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      pcm[i] = Math.sin(2 * Math.PI * freq * (i / sampleRate)) * 0.5;
    }
    const wav = MelWav.encode(pcm, sampleRate);
    return {
      content: [{ type: 'text', text: JSON.stringify({ tool: name, result: { samples: numSamples, size: wav.length, base64: wav.toString('base64') } }) }],
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
        serverInfo: { name: 'melsound', version: '1.0.0' }
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
