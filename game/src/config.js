// Shared constants and tiny math helpers for Lantern Thief.
// One clear job: every number the rest of the game agrees on lives here.
export const TILE = 48;
export const COLS = 20;
export const ROWS = 13;
export const VIEW_W = COLS * TILE; // 960
export const VIEW_H = ROWS * TILE; // 624
export const HUD_H = 56;
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walk: 125,
  run: 190,
  sneak: 70,
};

export const GUARD = {
  radius: 13,
  patrolSpeed: 55,
  suspiciousSpeed: 85,
  alertSpeed: 122,
  visionRange: 235,
  halfAngle: 0.62, // ~35 degrees each side
  catchDistance: 26,
  suspiciousAt: 55,
  alertAt: 100,
  hearRange: 270,
};

/** Clamp a value between lo and hi. */
export function clamp(value, lo, hi) {
  return value < lo ? lo : value > hi ? hi : value;
}

/** Euclidean distance between two points. */
export function distance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Smallest absolute difference between two angles, in radians. */
export function angleDifference(a, b) {
  let diff = a - b;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff);
}

/** A tiny deterministic random generator (mulberry32) for staged scenes. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Format seconds as m:ss. */
export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return minutes + ':' + (rest < 10 ? '0' : '') + rest;
}
