// MelSound Project Engine - DAW project model with tracks, patterns, instruments and plugins.
class MelSoundProject {
  constructor({ bpm = 120, masterGain = 1, tracks = [], instruments = [] } = {}) {
    this.bpm = Math.max(1, Math.min(999, Math.round(Number(bpm) || 120)));
    this.masterGain = Math.max(0, Math.min(10, Number(masterGain) || 1));
    this.tracks = Array.isArray(tracks) ? tracks : [];
    this.instruments = Array.isArray(instruments) ? instruments : [];
  }

  static deserialize(json) {
    if (!json) throw new Error('Empty project file');
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const project = new MelSoundProject({
      bpm: data.bpm,
      masterGain: data.masterGain,
      tracks: data.tracks,
      instruments: data.instruments
    });
    project.meta = data.meta || { source: 'mel-sound' };
    return project;
  }

  serialize() {
    return JSON.stringify({
      bpm: this.bpm,
      masterGain: this.masterGain,
      tracks: this.tracks,
      instruments: this.instruments,
      meta: { source: 'mel-sound' }
    });
  }

  setBpm(bpm) {
    this.bpm = Math.max(1, Math.min(999, Math.round(Number(bpm) || this.bpm)));
    return this.bpm;
  }

  get masterGainValue() {
    return this.masterGain;
  }

  setMasterGain(gain) {
    this.masterGain = Math.max(0, Math.min(10, Number(gain) || 0));
    return this.masterGain;
  }

  addTrack(name) {
    const id = 'track-' + Date.now();
    const track = { id, name: name || ('Track ' + (this.tracks.length + 1)), steps: new Array(16).fill(0) };
    this.tracks.push(track);
    return track;
  }

  removeTrack(trackId) {
    this.tracks = this.tracks.filter((t) => t.id !== trackId);
  }

  setStep(trackId, step, note) {
    const track = this.tracks.find((t) => t.id === trackId);
    if (!track) return false;
    const idx = Math.max(0, Math.min(15, Math.round(step)));
    track.steps[idx] = Math.max(0, Math.min(127, Math.round(Number(note) || 0)));
    return true;
  }

  getStep(trackId, step) {
    const track = this.tracks.find((t) => t.id === trackId);
    if (!track) return 0;
    const idx = Math.max(0, Math.min(15, Math.round(step)));
    return track.steps[idx] || 0;
  }

  addInstrument(name, type, pluginName, params) {
    const id = 'inst-' + Date.now();
    const instrument = {
      id,
      name: name || 'Instrument',
      type: type || 'synth',
      pluginName: pluginName || '',
      params: params || { cutoff: 2000, resonance: 1, level: 0.8 }
    };
    this.instruments.push(instrument);
    return instrument;
  }
}

module.exports = { MelSoundProject };
