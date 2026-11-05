# MelSoft MelWorks

**MelSoft MelWorks** is a professional desktop productivity, creative, and engineering suite built on Node.js and Electron, engineered for standard compatibility and agentic control via MCP (Model Context Protocol).

---

## Applications

### 1. MelCAD (`mel-cad/`)
Professional 2D computer-aided design (CAD) drafting studio.
* **AutoCAD DXF**: Full roundtrip parser & generator supporting `LINE`, `CIRCLE`, `ARC`, `LWPOLYLINE`, `POLYLINE` with `VERTEX` chains, `TEXT`, `MTEXT`, `DIMENSION`, `POINT`, and `SOLID` entities.
* **AutoCAD DWG**: Binary parser for AC1015 (AutoCAD 2000), AC1018 (AutoCAD 2004), and AC1027 (AutoCAD 2013) formats; extracts embedded 256-color BMP previews, layer tables, and metadata.
* **Cleanroom Library**: Preloaded architectural and mechanical blocks (doors, compressors, workstations, P&ID pumps, arrows, storage, ADA vanities, wall sections).
* **SVG Export**: High-precision vector export with layer visibility and color mapping.

### 2. MelCromedia (`mel-cromedia/`)
Adobe Flash Professional animation and vector authoring studio.
* **SWF v19 Engine**: Binary SWF encoder and decoder with ActionScript 3.0 (AVM2) bytecode generation.
* **AS3 Tooling**: Built-in ActionScript 3 compiler, AVM2 ABC disassembler, syntax validator, and execution sandbox.
* **Display List**: Full `DisplayObjectContainer`, `Sprite`, `MovieClip`, and event dispatcher system.
* **FLA / XFL**: Project import and export using DOMDocument XFL format.
* **MelTween**: Keyframe tweening with cubic bezier easing and shape morphing.

### 3. MelDraw (`mel-draw/`)
Photoshop-style raster image editor and graphic design studio.
* **PSD Binary Engine**: Adobe Photoshop PSD parser and generator with PackBits RLE compression.
* **Layer Management**: Multi-layer compositing, opacity, visibility, and blending modes.
* **Adjustment Engines**: Full curves point mapping, brightness, contrast, threshold, invert, grayscale, and sepia filters.
* **AI Segmentation**: Subject segmentation and foreground isolation.

### 4. MelFilm (`mel-film/`)
Non-linear video editing (NLE) and motion graphics studio powered by FFmpeg.
* **Multi-Track Timeline**: Layer stack, clip trimming, and track sequencing.
* **Transitions**: Hardware-accelerated crossfade transitions (`xfade`) with duration controls.
* **Keyframe Motion**: Position, scale, and opacity tweening with mathematical easing.
* **Color Grading**: Brightness, contrast, and saturation post-processing.
* **Adobe Bundles**: Export to Adobe Premiere Pro (`.prproj`) and Adobe After Effects (`.aepx`) project bundles.

### 5. MelLite (`mel-lite/`)
Lightroom-style non-destructive RAW photo development and darkroom workstation.
* **Development Pipeline**: Non-destructive exposure EV (-5..5), contrast, saturation, and white balance.
* **Darkroom Effects**: Film grain, vignette, highlight roll-off, sharpening, red-eye reduction, crop, and rotation.
* **RAW Import**: RAW image decode and preview via FFmpeg bridge.

### 6. MelOffice 365 (`mel-office/`)
Office productivity suite with native OpenXML support.
* **MelWord (`.docx`)**: Word processor with paragraphs, headings, tables, borders, and HTML export.
* **MelExcel (`.xlsx`)**: Spreadsheet engine with formula evaluation (`SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, `PRODUCT`, `LOOKUP`, `IF`, `ABS`, `ROUND`), cell styling, and multi-sheet workbooks.
* **MelPowerPoint (`.pptx`)**: Slide deck presenter with slide master backgrounds, text layouts, and thumbnails.
* **MelPDF (`.pdf`)**: Embedded PDF document reader and form handler.

### 7. MelSound (`mel-sound/`)
FL Studio-style digital audio workstation (DAW).
* **Step Sequencer**: Pattern-based drum machine and piano roll synthesizer.
* **Synthesis**: Multi-voice tone generation (sine, sawtooth) with swing timing and track mixer controls (volume, pan, mute, solo).
* **Song Construction**: Pattern chain sequencer for full song arrangement.
* **FLP & WAV**: Native FL Studio FLP project binary serialization and master WAV audio render.

### 8. MelVU (`mel-vu/`)
Visual web authoring IDE inspired by NVU, Dreamweaver, and modern code editors.
* **WYSIWYG Editing**: Live visual HTML editing with raw source synchronization.
* **CSS Studio**: CSS parser, formatter, minifier, validator, and specificity calculator.
* **Code Editor**: Multi-language tokenizer (HTML, Markdown, CSS, JavaScript, Go, Python, SQL) with bracket matching, indent management, and undo/redo history.
* **Markdown**: Bidirectional Markdown-to-HTML and HTML-to-Markdown converter.

---

## Agentic AI Integration (MCP)

Each application and the overall suite expose Model Context Protocol (MCP) servers communicating over stdio JSON-RPC 2.0:

* **Suite Server (`mcp/server.js`)**: Unified MCP server exposing tools across office formulas, image curves/filters, sound project summaries, and video bundle packaging.
* **Per-App Servers**:
  * `mel-cad/mcp.js`: `melcad_parse_dxf`, `melcad_export_svg`
  * `mel-cromedia/mcp.js`: `melcromedia_compile_as3`, `melcromedia_check_as3_syntax`
  * `mel-draw/mcp.js`: `meldraw_apply_curves`, `meldraw_apply_filters`
  * `mel-film/mcp.js`: `melfilm_bundle_save`, `melfilm_build_aepx`
  * `mel-lite/mcp.js`: `mellite_adjust_photo`
  * `mel-office/mcp.js`: `meloffice_evaluate_formula`, `meloffice_create_docx`
  * `mel-sound/mcp.js`: `melsound_project_summary`, `melsound_render_tone`
  * `mel-vu/mcp.js`: `melvu_markdown_to_html`, `melvu_html_to_markdown`, `melvu_format_css`, `melvu_validate_css`, `melvu_css_for_element`, `melvu_parse_html`

---

## Installation & Running

### Dependencies
Install project dependencies across suites:
```bash
for app in mel-*; do
  (cd "$app" && npm install --ignore-scripts)
done
```

### Run Tests
Execute the automated test suites:
```bash
for app in mel-* mcp; do
  (cd "$app" && npm test)
done
```

### Launch Desktop Applications
Run any application with Electron:
```bash
cd mel-cad      && npm start
cd mel-office   && npm start
cd mel-film     && npm start
cd mel-sound    && npm start
cd mel-draw     && npm start
cd mel-lite     && npm start
cd mel-cromedia && npm start
cd mel-vu       && npm start
```

---

## License
SPL-R5
