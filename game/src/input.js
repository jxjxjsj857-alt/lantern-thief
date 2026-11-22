// Keyboard and mouse input for Lantern Thief.
// Keys: WASD/arrows move, Shift run, Ctrl/C sneak, Enter start/advance,
// P/Esc pause, R retry, M mute. Click: menus, and in play throws a pebble
// to lure guards toward the clicked floor tile.
export class Input {
  constructor(canvas, onClick) {
    this.up = false;
    this.down = false;
    this.left = false;
    this.right = false;
    this.run = false;
    this.sneak = false;
    this.pressed = new Set();
    this.onClick = onClick;
    this.canvas = canvas;
    window.addEventListener('keydown', (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
      if (!event.repeat) this.pressed.add(event.key.toLowerCase());
      this.update(event, true);
    });
    window.addEventListener('keyup', (event) => this.update(event, false));
    canvas.addEventListener('mousedown', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.onClick(event.clientX - rect.left, event.clientY - rect.top);
    });
    window.addEventListener('blur', () => {
      this.up = this.down = this.left = this.right = this.run = this.sneak = false;
    });
  }

  update(event, down) {
    const key = event.key.toLowerCase();
    if (key === 'arrowup' || key === 'w') this.up = down;
    if (key === 'arrowdown' || key === 's') this.down = down;
    if (key === 'arrowleft' || key === 'a') this.left = down;
    if (key === 'arrowright' || key === 'd') this.right = down;
    if (key === 'shift') this.run = down;
    if (key === 'control' || key === 'c') this.sneak = down;
  }

  /** True once for a key pressed since the last frame; then it is consumed. */
  consume(key) {
    const k = key.toLowerCase();
    if (this.pressed.has(k)) {
      this.pressed.delete(k);
      return true;
    }
    return false;
  }

  clearPressed() {
    this.pressed.clear();
  }
}
