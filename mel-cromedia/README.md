# MelCromedia Professional Studio

A standalone web-based Flash animation and development environment implementing authentic Adobe Flash Professional user experience with complete ActionScript 3 support.

## Overview

MelCromedia provides a full-featured animation studio with timeline-based editing, symbol libraries, and ActionScript 3 / AVM2 bytecode compilation and execution.

## Features

### Timeline & Animation
- Multi-layer timeline with keyframe support
- Frame-by-frame animation
- Motion tweens with 11 easings (linear, quadIn/Out/InOut, cubicIn/Out/InOut, backOut, elasticOut, bounceOut) via `MelTween`
- Shape tween / morph between keyframes (rect, oval, line, path outlines + color blend)
- Onion skinning for frame reference
- Frame rate control (1-60 fps)
- Play, pause, rewind, and loop controls

### Full Object Support
- Every stage element carries full transform/identity props: x, y, width, height, scaleX/scaleY, rotation, alpha, visible, name, locked
- Alpha, scale, rotation, name, visible, locked editable via the Properties inspector
- Transform handles support move, resize (via scale), and rotate (Q); rotate handle above top-center, Shift snaps to 15°
- Groups (Ctrl+G) with relative children coordinates; Ungroup (Ctrl+Shift+G)
- Symbol instances (F8-placed) with live library resolution and tween support
- Multi-select via marquee / Ctrl+click, duplicate (Ctrl+D)

### Drawing Tools
- Selection and subselection tools
- Free transform (Q) with rotate, scale, skew
- Rectangle and oval primitives
- Line and pencil tools
- Brush with variable sizes
- Paint bucket fill
- Eyedropper color picker
- Text tool with formatting

### Symbol Library
- Convert to Symbol (F8)
- Graphic, MovieClip, and Button types
- Library panel with preview
- Drag instances to stage
- Edit in place mode
- Placed instances support full transform, tweening, groups, and rendering

### ActionScript 3 / AVM2
- Full AS3 lexer and parser
- AVM2 ABC bytecode compiler (140+ opcodes)
- ABC disassembler with constant pool resolution
- Runtime execution sandbox
- Flash Player standard library:
  - DisplayObject, Sprite, MovieClip, Stage, TextField
  - EventDispatcher, Event, MouseEvent, KeyboardEvent, TimerEvent
  - Point, Rectangle, ByteArray, Timer, Graphics
- Actions panel with syntax checking
- Bytecode viewer
- Trace console output

### SWF Export
- SWF version 19 compliant
- FileAttributes tag (AS3 flag)
- SymbolClass binding
- DoABC bytecode delivery
- Shape and place object tags
- Background color and frame rate

### FLA / XFL Project Format
- DOMDocument XFL standard
- ZIP container structure
- Layer and frame serialization
- Symbol library persistence
- ActionScript 3 metadata

## Architecture

MelCromedia follows a dual-mode architecture:

### Desktop Mode (Electron)
```bash
npm start
```
Launches the Electron application with native file system access.

### Browser Mode (Node HTTP Server)
```bash
node server.js
```
Serves the application at `http://localhost:8082` for browser-based usage.

## Project Structure

```
mel-flash/
├── main.js           # Electron main process
├── preload.js        # Electron preload bridge
├── server.js         # Node HTTP server for browser mode
├── package.json      # Dependencies and scripts
├── test.js           # Automated check test suite (12 tests)
├── src/
│   ├── index.html    # Main application shell
│   ├── styles.css    # Flash Professional authentic styling
│   ├── app.js        # Timeline, tools, and UI controller
│   ├── as3.js        # AS3 lexer, parser, compiler, runtime
│   ├── swf.js        # SWF v19 encoder/decoder with AS3 tags
│   ├── fla.js        # FLA/XFL project serialization
│   └── tween.js      # Shared tween engine (easings, interpolation, morph)
└── samples/          # Sample FLA projects for testing
```

## AS3 Compiler & Runtime

The ActionScript 3 implementation provides:

### Lexer/Parser
- Tokenizes AS3 source code
- Builds AST with full grammar support
- Handles classes, functions, variables, control flow

### AVM2 Bytecode Compiler
- Compiles AST to ABC (ActionScript Bytecode)
- 140+ opcode support
- Constant pool management
- Class and method generation
- Control flow (if/while/for)

### ABC Disassembler
- Parses ABC binary format
- Resolves constant pool references
- Outputs human-readable bytecode

### Runtime Sandbox
- Executes AS3 in JavaScript environment
- Flash Player API compatibility
- Event dispatching system
- Display list management
- Trace output capture

## Running Tests

```bash
node test.js
```

Verifies:
1. SWF binary generation with AS3
2. ABC bytecode disassembly
3. AS3 compiler output
4. Runtime execution
5. Class declaration and instantiation
6. Display list API
7. Event system
8. Standard library (Point, Rectangle, ByteArray)
9. Syntax checker
10. FLA import/export
11. End-to-end AS3 workflow
12. MelTween engine (easings, interpolation, shape morphing)

## Usage

1. Launch via `npm start` (Electron) or `node server.js` (browser)
2. Use drawing tools on the canvas
3. Insert keyframes (F6) and create animation
4. Add ActionScript in the Actions panel
5. Test Movie (Ctrl+Enter) with AS3 execution
6. Export as SWF or save as FLA

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| F6 | Insert Keyframe |
| F7 | Insert Blank Keyframe |
| F8 | Convert to Symbol |
| Ctrl+G | Group Selection |
| Ctrl+Shift+G | Ungroup Selection |
| Ctrl+D | Duplicate Selection |
| Ctrl+Enter | Test Movie |
| Enter | Play/Pause Timeline |
| Q | Free Transform Tool |
| V | Selection Tool |

## ActionScript 3 Examples

### Stop and trace
```actionscript
stop();
trace("Frame 1 initialized");
```

### Display list manipulation
```actionscript
var sp:Sprite = new Sprite();
sp.graphics.beginFill(0xFF6600);
sp.graphics.drawRect(0, 0, 100, 80);
sp.graphics.endFill();
sp.x = 150;
sp.y = 200;
addChild(sp);
```

### Event handling
```actionscript
addEventListener(MouseEvent.CLICK, function(e) {
  trace("Clicked at " + e.stageX + ", " + e.stageY);
});
```

## Technology

- Pure JavaScript implementation (no external frameworks)
- SWF v19 specification compliant
- AVM2 bytecode format per Adobe specification
- HTML5 Canvas for rendering
- CSS Grid and Flexbox for layout
- Electron for desktop integration

## Credits

Third-party libraries:
- [JSZip](https://stuk.github.io/jszip/) - ZIP file creation and extraction for FLA/XFL format (MIT License)

## References

- Adobe SWF File Format Specification Version 19
- Adobe ActionScript Virtual Machine 2 (AVM2) Overview
- ActionScript 3.0 Language Reference
