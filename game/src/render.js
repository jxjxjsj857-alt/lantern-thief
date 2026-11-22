// Canvas rendering for Lantern Thief: the museum floor, vision cones,
// guards, the thief, the HUD and every screen. One clear job: draw what
// the game state says, in one consistent top-down night-museum look.
import { TILE, COLS, ROWS, VIEW_W, VIEW_H, HUD_H, formatTime } from './config.js';

const FLOOR_A = '#3a3226';
const FLOOR_B = '#342d22';
const SHADOW_A = '#232a3d';
const SHADOW_B = '#202639';
const WALL = '#191d29';
const WALL_TOP = '#2e3448';

/** Base RGB of a guard's cone by state: calm yellow, wary orange, alert red. */
function coneRgb(guard) {
  if (guard.state === 'alert') return '255, 64, 48';
  if (guard.state === 'suspicious' || guard.suspicion >= 55) return '255, 150, 40';
  return '255, 208, 90';
}

function coneEdgeColor(guard) {
  if (guard.state === 'alert') return 'rgba(255, 90, 70, 0.8)';
  if (guard.state === 'suspicious' || guard.suspicion >= 55) return 'rgba(255, 170, 60, 0.7)';
  return 'rgba(255, 222, 120, 0.65)';
}

/** Draw one floor tile. */
function drawFloorTile(ctx, x, y, ch) {
  const px = x * TILE;
  const py = y * TILE;
  if (ch === ',') {
    ctx.fillStyle = (x + y) % 2 === 0 ? SHADOW_A : SHADOW_B;
    ctx.fillRect(px, py, TILE, TILE);
    ctx.strokeStyle = 'rgba(120, 140, 200, 0.10)';
    ctx.beginPath();
    ctx.moveTo(px, py + TILE);
    ctx.lineTo(px + TILE, py);
    ctx.stroke();
    return;
  }
  ctx.fillStyle = (x + y) % 2 === 0 ? FLOOR_A : FLOOR_B;
  ctx.fillRect(px, py, TILE, TILE);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
}

/** Draw a wall, crate or pillar tile. */
function drawSolidTile(ctx, x, y, ch) {
  const px = x * TILE;
  const py = y * TILE;
  if (ch === '#') {
    ctx.fillStyle = WALL;
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = WALL_TOP;
    ctx.fillRect(px, py, TILE, 6);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(px, py + 6, TILE, 2);
    return;
  }
  if (ch === 'C') {
    ctx.fillStyle = '#6b4a26';
    ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
    ctx.strokeStyle = '#4a3016';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 4, py + 4, TILE - 8, TILE - 8);
    ctx.beginPath();
    ctx.moveTo(px + 4, py + 4);
    ctx.lineTo(px + TILE - 4, py + TILE - 4);
    ctx.moveTo(px + TILE - 4, py + 4);
    ctx.lineTo(px + 4, py + TILE - 4);
    ctx.stroke();
    ctx.fillStyle = '#8a6136';
    ctx.fillRect(px + 4, py + 4, TILE - 8, 5);
    return;
  }
  if (ch === 'P') {
    ctx.fillStyle = '#4b5165';
    ctx.beginPath();
    ctx.arc(px + TILE / 2, py + TILE / 2, TILE / 2 - 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5d6378';
    ctx.beginPath();
    ctx.arc(px + TILE / 2, py + TILE / 2, TILE / 2 - 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRelic(ctx, relic, time) {
  if (relic.taken) {
    ctx.fillStyle = '#3d3428';
    ctx.fillRect(relic.x - 12, relic.y - 8, 24, 10);
    return;
  }
  const pulse = 0.75 + Math.sin(time * 3 + relic.x) * 0.25;
  const glow = ctx.createRadialGradient(relic.x, relic.y - 8, 2, relic.x, relic.y - 8, 46);
  glow.addColorStop(0, 'rgba(255, 214, 120, ' + (0.5 * pulse) + ')');
  glow.addColorStop(1, 'rgba(255, 214, 120, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(relic.x - 46, relic.y - 54, 92, 92);
  ctx.fillStyle = '#5d4a2a';
  ctx.fillRect(relic.x - 12, relic.y - 4, 24, 10);
  ctx.fillStyle = '#ffd678';
  ctx.beginPath();
  ctx.moveTo(relic.x, relic.y - 26);
  ctx.lineTo(relic.x + 9, relic.y - 10);
  ctx.lineTo(relic.x, relic.y - 2);
  ctx.lineTo(relic.x - 9, relic.y - 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.moveTo(relic.x, relic.y - 26);
  ctx.lineTo(relic.x + 4, relic.y - 10);
  ctx.lineTo(relic.x, relic.y - 6);
  ctx.lineTo(relic.x - 4, relic.y - 10);
  ctx.closePath();
  ctx.fill();
}

function drawCoin(ctx, coin, time) {
  if (coin.taken) return;
  const bob = Math.sin(time * 4 + coin.x) * 2;
  ctx.fillStyle = '#e8b93c';
  ctx.beginPath();
  ctx.arc(coin.x, coin.y + bob, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff0a8';
  ctx.beginPath();
  ctx.arc(coin.x - 2, coin.y + bob - 2, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawExit(ctx, game, time) {
  const exit = game.exit;
  const open = game.exitOpen;
  const pulse = open ? 0.6 + Math.sin(time * 4) * 0.25 : 0.25;
  const glow = ctx.createRadialGradient(exit.x, exit.y, 4, exit.x, exit.y, 60);
  glow.addColorStop(0, open ? 'rgba(90, 255, 150, ' + pulse + ')' : 'rgba(120, 140, 120, 0.18)');
  glow.addColorStop(1, 'rgba(90, 255, 150, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(exit.x - 60, exit.y - 60, 120, 120);
  ctx.fillStyle = open ? '#1d5c33' : '#2c2f38';
  ctx.fillRect(exit.x - 16, exit.y - 20, 32, 40);
  ctx.strokeStyle = open ? '#7dffab' : '#565b68';
  ctx.lineWidth = 2;
  ctx.strokeRect(exit.x - 16, exit.y - 20, 32, 40);
  ctx.beginPath();
  ctx.moveTo(exit.x, exit.y - 20);
  ctx.lineTo(exit.x, exit.y + 20);
  ctx.stroke();
  if (!open) {
    ctx.fillStyle = '#ffd678';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔒', exit.x, exit.y - 26);
  }
}

function drawGuard(ctx, game, guard) {
  const polygon = guard.conePolygon(game.tiles);
  const rgb = coneRgb(guard);
  const gradient = ctx.createRadialGradient(guard.x, guard.y, 12, guard.x, guard.y, 235);
  gradient.addColorStop(0, 'rgba(' + rgb + ', 0.55)');
  gradient.addColorStop(1, 'rgba(' + rgb + ', 0.12)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(polygon[0].x, polygon[0].y);
  for (let i = 1; i < polygon.length; i += 1) ctx.lineTo(polygon[i].x, polygon[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = coneEdgeColor(guard);
  ctx.lineWidth = 2;
  ctx.stroke();
  const bob = Math.sin(guard.walkCycle) * 1.5;
  ctx.fillStyle = guard.state === 'alert' ? '#c0392b' : '#7a4a2b';
  ctx.beginPath();
  ctx.arc(guard.x, guard.y + bob, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d8c49a';
  ctx.beginPath();
  ctx.arc(guard.x, guard.y + bob, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b2b2b';
  ctx.beginPath();
  ctx.arc(guard.x + Math.cos(guard.facing) * 6, guard.y + bob + Math.sin(guard.facing) * 6, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f5d76e';
  ctx.beginPath();
  ctx.arc(guard.x + Math.cos(guard.facing) * 13, guard.y + bob + Math.sin(guard.facing) * 13, 2.5, 0, Math.PI * 2);
  ctx.fill();
  if (guard.state === 'suspicious' || (guard.suspicion >= 25 && guard.state === 'patrol')) {
    ctx.fillStyle = '#ffb347';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('?', guard.x, guard.y - 20);
  }
  if (guard.state === 'alert') {
    ctx.fillStyle = '#ff4030';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', guard.x, guard.y - 20);
  }
  if (guard.suspicion > 2 && guard.state !== 'alert') {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(guard.x - 14, guard.y - 32, 28, 5);
    ctx.fillStyle = guard.suspicion >= 55 ? '#ff9632' : '#ffd25a';
    ctx.fillRect(guard.x - 14, guard.y - 32, 28 * (guard.suspicion / 100), 5);
  }
}

function drawPlayer(ctx, game) {
  const player = game.player;
  const glow = ctx.createRadialGradient(player.x, player.y, 4, player.x, player.y, 64);
  glow.addColorStop(0, 'rgba(255, 190, 90, 0.30)');
  glow.addColorStop(1, 'rgba(255, 190, 90, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(player.x - 64, player.y - 64, 128, 128);
  ctx.fillStyle = '#1f3a5f';
  ctx.beginPath();
  ctx.moveTo(player.x, player.y - 15);
  ctx.lineTo(player.x + 12, player.y + 11);
  ctx.lineTo(player.x - 12, player.y + 11);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f2d8a7';
  ctx.beginPath();
  ctx.arc(player.x, player.y - 4, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1f3a5f';
  ctx.beginPath();
  ctx.arc(player.x, player.y - 6, 7, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd25a';
  ctx.beginPath();
  ctx.arc(player.x + Math.cos(player.facing) * 14, player.y + Math.sin(player.facing) * 14, 3.5, 0, Math.PI * 2);
  ctx.fill();
  if (player.hidden(game.tiles)) {
    ctx.fillStyle = 'rgba(140, 170, 255, 0.9)';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HIDDEN', player.x, player.y - 22);
  }
}

function drawNoises(ctx, game) {
  for (const noise of game.noises) {
    const progress = noise.age / noise.maxAge;
    ctx.strokeStyle = 'rgba(255, 255, 255, ' + (0.6 * (1 - progress)) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(noise.x, noise.y, 8 + progress * 44, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** Draw the whole level (no HUD, no screens). */
export function drawWorld(ctx, game) {
  const time = game.time;
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      drawFloorTile(ctx, x, y, game.tiles[y][x]);
    }
  }
  for (const lantern of game.lanterns) {
    const glow = ctx.createRadialGradient(lantern.x, lantern.y, 4, lantern.x, lantern.y, 110);
    glow.addColorStop(0, 'rgba(255, 190, 100, 0.16)');
    glow.addColorStop(1, 'rgba(255, 190, 100, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(lantern.x - 110, lantern.y - 110, 220, 220);
  }
  for (const guard of game.guards) drawGuard(ctx, game, guard);
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const ch = game.tiles[y][x];
      if (ch === '#' || ch === 'C' || ch === 'P') drawSolidTile(ctx, x, y, ch);
    }
  }
  for (const relic of game.relics) drawRelic(ctx, relic, time);
  for (const coin of game.coins) drawCoin(ctx, coin, time);
  drawExit(ctx, game, time);
  drawPlayer(ctx, game);
  drawNoises(ctx, game);
}

/** Draw the top HUD bar. */
export function drawHUD(ctx, game) {
  ctx.fillStyle = '#12141d';
  ctx.fillRect(0, 0, VIEW_W, HUD_H);
  ctx.fillStyle = '#2a2f42';
  ctx.fillRect(0, HUD_H - 2, VIEW_W, 2);
  ctx.fillStyle = '#e8dcc0';
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(game.levelName, 14, 24);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#9aa3b8';
  ctx.fillText('Level ' + (game.levelIndex + 1) + ' / ' + game.levelCount, 14, 44);
  let x = 250;
  for (let i = 0; i < game.totalRelics; i += 1) {
    ctx.fillStyle = i < game.relicsGot ? '#ffd678' : '#3a3f52';
    ctx.beginPath();
    ctx.moveTo(x, 14);
    ctx.lineTo(x + 8, 24);
    ctx.lineTo(x, 34);
    ctx.lineTo(x - 8, 24);
    ctx.closePath();
    ctx.fill();
    x += 24;
  }
  ctx.fillStyle = '#e8b93c';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('● ' + game.coinsGot, x + 8, 27);
  ctx.fillStyle = '#e8dcc0';
  ctx.font = '15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⏱ ' + formatTime(game.time), VIEW_W / 2 + 60, 27);
  ctx.fillText('Score ' + game.score, VIEW_W / 2 + 170, 27);
  const alert = game.alertState;
  ctx.fillStyle = alert === 'alert' ? '#ff4030' : alert === 'suspicious' ? '#ff9632' : '#7ddb8a';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(alert === 'alert' ? '⚠ ALARM' : alert === 'suspicious' ? '? SUSPICIOUS' : '● UNSEEN', VIEW_W - 14, 27);
  ctx.fillStyle = '#9aa3b8';
  ctx.font = '12px sans-serif';
  ctx.fillText(game.muted ? 'M: sound off' : 'M: sound on', VIEW_W - 14, 45);
}

function dimScreen(ctx) {
  ctx.fillStyle = 'rgba(8, 10, 18, 0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H + HUD_H);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(18, 20, 32, 0.94)';
  ctx.strokeStyle = '#3a415c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.fill();
  ctx.stroke();
}

export function drawTitle(ctx, game) {
  dimScreen(ctx);
  panel(ctx, VIEW_W / 2 - 330, 120, 660, 420);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd678';
  ctx.font = 'bold 52px Georgia, serif';
  ctx.fillText('LANTERN THIEF', VIEW_W / 2, 190);
  ctx.fillStyle = '#e8dcc0';
  ctx.font = '17px Georgia, serif';
  ctx.fillText('A night-museum heist in the dark', VIEW_W / 2, 224);
  ctx.fillStyle = '#9aa3b8';
  ctx.font = '15px sans-serif';
  ctx.fillText('Steal the relics. Dodge the lantern-lit guards. Reach the exit unseen.', VIEW_W / 2, 262);
  ctx.fillText('Shadows hide you. Running is loud. A pebble click lures a guard away.', VIEW_W / 2, 288);
  ctx.fillStyle = '#e8dcc0';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('WASD / Arrows — move      Shift — run (loud)', VIEW_W / 2, 336);
  ctx.fillText('Ctrl / C — sneak (slow, quiet)      Click — throw a pebble', VIEW_W / 2, 362);
  ctx.fillText('P — pause      M — sound      R — restart', VIEW_W / 2, 388);
  if (game.best > 0) {
    ctx.fillStyle = '#ffd678';
    ctx.font = '15px sans-serif';
    ctx.fillText('Best score: ' + game.best, VIEW_W / 2, 424);
  }
  ctx.fillStyle = '#7ddb8a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('▶  Press Enter or click to begin', VIEW_W / 2, 492);
}

export function drawPause(ctx) {
  dimScreen(ctx);
  panel(ctx, VIEW_W / 2 - 200, VIEW_H / 2 - 70, 400, 140);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8dcc0';
  ctx.font = 'bold 30px Georgia, serif';
  ctx.fillText('Paused', VIEW_W / 2, VIEW_H / 2 - 14);
  ctx.fillStyle = '#9aa3b8';
  ctx.font = '15px sans-serif';
  ctx.fillText('Press P or Esc to keep stealing', VIEW_W / 2, VIEW_H / 2 + 22);
}

export function drawCaught(ctx, game) {
  dimScreen(ctx);
  panel(ctx, VIEW_W / 2 - 260, 170, 520, 260);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5040';
  ctx.font = 'bold 44px Georgia, serif';
  ctx.fillText('CAUGHT!', VIEW_W / 2, 240);
  ctx.fillStyle = '#e8dcc0';
  ctx.font = '16px sans-serif';
  ctx.fillText('A guard grabbed you by the lantern light.', VIEW_W / 2, 280);
  ctx.fillText('Relics kept: ' + game.relicsGot + ' / ' + game.totalRelics + '    Score: ' + game.score, VIEW_W / 2, 310);
  ctx.fillStyle = '#9aa3b8';
  ctx.font = '15px sans-serif';
  ctx.fillText('Tip: shadows hide you, and a pebble click pulls a guard away.', VIEW_W / 2, 348);
  ctx.fillStyle = '#7ddb8a';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('Press R or click to try this floor again', VIEW_W / 2, 392);
}

export function drawLevelClear(ctx, game) {
  dimScreen(ctx);
  panel(ctx, VIEW_W / 2 - 260, 150, 520, 300);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7ddb8a';
  ctx.font = 'bold 40px Georgia, serif';
  ctx.fillText('CLEAN GETAWAY!', VIEW_W / 2, 220);
  ctx.fillStyle = '#e8dcc0';
  ctx.font = '16px sans-serif';
  ctx.fillText(game.levelName + ' cleared in ' + formatTime(game.clearTime), VIEW_W / 2, 262);
  ctx.fillText('Relics ' + game.relicsGot + '/' + game.totalRelics + '   Coins ' + game.coinsGot, VIEW_W / 2, 290);
  ctx.fillText('Level score: ' + game.levelScore + (game.ghost ? '  (ghost bonus +500 — never spotted!)' : ''), VIEW_W / 2, 318);
  ctx.fillText('Total score: ' + game.score, VIEW_W / 2, 346);
  ctx.fillStyle = '#7ddb8a';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(game.levelIndex + 1 < game.levelCount ? 'Press Enter for the next floor' : 'Press Enter for the final tally', VIEW_W / 2, 402);
}

export function drawWin(ctx, game) {
  dimScreen(ctx);
  panel(ctx, VIEW_W / 2 - 300, 130, 600, 360);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd678';
  ctx.font = 'bold 44px Georgia, serif';
  ctx.fillText('THE VAULT IS YOURS', VIEW_W / 2, 200);
  ctx.fillStyle = '#e8dcc0';
  ctx.font = '17px sans-serif';
  ctx.fillText('Every relic, every floor — and the museum never knew.', VIEW_W / 2, 242);
  ctx.fillText('Total time: ' + formatTime(game.totalTime), VIEW_W / 2, 282);
  ctx.fillText('Ghost runs (never spotted): ' + game.ghostLevels + ' / ' + game.levelCount, VIEW_W / 2, 310);
  ctx.fillText('Coins pocketed: ' + game.totalCoins, VIEW_W / 2, 338);
  ctx.fillStyle = '#ffd678';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('Final score: ' + game.score, VIEW_W / 2, 380);
  ctx.fillStyle = '#9aa3b8';
  ctx.font = '15px sans-serif';
  ctx.fillText(game.score >= game.best ? 'A new best score!' : 'Best score: ' + game.best, VIEW_W / 2, 414);
  ctx.fillStyle = '#7ddb8a';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('Press R to steal again', VIEW_W / 2, 452);
}
