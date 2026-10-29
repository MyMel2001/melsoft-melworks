// MelVU Automated Check Test
const assert = require('assert');
const MelMarkdown = require('./src/markdown');
const MelCss = require('./src/css');
const MelDom = require('./src/dom');
const MelEditor = require('./src/editor');
const { createMcpServer } = require('./mcp');

let failures = 0;

function check(name, fn) {
  try {
    fn();
    console.log('✓ ' + name);
  } catch (e) {
    failures++;
    console.log('✗ ' + name + ': ' + e.message);
  }
}

async function runTests() {
  console.log('Testing MelVU markdown engine...');

  check('markdownToHtml renders h2', () => {
    assert.strictEqual(MelMarkdown.markdownToHtml('## Hello'), '<h2>Hello</h2>\n');
  });
  check('markdownToHtml renders bold', () => {
    assert.ok(MelMarkdown.markdownToHtml('**bold** text').includes('<strong>bold</strong>'));
  });
  check('markdownToHtml renders list', () => {
    assert.ok(MelMarkdown.markdownToHtml('- a\n- b').includes('<ul>'));
  });
  check('markdownToHtml renders code fence', () => {
    assert.ok(MelMarkdown.markdownToHtml('```js\nconst x = 1;\n```').includes('<pre><code'));
  });
  check('markdownToHtml renders table', () => {
    assert.ok(MelMarkdown.markdownToHtml('| a | b |\n|---|---|\n| 1 | 2 |').includes('<table>'));
  });
  check('markdownToHtml renders blockquote', () => {
    assert.ok(MelMarkdown.markdownToHtml('> quote').includes('<blockquote>'));
  });
  check('markdownToHtml trims output', () => {
    assert.strictEqual(MelMarkdown.markdownToHtml('Hello'), '<p>Hello</p>\n');
  });
  check('htmlToMarkdown converts heading', () => {
    assert.ok(MelMarkdown.htmlToMarkdown('<h1>Title</h1>').startsWith('# Title'));
  });
  check('wordCount counts words', () => {
    assert.strictEqual(MelMarkdown.wordCount('one two three'), 3);
  });
  check('wordCount ignores heading marker', () => {
    assert.strictEqual(MelMarkdown.wordCount('# Title'), 1);
  });

  console.log('Testing MelVU CSS engine...');
  check('formatCss pretty prints single rule', () => {
    assert.strictEqual(MelCss.formatCss('div{color:red;}'), 'div {\n  color: red;\n}\n');
  });
  check('formatCss pretty prints multiple rules', () => {
    const f = MelCss.formatCss('a{color:red}\nb{color:blue}');
    assert.ok(f.includes('a {\n  color: red;\n}\n'));
    assert.ok(f.includes('b {\n  color: blue;\n}\n'));
  });
  check('minifyCss joins top level rules', () => {
    assert.strictEqual(MelCss.minifyCss('a{color:red}\nb{color:blue}'), 'a{color:red}\nb{color:blue}\n');
  });
  check('validateCss accepts valid stylesheet', () => {
    assert.deepStrictEqual(MelCss.validateCss('div {\n  color: red;\n}\n'), []);
  });
  check('validateCss rejects unknown property', () => {
    assert.ok(MelCss.validateCss('div {\n  color: bogusProp;\n').length > 0);
  });
  check('computeStyle cascade picks later rule', () => {
    const ast = MelCss.parseCss('div { color: red; }\ndiv { color: blue; }');
    assert.strictEqual(MelCss.computeStyle(ast, [{ tag: 'div' }]).color, 'blue');
  });
  check('computeStyle id beats element selector', () => {
    const ast = MelCss.parseCss('#x { color: red; } div { color: blue; }');
    assert.strictEqual(MelCss.computeStyle(ast, [{ tag: 'div', id: 'x' }]).color, 'red');
  });
  check('computeStyle matches element selector', () => {
    assert.strictEqual(MelCss.computeStyle(MelCss.parseCss('div { color: red; }'), [{ tag: 'div' }]).color, 'red');
  });
  check('matchSimple matches tag', () => {
    assert.strictEqual(MelCss.matchSimple('div', [{ tag: 'div' }]), true);
  });
  check('matchSimple matches class', () => {
    assert.strictEqual(MelCss.matchSimple('.cls', [{ tag: 'div', classes: ['cls'] }]), true);
  });
  check('matchSimple matches comma list', () => {
    assert.strictEqual(MelCss.matchSimple('div, span', [{ tag: 'span' }]), true);
  });
  check('specificity computes element id', () => {
    assert.deepStrictEqual(MelCss.specificity('div'), { a: 0, b: 0, c: 1 });
  });
  check('boxModel content box math', () => {
    const bm = MelCss.boxModel({
      width: 100,
      height: 50,
      padding: { top: 5, right: 5, bottom: 5, left: 5 },
      border: { top: 1, right: 1, bottom: 1, left: 1 }
    });
    assert.strictEqual(bm.contentWidth, 100);
    assert.strictEqual(bm.borderBoxWidth, 112);
  });

  console.log('Testing MelVU DOM engine...');
  check('dom serialize roundtrips html', () => {
    const root = MelDom.parseHtml('<div><p>hi</p></div>');
    assert.strictEqual(MelDom.serializeHtml(root), '<div><p>hi</p></div>');
  });
  check('dom textContent reads nested text', () => {
    const root = MelDom.parseHtml('<div><b>there</b></div>');
    assert.strictEqual(MelDom.textContent(MelDom.select(root, [0, 0])), 'there');
  });

  console.log('Testing MelVU editor engine...');
  check('editor doc insert undo redo', () => {
    const doc = new MelEditor.EditorDoc('hello', 'javascript');
    doc.insert(doc.positionToOffset({ line: 1, column: 6 }), ' world');
    assert.strictEqual(doc.getText(), 'hello world');
    assert.ok(doc.undo());
    assert.strictEqual(doc.getText(), 'hello');
    assert.ok(doc.redo());
    assert.strictEqual(doc.getText(), 'hello world');
  });
  check('editor doc setText undo', () => {
    const doc = new MelEditor.EditorDoc('', 'javascript');
    doc.setText('abc');
    assert.ok(doc.undo());
    assert.strictEqual(doc.getText(), '');
  });
  check('editor find and replaceAll', () => {
    assert.strictEqual(MelEditor.find('hello world', 'world', { regex: false }).length, 1);
    assert.strictEqual(MelEditor.replaceAll('hello world', 'world', 'there', { regex: false }), 'hello there');
  });
  check('editor formatDocument json', () => {
    assert.strictEqual(MelEditor.formatDocument('{"b":1,"a":2}', 'json'), '{\n  "b": 1,\n  "a": 2\n}\n');
  });
  check('editor indentLines reindents block', () => {
    assert.strictEqual(MelEditor.indentLines('function f() {\nreturn 1;\n}\n', 'javascript', {}), 'function f() {\n  return 1;\n}\n');
  });
  check('editor toggleComment adds and removes', () => {
    const src = 'const a = 1;';
    const out = MelEditor.toggleComment(src, 4, 'javascript');
    assert.ok(out.startsWith('// const a = 1;'), 'toggled: ' + out);
    const out2 = MelEditor.toggleComment(out, 4, 'javascript');
    assert.strictEqual(out2, 'const a = 1;');
  });
  check('editor tokenize javascript', () => {
    const tokens = MelEditor.tokenize('const a = 1;', 'javascript');
    assert.strictEqual(tokens.length, 1);
    const t = tokens[0];
    assert.strictEqual(t[0].type, 'keyword');
    assert.strictEqual(t[0].value, 'const');
    assert.strictEqual(t[1].type, 'identifier');
    assert.strictEqual(t[2].type, 'punctuation');
    assert.strictEqual(t[3].type, 'number');
  });
  check('editor tokenize css', () => {
    const tokens = MelEditor.tokenize('div {\n  color: red;\n}', 'css');
    assert.strictEqual(tokens.length, 3);
    assert.strictEqual(tokens[0][0].type, 'selector');
    assert.strictEqual(tokens[0][1].type, 'punctuation');
    assert.strictEqual(tokens[1][0].type, 'property');
    assert.strictEqual(tokens[1][1].type, 'value');
    assert.strictEqual(tokens[2][0].type, 'text');
  });
  check('editor tokenize markdown', () => {
    const tokens = MelEditor.tokenize('# Hi\n\nworld', 'markdown');
    assert.strictEqual(tokens.length, 3);
    assert.strictEqual(tokens[0][0].type, 'heading');
  });

  console.log('Testing MelVU MCP server...');
  const server = createMcpServer();
  const ping = await server.handleRequest({ jsonrpc: '2.0', id: 1, method: 'ping' });
  assert.deepStrictEqual(ping.result, {});

  const toolsRes = await server.handleRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  check('mcp tools list returns six tools', () => {
    assert.strictEqual(toolsRes.result.tools.length, 6);
    assert.ok(toolsRes.result.tools.some((t) => t.name === 'melvu_markdown_to_html'));
  });

  const unknownCall = await server.handleRequest({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'nope', arguments: {} } });
  check('mcp unknown tool returns error', () => {
    assert.strictEqual(unknownCall.result.isError, true);
    const parsed = JSON.parse(unknownCall.result.content[0].text);
    assert.strictEqual(parsed.result.error, 'Unknown tool: nope');
  });

  const badMethod = await server.handleRequest({ jsonrpc: '2.0', id: 4, method: 'bogus/method' });
  check('mcp unknown method returns -32601', () => {
    assert.strictEqual(badMethod.error.code, -32601);
  });

  const mdCall = await server.handleRequest({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'melvu_markdown_to_html', arguments: { markdown: '# Hi' } } });
  check('mcp markdown_to_html tool responds', () => {
    const parsed = JSON.parse(mdCall.result.content[0].text);
    assert.strictEqual(parsed.tool, 'melvu_markdown_to_html');
    assert.strictEqual(parsed.result.html, '<h1>Hi</h1>\n');
  });
}

runTests().then(() => {
  if (failures > 0) {
    console.log('\n' + failures + ' MELVU TEST(S) FAILED.');
    process.exit(1);
  }
  console.log('\nALL MELVU TESTS PASSED SUCCESSFULLY!\n');
}).catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
