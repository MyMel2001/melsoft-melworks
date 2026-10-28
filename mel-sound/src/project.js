// MelSound Project Engine - DAW project model with tracks, patterns, instruments and plugins.
class MelSoundProject {
  static trackSeq = 0;
  static patternSeq = 0;
  constructor({ bpm = 120, masterGain = 1, tracks = [], instruments = [], kind = 'instrumental', patterns = [] } = {}) {
    this.bpm = Math.max(1, Math.min(999, Math.round(Number(bpm) || 120)));
    this.masterGain = Math.max(0, Math.min(10, Number(masterGain) || 1));
    this.tracks = Array.isArray(tracks) ? tracks : [];
    this.instruments = Array.isArray(instruments) ? instruments : [];
    this.kind = kind || 'instrumental';
    this.patterns = Array.isArray(patterns) ? patterns : [];
  }

  static create(kind, bpm) {
    return new MelSoundProject({ bpm, kind: kind || 'instrumental' });
  }

  static deserialize(json) {
    if (!json) throw new Error('Empty project file');
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const project = new MelSoundProject({
      bpm: data.bpm,
      masterGain: data.masterGain,
      tracks: data.tracks,
      instruments: data.instruments,
      kind: data.kind
    });
    project.meta = data.meta || { source: 'mel-sound' };
    project.patterns = Array.isArray(data.patterns) ? data.patterns : [];
    return project;
  }

  serialize() {
    return JSON.stringify({
      bpm: this.bpm,
      masterGain: this.masterGain,
      tracks: this.tracks,
      instruments: this.instruments,
      kind: this.kind,
      patterns: this.patterns,
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

  setKind(kind) {
    this.kind = kind || 'instrumental';
    return this.kind;
  }

  addTrack(name, kind) {
    const id = 'track-' + (++MelSoundProject.trackSeq);
    const track = {
      id,
      name: name || ('Track ' + (this.tracks.length + 1)),
      kind: kind || 'instrumental',
      lyrics: '',
      steps: new Array(16).fill(0)
    };
    this.tracks.push(track);
    return track;
  }

  removeTrack(trackId) {
    this.tracks = this.tracks.filter((t) => t.id !== trackId);
  }

  setLyrics(trackId, lyrics) {
    const track = this.tracks.find((t) => t.id === trackId);
    if (!track) return false;
    track.lyrics = lyrics || '';
    return true;
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

  setStepOnPattern(patternId, trackId, step, note) {
    const pattern = this.getPattern(patternId);
    const track = this.tracks.find((t) => t.id === trackId);
    if (!pattern || !track) return false;
    const steps = pattern.steps[trackId];
    if (!Array.isArray(steps)) return false;
    const idx = Math.max(0, Math.min(15, Math.round(step)));
    steps[idx] = Math.max(0, Math.min(127, Math.round(Number(note) || 0)));
    return true;
  }

  getStepOnPattern(patternId, trackId, step) {
    const pattern = this.getPattern(patternId);
    const track = this.tracks.find((t) => t.id === trackId);
    if (!pattern || !track) return 0;
    const steps = pattern.steps[trackId];
    if (!Array.isArray(steps)) return 0;
    const idx = Math.max(0, Math.min(15, Math.round(step)));
    return steps[idx] || 0;
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

  addPattern(name) {
    const id = 'pattern-' + (++MelSoundProject.patternSeq);
    const pattern = {
      id,
      name: name || ('Pattern ' + (this.patterns.length + 1)),
      steps: {}
    };
    for (const track of this.tracks) {
      pattern.steps[track.id] = new Array(16).fill(0);
    }
    this.patterns.push(pattern);
    return pattern;
  }

  removePattern(patternId) {
    const before = this.patterns.length;
    this.patterns = this.patterns.filter((p) => p.id !== patternId);
    return before - this.patterns.length;
  }

  getPattern(patternId) {
    return this.patterns.find((p) => p.id === patternId) || null;
  }

  selectPattern(patternId) {
    const pattern = this.getPattern(patternId);
    return pattern ? pattern.id : null;
  }
}

module.exports = { MelSoundProject };
