# MelCAD

A standalone web-based CAD application implementing authentic AutoCAD user experience.

## Overview

MelCAD provides professional 2D drafting and design tools with precision drawing, snapping, layers, and DWG-compatible workflow.

## Features

### Drawing Tools
- Line tool (L) - Draw line segments
- Polyline (PL) - Connected line segments
- Rectangle (REC) - Draw rectangles
- Circle (C) - Draw circles by center/radius or 3 points
- Arc (A) - Draw arcs
- Ellipse (EL) - Draw ellipses
- Polygon (POL) - Regular polygons (3-1024 sides)
- Spline (SPL) - Bézier curves
- Hatch (H) - Fill patterns
- Text (T) - Single and multiline text
- Dimensions (DIM) - Linear, aligned, angular, radial

### Modify Tools
- Move (M) - Move objects
- Copy (CO) - Duplicate objects
- Rotate (RO) - Rotate around base point
- Scale (SC) - Scale uniformly or non-uniformly
- Mirror (MI) - Mirror across axis
- Offset (O) - Create parallel copies
- Array (AR) - Rectangular and polar patterns
- Trim (TR) - Trim to cutting edges
- Extend (EX) - Extend to boundary
- Fillet (F) - Round corners
- Chamfer (CHA) - Beveled corners
- Explode (X) - Break compound objects
- Erase (E) - Delete objects

### Precision Tools
- Object Snap (F3) - Snap to endpoints, midpoints, centers, intersections, quadrants, perpendicular, tangent
- Grid display (F7) - Visual grid overlay
- Ortho mode (F8) - Constrain to horizontal/vertical
- Polar tracking (F10) - Snap to angular increments
- Object Snap Tracking - Align with snap points
- Coordinate input - Absolute and relative (@X,Y), polar (@distance<angle)

### Layers
- Layer Properties Manager (LA)
- Create, delete, rename layers
- Layer colors (index and true color)
- Layer linetypes (Continuous, Dashed, Dotted, Center, Hidden)
- Layer lineweights
- Layer on/off, freeze/thaw, lock/unlock
- Layer filters
- Current layer assignment

### View Controls
- Zoom Window (Z) - Zoom to selection
- Zoom Extents (E) - Fit all objects
- Zoom Previous - Return to previous view
- Pan (P) - Pan view
- ViewCube - 3D orientation widget
- UCS Icon - Coordinate system display
- Viewports - Multiple views

### Object Properties
- Properties panel (Ctrl+1)
- Color, linetype, lineweight override
- Object geometry editing
- Quick properties on selection

### Blocks
- Block definition (B) - Create blocks
- Block insert (I) - Place block instances
- Block edit in place
- Attributes for data

### Inquiry
- Distance (DI) - Measure distance
- Area (AA) - Calculate area
- List (LI) - Object information
- ID Point - Coordinate display

### Annotation
- Text styles
- Dimension styles
- Leaders and multileaders
- Tables
- Hatch patterns

## Architecture

MelCAD follows a dual-mode architecture:

### Desktop Mode (Electron)
```bash
npm start
```
Launches the Electron application with native file system access.

### Browser Mode (Node HTTP Server)
```bash
node server.js
```
Serves the application at `http://localhost:8083` for browser-based usage.

## Project Structure

```
mel-cad/
├── main.js           # Electron main process
├── preload.js        # Electron preload bridge
├── server.js         # Node HTTP server for browser mode
├── package.json      # Dependencies and scripts
├── test.js           # Automated check test suite
├── src/
│   ├── index.html    # Main application shell
│   ├── styles.css    # AutoCAD authentic styling
│   └── app.js        # Application controller and logic
└── samples/          # Sample DWG files for testing
```

## Running Tests

```bash
node test.js
```

Verifies drawing tools, object snaps, layer management, and DWG export.

## Usage

1. Launch via `npm start` (Electron) or `node server.js` (browser)
2. Select drawing tools from ribbon or type commands
3. Use object snaps for precision
4. Manage layers in Layer Properties Manager
5. Edit object properties in Properties panel
6. Export as DWG or DXF format

## Command Line

Type commands at the command prompt:
```
Command: LINE
Specify first point: 0,0
Specify next point: @100<45
Specify next point: [Enter]
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| F1 | Help |
| F2 | Text Window |
| F3 | Object Snap Toggle |
| F7 | Grid Toggle |
| F8 | Ortho Toggle |
| F9 | Snap Toggle |
| F10 | Polar Tracking Toggle |
| F11 | Object Snap Tracking Toggle |
| F12 | Dynamic Input Toggle |
| Esc | Cancel Command |
| Enter | Repeat Last Command |
| Ctrl+1 | Properties Panel |
| Ctrl+2 | Design Center |
| Ctrl+S | Save |
| Ctrl+Shift+S | Save As |
| Ctrl+O | Open |
| Ctrl+N | New |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Ctrl+A | Select All |
| Delete | Erase Selection |

## Object Snaps

| Snap | Marker | Description |
|------|--------|-------------|
| ENDpoint | Square | Snaps to endpoints |
| MIDpoint | Triangle | Snaps to midpoints |
| CENter | Circle | Snaps to circle/arc centers |
| NODE | Cross | Snaps to point objects |
| QUADrant | Diamond | Snaps to quadrant points |
| INTersection | X | Snaps to intersections |
| INSertion | - | Snaps to block insertions |
| PERpendicular | Right angle | Snaps perpendicular |
| TANgent | Circle with line | Snaps tangent |
| NEArest | Hourglass | Snaps to nearest point |
| APParent Intersection | Square with X | Snaps to apparent intersections |

## Technology

- Pure JavaScript implementation (no external frameworks)
- HTML5 Canvas for vector rendering
- CSS Grid and Flexbox for layout
- Electron for desktop integration
- DWG/DXF file format support

## Credits

Third-party libraries:
- [JSZip](https://stuk.github.io/jszip/) - ZIP file creation for DWG format (MIT License)
