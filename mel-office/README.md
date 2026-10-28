# MelOffice

A standalone web-based office suite implementing authentic Microsoft Office 365 user experience.

## Overview

MelOffice provides a complete office productivity suite with three core applications:

- **MelWord** - Word processor with rich text formatting, tables, images, and page layout
- **MelExcel** - Spreadsheet application with formulas, charts, multiple sheets, and cell styling
- **MelPowerPoint** - Presentation tool with slides, animations, transitions, and presenter view

## Features

### MelWord
- Rich text editing with formatting toolbar
- Font family, size, bold, italic, underline, strikethrough
- Text alignment, line spacing, indentation
- Tables with cell merging and borders
- Image insertion and positioning
- Page margins and orientation
- Find and replace
- Spell check highlighting
- Export to .docx format

### MelExcel
- Multiple worksheets with tabs
- Cell selection, editing, and navigation
- Formula engine supporting 50+ functions
- Chart creation (bar, line, pie, scatter)
- Conditional formatting
- Cell styles, borders, and fills
- Freeze panes
- Auto-filter and sort
- Export to .xlsx format

### MelPowerPoint
- Slide thumbnails and navigation
- Shape tools (rectangles, circles, lines, arrows)
- Text boxes with formatting
- Image placeholders
- Slide transitions and animations
- Master slide templates
- Presenter view with notes
- Export to .pptx format

## Architecture

MelOffice follows a dual-mode architecture:

### Desktop Mode (Electron)
```bash
npm start
```
Launches the Electron application with native file system access.

### Browser Mode (Node HTTP Server)
```bash
node server.js
```
Serves the application at `http://localhost:8080` for browser-based usage.

## Project Structure

```
mel-office/
├── main.js           # Electron main process
├── preload.js        # Electron preload bridge
├── server.js         # Node HTTP server for browser mode
├── package.json      # Dependencies and scripts
├── test.js           # Automated check test suite
├── src/
│   ├── index.html    # Main application shell
│   ├── styles.css    # Office 365 authentic styling
│   └── app.js        # Application controller and logic
└── samples/          # Sample documents for testing
```

## Dependencies

- **jszip** - ZIP archive creation for Office Open XML formats (.docx, .xlsx, .pptx)

## Running Tests

```bash
node test.js
```

Verifies document generation, formatting, formula calculations, and export functionality.

## Usage

1. Launch via `npm start` (Electron) or `node server.js` (browser)
2. Select Word, Excel, or PowerPoint from the application picker
3. Create, edit, and save documents
4. Export using the File menu to standard Office formats

## Technology

- Pure JavaScript implementation (no external frameworks)
- Office Open XML (OOXML) standard for file compatibility
- HTML5 Canvas for rendering
- CSS Grid and Flexbox for layout
- Electron for desktop integration

## Credits

Third-party libraries:
- [JSZip](https://stuk.github.io/jszip/) - ZIP file creation and extraction (MIT License)
