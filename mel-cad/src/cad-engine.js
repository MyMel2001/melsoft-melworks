// MelCAD CAD Engine & Cleanroom Helpers Library

// Preloaded engineering and architectural blocks synthesized from cleanroom-helpers/cad-dwgs
const CAD_BLOCKS = {
  '3ft_Single_Door': {
    name: '3ft Single Door (Swing)',
    source: 'cleanroom-helpers/cad-dwgs/3ft-single-and-double-swing-doors-plan-view/3ft0in Single Door.DWG',
    entities: [
      { type: 'LINE', layer: 'DOORS', x1: 0, y1: 0, x2: 36, y2: 0, color: 4 }, // Door panel (36in = 3ft)
      { type: 'ARC', layer: 'DOORS', cx: 0, cy: 0, radius: 36, startAngle: 0, endAngle: 90, color: 4 }, // Swing arc
      { type: 'LINE', layer: 'WALLS', x1: -4, y1: -2, x2: 0, y2: -2, color: 2 }, // Left jamb
      { type: 'LINE', layer: 'WALLS', x1: 36, y1: -2, x2: 40, y2: -2, color: 2 } // Right jamb
    ]
  },
  '3ft_Double_Doors': {
    name: '3ft Double Doors (Pair)',
    source: 'cleanroom-helpers/cad-dwgs/3ft-single-and-double-swing-doors-plan-view/3ft0in Double Doors.dwg',
    entities: [
      { type: 'LINE', layer: 'DOORS', x1: 0, y1: 0, x2: 36, y2: 0, color: 4 },
      { type: 'ARC', layer: 'DOORS', cx: 0, cy: 0, radius: 36, startAngle: 0, endAngle: 90, color: 4 },
      { type: 'LINE', layer: 'DOORS', x1: 72, y1: 0, x2: 36, y2: 0, color: 4 },
      { type: 'ARC', layer: 'DOORS', cx: 72, cy: 0, radius: 36, startAngle: 90, endAngle: 180, color: 4 }
    ]
  },
  'Door_90_Frame_600': {
    name: 'Door 90 Frame 600 Wide Left',
    source: 'cleanroom-helpers/cad-dwgs/Door 90 frame 600 wide left.dwg',
    entities: [
      { type: 'LINE', layer: 'DOORS', x1: 0, y1: 0, x2: 60, y2: 0, color: 4 },
      { type: 'ARC', layer: 'DOORS', cx: 0, cy: 0, radius: 60, startAngle: 0, endAngle: 90, color: 4 },
      { type: 'LINE', layer: 'WALLS', x1: -5, y1: -5, x2: 0, y2: -5, color: 2 },
      { type: 'LINE', layer: 'WALLS', x1: 60, y1: -5, x2: 65, y2: -5, color: 2 }
    ]
  },
  'Computer_Workstation': {
    name: 'Computer Plan & Keyboard Desk',
    source: 'cleanroom-helpers/cad-dwgs/Computer_plan.dwg',
    entities: [
      // Desk
      { type: 'LWPOLYLINE', layer: 'FURNITURE', color: 3, closed: true, vertices: [
        { x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 30 }, { x: 0, y: 30 }
      ]},
      // Monitor
      { type: 'LWPOLYLINE', layer: 'EQUIPMENT', color: 7, closed: true, vertices: [
        { x: 18, y: 22 }, { x: 42, y: 22 }, { x: 42, y: 26 }, { x: 18, y: 26 }
      ]},
      // Keyboard
      { type: 'LWPOLYLINE', layer: 'EQUIPMENT', color: 7, closed: true, vertices: [
        { x: 20, y: 8 }, { x: 40, y: 8 }, { x: 40, y: 15 }, { x: 20, y: 15 }
      ]}
    ]
  },
  'Compressor_Unit': {
    name: 'Mechanical Compressor Unit',
    source: 'cleanroom-helpers/cad-dwgs/Compressor.dwg',
    entities: [
      { type: 'CIRCLE', layer: 'MECHANICAL', color: 1, cx: 30, cy: 30, radius: 25 },
      { type: 'CIRCLE', layer: 'MECHANICAL', color: 1, cx: 30, cy: 30, radius: 8 },
      { type: 'LINE', layer: 'MECHANICAL', color: 1, x1: 5, y1: 30, x2: 55, y2: 30 },
      { type: 'LINE', layer: 'MECHANICAL', color: 1, x1: 30, y1: 5, x2: 30, y2: 55 },
      { type: 'TEXT', layer: 'TEXT', color: 7, x: 18, y: 62, height: 6, text: 'COMP-101' }
    ]
  },
  'PID_Centrifugal_Pump': {
    name: 'P&ID Pump Symbol',
    source: 'cleanroom-helpers/cad-dwgs/ALL_PID_SYMBOLS_SHEET.dwg',
    entities: [
      { type: 'CIRCLE', layer: 'PID', color: 6, cx: 20, cy: 20, radius: 15 },
      { type: 'LINE', layer: 'PID', color: 6, x1: 5, y1: 20, x2: 0, y2: 20 },
      { type: 'LINE', layer: 'PID', color: 6, x1: 20, y1: 35, x2: 20, y2: 45 },
      { type: 'LINE', layer: 'PID', color: 6, x1: 20, y1: 35, x2: 32, y2: 28 },
      { type: 'TEXT', layer: 'PID', color: 7, x: 12, y: -4, height: 6, text: 'P-101A' }
    ]
  }
};

class CadEngine {
  static distance(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  }

  static angleDeg(x1, y1, x2, y2) {
    let a = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
    if (a < 0) a += 360;
    return a;
  }

  static boundingBox(entities) {
    if (!entities || entities.length === 0) {
      return { minX: -100, minY: -100, maxX: 100, maxY: 100, width: 200, height: 200 };
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const ent of entities) {
      if (ent.type === 'LINE' || ent.type === 'DIMENSION') {
        minX = Math.min(minX, ent.x1, ent.x2);
        minY = Math.min(minY, ent.y1, ent.y2);
        maxX = Math.max(maxX, ent.x1, ent.x2);
        maxY = Math.max(maxY, ent.y1, ent.y2);
      } else if (ent.type === 'CIRCLE' || ent.type === 'ARC') {
        minX = Math.min(minX, ent.cx - ent.radius);
        minY = Math.min(minY, ent.cy - ent.radius);
        maxX = Math.max(maxX, ent.cx + ent.radius);
        maxY = Math.max(maxY, ent.cy + ent.radius);
      } else if (ent.type === 'LWPOLYLINE' && ent.vertices) {
        for (const v of ent.vertices) {
          minX = Math.min(minX, v.x);
          minY = Math.min(minY, v.y);
          maxX = Math.max(maxX, v.x);
          maxY = Math.max(maxY, v.y);
        }
      } else if (ent.type === 'TEXT') {
        minX = Math.min(minX, ent.x);
        minY = Math.min(minY, ent.y);
        maxX = Math.max(maxX, ent.x + 50);
        maxY = Math.max(maxY, ent.y + (ent.height || 10));
      }
    }

    if (!isFinite(minX)) {
      return { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 };
    }

    return {
      minX, minY, maxX, maxY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY)
    };
  }

  static exportSvg(entities, width = 800, height = 600) {
    const bbox = CadEngine.boundingBox(entities);
    const pad = Math.max(bbox.width, bbox.height) * 0.1;
    const viewBox = `${bbox.minX - pad} ${-(bbox.maxY + pad)} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`;

    let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}" style="background:#1e1e1e;">\n`;
    svg += `  <g transform="scale(1, -1)">\n`; // Invert Y to match CAD coordinates

    for (const ent of entities) {
      const color = ent.hexColor || '#38BDF8';
      if (ent.type === 'LINE') {
        svg += `    <line x1="${ent.x1}" y1="${ent.y1}" x2="${ent.x2}" y2="${ent.y2}" stroke="${color}" stroke-width="1.5"/>\n`;
      } else if (ent.type === 'CIRCLE') {
        svg += `    <circle cx="${ent.cx}" cy="${ent.cy}" r="${ent.radius}" stroke="${color}" stroke-width="1.5" fill="none"/>\n`;
      } else if (ent.type === 'ARC') {
        // SVG path arc
        const startRad = (ent.startAngle * Math.PI) / 180;
        const endRad = (ent.endAngle * Math.PI) / 180;
        const sx = ent.cx + ent.radius * Math.cos(startRad);
        const sy = ent.cy + ent.radius * Math.sin(startRad);
        const ex = ent.cx + ent.radius * Math.cos(endRad);
        const ey = ent.cy + ent.radius * Math.sin(endRad);
        const largeArc = Math.abs(ent.endAngle - ent.startAngle) > 180 ? 1 : 0;
        svg += `    <path d="M ${sx} ${sy} A ${ent.radius} ${ent.radius} 0 ${largeArc} 1 ${ex} ${ey}" stroke="${color}" stroke-width="1.5" fill="none"/>\n`;
      } else if (ent.type === 'LWPOLYLINE' && ent.vertices) {
        const pts = ent.vertices.map(v => `${v.x},${v.y}`).join(' ');
        svg += `    <polyline points="${pts}" stroke="${color}" stroke-width="1.5" fill="none"/>\n`;
      } else if (ent.type === 'TEXT') {
        svg += `    <text x="${ent.x}" y="${ent.y}" font-size="${ent.height || 10}" fill="${color}" transform="scale(1, -1)">${ent.text}</text>\n`;
      }
    }

    svg += `  </g>\n`;
    svg += `</svg>`;
    return svg;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CadEngine, CAD_BLOCKS };
}
