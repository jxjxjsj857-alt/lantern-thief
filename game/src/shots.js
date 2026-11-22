// Screenshot scenes behind ?shot=title|patrol|alert|win.
// Each one plays the real rules forward from a fresh world for a fixed
// number of steps, steered by a simple autopilot, so the frame is what a
// short game really looks like and the same seed always gives the same frame.
import { STEP, TILE } from './config.js';
import { collideCircle } from './level.js';

const SAMPLE = STEP;
const DIRECTIONS = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** Would the player be seen standing at (x, y)? */
function seenAt(game, x, y) {
  const probe = { x, y, running: false, sneaking: false };
  for (const guard of game.guards) {
    if (guard.seesPlayer(game.tiles, probe) > 0) return true;
  }
  return false;
}

/** Pick a safe step toward the target: closer is better, seen is bad. */
function autopilot(game, target) {
  const player = game.player;
  let best = [0, 0];
  let bestScore = -Infinity;
  for (const [dx, dy] of DIRECTIONS) {
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const speed = 125 * SAMPLE;
    const nx = player.x + (dx / len) * speed;
    const ny = player.y + (dy / len) * speed;
    const fixed = collideCircle(game.tiles, nx, ny, 13);
    const moved = Math.hypot(fixed.x - player.x, fixed.y - player.y);
    if (dx !== 0 || dy !== 0) {
      if (moved < speed * 0.3) continue;
    }
    const dist = Math.hypot(target.x - fixed.x, target.y - fixed.y);
    let score = -dist;
    if (seenAt(game, fixed.x, fixed.y)) score -= 500;
    if (dx === 0 && dy === 0) score -= 30;
    if (score > bestScore) {
      bestScore = score;
      best = [dx, dy];
    }
  }
  return best;
}

/** Drive the autopilot for `seconds` of game time. */
function playForward(game, seconds, relicLimit) {
  const input = game.input;
  const steps = Math.floor(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    if (game.state === 'levelclear' || game.state === 'caught') break;
    let dx = 0;
    let dy = 0;
    const remaining = game.relics.filter((relic) => !relic.taken);
    if (game.player.relics < relicLimit && remaining.length > 0) {
      let target = remaining[0];
      for (const relic of remaining) {
        if (Math.hypot(relic.x - game.player.x, relic.y - game.player.y) <
          Math.hypot(target.x - game.player.x, target.y - game.player.y)) target = relic;
      }
      [dx, dy] = autopilot(game, target);
    }
    input.up = dy < 0;
    input.down = dy > 0;
    input.left = dx < 0;
    input.right = dx > 0;
    input.run = false;
    input.sneak = false;
    game.step(SAMPLE);
  }
  input.up = input.down = input.left = input.right = false;
}

/**
 * Set the game to the named scene and return the screen to draw over it.
 * Names: title, patrol, alert, win. Any other name is title.
 */
export function stageShot(name, game) {
  if (name === 'patrol') {
    game.loadLevel(0);
    game.state = 'play';
    playForward(game, 6, 2);
    return { screen: 'play' };
  }
  if (name === 'alert') {
    game.loadLevel(1);
    game.state = 'play';
    const guard = game.guards[0];
    game.player.x = guard.x;
    game.player.y = guard.y + 3.2 * TILE;
    game.player.facing = -Math.PI / 2;
    guard.facing = Math.PI / 2;
    guard.suspicion = 100;
    guard.state = 'alert';
    guard.lastSeen = { x: game.player.x, y: game.player.y };
    guard.lastSeenTimer = 0;
    game.time = 34;
    for (let i = 0; i < Math.floor(0.9 / SAMPLE); i += 1) game.step(SAMPLE);
    return { screen: 'play' };
  }
  if (name === 'win') {
    game.loadLevel(0);
    game.state = 'play';
    for (const relic of game.relics) relic.taken = true;
    game.player.relics = game.relics.length;
    game.exitOpen = true;
    game.player.x = game.exit.x;
    game.player.y = game.exit.y;
    game.player.facing = -Math.PI / 2;
    game.score = 4250;
    game.totalTime = 187;
    game.totalCoins = 3;
    game.ghostLevels = 2;
    game.time = 187;
    return { screen: 'win' };
  }
  game.loadLevel(0);
  game.state = 'title';
  for (let i = 0; i < Math.floor(5 / SAMPLE); i += 1) game.step(SAMPLE);
  return { screen: 'title' };
}
