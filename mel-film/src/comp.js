// MelFilm After Effects-style Composition model (layer stack within a comp).
class MelFilmComp {
  constructor({ name = 'Comp', width = 1920, height = 1080, frameRate = 24, frameCount = 0, layers = [] } = {}) {
    this.name = name;
    this.width = width;
    this.height = height;
    this.frameRate = frameRate;
    this.frameCount = frameCount;
    this.layers = Array.isArray(layers) ? layers : [];
  }

  static create(name) {
    return new MelFilmComp({ name: name || 'Comp' });
  }

  addLayer(name, source) {
    const layer = {
      id: 'layer-' + (++MelFilmComp.layerSeq),
      name: name || ('Layer ' + (this.layers.length + 1)),
      source: source || ''
    };
    this.layers.push(layer);
    return layer;
  }

  removeLayer(layerId) {
    const before = this.layers.length;
    this.layers = this.layers.filter((l) => l.id !== layerId);
    return before - this.layers.length;
  }

  getLayer(layerId) {
    return this.layers.find((l) => l.id === layerId) || null;
  }
}

MelFilmComp.layerSeq = 0;

module.exports = { MelFilmComp };
