// The thief: movement, noise, relic and coin collection.
// One clear job: where the player is, how loud they are, what they carry.
import { PLAYER, clamp, distance } from './config.js';
import { collideCircle, isShadow } from './level.js';

export class Player {
  constructor(start) {
    this.x = start.x;
    this.y = start.y;
    this.vx = 0;
    this.vy = 0;
    this.facing = -Math.PI / 2;
    this.running = false;
    this.sneaking = false;
    this.moving = false;
    this.stepTimer = 0;
    this.noiseTimer = 0;
    this.relics = 0;
    this.coins = 0;
  }

  /** Move by the input vector; returns a noise event when running footsteps land. */
  update(dt, input, tiles) {
    let dx = 0;
    let dy = 0;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;
    this.running = input.run && (dx !== 0 || dy !== 0);
    this.sneaking = input.sneak && !this.running;
    const speed = this.running ? PLAYER.run : this.sneaking ? PLAYER.sneak : PLAYER.walk;
    this.moving = dx !== 0 || dy !== 0;
    if (this.moving) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
      this.facing = Math.atan2(dy, dx);
      const fixed = collideCircle(tiles, this.x + dx * speed * dt, this.y + dy * speed * dt, PLAYER.radius);
      this.x = fixed.x;
      this.y = fixed.y;
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = this.running ? 0.26 : 0.42;
        if (this.running) {
          this.noiseTimer = 0;
          return { type: 'footstep', x: this.x, y: this.y, loud: true };
        }
        return { type: 'footstep', x: this.x, y: this.y, loud: false };
      }
    }
    return null;
  }

  /** Standing in shadow right now? */
  hidden(tiles) {
    return isShadow(tiles, this.x, this.y);
  }

  /** Collect any relic or coin within reach. Returns what was picked up. */
  collect(world) {
    const found = [];
    for (const relic of world.relics) {
      if (!relic.taken && distance(this.x, this.y, relic.x, relic.y) < 34) {
        relic.taken = true;
        this.relics += 1;
        found.push('relic');
      }
    }
    for (const coin of world.coins) {
      if (!coin.taken && distance(this.x, this.y, coin.x, coin.y) < 30) {
        coin.taken = true;
        this.coins += 1;
        found.push('coin');
      }
    }
    return found;
  }

  /** True when every relic of the level is in hand. */
  hasAllRelics(world) {
    return this.relics >= world.relics.length;
  }

  /** True when standing on the open exit. */
  atExit(world) {
    return this.hasAllRelics(world) && distance(this.x, this.y, world.exit.x, world.exit.y) < 34;
  }

  /** Keep the player inside the level bounds. */
  clampToLevel() {
    this.x = clamp(this.x, PLAYER.radius, 960 - PLAYER.radius);
    this.y = clamp(this.y, PLAYER.radius, 624 - PLAYER.radius);
  }
}
