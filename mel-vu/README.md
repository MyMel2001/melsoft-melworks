# MelVU

MelVU - Visual Web Studio powered by Melsoft engines.

## Features
- Visual HTML editor with live preview (Markdown <-> HTML, HTML source editing).
- CSS tooling: parse, format, minify, validate, specificity, computed styles, selector matching.
- Editor core: undo/redo, find/replaceAll, indent, toggle comment, format, tokens, outline.

## Commands
- `npm start` - launch Electron app.
- `npm test` - run automated engine checks.
- `npm run serve` - static web server for UI.

## Architecture
- `main.js` - Electron main process.
- `preload.js` - preload bridge (`window.isElectron`).
- `server.js` - static HTTP server for UI.
- `src/markdown.js`, `src/css.js`, `src/dom.js`, `src/editor.js` - UMD engine modules.
- `src/index.html`, `src/styles.css`, `src/app.js` - studio UI.
- `mcp.js` - MCP stdio server for agentic use.

## Dependencies
- electron ^45.1.0
