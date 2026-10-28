// MelSoft MCP Server - stdio JSON-RPC bridge so AI agents can drive the suite
// Protocol: MCP stdio transport (JSON-RPC 2.0, newline-delimited JSON)
const path = require('path');
const { createRequire } = require('module');

const melOfficeRequire = createRequire(path.join(__dirname, '..', 'mel-office', 'package.json'));
const XlsxSpreadsheet = melOfficeRequire('./src/xlsx');
const melDrawRequire = createRequire(path.join(__dirname, '..', 'mel-draw', 'package.json'));
const FilterEngine = melDrawRequire('./src/filters');
const melSoundRequire = createRequire(path.join(__dirname, '..', 'mel-sound', 'package.json'));
const { MelSoundProject } = melSoundRequire('./src/project');
const melFilmRequire = createRequire(path.join(__dirname, '..', 'mel-film', 'package.json'));
const { MelFilmBundle } = melFilmRequire('./src/bundle');

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
    },
    {
      name: 'meldraw_apply_filters',
      description: 'Apply a Photoshop-style pixel filter (brightness/contrast/invert/grayscale/sepia/threshold/sharpen/blur) to RGBA pixel values.',
      inputSchema: {
        type: 'object',
        properties: {
          filter: { type: 'string', enum: ['brightness', 'contrast', 'invert', 'grayscale', 'sepia', 'threshold', 'sharpen', 'blur'], description: 'Filter to apply.' },
          brightness: { type: 'number', description: 'Brightness offset (-255..255). Used by brightness/contrast filters.' },
          contrast: { type: 'number', description: 'Contrast (-255..255). Used by brightness/contrast filters.' },
          threshold: { type: 'number', description: 'Threshold (0..255). Used by threshold filter.' },
          pixels: { type: 'array', items: { type: 'number' }, description: 'Flattened RGBA pixel values.' }
        },
        required: ['filter', 'pixels']
      }
    },
    {
      name: 'melsound_project_summary',
      description: 'Summarize a MelSound DAW project (BPM, kind, tracks, instruments, duration) from its serialized JSON.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: 'Serialized MelSound project JSON.' }
        },
        required: ['project']
      }
    },
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
    }
  ];
}

async function callTool(name, args) {
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

  if (name === 'meldraw_apply_filters') {
    const filter = args.filter || 'grayscale';
    const pixels = args.pixels || [];
    const width = Math.max(1, Math.ceil(pixels.length / 4));
    const height = 1;
    const data = new Uint8ClampedArray(pixels.length);
    for (let i = 0; i < pixels.length; i++) data[i] = Math.max(0, Math.min(255, Number(pixels[i]) || 0));

    const imageData = { width, height, data };
    let out;
    if (filter === 'brightness' || filter === 'contrast') {
      out = FilterEngine.applyBrightnessContrast(imageData, Number(args.brightness) || 0, Number(args.contrast) || 0);
    } else if (filter === 'invert') {
      out = FilterEngine.applyInvert(imageData);
    } else if (filter === 'grayscale') {
      out = FilterEngine.applyGrayscale(imageData);
    } else if (filter === 'sepia') {
      out = FilterEngine.applySepia(imageData);
    } else if (filter === 'threshold') {
      out = FilterEngine.applyThreshold(imageData, Number(args.threshold) || 128);
    } else if (filter === 'sharpen') {
      out = FilterEngine.applySharpen(imageData);
    } else if (filter === 'blur') {
      out = FilterEngine.applyBoxBlur(imageData);
    } else {
      return { content: [{ type: 'text', text: JSON.stringify({ tool: name, result: { error: `Unknown filter: ${filter}` } }) }], isError: true };
    }

    const mapped = [];
    for (let i = 0; i < out.data.length; i += 4) {
      mapped.push(out.data[i], out.data[i + 1], out.data[i + 2]);
    }
    return { content: [{ type: 'text', text: JSON.stringify({ tool: name, result: { filter, mapped } }) }], isError: false };
  }

  if (name === 'melsound_project_summary') {
    const projectJson = args.project || '{}';
    const data = typeof projectJson === 'string' ? JSON.parse(projectJson) : projectJson;
    const project = MelSoundProject.deserialize(data);
    const durationSeconds = project.tracks.length ? (16 * 60) / (project.bpm * 4) : 0;
    const summary = {
      bpm: project.bpm,
      kind: project.kind,
      tracks: project.tracks.length,
      instruments: project.instruments.length,
      durationSeconds
    };
    return { content: [{ type: 'text', text: JSON.stringify({ tool: name, result: summary }) }], isError: false };
  }

  if (name === 'melfilm_bundle_save') {
    const format = args.format || 'aepx';
    const xml = args.xml || '';
    const buf = format === 'prproj'
      ? await MelFilmBundle.savePrproj(args.projectName || 'MelFilm', xml)
      : await MelFilmBundle.saveAepx(args.projectName || 'MelFilm', xml);
    return { content: [{ type: 'text', text: JSON.stringify({ tool: name, result: { format, bytes: buf.length, base64: buf.toString('base64') } }) }], isError: false };
  }

  return { content: [{ type: 'text', text: JSON.stringify({ tool: name, result: { error: `Unknown tool: ${name}` } }) }], isError: true };
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
    const callResult = await callTool(tool, args);
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
  process.stdin.on('data', async (chunk) => {
    buffer += chunk;
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      let response = null;
      try {
        response = await handleRequest(JSON.parse(line));
      } catch (err) {
        response = { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } };
      }
      if (response) process.stdout.write(JSON.stringify(response) + '\n');
    }
  });
  process.stdin.on('end', () => process.exit(0));
}

module.exports = { createMcpServer, handleRequest, listTools, callTool };