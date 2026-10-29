// MelVU MCP Server - stdio JSON-RPC bridge so AI agents can drive the studio
// Protocol: MCP stdio transport (JSON-RPC 2.0, newline-delimited JSON)
const path = require('path');
const { createRequire } = require('module');

const melVuRequire = createRequire(path.join(__dirname, 'package.json'));
const MelMarkdown = melVuRequire('./src/markdown');
const MelCss = melVuRequire('./src/css');
const MelDom = melVuRequire('./src/dom');

function listTools() {
  return [
    {
      name: 'melvu_markdown_to_html',
      description: 'Convert Markdown text to HTML (headings, lists, code blocks, tables, inline styles).',
      inputSchema: {
        type: 'object',
        properties: {
          markdown: { type: 'string', description: 'Markdown source text.' }
        },
        required: ['markdown']
      }
    },
    {
      name: 'melvu_html_to_markdown',
      description: 'Convert HTML text to Markdown (headings, lists, code blocks, quotes, inline styles).',
      inputSchema: {
        type: 'object',
        properties: {
          html: { type: 'string', description: 'HTML source text.' }
        },
        required: ['html']
      }
    },
    {
      name: 'melvu_format_css',
      description: 'Pretty-print a CSS stylesheet via the MelCss formatter.',
      inputSchema: {
        type: 'object',
        properties: {
          css: { type: 'string', description: 'CSS source text.' }
        },
        required: ['css']
      }
    },
    {
      name: 'melvu_validate_css',
      description: 'Validate CSS source text and return problems (unknown properties, malformed declarations, unknown at-rules).',
      inputSchema: {
        type: 'object',
        properties: {
          css: { type: 'string', description: 'CSS source text.' }
        },
        required: ['css']
      }
    },
    {
      name: 'melvu_css_for_element',
      description: 'Compute the CSS selector and cascade winner for an element path against a stylesheet.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'array', items: { type: 'object' }, description: 'Element path array, e.g. [{ tag: "div", id: "", classes: ["hero"], indexAmongSiblings: 0, siblingTags: ["div"] }]. Simple strings are accepted as [{ tag: "div", id: "", classes: [], indexAmongSiblings: 0, siblingTags: ["div"] }].'},
          css: { type: 'string', description: 'Optional stylesheet text. Defaults to empty.' }
        },
        required: ['path']
      }
    },
    {
      name: 'melvu_parse_html',
      description: 'Parse HTML into an element outline (paths, tags, ids, classes, text previews) via the MelDom tree.',
      inputSchema: {
        type: 'object',
        properties: {
          html: { type: 'string', description: 'HTML source text.' }
        },
        required: ['html']
      }
    }
  ];
}

function toElementPath(path) {
  const arr = Array.isArray(path) ? path : [path];
  const last = arr[arr.length - 1];
  const el = typeof last === 'string' ? { tag: last, id: '', classes: [], indexAmongSiblings: 0, siblingTags: [last] } : (last || { tag: 'div', id: '', classes: [], indexAmongSiblings: 0, siblingTags: ['div'] });
  const full = [];
  for (const item of arr) {
    full.push(typeof item === 'string' ? { tag: item, id: '', classes: [], indexAmongSiblings: 0, siblingTags: [item] } : (item || { tag: 'div', id: '', classes: [], indexAmongSiblings: 0, siblingTags: ['div'] }));
  }
  return full;
}

function callTool(name, args) {
  if (name === 'melvu_markdown_to_html') {
    const md = (args && args.markdown) || '';
    const html = MelMarkdown.markdownToHtml(md);
    return { content: [{ type: 'text', text: JSON.stringify({ tool: name, result: { html } }) }], isError: false };
  }
  if (name === 'melvu_html_to_markdown') {
    const html = (args && args.html) || '';
    const md = MelMarkdown.htmlToMarkdown(html);
    return { content: [{ type: 'text', text: JSON.stringify({ tool: name, result: { markdown: md } }) }], isError: false };
  }
  if (name === 'melvu_format_css') {
    const css = (args && args.css) || '';
    const formatted = MelCss.formatCss(css);
    return { content: [{ type: 'text', text: JSON.stringify({ tool: name, result: { formatted } }) }], isError: false };
  }
  if (name === 'melvu_validate_css') {
    const css = (args && args.css) || '';
    const problems = MelCss.validateCss(css);
    return { content: [{ type: 'text', text: JSON.stringify({ tool: name, result: { problems } }) }], isError: false };
  }
  if (name === 'melvu_css_for_element') {
    const elPath = toElementPath(args && args.path);
    const css = (args && args.css) || '';
    const selector = MelCss.selectorForElement(elPath[elPath.length - 1]);
    const specificity = MelCss.specificity(selector);
    const computed = MelCss.computeStyle(MelCss.parseCss(css), elPath[elPath.length - 1], {});
    return { content: [{ type: 'text', text: JSON.stringify({ tool: name, result: { selector, specificity, computed } }) }], isError: false };
  }
  if (name === 'melvu_parse_html') {
    const html = (args && args.html) || '';
    const root = MelDom.parseHtml(html);
    const outline = [];
    const walk = (node, trail) => {
      if (node.type === 'tag') {
        outline.push({
          path: trail.slice(),
          tag: node.tag,
          id: (node.attrs && node.attrs.id) || '',
          classes: String((node.attrs && node.attrs.class) || '').split(/\s+/).filter(Boolean),
          textPreview: MelDom.textContent(node).replace(/\s+/g, ' ').trim().slice(0, 80)
        });
        for (let i = 0; i < (node.children || []).length; i++) walk(node.children[i], trail.concat([i]));
      }
    };
    for (let i = 0; i < (root.children || []).length; i++) walk(root.children[i], [i]);
    return { content: [{ type: 'text', text: JSON.stringify({ tool: name, result: { outline } }) }], isError: false };
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
