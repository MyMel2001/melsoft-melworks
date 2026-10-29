// MelFilm Tween Engine - layer property keyframes, easing, FFMPEG expression building.
const TWEEN_DEFAULT_PROPS = { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };
const TWEEN_PROP_KEYS = ['x', 'y', 'scale', 'rotation', 'opacity'];

function bounceOut(p) {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (p < 1 / d1) return n1 * p * p;
  if (p < 2 / d1) { const q = p - 1.5 / d1; return n1 * q * q + 0.75; }
  if (p < 2.5 / d1) { const q = p - 2.25 / d1; return n1 * q * q + 0.9375; }
  const q = p - 2.625 / d1;
  return n1 * q * q + 0.984375;
}

// Easing set applied to the normalized t between two keyframes.
const TWEEN_EASINGS = {
  linear: (p) => p,
  easeIn: (p) => p * p,
  easeOut: (p) => 1 - (1 - p) * (1 - p),
  easeInOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  bounceOut: bounceOut
};

function fmtNum(n) {
  return String(Math.round(Number(n) * 100000) / 100000);
}

function frameToSec(frame, frameRate) {
  const fps = Number(frameRate) > 0 ? Number(frameRate) : 24;
  return Math.round((Number(frame) / fps) * 10000) / 10000;
}

function normalizeProps(props) {
  const out = {};
  TWEEN_PROP_KEYS.forEach((k) => {
    const v = props && props[k] !== undefined ? Number(props[k]) : TWEEN_DEFAULT_PROPS[k];
    out[k] = Number.isFinite(v) ? v : TWEEN_DEFAULT_PROPS[k];
  });
  return out;
}

// FFMPEG expression form of each easing (pExpr = normalized position expression string).
function easingExpr(easing, p) {
  if (easing === 'easeIn') return '((' + p + ')*(' + p + '))';
  if (easing === 'easeOut') return '(1-(1-' + p + ')*(1-' + p + '))';
  if (easing === 'easeInOut') return 'if(lt(' + p + ',0.5),4*pow(' + p + ',3),1-pow(-2*' + p + '+2,3)/2)';
  if (easing === 'bounceOut') {
    return 'if(lt(' + p + ',0.363636),7.5625*(' + p + ')*(' + p + '),' +
      'if(lt(' + p + ',0.727273),7.5625*(' + p + '-0.545455)*(' + p + '-0.545455)+0.75,' +
      'if(lt(' + p + ',0.909091),7.5625*(' + p + '-0.818182)*(' + p + '-0.818182)+0.9375,' +
      '7.5625*(' + p + '-0.954545)*(' + p + '-0.954545)+0.984375)))';
  }
  return p;
}

function addKeyframe(layer, frame, props, easing) {
  if (!layer || !Number.isFinite(Number(frame))) throw new Error('addKeyframe requires a layer and a numeric frame');
  if (!Array.isArray(layer.keyframes)) layer.keyframes = [];
  const f = Math.round(Number(frame));
  const kf = {
    frame: f,
    easing: TWEEN_EASINGS[easing] ? easing : 'linear',
    props: normalizeProps(props)
  };
  const at = layer.keyframes.findIndex((k) => k.frame === f);
  if (at >= 0) layer.keyframes[at] = kf;
  else layer.keyframes.push(kf);
  layer.keyframes.sort((a, b) => a.frame - b.frame);
  return kf;
}

function removeKeyframe(layer, frame) {
  if (!layer || !Array.isArray(layer.keyframes)) return 0;
  const before = layer.keyframes.length;
  layer.keyframes = layer.keyframes.filter((k) => k.frame !== Math.round(Number(frame)));
  return before - layer.keyframes.length;
}

function getKeyframe(layer, frame) {
  if (!layer || !Array.isArray(layer.keyframes)) return null;
  const f = Math.round(Number(frame));
  return layer.keyframes.find((k) => k.frame === f) || null;
}

function sampleKeyframes(keyframes, frame) {
  const list = (Array.isArray(keyframes) ? keyframes : []).slice().sort((a, b) => a.frame - b.frame);
  if (list.length === 0) return normalizeProps(null);
  const f = Number(frame) || 0;
  if (f <= list[0].frame) return normalizeProps(list[0].props);
  const last = list[list.length - 1];
  if (f >= last.frame) return normalizeProps(last.props);
  let i = 0;
  while (i < list.length - 2 && list[i + 1].frame <= f) i++;
  const a = list[i];
  const b = list[i + 1];
  const span = b.frame - a.frame;
  // The keyframe where a segment STARTS carries the easing for that segment.
  const ease = TWEEN_EASINGS[a.easing] || TWEEN_EASINGS.linear;
  const t = ease(span > 0 ? (f - a.frame) / span : 1);
  const pa = normalizeProps(a.props);
  const pb = normalizeProps(b.props);
  const out = {};
  TWEEN_PROP_KEYS.forEach((k) => { out[k] = pa[k] + (pb[k] - pa[k]) * t; });
  return out;
}

function sampleLayer(layer, frame) {
  return sampleKeyframes(layer && layer.keyframes, frame);
}

// Piecewise -> FFMPEG expression. pairs = [[value1, cond1], ..., [fallback]].
// A cond can be a raw condition string or [frameStart, frameEnd] (seconds via frameRate).
function toFfmpegExpr(pairs, frameRate) {
  if (!Array.isArray(pairs) || pairs.length === 0) throw new Error('toFfmpegExpr requires at least one [value, condition] piece');
  const fps = Number(frameRate) > 0 ? Number(frameRate) : 24;
  let expr = null;
  for (let i = pairs.length - 1; i >= 0; i--) {
    const piece = pairs[i];
    const value = String(piece[0]);
    if (expr === null) expr = value;
    if (piece.length < 2) continue;
    const cond = Array.isArray(piece[1])
      ? 'between(t,' + fmtNum(frameToSec(piece[1][0], fps)) + ',' + fmtNum(frameToSec(piece[1][1], fps)) + ')'
      : String(piece[1]);
    expr = 'if(' + cond + ',' + value + ',' + expr + ')';
  }
  return expr;
}

// Per-prop FFMPEG expressions for a layer. scale value = multiplier of source size.
// Static props stay null.
function buildTweenExpressions(layer, frameRate) {
  const fps = Number(frameRate) > 0 ? Number(frameRate) : 24;
  const kfs = ((layer && Array.isArray(layer.keyframes)) ? layer.keyframes : []).slice().sort((a, b) => a.frame - b.frame);
  const out = { scale: null, rotation: null, opacity: null, x: null, y: null };
  if (kfs.length < 2) return out;
  TWEEN_PROP_KEYS.forEach((prop) => {
    const values = kfs.map((k) => normalizeProps(k.props)[prop]);
    if (values.every((v) => v === values[0])) return;
    const pairs = [];
    for (let i = 0; i < kfs.length - 1; i++) {
      const f1 = kfs[i].frame;
      const f2 = kfs[i + 1].frame;
      const s1 = frameToSec(f1, fps);
      const s2 = frameToSec(f2, fps);
      const span = Math.round((s2 - s1) * 10000) / 10000;
      if (span <= 0) continue;
      const p = '((t-' + fmtNum(s1) + ')/' + fmtNum(span) + ')';
      const eased = easingExpr(kfs[i].easing, p);
      pairs.push([fmtNum(values[i]) + '+(' + fmtNum(values[i + 1] - values[i]) + ')*' + eased, [f1, f2]]);
    }
    if (pairs.length === 0) return;
    pairs.push([fmtNum(values[values.length - 1])]);
    out[prop] = toFfmpegExpr(pairs, fps);
  });
  return out;
}

const api = {
  TWEEN_DEFAULT_PROPS,
  TWEEN_EASINGS,
  addKeyframe,
  removeKeyframe,
  getKeyframe,
  sampleKeyframes,
  sampleLayer,
  toFfmpegExpr,
  buildTweenExpressions
};

if (typeof module !== 'undefined' && module.exports) module.exports = api;
else window.MelTween = api;
