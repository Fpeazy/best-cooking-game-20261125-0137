// SATE BAKAR — shared constants, the seeded random source and the ingredient list.
// Every number the HUD shows comes from the live game state, never from a literal here.
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const SHIFT_SECONDS = 120;
export const WIN_SCORE = 600;
export const MAX_WALKOUTS = 3;
export const GRILL_SLOTS = 4;
export const STEP = 1 / 60;

// Mulberry32: the game's one deterministic random source (seeded per run / per scene).
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const INGREDIENTS = [
  { id: 'chicken', name: 'Ayam', color: '#f2a65a', dark: '#c97b2d', price: 0 },
  { id: 'beef', name: 'Sapi', color: '#c0392b', dark: '#7e241a', price: 0 },
  { id: 'tofu', name: 'Tahu', color: '#fdf3d0', dark: '#d9c48a', price: 0 },
  { id: 'tempeh', name: 'Tempe', color: '#e8c07a', dark: '#a87c33', price: 0 },
  { id: 'mushroom', name: 'Jamur', color: '#e8dcc8', dark: '#9c8a6d', price: 0 },
];

export const GARNISHES = [
  { id: 'ketupat', name: 'Ketupat', color: '#b8e986' },
  { id: 'onion', name: 'Bawang', color: '#f5d0fe' },
  { id: 'chili', name: 'Cabai', color: '#e63946' },
  { id: 'cucumber', name: 'Timun', color: '#7ee081' },
  { id: 'krupuk', name: 'Krupuk', color: '#ffd166' },
];

export const SAUCES = [
  { id: 'peanut', name: 'Kacang', color: '#a4713b' },
  { id: 'kecap', name: 'Kecap', color: '#3d2314' },
  { id: 'sambal', name: 'Sambal', color: '#d62828' },
];

// Station rectangles on the 1280x720 floor (x, y, w, h). The chef walks the floor lane.
export const STATIONS = {
  ingredients: { x: 20, y: 300, w: 210, h: 150, label: 'BAHAN' },
  chop: { x: 250, y: 300, w: 150, h: 150, label: 'POTONG' },
  grill: { x: 420, y: 290, w: 330, h: 165, label: 'BAKAR' },
  sauce: { x: 770, y: 300, w: 150, h: 150, label: 'SAUS' },
  plate: { x: 940, y: 300, w: 150, h: 150, label: 'PIRING' },
  serve: { x: 1110, y: 300, w: 150, h: 150, label: 'SAJI' },
};
export const FLOOR_Y = 560;
export const CHEF_START = { x: 640, y: 600 };
