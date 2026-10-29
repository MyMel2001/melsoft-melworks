// MelSound WAV Writer - renders a MelSound sequence to 16-bit PCM WAV bytes.
const fs = require('fs');

function writeWav(buffer, sampleRate) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const dataSize = buffer.length * 2;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, 28);
  header.writeUInt16LE(numChannels * bitsPerSample / 8, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataSize, 40);
  const pcm = Buffer.alloc(dataSize);
  for (let i = 0; i < buffer.length; i++) {
    const v = Math.max(-1, Math.min(1, buffer[i]));
    pcm.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  return Buffer.concat([header, pcm]);
}

function renderSequenceWav(project, sampleRate = 44100) {
  const seq = require('./audio').buildSequence(project);
  const totalSamples = Math.max(1, Math.ceil(seq.duration * sampleRate));
  const clean = new Float32Array(totalSamples);
  const noteToFreq = require('./audio').noteToFrequency;
  const masterGain = (project && project.masterGain) ? project.masterGain : 1;
  const master = Math.max(0, Math.min(10, masterGain));
  for (const e of seq.events) {
    const startSample = Math.floor(e.time * sampleRate);
    const durSamples = Math.max(1, Math.floor(e.duration * sampleRate));
    const freq = noteToFreq(e.midi);
    const vol = Math.max(0, Math.min(1, e.volume === undefined ? 1 : e.volume)) * 0.8 * master;
    const release = Math.max(1, Math.floor(0.05 * sampleRate));
    for (let s = 0; s < durSamples && startSample + s < totalSamples; s++) {
      const t = s / sampleRate;
      const env = Math.min(1, (durSamples - s) / release);
      const saw = 2 * Math.abs(2 * ((freq * t) % 1) - 1) - 1;
      clean[startSample + s] += vol * env * (Math.sin(2 * Math.PI * freq * t) + 0.5 * Math.sin(2 * Math.PI * freq * 2 * t) + 0.25 * Math.sin(2 * Math.PI * freq * 3 * t) + 0.35 * saw);
    }
  }
  return writeWav(clean, sampleRate);
}

function saveWav(project, outputPath, sampleRate) {
  const wav = renderSequenceWav(project, sampleRate);
  fs.writeFileSync(outputPath, wav);
  return wav;
}

module.exports = { writeWav, renderSequenceWav, saveWav };
