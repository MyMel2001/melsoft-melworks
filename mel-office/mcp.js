// MelOffice MCP Server - stdio JSON-RPC bridge for Office suite operations
const XlsxSpreadsheet = require('./src/xlsx');
const DocxDocument = require('./src/docx');
const PptxPresentation = require('./src/pptx');

function listTools() {
  return [
    {
      name: 'meloffice_evaluate_formula',
      description: 'Evaluate an Excel spreadsheet formula (e.g. =SUM(B2:B5), =AVERAGE(C1:C10), =B2*C2) against a cell map.',
      inputSchema: {
        type: 'object',
        properties: {
          formula: { type: 'string', description: 'Formula text, with or without leading "="' },
          cells: { type: 'object', description: 'Cell map: { "A1": { "value": 10 } }' }
        },
        required: ['formula']
      }
    },
    {
      name: 'meloffice_create_docx',
      description: 'Generate an OpenXML DOCX document buffer with title and paragraphs.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Document title' },
          paragraphs: { type: 'array', items: { type: 'string' }, description: 'Paragraph texts' }
        },
        required: ['paragraphs']
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

  if (name === 'meloffice_create_docx') {
    const title = (args && args.title) || '';
    const paragraphs = (args && args.paragraphs) || [];
    const doc = new DocxDocument({ title, paragraphs });
    const buf = await doc.toBuffer();
    return {
      content: [{ type: 'text', text: JSON.stringify({ tool: name, result: { size: buf.length, base64: buf.toString('base64') } }) }],
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
        serverInfo: { name: 'meloffice', version: '1.0.0' }
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
