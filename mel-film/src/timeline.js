// MelFilm Timeline Model - NLE track-based clip editing timeline.
class MelFilmTimeline {
  constructor({ name = 'Timeline', fps = 24, tracks = [] } = {}) {
    this.name = name;
    this.fps = Math.max(1, Math.round(Number(fps) || 24));
    this.tracks = Array.isArray(tracks) ? tracks : [];
  }

  static create(name, fps) {
    return new MelFilmTimeline({ name: name || 'Timeline', fps: fps || 24 });
  }

  addTrack(name, kind) {
    const id = 'track-' + (++MelFilmTimeline.trackSeq);
    const track = { id, name: name || ('Track ' + (this.tracks.length + 1)), kind: kind || 'video', clips: [] };
    this.tracks.push(track);
    return track;
  }

  removeTrack(trackId) {
    const before = this.tracks.length;
    this.tracks = this.tracks.filter((t) => t.id !== trackId);
    return before - this.tracks.length;
  }

  getTrack(trackId) {
    return this.tracks.find((t) => t.id === trackId) || null;
  }

  addClip(trackId, source, inPoint, outPoint) {
    const track = this.getTrack(trackId);
    if (!track) return null;
    const id = 'clip-' + (++MelFilmTimeline.clipSeq);
    const clip = { id, source: source || '', inPoint: Math.round(Number(inPoint) || 0), outPoint: Math.round(Number(outPoint) || 0) };
    track.clips.push(clip);
    return clip;
  }

  removeClip(trackId, clipId) {
    const track = this.getTrack(trackId);
    if (!track) return 0;
    const before = track.clips.length;
    track.clips = track.clips.filter((c) => c.id !== clipId);
    return before - track.clips.length;
  }

  getClips(trackId) {
    const track = this.getTrack(trackId);
    return track ? track.clips.slice() : [];
  }

  setClipRange(trackId, clipId, inPoint, outPoint) {
    const track = this.getTrack(trackId);
    const clip = track && track.clips.find((c) => c.id === clipId);
    if (!clip) return false;
    clip.inPoint = Math.round(Number(inPoint) || 0);
    clip.outPoint = Math.round(Number(outPoint) || 0);
    return true;
  }

  computeDuration() {
    let maxEnd = 0;
    for (const track of this.tracks) {
      for (const clip of track.clips || []) {
        const end = (Number(clip.outPoint) || 0) - (Number(clip.inPoint) || 0);
        maxEnd = Math.max(maxEnd, end);
      }
    }
    return maxEnd / this.fps;
  }

  toJSON() {
    return { name: this.name, fps: this.fps, tracks: this.tracks.map((t) => ({ id: t.id, name: t.name, kind: t.kind, clips: t.clips.slice() })) };
  }

  static fromJSON(json) {
    const timeline = new MelFilmTimeline({ name: json.name || 'Timeline', fps: json.fps || 24, tracks: json.tracks || [] });
    for (const t of timeline.tracks) {
      t.clips = (t.clips || []).map((c) => ({ id: c.id, source: c.source, inPoint: c.inPoint, outPoint: c.outPoint }));
    }
    return timeline;
  }
}

MelFilmTimeline.trackSeq = 0;
MelFilmTimeline.clipSeq = 0;

module.exports = { MelFilmTimeline };
