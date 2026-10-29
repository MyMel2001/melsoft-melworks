// MelLite FFMPEG backed media decode bridge - converts FFMPEG supported inputs
// (ProRes RAW, ProRes, DNG via ffmpeg, and other FFMPEG-decodable formats) into ImageData.
const { spawn } = require('child_process');

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args);
    const chunks = [];
    let stderr = '';
    proc.stdout.on('data', (d) => chunks.push(d));
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (err) => reject(err));
    proc.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
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
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error('ffprobe exited with code ' + code + ': ' + stderr));
    });
  });
}

async function probeVideo(inputPath) {
  const res = await runFfprobe(['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', inputPath]);
  const info = JSON.parse(res.stdout);
  const stream = (info && info.streams && info.streams[0]) || { width: 0, height: 0 };
  return { width: parseInt(stream.width, 10) || 0, height: parseInt(stream.height, 10) || 0 };
}

async function decodeVideoToImageData(inputPath) {
  const info = await probeVideo(inputPath);
  if (!info.width || !info.height) throw new Error('FFMPEG decode requires resolvable video dimensions');
  const rgb = await runFfmpeg(['-i', inputPath, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1']);
  if (rgb.length < info.width * info.height * 3) throw new Error('FFMPEG decode produced short raw buffer');
  const data = new Uint8ClampedArray(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) {
    const s = i * 3;
    const o = i * 4;
    data[o] = rgb[s];
    data[o + 1] = rgb[s + 1];
    data[o + 2] = rgb[s + 2];
    data[o + 3] = 255;
  }
  return { width: info.width, height: info.height, data };
}

class MelLiteFfmpeg {
  static async probe(inputPath) {
    return await probeVideo(inputPath);
  }

  static async decodeToImageData(inputPath) {
    return await decodeVideoToImageData(inputPath);
  }
}

module.exports = { MelLiteFfmpeg, runFfmpeg, runFfprobe, probeVideo, decodeVideoToImageData };
