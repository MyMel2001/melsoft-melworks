// MelCAD Standard AutoCAD DXF Reader & Writer

// AutoCAD Color Index (ACI) to RGB Hex map
const ACI_TO_HEX = {
  1: '#FF0000', // Red
  2: '#FFFF00', // Yellow
  3: '#00FF00', // Green
  4: '#00FFFF', // Cyan
  5: '#0000FF', // Blue
  6: '#FF00FF', // Magenta
  7: '#FFFFFF', // White / Black
  8: '#808080', // Dark Gray
  9: '#C0C0C0'  // Light Gray
};

const HEX_TO_ACI = {
  '#ff0000': 1,
  '#ffff00': 2,
  '#00ff00': 3,
  '#00ffff': 4,
  '#0000ff': 5,
  '#ff00ff': 6,
  '#ffffff': 7,
  '#000000': 7,
  '#808080': 8
};

class DxfDocument {
  constructor(options = {}) {
    this.layers = options.layers || [
      { name: '0', color: 7, linetype: 'CONTINUOUS', visible: true, locked: false },
      { name: 'WALLS', color: 2, linetype: 'CONTINUOUS', visible: true, locked: false },
      { name: 'DOORS', color: 4, linetype: 'CONTINUOUS', visible: true, locked: false },
      { name: 'DIMENSIONS', color: 1, linetype: 'CONTINUOUS', visible: true, locked: false }
    ];
    this.entities = options.entities || [];
  }

  // Generate standard AutoCAD ASCII DXF
  toDxf() {
    let out = '';
    function line(code, val) {
      out += `${code}\n${val}\n`;
    }

    // SECTION HEADER
    line(0, 'SECTION');
    line(2, 'HEADER');
    line(9, '$ACADVER');
    line(1, 'AC1015'); // AutoCAD 2000 format
    line(9, '$INSUNITS');
    line(70, 1); // 1 = Inches, 4 = Millimeters
    line(0, 'ENDSEC');

    // SECTION TABLES
    line(0, 'SECTION');
    line(2, 'TABLES');

    // LAYER TABLE
    line(0, 'TABLE');
    line(2, 'LAYER');
    line(70, this.layers.length);
    for (const l of this.layers) {
      line(0, 'LAYER');
      line(2, l.name);
      line(70, 0);
      line(62, l.color || 7);
      line(6, l.linetype || 'CONTINUOUS');
    }
    line(0, 'ENDTAB');

    line(0, 'ENDSEC');

    // SECTION ENTITIES
    line(0, 'SECTION');
    line(2, 'ENTITIES');

    for (const ent of this.entities) {
      if (ent.type === 'LINE') {
        line(0, 'LINE');
        line(8, ent.layer || '0');
        if (ent.color) line(62, ent.color);
        line(10, ent.x1.toFixed(4));
        line(20, ent.y1.toFixed(4));
        line(30, 0.0);
        line(11, ent.x2.toFixed(4));
        line(21, ent.y2.toFixed(4));
        line(31, 0.0);
      } else if (ent.type === 'CIRCLE') {
        line(0, 'CIRCLE');
        line(8, ent.layer || '0');
        if (ent.color) line(62, ent.color);
        line(10, ent.cx.toFixed(4));
        line(20, ent.cy.toFixed(4));
        line(30, 0.0);
        line(40, ent.radius.toFixed(4));
      } else if (ent.type === 'ARC') {
        line(0, 'ARC');
        line(8, ent.layer || '0');
        if (ent.color) line(62, ent.color);
        line(10, ent.cx.toFixed(4));
        line(20, ent.cy.toFixed(4));
        line(30, 0.0);
        line(40, ent.radius.toFixed(4));
        line(50, ent.startAngle.toFixed(4));
        line(51, ent.endAngle.toFixed(4));
      } else if (ent.type === 'LWPOLYLINE') {
        line(0, 'LWPOLYLINE');
        line(8, ent.layer || '0');
        if (ent.color) line(62, ent.color);
        line(90, ent.vertices.length);
        line(70, ent.closed ? 1 : 0);
        for (const v of ent.vertices) {
          line(10, v.x.toFixed(4));
          line(20, v.y.toFixed(4));
        }
      } else if (ent.type === 'TEXT') {
        line(0, 'TEXT');
        line(8, ent.layer || '0');
        if (ent.color) line(62, ent.color);
        line(10, ent.x.toFixed(4));
        line(20, ent.y.toFixed(4));
        line(30, 0.0);
        line(40, (ent.height || 12).toFixed(4));
        line(1, ent.text);
      } else if (ent.type === 'DIMENSION') {
        line(0, 'DIMENSION');
        line(8, ent.layer || 'DIMENSIONS');
        line(70, 0); // Linear dimension
        line(10, ent.x1.toFixed(4));
        line(20, ent.y1.toFixed(4));
        line(11, ent.x2.toFixed(4));
        line(21, ent.y2.toFixed(4));
        line(1, ent.text || '');
      }
    }

    line(0, 'ENDSEC');
    line(0, 'EOF');

    return out;
  }

  // Parse ASCII DXF string
  static parse(dxfText) {
    const lines = dxfText.split(/\r?\n/).map(l => l.trim());
    const layers = [];
    const entities = [];

    let i = 0;
    while (i < lines.length - 1) {
      const code = parseInt(lines[i], 10);
      const val = lines[i + 1];
      i += 2;

      if (code === 0 && val === 'LAYER') {
        const layer = { name: '0', color: 7, linetype: 'CONTINUOUS' };
        while (i < lines.length - 1) {
          const lCode = parseInt(lines[i], 10);
          const lVal = lines[i + 1];
          if (lCode === 0) break;
          i += 2;
          if (lCode === 2) layer.name = lVal;
          if (lCode === 62) layer.color = parseInt(lVal, 10);
          if (lCode === 6) layer.linetype = lVal;
        }
        layers.push(layer);
      } else if (code === 0 && (val === 'LINE' || val === 'CIRCLE' || val === 'ARC' || val === 'LWPOLYLINE' || val === 'TEXT' || val === 'DIMENSION')) {
        const entType = val;
        const ent = { type: entType, layer: '0', color: null };
        const vertices = [];

        let curX = 0, curY = 0;
        while (i < lines.length - 1) {
          const eCode = parseInt(lines[i], 10);
          const eVal = lines[i + 1];
          if (eCode === 0) break;
          i += 2;

          if (eCode === 8) ent.layer = eVal;
          if (eCode === 62) ent.color = parseInt(eVal, 10);

          if (entType === 'LINE') {
            if (eCode === 10) ent.x1 = parseFloat(eVal);
            if (eCode === 20) ent.y1 = parseFloat(eVal);
            if (eCode === 11) ent.x2 = parseFloat(eVal);
            if (eCode === 21) ent.y2 = parseFloat(eVal);
          } else if (entType === 'CIRCLE') {
            if (eCode === 10) ent.cx = parseFloat(eVal);
            if (eCode === 20) ent.cy = parseFloat(eVal);
            if (eCode === 40) ent.radius = parseFloat(eVal);
          } else if (entType === 'ARC') {
            if (eCode === 10) ent.cx = parseFloat(eVal);
            if (eCode === 20) ent.cy = parseFloat(eVal);
            if (eCode === 40) ent.radius = parseFloat(eVal);
            if (eCode === 50) ent.startAngle = parseFloat(eVal);
            if (eCode === 51) ent.endAngle = parseFloat(eVal);
          } else if (entType === 'LWPOLYLINE') {
            if (eCode === 10) curX = parseFloat(eVal);
            if (eCode === 20) {
              curY = parseFloat(eVal);
              vertices.push({ x: curX, y: curY });
            }
            if (eCode === 70) ent.closed = (parseInt(eVal, 10) & 1) === 1;
          } else if (entType === 'TEXT') {
            if (eCode === 10) ent.x = parseFloat(eVal);
            if (eCode === 20) ent.y = parseFloat(eVal);
            if (eCode === 40) ent.height = parseFloat(eVal);
            if (eCode === 1) ent.text = eVal;
          } else if (entType === 'DIMENSION') {
            if (eCode === 10) ent.x1 = parseFloat(eVal);
            if (eCode === 20) ent.y1 = parseFloat(eVal);
            if (eCode === 11) ent.x2 = parseFloat(eVal);
            if (eCode === 21) ent.y2 = parseFloat(eVal);
            if (eCode === 1) ent.text = eVal;
          }
        }

        if (entType === 'LWPOLYLINE') ent.vertices = vertices;
        entities.push(ent);
      }
    }

    return new DxfDocument({
      layers: layers.length ? layers : [{ name: '0', color: 7, linetype: 'CONTINUOUS' }],
      entities
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DxfDocument, ACI_TO_HEX, HEX_TO_ACI };
}
