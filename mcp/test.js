// MelSoft MCP Server Protocol Test
const assert = require('assert');
const { createMcpServer, handleRequest, listTools, callTool } = require('./server');

function testInitialize() {
  const response = handleRequest({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '0.0.0' } } });
  assert.strictEqual(response.jsonrpc, '2.0');
  assert.strictEqual(response.id, 1);
  assert.strictEqual(response.result.protocolVersion, '2024-11-05');
  assert.strictEqual(response.result.serverInfo.name, 'melsoft');
  assert.ok(response.result.capabilities.tools, 'initialize reports tools capability');
  console.log('✓ MCP initialize handshake validated');
}

function testNotificationsAndPing() {
  assert.strictEqual(handleRequest({ jsonrpc: '2.0', method: 'notifications/initialized' }), null, 'notifications/initialized must not produce a response');
  const ping = handleRequest({ jsonrpc: '2.0', id: 2, method: 'ping' });
  assert.strictEqual(ping.id, 2);
  assert.deepStrictEqual(ping.result, {});
  console.log('✓ MCP notifications/initialized and ping validated');
}

function testToolsList() {
  const response = handleRequest({ jsonrpc: '2.0', id: 3, method: 'tools/list' });
  assert.ok(Array.isArray(response.result.tools), 'tools/list returns an array');
  const names = response.result.tools.map(t => t.name);
  assert.ok(names.includes('meloffice_evaluate_formula'), 'tools/list includes meloffice_evaluate_formula');
  assert.ok(names.includes('meldraw_apply_curves'), 'tools/list includes meldraw_apply_curves');
  assert.ok(names.includes('meldraw_apply_filters'), 'tools/list includes meldraw_apply_filters');
  for (const tool of response.result.tools) {
    assert.ok(tool.inputSchema, `${tool.name} has an inputSchema`);
    assert.ok(Array.isArray(tool.inputSchema.required), `${tool.name} has required fields`);
  }
  console.log('✓ MCP tools/list validated');
}

function testToolCallEvaluateFormula() {
  const response = handleRequest({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'meloffice_evaluate_formula', arguments: { formula: '=SUM(B2:B5)', cells: { B2: { value: 10 }, B3: { value: 20 }, B4: { value: 30 }, B5: { value: 40 } } } } });
  const text = response.result.content[0].text;
  const parsed = JSON.parse(text);
  assert.strictEqual(parsed.tool, 'meloffice_evaluate_formula');
  assert.strictEqual(parsed.result.value, 100, 'MCP spreadsheet SUM evaluates correctly');
  assert.strictEqual(response.result.isError, false);
  console.log('✓ MCP tools/call meloffice_evaluate_formula validated');
}

function testToolCallCurves() {
  const response = handleRequest({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'meldraw_apply_curves', arguments: { points: [{ input: 0, output: 0 }, { input: 128, output: 255 }, { input: 255, output: 255 }], pixels: [0, 0, 0, 255, 128, 128, 128, 255] } } });
  const parsed = JSON.parse(response.result.content[0].text);
  assert.strictEqual(parsed.tool, 'meldraw_apply_curves');
  assert.deepStrictEqual(parsed.result.mapped, [0, 0, 0, 255, 255, 255], 'MCP curves mapping applies correctly');
  assert.strictEqual(response.result.isError, false);
  console.log('✓ MCP tools/call meldraw_apply_curves validated');
}

function testToolCallFilters() {
  const response = handleRequest({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'meldraw_apply_filters', arguments: { filter: 'invert', pixels: [10, 20, 30, 255, 200, 100, 50, 255] } } });
  const parsed = JSON.parse(response.result.content[0].text);
  assert.strictEqual(parsed.tool, 'meldraw_apply_filters');
  assert.deepStrictEqual(parsed.result.mapped, [245, 235, 225, 55, 155, 205], 'MCP filter invert applies correctly');
  assert.strictEqual(response.result.isError, false);
  console.log('✓ MCP tools/call meldraw_apply_filters validated');
}

function testUnknownToolAndMethod() {
  const unknownTool = callTool('no_such_tool', {});
  assert.strictEqual(unknownTool.isError, true, 'unknown MCP tool returns isError true');
  const badMethod = handleRequest({ jsonrpc: '2.0', id: 6, method: 'no/such/method' });
  assert.ok(badMethod.error, 'unknown MCP method returns a JSON-RPC error');
  console.log('✓ MCP unknown tool/method error paths validated');
}

function main() {
  console.log('Testing MelSoft MCP Server protocol handling...');
  testInitialize();
  testNotificationsAndPing();
  testToolsList();
  testToolCallEvaluateFormula();
  testToolCallCurves();
  testToolCallFilters();
  testUnknownToolAndMethod();
  console.log('\nALL MCP SERVER TESTS PASSED SUCCESSFULLY!\n');
}

main();
