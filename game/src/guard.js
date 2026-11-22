// Guard AI for Lantern Thief: patrol routes, vision cones, suspicion,
// alert chases and searching. A guard's job is to be readable: its cone
// shows exactly what it can see, and its colour shows what it thinks.
import { GUARD, TILE, angleDifference, clamp, distance } from './config.js';
import { collideCircle, hasLineOfSight, isShadow, tileBlocksMove } from './level.js';

const PATROL_PAUSE = 1.2;

/** Build a guard from a spawn point and a list of patrol waypoints (tile coords). */
export class Guard {
  constructor(spawn, patrolTiles) {
    this.x = spawn.x;
    this.y = spawn.y;
    this.waypoints = patrolTiles.map(([tx, ty]) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 }));
    this.waypointIndex = 1 % this.waypoints.length;
    this.facing = 0;
    this.state = 'patrol'; // patrol | suspicious | alert | search
    this.suspicion = 0;
    this.pauseTimer = 0;
    this.lastSeen = null;
    this.lastSeenTimer = 0;
    this.searchTimer = 0;
    this.noiseTarget = null;
    this.stepPhase = Math.random() * Math.PI * 2;
    this.walkCycle = 0;
  }

  /** Can this guard see the player right now? Returns 0..1 (0 = not seen). */
  seesPlayer(tiles, player) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > GUARD.visionRange) return 0;
    // Deep shadow hides the thief outright at a distance: stay in the dark.
    if (dist > 120 && isShadow(tiles, player.x, player.y)) return 0;
    if (dist > 30 && angleDifference(Math.atan2(dy, dx), this.facing) > GUARD.halfAngle) return 0;
    if (!hasLineOfSight(tiles, this.x, this.y, player.x, player.y)) return 0;
    const closeness = 1 - dist / GUARD.visionRange;
    return 0.35 + closeness * 0.65;
  }

  /** Move toward a point at a speed, sliding along walls. Returns true on arrival. */
  moveToward(tiles, tx, ty, speed, dt) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 4) return true;
    const step = Math.min(dist, speed * dt);
    const nx = this.x + (dx / dist) * step;
    const ny = this.y + (dy / dist) * step;
    const fixed = collideCircle(tiles, nx, ny, GUARD.radius);
    this.x = fixed.x;
    this.y = fixed.y;
    this.facing = Math.atan2(dy, dx);
    this.walkCycle += dt * speed * 0.09;
    return dist - step < 4;
  }

  /** One simulation step. `events` collects noises and alerts for the world. */
  update(dt, world, events) {
    const tiles = world.tiles;
    const player = world.player;
    const seen = this.seesPlayer(tiles, player);
    const inShadow = isShadow(tiles, player.x, player.y);
    if (seen > 0) {
      this.lastSeen = { x: player.x, y: player.y };
      this.lastSeenTimer = 0;
      let rate = 36 * seen;
      if (player.running) rate *= 1.5;
      if (player.sneaking) rate *= 0.55;
      if (inShadow) rate *= 0.45;
      this.suspicion = clamp(this.suspicion + rate * dt, 0, 100);
    } else {
      this.suspicion = clamp(this.suspicion - 22 * dt, 0, 100);
      this.lastSeenTimer += dt;
    }

    if (this.suspicion >= GUARD.alertAt && this.state !== 'alert') {
      this.state = 'alert';
      events.push({ type: 'alarm', guard: this });
    }
    if (this.state !== 'alert' && this.suspicion >= GUARD.suspiciousAt && this.state !== 'suspicious') {
      this.state = 'suspicious';
    }
    if (this.state === 'suspicious' && this.suspicion < 12) {
      this.state = 'patrol';
      this.noiseTarget = null;
    }

    if (this.state === 'patrol') {
      if (this.pauseTimer > 0) {
        this.pauseTimer -= dt;
        this.facing += dt * 0.5;
      } else {
        const target = this.waypoints[this.waypointIndex];
        if (this.moveToward(tiles, target.x, target.y, GUARD.patrolSpeed, dt)) {
          this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length;
          this.pauseTimer = PATROL_PAUSE;
        }
      }
    } else if (this.state === 'suspicious') {
      const target = this.noiseTarget || this.lastSeen;
      if (target) {
        if (this.moveToward(tiles, target.x, target.y, GUARD.suspiciousSpeed, dt)) {
          this.noiseTarget = null;
          this.facing += dt * 1.2;
        }
      } else {
        this.facing += dt * 1.2;
      }
    } else if (this.state === 'alert') {
      const target = seen > 0 ? { x: player.x, y: player.y } : this.lastSeen;
      if (target) this.moveToward(tiles, target.x, target.y, GUARD.alertSpeed, dt);
      if (seen === 0 && this.lastSeenTimer > 3) {
        this.state = 'search';
        this.searchTimer = 4;
      }
      if (distance(this.x, this.y, player.x, player.y) < GUARD.catchDistance) {
        events.push({ type: 'caught', guard: this });
      }
    } else if (this.state === 'search') {
      this.searchTimer -= dt;
      this.facing += dt * 1.6;
      if (this.searchTimer <= 0) {
        this.state = 'patrol';
        this.suspicion = 0;
      }
    }
  }

  /** Hear a noise: turn suspicious and walk over to check it. */
  hearNoise(x, y) {
    if (this.state === 'alert') return;
    const dist = distance(this.x, this.y, x, y);
    if (dist > GUARD.hearRange) return;
    this.noiseTarget = { x, y };
    if (this.state === 'patrol') {
      this.state = 'suspicious';
      this.suspicion = Math.max(this.suspicion, 30);
    }
  }

  /** The vision cone as a polygon of points, clipped by walls. */
  conePolygon(tiles) {
    const rays = 17;
    const points = [{ x: this.x, y: this.y }];
    for (let i = 0; i <= rays; i += 1) {
      const angle = this.facing - GUARD.halfAngle + (2 * GUARD.halfAngle * i) / rays;
      let reach = GUARD.visionRange;
      const step = 8;
      for (let d = step; d <= GUARD.visionRange; d += step) {
        const x = this.x + Math.cos(angle) * d;
        const y = this.y + Math.sin(angle) * d;
        if (tileBlocksMove(tiles, Math.floor(x / TILE), Math.floor(y / TILE))) {
          reach = d;
          break;
        }
      }
      points.push({ x: this.x + Math.cos(angle) * reach, y: this.y + Math.sin(angle) * reach });
    }
    return points;
  }
}
