// MelFilm Transition Library - FFMPEG xfade transition presets.
const XFADE_TRANSITIONS = [
  { name: 'fade', label: 'Fade', filter: 'fade', description: 'Linear fade between clips.' },
  { name: 'fadeblack', label: 'Fade to Black', filter: 'fadeblack', description: 'Clip B fades from black.' },
  { name: 'fadewhite', label: 'Fade from White', filter: 'fadewhite', description: 'Clip B fades from white.' },
  { name: 'slideleft', label: 'Slide Left', filter: 'slideleft', description: 'Clip B slides in from left.' },
  { name: 'slideright', label: 'Slide Right', filter: 'slideright', description: 'Clip B slides in from right.' },
  { name: 'slideup', label: 'Slide Up', filter: 'slideup', description: 'Clip B slides in from bottom.' },
  { name: 'slidedown', label: 'Slide Down', filter: 'slidedown', description: 'Clip B slides in from top.' },
  { name: 'zoompan', label: 'Zoom', filter: 'zoompan', description: 'Clip B zooms into frame.' }
];

function getTransition(name) {
  const hit = XFADE_TRANSITIONS.find((t) => t.name === name);
  if (!hit) throw new Error('Unknown FFMPEG transition: ' + name);
  return hit;
}

module.exports = { XFADE_TRANSITIONS, getTransition };
