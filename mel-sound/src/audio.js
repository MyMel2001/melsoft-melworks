// MelSound Audio Engine - WebAudio-backed playback of 16-step patterns.
function noteToFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function buildSequence(project) {
  const bpm = (project && project.bpm) ? project.bpm : 120;
  const stepDuration = 60 / (bpm * 4); // 16 steps per bar
  const events = [];
  const tracks = (project && project.tracks) || [];
  for (const track of tracks) {
    if (track.mute) continue;
    const steps = track.steps || new Array(16).fill(0);
    for (let s = 0; s < 16; s++) {
      const note = steps[s];
      if (!note) continue;
      events.push({ trackId: track.id, step: s, time: s * stepDuration, duration: stepDuration * 0.9, midi: note, volume: track.volume === undefined ? 1 : track.volume });
    }
  }
  let lastEnd = 0;
  for (const e of events) lastEnd = Math.max(lastEnd, e.time + e.duration);
  return { events, stepDuration, bpm, duration: lastEnd };
}

class MelSoundPlayer {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
  }

  ensureContext() {
    if (!this.ctx) {
      const AC = (typeof window !== 'undefined') ? (window.AudioContext || window.webkitAudioContext) : null;
      if (!AC) throw new Error('AudioContext unavailable in this environment');
      this.ctx = new AC();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.8;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  play(project) {
    const ctx = this.ensureContext();
    const seq = buildSequence(project);
    const now = ctx.currentTime;
    for (const e of seq.events) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = noteToFrequency(e.midi);
      gain.gain.setValueAtTime(0, now + e.time);
      gain.gain.linearRampToValueAtTime(0.8 * (e.volume || 1), now + e.time + 0.01);
      gain.gain.setValueAtTime(0.8 * (e.volume || 1), now + e.time + e.duration);
      gain.gain.linearRampToValueAtTime(0, now + e.time + e.duration);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + e.time);
      osc.stop(now + e.time + e.duration);
    }
    return seq;
  }

  stop() {
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(0.8, this.ctx.currentTime + 0.05);
    }
  }
}

module.exports = { MelSoundPlayer, buildSequence, noteToFrequency };
