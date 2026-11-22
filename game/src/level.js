// Level data for Lantern Thief: three hand-drawn night-museum floors.
// Tiles: '#' wall, '.' lit floor, ',' shadow floor (hides you), 'C' crate,
// 'P' pillar, 'R' relic pedestal, 'E' exit door, 'G' gold coin,
// 'S' player start, '1'-'4' guard spawns (patrols listed per level).
import { COLS, ROWS, TILE } from './config.js';

export const LEVELS = [
  {
    name: 'The Marble Hall',
    par: 90,
    lanterns: [[5, 1], [15, 6], [10, 11]],
    patrols: [
      [[14, 11], [14, 5], [7, 5], [7, 11]],
      [[10, 2], [16, 2], [16, 7], [10, 7]],
    ],
    map: [
      '####################',
      '#....,,......R.....#',
      '#.##....##2.....G..#',
      '#....C.....##......#',
      '#.S..C....,,...##..#',
      '#....C....,,...##..#',
      '#..####...,,...#...#',
      '#......,......#....#',
      '#.C....,,..C..#..R.#',
      '#..C.......C.......#',
      '#....##....,,...##R#',
      '#..G......,,..1...E#',
      '####################',
    ],
  },
  {
    name: 'The Gilded Gallery',
    par: 120,
    lanterns: [[4, 3], [15, 4], [9, 9]],
    patrols: [
      [[18, 4], [18, 8], [12, 8], [12, 4]],
      [[14, 11], [14, 6], [8, 6], [8, 11]],
      [[18, 9], [17, 2], [10, 2], [10, 9]],
    ],
    map: [
      '####################',
      '#..R....,,.....#..R#',
      '#.##..C..,,..C..#..#',
      '#....C....,,....#..#',
      '#.S....####...C...1#',
      '#..##......,,..##..#',
      '#....C...,,..C....G#',
      '#..##....,,....##..#',
      '#.G....####...C....#',
      '#....C....,,..C..#3#',
      '#..##..C..,,....#..#',
      '#.....R...,,..2...E#',
      '####################',
    ],
  },
  {
    name: 'The Vault of Kings',
    par: 150,
    lanterns: [[6, 2], [13, 5], [10, 10]],
    patrols: [
      [[3, 11], [3, 5], [9, 5], [9, 11]],
      [[14, 11], [15, 4], [17, 4], [17, 11]],
      [[16, 2], [17, 8], [11, 8], [11, 2]],
      [[17, 7], [13, 7], [13, 10], [17, 10]],
    ],
    map: [
      '####################',
      '#..R...,,...#...R..#',
      '#.##.C..,,..#..C3#.#',
      '#...C....,,....C...#',
      '#.S..##..,,..##....#',
      '#....C....,,...C.#.#',
      '#..##....,,....##..#',
      '#..C...####...C..4G#',
      '#....##....,,..##..#',
      '#.G..C....,,..C....#',
      '#..##....,,....##..#',
      '#..1...R..,,..2...E#',
      '####################',
    ],
  },
];

/** Parse a level into a playable world description. */
export function parseLevel(index) {
  const def = LEVELS[index];
  if (!def) return null;
  const tiles = def.map.map((row) => row.split(''));
  const relics = [];
  const coins = [];
  const guardSpawns = [];
  let playerStart = null;
  let exit = null;
  for (let y = 0; y < ROWS; y += 1) {
    if (tiles[y].length !== COLS) {
      throw new Error('Level ' + (index + 1) + ' row ' + y + ' is ' + tiles[y].length + ' wide, expected ' + COLS);
    }
    for (let x = 0; x < COLS; x += 1) {
      const ch = tiles[y][x];
      const cx = x * TILE + TILE / 2;
      const cy = y * TILE + TILE / 2;
      if (ch === 'R') relics.push({ x: cx, y: cy, taken: false });
      else if (ch === 'G') coins.push({ x: cx, y: cy, taken: false });
      else if (ch === 'S') playerStart = { x: cx, y: cy };
      else if (ch === 'E') exit = { x: cx, y: cy };
      else if (ch >= '1' && ch <= '9') guardSpawns.push({ x: cx, y: cy, digit: ch });
    }
  }
  guardSpawns.sort((a, b) => (a.digit < b.digit ? -1 : 1));
  if (!playerStart) throw new Error('Level ' + (index + 1) + ' has no player start');
  if (!exit) throw new Error('Level ' + (index + 1) + ' has no exit');
  if (relics.length === 0) throw new Error('Level ' + (index + 1) + ' has no relics');
  return {
    def,
    index,
    tiles,
    relics,
    coins,
    guardSpawns,
    playerStart,
    exit,
    lanterns: def.lanterns.map(([tx, ty]) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 })),
  };
}

/** True when the tile at (tx, ty) blocks movement. */
export function tileBlocksMove(tiles, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
  const ch = tiles[ty][tx];
  return ch === '#' || ch === 'C' || ch === 'P';
}

/** True when the tile at (tx, ty) blocks a guard's line of sight. */
export function tileBlocksSight(tiles, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
  const ch = tiles[ty][tx];
  return ch === '#' || ch === 'C' || ch === 'P';
}

/** True when the pixel point (x, y) stands on a shadow tile. */
export function isShadow(tiles, x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return false;
  return tiles[ty][tx] === ',';
}

/** Line of sight between two pixel points, blocked by walls, crates and pillars. */
export function hasLineOfSight(tiles, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i += 1) {
    const x = x1 + (dx * i) / steps;
    const y = y1 + (dy * i) / steps;
    if (tileBlocksSight(tiles, Math.floor(x / TILE), Math.floor(y / TILE))) return false;
  }
  return true;
}

/** Circle-vs-tile collision: slide the circle out of solid tiles. Returns corrected {x, y}. */
export function collideCircle(tiles, x, y, radius) {
  let nx = x;
  let ny = y;
  const minTx = Math.floor((nx - radius) / TILE);
  const maxTx = Math.floor((nx + radius) / TILE);
  const minTy = Math.floor((ny - radius) / TILE);
  const maxTy = Math.floor((ny + radius) / TILE);
  for (let ty = minTy; ty <= maxTy; ty += 1) {
    for (let tx = minTx; tx <= maxTx; tx += 1) {
      if (!tileBlocksMove(tiles, tx, ty)) continue;
      const left = tx * TILE;
      const top = ty * TILE;
      const right = left + TILE;
      const bottom = top + TILE;
      const closestX = Math.max(left, Math.min(nx, right));
      const closestY = Math.max(top, Math.min(ny, bottom));
      const dx = nx - closestX;
      const dy = ny - closestY;
      const d2 = dx * dx + dy * dy;
      if (d2 < radius * radius) {
        if (d2 === 0) {
          ny = top - radius;
        } else {
          const d = Math.sqrt(d2);
          const push = (radius - d) / d;
          nx += dx * push;
          ny += dy * push;
        }
      }
    }
  }
  return { x: nx, y: ny };
}
