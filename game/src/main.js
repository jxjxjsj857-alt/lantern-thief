// Lantern Thief: the game loop, screens and scoring.
// One clear job: own the state machine (title, play, pause, caught,
// level clear, win), step the world, and hand frames to the renderer.
import { STEP, VIEW_W, VIEW_H, HUD_H, TILE } from './config.js';
import { LEVELS, parseLevel } from './level.js';
import { Guard } from './guard.js';
import { Player } from './player.js';
import { SoundFX } from './audio.js';
import { Input } from './input.js';
import { drawWorld, drawHUD, drawTitle, drawPause, drawCaught, drawLevelClear, drawWin } from './render.js';
import { stageShot } from './shots.js';

const BEST_KEY = 'lantern-thief-best';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sound = new SoundFX();
    this.input = new Input(canvas, (x, y) => this.onClick(x, y));
    this.state = 'title';
    this.levelIndex = 0;
    this.levelCount = LEVELS.length;
    this.score = 0;
    this.totalTime = 0;
    this.totalCoins = 0;
    this.ghostLevels = 0;
    this.best = Number(localStorage.getItem(BEST_KEY) || 0);
    this.muted = false;
    this.time = 0;
    this.accumulator = 0;
    this.lastTick = 0;
    this.heartbeatTimer = 0;
    this.shot = null;
    this.loadLevel(0);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / (VIEW_H + HUD_H));
    this.canvas.width = Math.max(320, Math.floor(window.innerWidth * window.devicePixelRatio));
    this.canvas.height = Math.max(240, Math.floor(window.innerHeight * window.devicePixelRatio));
    this.scale = scale * window.devicePixelRatio;
    this.offsetX = (this.canvas.width - VIEW_W * this.scale) / 2;
    this.offsetY = (this.canvas.height - (VIEW_H + HUD_H) * this.scale) / 2;
  }

  loadLevel(index) {
    this.levelIndex = index;
    const parsed = parseLevel(index);
    this.tiles = parsed.tiles;
    this.relics = parsed.relics;
    this.coins = parsed.coins;
    this.exit = parsed.exit;
    this.lanterns = parsed.lanterns;
    this.levelName = parsed.def.name;
    this.par = parsed.def.par;
    this.player = new Player(parsed.playerStart);
    this.guards = parsed.guardSpawns.map((spawn, i) => new Guard(spawn, parsed.def.patrols[i]));
    this.noises = [];
    this.time = 0;
    this.exitOpen = false;
    this.ghost = true;
    this.alertState = 'calm';
    this.clearTime = 0;
    this.levelScore = 0;
  }

  get totalRelics() {
    return this.relics.length;
  }

  get relicsGot() {
    return this.player.relics;
  }

  get coinsGot() {
    return this.player.coins;
  }

  /** Convert a canvas click into logical game coordinates. */
  toLogical(x, y) {
    return {
      x: (x * window.devicePixelRatio - this.offsetX) / this.scale,
      y: (y * window.devicePixelRatio - this.offsetY) / this.scale,
    };
  }

  onClick(clientX, clientY) {
    this.sound.ensure();
    const point = this.toLogical(clientX, clientY);
    if (this.state === 'title') {
      this.startGame();
      return;
    }
    if (this.state === 'caught') {
      this.loadLevel(this.levelIndex);
      this.state = 'play';
      return;
    }
    if (this.state === 'levelclear') {
      this.nextLevel();
      return;
    }
    if (this.state === 'win') {
      this.startGame();
      return;
    }
    if (this.state !== 'play') return;
    const lx = point.x;
    const ly = point.y - HUD_H;
    if (ly < 0 || lx < 0 || lx > VIEW_W || ly > VIEW_H) return;
    if (Math.hypot(lx - this.player.x, ly - this.player.y) > 240) return;
    this.throwPebble(lx, ly);
  }

  throwPebble(x, y) {
    this.sound.pebble();
    this.noises.push({ x, y, age: 0, maxAge: 0.9, pebble: true });
    for (const guard of this.guards) guard.hearNoise(x, y);
  }

  startGame() {
    this.score = 0;
    this.totalTime = 0;
    this.totalCoins = 0;
    this.ghostLevels = 0;
    this.loadLevel(0);
    this.state = 'play';
    this.input.clearPressed();
  }

  nextLevel() {
    if (this.levelIndex + 1 < this.levelCount) {
      this.loadLevel(this.levelIndex + 1);
      this.state = 'play';
    } else {
      this.state = 'win';
      if (this.score > this.best) {
        this.best = this.score;
        localStorage.setItem(BEST_KEY, String(this.best));
      }
    }
    this.input.clearPressed();
  }

  levelCleared() {
    this.clearTime = this.time;
    this.totalTime += this.time;
    this.totalCoins += this.player.coins;
    const timeBonus = Math.max(0, Math.round((this.par - this.time) * 10));
    this.levelScore = 1000 + this.player.relics * 250 + this.player.coins * 50 + timeBonus + (this.ghost ? 500 : 0);
    this.score += this.levelScore;
    if (this.ghost) this.ghostLevels += 1;
    this.sound.fanfare();
    this.state = 'levelclear';
  }

  caught() {
    this.sound.alarm();
    this.state = 'caught';
  }

  step(dt) {
    if (this.state === 'title') {
      this.time += dt;
      for (const guard of this.guards) guard.update(dt, this, []);
      return;
    }
    if (this.state !== 'play') return;
    this.time += dt;
    const footstep = this.player.update(dt, this.input, this.tiles);
    if (footstep) {
      this.sound.footstep(footstep.loud);
      if (footstep.loud) {
        this.noises.push({ x: footstep.x, y: footstep.y, age: 0, maxAge: 0.7 });
        for (const guard of this.guards) guard.hearNoise(footstep.x, footstep.y);
      }
    }
    const picked = this.player.collect(this);
    for (const kind of picked) {
      if (kind === 'relic') this.sound.chime();
      else this.sound.coin();
    }
    if (this.player.hasAllRelics(this)) this.exitOpen = true;
    const events = [];
    for (const guard of this.guards) guard.update(dt, this, events);
    let alarming = false;
    let suspicious = false;
    for (const guard of this.guards) {
      if (guard.state === 'alert') alarming = true;
      else if (guard.state === 'suspicious') suspicious = true;
    }
    this.alertState = alarming ? 'alert' : suspicious ? 'suspicious' : 'calm';
    if (alarming) {
      this.ghost = false;
      this.heartbeatTimer -= dt;
      if (this.heartbeatTimer <= 0) {
        this.sound.heartbeat();
        this.heartbeatTimer = 0.85;
      }
    }
    for (const event of events) {
      if (event.type === 'alarm') this.sound.alarm();
      if (event.type === 'caught') {
        this.caught();
        return;
      }
    }
    for (const noise of this.noises) noise.age += dt;
    this.noises = this.noises.filter((noise) => noise.age < noise.maxAge);
    if (this.player.atExit(this)) this.levelCleared();
  }

  frame(timestamp) {
    const dt = Math.min(0.1, (timestamp - this.lastTick) / 1000 || 0);
    this.lastTick = timestamp;
    if (this.input.consume('m')) this.muted = this.sound.toggleMute();
    if (this.state === 'play' && (this.input.consume('p') || this.input.consume('escape'))) {
      this.state = 'pause';
    } else if (this.state === 'pause' && (this.input.consume('p') || this.input.consume('escape'))) {
      this.state = 'play';
    }
    if (this.state === 'title' && (this.input.consume('enter') || this.input.consume(' '))) {
      this.sound.ensure();
      this.startGame();
    }
    if (this.state === 'caught' && this.input.consume('r')) {
      this.loadLevel(this.levelIndex);
      this.state = 'play';
    }
    if (this.state === 'levelclear' && this.input.consume('enter')) this.nextLevel();
    if (this.state === 'win' && this.input.consume('r')) this.startGame();
    this.accumulator += dt;
    while (this.accumulator >= STEP) {
      this.step(STEP);
      this.accumulator -= STEP;
    }
    this.render();
    requestAnimationFrame((t) => this.frame(t));
  }

  render() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0a0c13';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);
    drawWorld(ctx, this);
    drawHUD(ctx, this);
    if (this.state === 'title') drawTitle(ctx, this);
    else if (this.state === 'pause') drawPause(ctx);
    else if (this.state === 'caught') drawCaught(ctx, this);
    else if (this.state === 'levelclear') drawLevelClear(ctx, this);
    else if (this.state === 'win') drawWin(ctx, this);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** Start the loop; if ?shot= is set, stage that screenshot scene instead. */
  start() {
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (shot) {
      const staged = stageShot(shot, this);
      this.state = staged.screen;
      this.render();
      document.title = 'Lantern Thief — shot ' + shot;
      return;
    }
    requestAnimationFrame((t) => {
      this.lastTick = t;
      this.frame(t);
    });
  }
}

const canvas = document.getElementById('game');
const game = new Game(canvas);
game.start();
