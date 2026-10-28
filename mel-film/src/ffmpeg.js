// MelFilm Video Engine - FFMPEG backed import/export/render/post processing
const { spawn } = require('child_process');
const { getTransition } = require('./transitions');

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
    const filter = '[i0:v][i1:v]xfade=transition=' + tr.filter + ':duration=' + duration + ':offset=0[e0]';
    const args = ['-y'];
    args.push('-i', inputs[0].inputPath);
    args.push('-i', inputs[1].inputPath);
    args.push('-filter_complex', filter);
    args.push('-map', '[e0]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', outputPath);
    return await runFfmpeg(args);
  }
}

module.exports = { MelFfmpeg, runFfmpeg, runFfprobe };
