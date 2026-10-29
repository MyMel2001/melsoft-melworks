// MelFilm Video Engine - FFMPEG backed import/export/render/post processing
const { spawn } = require('child_process');
const { getTransition } = require('./transitions');
const { buildTweenExpressions, sampleKeyframes } = require('./tween');

function fmtNum(n) {
  return String(Math.round(Number(n) * 100000) / 100000);
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args);
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (err) => reject(err));
    proc.on('close', (code) => {
      if (code === 0) resolve({ code, stdout: '', stderr });
      else reject(new Error('ffmpeg exited with code ' + code + ': ' + stderr));
    });
  });
}

function runFfprobe(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', args);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (err) => reject(err));
    proc.on('close', (code) => {
      if (code === 0) resolve({ code, stdout, stderr });
      else reject(new Error('ffprobe exited with code ' + code + ': ' + stderr));
    });
  });
}

class MelFfmpeg {
  static async probe(inputPath) {
    const res = await runFfprobe([
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,r_frame_rate,nb_frames',
      '-of', 'json',
      inputPath
    ]);
    const info = JSON.parse(res.stdout);
    const stream = (info && info.streams && info.streams[0]) || { width: 0, height: 0, r_frame_rate: '0/0', nb_frames: '0' };
    return {
      width: parseInt(stream.width, 10) || 0,
      height: parseInt(stream.height, 10) || 0,
      frameRate: parseFloat(stream.r_frame_rate) || 0,
      nbFrames: parseInt(stream.nb_frames, 10) || 0
    };
  }

  static async exportVideo({ inputPath, outputPath, resolution, format, fps }) {
    const args = ['-y', '-i', inputPath];
    if (resolution) {
      const [w, h] = String(resolution).toLowerCase().split('x').map((n) => parseInt(n, 10) || 0);
      if (w > 0 && h > 0) args.push('-vf', 'scale=' + w + ':' + h);
    }
    if (fps) args.push('-r', String(fps));
    args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-f', format || 'mp4', outputPath);
    return await runFfmpeg(args);
  }

  static async capturePoster({ inputPath, outputPath, timeSeconds }) {
    const args = ['-y', '-i', inputPath, '-ss', String(timeSeconds), '-frames:v', '1', '-q:v', '2', outputPath];
    return await runFfmpeg(args);
  }

  static async crossfade({ inputs, outputPath, transition = 'fade', duration = 1 }) {
    if (!Array.isArray(inputs) || inputs.length !== 2) throw new Error('crossfade requires exactly 2 inputs');
    const tr = getTransition(transition);
    const offset = Number((inputs && inputs[0] && inputs[0].duration) || 0) || duration;
    const filter = '[i0:v][i1:v]xfade=transition=' + tr.filter + ':duration=' + duration + ':offset=' + offset + '[e0];[i0:a][i1:a]amix=inputs=2:duration=first:dropout_transition=2[e1]';
    const args = ['-y'];
    args.push('-i', inputs[0].inputPath);
    args.push('-i', inputs[1].inputPath);
    args.push('-filter_complex', filter);
    args.push('-map', '[e0]');
    args.push('-map', '[e1]');
    args.push('-c:v', 'libx264');
    args.push('-pix_fmt', 'yuv420p');
    args.push('-c:a', 'aac');
    args.push('-b:a', '128k');
    args.push(outputPath);
    return await runFfmpeg(args);
  }

  static async renderTimeline({ timeline, outputPath, resolution, fps, format, transition = 'none', transitionDuration = 1, grade = null }) {
    const tl = timeline;
    const clips = [];
    for (const t of (tl && Array.isArray(tl.tracks) ? tl.tracks : [])) {
      if (!t || t.kind !== 'video') continue;
      for (const c of (Array.isArray(t.clips) ? t.clips : [])) {
        if (c && c.source) clips.push(c);
      }
    }
    clips.sort((a, b) => (Number(a.inPoint) || 0) - (Number(b.inPoint) || 0));
    if (clips.length === 0) throw new Error('renderTimeline requires at least one clip with a source');

    const tr = transition && transition !== 'none' ? getTransition(transition) : { name: 'none', label: 'None', filter: 'fade' };
    const fpsNum = Number(fps) > 0 ? Number(fps) : (tl && tl.fps) || 24;
    let size = '1920x1080';
    if (resolution) {
      const [w, h] = String(resolution).toLowerCase().split('x').map((n) => parseInt(n, 10) || 0);
      if (w > 0 && h > 0) size = w + 'x' + h;
    }
    const durs = clips.map((c) => Math.max(0.04, ((Number(c.outPoint) || 0) - (Number(c.inPoint) || 0)) / fpsNum));
    const T = Math.max(0, Number(transitionDuration) || 0);

    const args = ['-y'];
    clips.forEach((c) => args.push('-i', c.source));
    const segments = [];
    clips.forEach((c, i) => { segments.push('[' + i + ':v]scale=' + size + '[v' + i + ']'); });
    let finalLabel = '[v0]';
    if (clips.length > 1) {
      let cur = '[v0]';
      let dur = durs[0];
      for (let i = 1; i < clips.length; i++) {
        const t = Math.min(T, dur, durs[i]);
        const out = '[x' + (i - 1) + ']';
        segments.push(cur + '[v' + i + ']xfade=transition=' + tr.filter + ':duration=' + fmtNum(t) + ':offset=' + fmtNum(Math.max(0, dur - t)) + '[' + out.slice(1, -1) + ']');
        dur = dur + durs[i] - t;
        cur = out;
      }
      finalLabel = cur;
    } else {
      segments.push(finalLabel);
    }
    const gradeVals = grade || {};
    const hasGrade = Number(gradeVals.brightness) !== undefined || Number(gradeVals.contrast) !== undefined || Number(gradeVals.saturation) !== undefined || Number(gradeVals.hue) !== undefined;
    if (hasGrade) {
      const parts = ['eq=brightness=' + fmtNum(Number(gradeVals.brightness) || 0) + ':contrast=' + fmtNum(Number(gradeVals.contrast) || 1) + ':saturation=' + fmtNum(Number(gradeVals.saturation) === undefined ? 1 : Number(gradeVals.saturation))];
      if (Number(gradeVals.hue) !== undefined) parts.push('hue=h=' + fmtNum(Number(gradeVals.hue) || 0));
      segments.push(finalLabel + parts.join(',') + '[vout]');
      finalLabel = '[vout]';
    }
    args.push('-filter_complex', segments.join(';') + ';');
    args.push('-map', finalLabel);
    args.push('-map', '0:a?');
    if (fps) args.push('-r', String(fps));
    args.push('-c:v', 'libx264');
    args.push('-pix_fmt', 'yuv420p');
    args.push('-c:a', 'aac');
    args.push('-b:a', '128k');
    args.push('-f', format || 'mp4');
    args.push(outputPath);
    return await runFfmpeg(args);
  }

  static async applyGrade({ inputPath, outputPath, grade = {} }) {
    const brightness = Number(grade.brightness) || 0;
    const contrast = Number(grade.contrast);
    const saturation = Number(grade.saturation);
    const hue = Number(grade.hue);
    const parts = ['eq=brightness=' + fmtNum(brightness) + ':contrast=' + fmtNum(Number.isFinite(contrast) ? contrast : 1) + ':saturation=' + fmtNum(Number.isFinite(saturation) ? saturation : 1)];
    if (Number.isFinite(hue) && hue !== 0) parts.push('hue=h=' + fmtNum(hue));
    const filter = parts.join(',');
    const args = ['-y', '-i', inputPath, '-vf', filter, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', outputPath];
    return await runFfmpeg(args);
  }

  static async renderTween({ inputPath, outputPath, keyframes, frameRate = 24, fps, width, height }) {
    if (!Array.isArray(keyframes) || keyframes.length === 0) {
      throw new Error('renderTween requires a non-empty keyframes array');
    }
    const exprs = buildTweenExpressions({ keyframes }, frameRate);
    const info = await MelFfmpeg.probe(inputPath);
    const inRate = info.frameRate || frameRate || 24;
    const lastFrame = keyframes.reduce((m, k) => Math.max(m, Number(k.frame) || 0), 0);
    const duration = info.nbFrames > 0 && inRate > 0 ? info.nbFrames / inRate : (lastFrame + 1) / (frameRate > 0 ? frameRate : 24);
    const props = sampleKeyframes(keyframes, 0); // constants for props that never change
    const outW = width || info.width;
    const outH = height || info.height;
    const rate = fps || inRate || 24;

    let chain = 'format=rgba';
    if (exprs.scale) {
      chain += ",scale=w='max(1,iw*(" + exprs.scale + "))':h='max(1,ih*(" + exprs.scale + "))':eval=frame";
    } else if (props.scale !== 1) {
      chain += ",scale=w='max(1,iw*" + fmtNum(props.scale) + ")':h='max(1,ih*" + fmtNum(props.scale) + ")'";
    }
    if (exprs.rotation) {
      chain += ",rotate=a='" + exprs.rotation + "':fillcolor=none";
    } else if (props.rotation !== 0) {
      chain += ',rotate=a=' + fmtNum(props.rotation) + ':fillcolor=none';
    }
    const alpha = exprs.opacity || (props.opacity !== 1 ? fmtNum(props.opacity) : null);
    if (alpha) {
      // geq reads time as T, all other filters use t.
      chain += ",geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*(" + alpha.replace(/\bt\b/g, 'T') + ")'";
    }
    const xExpr = exprs.x || (props.x !== 0 ? fmtNum(props.x) : null);
    const yExpr = exprs.y || (props.y !== 0 ? fmtNum(props.y) : null);
    const overlay = '[1:v][v0]overlay=x=\'(W-w)/2' + (xExpr ? '+(' + xExpr + ')' : '') +
      '\':y=\'(H-h)/2' + (yExpr ? '+(' + yExpr + ')' : '') + '\':eval=frame[vout]';
    const filter = '[0:v]' + chain + '[v0];' + overlay;

    const args = ['-y', '-i', inputPath];
    args.push('-f', 'lavfi', '-i', 'color=c=black:s=' + outW + 'x' + outH + ':r=' + rate + ':d=' + fmtNum(duration));
    args.push('-filter_complex', filter);
    args.push('-map', '[vout]');
    args.push('-map', '0:a?');
    if (fps) args.push('-r', String(fps));
    args.push('-c:v', 'libx264');
    args.push('-pix_fmt', 'yuv420p');
    args.push('-c:a', 'aac');
    args.push('-b:a', '128k');
    args.push(outputPath);
    return await runFfmpeg(args);
  }
}

module.exports = { MelFfmpeg, runFfmpeg, runFfprobe };
