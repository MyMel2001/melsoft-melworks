// MelCromedia Tween Engine
// Shared tween math for classic motion tweens, shape morphing, and full object interpolation.
// Loads in Node (module.exports) and browser (window.MelTween).
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.MelTween = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // --- Easing functions (t expected in [0,1]) ---
  const EASING = {
    linear: t => t,
    quadIn: t => t * t,
    quadOut: t => 1 - (1 - t) * (1 - t),
    quadInOut: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    cubicIn: t => t * t * t,
    cubicOut: t => 1 - Math.pow(1 - t, 3),
    cubicInOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    backOut: t => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    elasticOut: t => {
      if (t === 0) return 0;
      if (t === 1) return 1;
      const c4 = (2 * Math.PI) / 3;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    },
    bounceOut: t => {
      const n1 = 7.5625;
      const d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  };

  // Clamp t to [0,1] and evaluate the named easing (falls back to linear)
  function ease(name, t) {
    t = Number(t);
    if (!isFinite(t)) t = 0;
    t = Math.max(0, Math.min(1, t));
    const fn = EASING[name];
    const v = (typeof fn === 'function') ? fn(t) : t;
    return Math.max(0, Math.min(1, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function parseHex(hex) {
    if (typeof hex !== 'string') return null;
    let h = hex.trim();
    if (h.charAt(0) === '#') h = h.slice(1);
    if (h.length !== 6) return null;
    const n = parseInt(h, 16);
    if (isNaN(n)) return null;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function toHex(c) {
    return '#' + [c.r, c.g, c.b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }

  // Blend two hex colors ('#rrggbb', missing '#' tolerated). Single valid color wins untouched.
  function lerpColor(hexA, hexB, t) {
    const a = parseHex(hexA);
    const b = parseHex(hexB);
    if (!a && !b) return (typeof hexA === 'string') ? hexA : (typeof hexB === 'string' ? hexB : '#000000');
    if (!a) return toHex(b);
    if (!b) return toHex(a);
    const u = ease(null, t);
    return toHex({ r: lerp(a.r, b.r, u), g: lerp(a.g, b.g, u), b: lerp(a.b, b.b, u) });
  }

  function tweenValue(a, b, t, easeName) {
    a = Number(a) || 0;
    b = Number(b) || 0;
    return lerp(a, b, ease(easeName, t));
  }

  // Numeric properties interpolated between elements. Defaults fill gaps when a side omits a prop.
  const NUM_PROPS = ['x', 'y', 'width', 'height', 'scaleX', 'scaleY', 'rotation', 'alpha', 'strokeWidth', 'fontSize', 'x1', 'y1', 'x2', 'y2'];
  const PROP_DEFAULTS = { scaleX: 1, scaleY: 1, alpha: 1 };
  const COLOR_PROPS = ['fill', 'stroke'];
  // Identity/structural props copied verbatim from the start element
  const FIXED_PROPS = ['type', 'name', 'visible', 'locked', 'text', 'symbolRef', 'symbolName'];

  function hasProp(obj, p) {
    return obj && obj[p] !== undefined && obj[p] !== null;
  }

  // Interpolate the full object property set between two elements.
  function interpolateProps(from, to, t, easeName) {
    from = from || {};
    to = to || {};
    const u = ease(easeName, t);
    const out = {};

    for (const p of NUM_PROPS) {
      if (!hasProp(from, p) && !hasProp(to, p)) continue;
      const a = hasProp(from, p) ? Number(from[p]) : (PROP_DEFAULTS[p] !== undefined ? PROP_DEFAULTS[p] : 0);
      const b = hasProp(to, p) ? Number(to[p]) : a;
      out[p] = lerp(a || 0, b || 0, u);
    }

    for (const p of COLOR_PROPS) {
      if (!hasProp(from, p) && !hasProp(to, p)) continue;
      out[p] = lerpColor(from[p], to[p], u);
    }

    for (const p of FIXED_PROPS) {
      if (from[p] !== undefined) out[p] = from[p];
    }

    // Untouched passthrough for anything else (e.g. raw path points handled by callers)
    if (from.points !== undefined && to.points === undefined) out.points = from.points;

    return out;
  }

  // Resample a polyline to exactly n points, evenly spaced by arc length.
  function resamplePolyline(points, n) {
    const pts = (points && points.length) ? points : [{ x: 0, y: 0 }];
    if (pts.length === 1) pts = [pts[0], pts[0]];
    if (n <= 2) return [{ x: pts[0].x, y: pts[0].y }, { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y }];

    // Cumulative arc lengths
    const cum = [0];
    for (let i = 1; i < pts.length; i++) {
      cum[i] = cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    const total = cum[cum.length - 1];
    if (total === 0) {
      const flat = [];
      for (let i = 0; i < n; i++) flat.push({ x: pts[0].x, y: pts[0].y });
      return flat;
    }

    const out = [];
    let seg = 0;
    for (let i = 0; i < n; i++) {
      const target = (i * total) / (n - 1);
      while (seg < pts.length - 2 && cum[seg + 1] < target) seg++;
      const segLen = cum[seg + 1] - cum[seg];
      const lt = segLen > 0 ? (target - cum[seg]) / segLen : 0;
      out.push({
        x: lerp(pts[seg].x, pts[seg + 1].x, lt),
        y: lerp(pts[seg].y, pts[seg + 1].y, lt)
      });
    }
    return out;
  }

  // Shape morph: resample both polylines to N = max(len) points (min 2) by arc length, then blend.
  function interpolatePath(fromPoints, toPoints, t, easeName) {
    const a = (fromPoints && fromPoints.length) ? fromPoints : [{ x: 0, y: 0 }, { x: 0, y: 0 }];
    const b = (toPoints && toPoints.length) ? toPoints : a;
    const n = Math.max(2, a.length, b.length);
    const ra = resamplePolyline(a, n);
    const rb = resamplePolyline(b, n);
    const u = ease(easeName, t);
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({ x: lerp(ra[i].x, rb[i].x, u), y: lerp(ra[i].y, rb[i].y, u) });
    }
    return out;
  }

  function cloneElement(el) {
    return JSON.parse(JSON.stringify(el));
  }

  // Pair elements by index and interpolate. Type mismatch snaps to the from element.
  function interpolateElements(prevEls, nextEls, t, easeName) {
    prevEls = prevEls || [];
    nextEls = nextEls || [];
    const out = [];
    for (let i = 0; i < prevEls.length; i++) {
      const p = prevEls[i];
      const n = nextEls[i];
      if (!p) continue;
      if (!n || n.type !== p.type) {
        out.push(cloneElement(p));
        continue;
      }
      if (p.type === 'path') {
        const el = interpolateProps(p, n, t, easeName);
        el.type = 'path';
        el.points = interpolatePath(p.points, n.points || p.points, t, easeName);
        out.push(el);
      } else if (p.type === 'group' || p.type === 'symbol') {
        const el = interpolateProps(p, n, t, easeName);
        el.type = p.type;
        const pKids = p.children || p.elements || [];
        const nKids = n.children || n.elements || pKids;
        el.elements = interpolateElements(pKids, nKids, t, easeName);
        out.push(el);
      } else {
        out.push(interpolateProps(p, n, t, easeName));
      }
    }
    return out;
  }

  // Normalize a keyframe argument: accepts { kf, frame } pairs or bare keyframe objects.
  function normalizeKF(kf) {
    if (!kf) return null;
    if (kf.kf !== undefined && typeof kf.frame === 'number') {
      return { kf: kf.kf, frame: kf.frame };
    }
    return { kf: kf, frame: (typeof kf.frame === 'number' ? kf.frame : 0) };
  }

  function copyElements(els) {
    return (els || []).map(cloneElement);
  }

  // Compute interpolated elements for a tween frame span.
  // { fromKF, toKF, frame, easeName } -> elements array
  function tweenFrame(args) {
    const from = normalizeKF(args && args.fromKF);
    if (!from || !from.kf) return [];
    const fromEls = from.kf.elements || [];
    const to = normalizeKF(args && args.toKF);
    if (!to || !to.kf || to.frame <= from.frame) {
      // Missing next keyframe or degenerate span
      return copyElements(fromEls);
    }
    const gap = to.frame - from.frame;
    const t = Math.max(0, Math.min(1, (args.frame - from.frame) / gap));
    const easeName = args.easeName || from.kf.ease || 'linear';
    return interpolateElements(fromEls, to.kf.elements || [], t, easeName);
  }

  return {
    EASING,
    ease,
    lerp,
    lerpColor,
    tweenValue,
    interpolateProps,
    interpolatePath,
    interpolateElements,
    tweenFrame
  };
});
