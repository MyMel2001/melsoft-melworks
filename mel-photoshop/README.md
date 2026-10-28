# MelDraw

A standalone web-based image editor implementing authentic Adobe Photoshop user experience.

## Overview

MelDraw provides a professional raster graphics editor with layers, selections, filters, and comprehensive editing tools.

## Features

### Tools
- Move tool (V) - Reposition layers
- Marquee selection (M) - Rectangular and elliptical selections
- Lasso selection (L) - Freeform selection
- Magic wand (W) - Color-based selection
- Crop tool (C) - Crop and straighten
- Brush tool (B) - Paint with variable size and hardness
- Eraser tool (E) - Erase with transparency
- Paint bucket (G) - Fill with foreground color
- Gradient tool (G) - Linear and radial gradients
- Blur tool - Blur areas
- Sharpen tool - Sharpen areas
- Dodge tool (O) - Lighten areas
- Burn tool (O) - Darken areas
- Type tool (T) - Add text layers
- Pen tool (P) - Vector paths
- Shape tools - Rectangle, ellipse, line, custom shapes
- Hand tool (H) - Pan canvas
- Zoom tool (Z) - Magnify view

### Layers
- Layer panel with visibility toggle
- Layer opacity and blend modes
- Layer locking (transparency, position, all)
- Layer groups and nesting
- Add, delete, duplicate layers
- Layer styles (drop shadow, glow, bevel, stroke)
- Adjustment layers (levels, curves, hue/saturation, color balance)
- Layer masks with painting
- Smart object support

### Selections
- Rectangular and elliptical marquee
- Lasso and polygonal lasso
- Magic wand with tolerance control
- Quick selection tool
- Select all, deselect, reselect, inverse
- Feather selection edges
- Expand and contract selection
- Save and load selections as alpha channels

### Image Adjustments
- Brightness/Contrast
- Levels (histogram with input/output)
- Curves (RGB and individual channels)
- Hue/Saturation/Lightness
- Color Balance
- Vibrance
- Exposure
- Shadow/Highlight
- Black & White conversion
- Invert
- Posterize
- Threshold
- Gradient Map

### Filters
- Blur (Gaussian, Motion, Radial, Box)
- Sharpen (Unsharp Mask, Smart Sharpen)
- Noise (Add Noise, Reduce Noise, Despeckle)
- Stylize (Find Edges, Emboss, Wind)
- Distort (Twirl, Ripple, Wave, Spherize)
- Pixelate (Mosaic, Crystallize, Pointillize)
- Render (Clouds, Difference Clouds, Lens Flare)
- Artistic (Oil Paint, Cutout, Dry Brush)

### Transforms
- Free Transform (Ctrl+T) with bounding box
- Scale, rotate, skew, distort, perspective, warp
- Flip horizontal and vertical
- Content-aware scaling

### Color Management
- Foreground and background color pickers
- Color panel with sliders (RGB, HSL, Lab)
- Swatches panel
- Eyedropper sampling
- Color wheel

### History
- Unlimited undo/redo
- History panel with snapshots
- Step backward/forward (Ctrl+Z / Ctrl+Shift+Z)

### Export
- Save as PSD (layered format)
- Export for Web (PNG, JPEG, GIF, WebP)
- Quick Export options
- Export layers to files

## Architecture

MelDraw follows a dual-mode architecture:

### Desktop Mode (Electron)
```bash
npm start
```
Launches the Electron application with native file system access.

### Browser Mode (Node HTTP Server)
```bash
node server.js
```
Serves the application at `http://localhost:8081` for browser-based usage.

## Project Structure

```
mel-photoshop/
├── main.js           # Electron main process
├── preload.js        # Electron preload bridge
├── server.js         # Node HTTP server for browser mode
├── package.json      # Dependencies and scripts
├── test.js           # Automated check test suite
├── src/
│   ├── index.html    # Main application shell
│   ├── styles.css    # Photoshop authentic styling
│   └── app.js        # Application controller and logic
└── samples/          # Sample images for testing
```

## Running Tests

```bash
node test.js
```

Verifies layer operations, selection tools, filter application, and PSD export.

## Usage

1. Launch via `npm start` (Electron) or `node server.js` (browser)
2. Open an image or create new document
3. Use tools from the toolbar on the left
4. Manage layers in the Layers panel
5. Apply adjustments and filters from menus
6. Export as PSD or web formats

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| V | Move Tool |
| M | Marquee Selection |
| L | Lasso Tool |
| W | Magic Wand |
| C | Crop Tool |
| B | Brush Tool |
| E | Eraser Tool |
| G | Gradient/Paint Bucket |
| T | Type Tool |
| P | Pen Tool |
| H | Hand Tool |
| Z | Zoom Tool |
| Ctrl+T | Free Transform |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Ctrl+D | Deselect |
| Ctrl+I | Invert Colors |
| [ / ] | Decrease/Increase Brush Size |

## Technology

- Pure JavaScript implementation (no external frameworks)
- HTML5 Canvas for pixel manipulation
- CSS Grid and Flexbox for layout
- Electron for desktop integration
- PSD file format support for layers and masks

## Credits

Third-party libraries:
- [JSZip](https://stuk.github.io/jszip/) - ZIP file creation for PSD format (MIT License)
