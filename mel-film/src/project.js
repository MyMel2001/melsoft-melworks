// MelFilm Project Model - composition stack persistence for the edit session.
class MelFilmProject {
  constructor({ name = 'MelFilm Project', comps = [], settings = {} } = {}) {
    this.name = name;
    this.comps = Array.isArray(comps) ? comps : [];
    this.settings = settings || { resolution: '1920x1080', fps: 30, format: 'mp4' };
  }

  static create(name) {
    return new MelFilmProject({ name: name || 'MelFilm Project' });
  }

  addComp(comp) {
    this.comps.push(comp);
    return comp;
  }

  removeComp(compId) {
    const before = this.comps.length;
    this.comps = this.comps.filter((c) => c.name !== compId);
    return before - this.comps.length;
  }

  getComp(compId) {
    return this.comps.find((c) => c.name === compId) || null;
  }

  toJSON() {
    return {
      name: this.name,
      comps: this.comps.map((c) => ({ name: c.name, width: c.width, height: c.height, frameRate: c.frameRate, layers: c.layers })),
      settings: this.settings
    };
  }

  static fromJSON(json) {
    const project = new MelFilmProject({ name: json.name || 'MelFilm Project', settings: json.settings || {} });
    project.comps = (json.comps || []).map((c) => ({
      name: c.name,
      width: c.width || 1920,
      height: c.height || 1080,
      frameRate: c.frameRate || 24,
      layers: c.layers || []
    }));
    return project;
  }
}

module.exports = { MelFilmProject };
