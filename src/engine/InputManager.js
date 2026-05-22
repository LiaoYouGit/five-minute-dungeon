export class InputManager {
  constructor() {
    this.direction = { x: 0, y: 0 };
    this._keys = {};
    this._justPressed = {};
    this._touchActive = false;
    this._pointerScreenPos = null;
    this._joystickOrigin = null;
    this._bound = false;
    this._enabled = true;
    this.joystickDeadzone = 15;
    this.joystickMaxRange = 60;
  }

  setEnabled(enabled) {
    this._enabled = enabled;
    if (!enabled) {
      this._pointerScreenPos = null;
      this._touchActive = false;
      this._joystickOrigin = null;
    }
  }

  bind(canvas) {
    if (this._bound) return;
    this._bound = true;
    this._canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (!this._keys[e.code]) this._justPressed[e.code] = true;
      this._keys[e.code] = true;
    });

    window.addEventListener('keyup', (e) => {
      this._keys[e.code] = false;
    });
  }

  handleTouchStart(touch) {
    if (!this._enabled) return false;
    this._pointerScreenPos = { x: touch.clientX, y: touch.clientY };
    this._joystickOrigin = { x: touch.clientX, y: touch.clientY };
    this._touchActive = true;
    return true;
  }

  handleTouchMove(touch) {
    if (!this._enabled || !this._touchActive) return;
    this._pointerScreenPos = { x: touch.clientX, y: touch.clientY };
  }

  handleTouchEnd() {
    this._pointerScreenPos = null;
    this._joystickOrigin = null;
    this._touchActive = false;
  }

  getJoystick() {
    if (!this._touchActive || !this._joystickOrigin || !this._pointerScreenPos) return null;
    const dx = this._pointerScreenPos.x - this._joystickOrigin.x;
    const dy = this._pointerScreenPos.y - this._joystickOrigin.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < this.joystickDeadzone) {
      return { origin: this._joystickOrigin, pos: this._joystickOrigin, dirX: 0, dirY: 0, active: true };
    }
    const clampDist = Math.min(dist, this.joystickMaxRange);
    const nx = dx / dist, ny = dy / dist;
    const pos = {
      x: this._joystickOrigin.x + nx * clampDist,
      y: this._joystickOrigin.y + ny * clampDist,
    };
    return { origin: this._joystickOrigin, pos, dirX: nx, dirY: ny, active: true };
  }

  getPointerScreenPos() {
    return this._pointerScreenPos;
  }

  isKeyboardMoving() {
    const k = this._keys;
    return k['KeyW'] || k['KeyS'] || k['KeyA'] || k['KeyD'] ||
           k['ArrowUp'] || k['ArrowDown'] || k['ArrowLeft'] || k['ArrowRight'];
  }

  snapshot() {
    if (this.isKeyboardMoving()) {
      let kx = 0, ky = 0;
      if (this._keys['KeyW'] || this._keys['ArrowUp']) ky -= 1;
      if (this._keys['KeyS'] || this._keys['ArrowDown']) ky += 1;
      if (this._keys['KeyA'] || this._keys['ArrowLeft']) kx -= 1;
      if (this._keys['KeyD'] || this._keys['ArrowRight']) kx += 1;
      const len = Math.sqrt(kx * kx + ky * ky);
      this.direction = { x: kx / len, y: ky / len };
    } else {
      const js = this.getJoystick();
      if (js) {
        this.direction = { x: js.dirX, y: js.dirY };
      } else {
        this.direction = { x: 0, y: 0 };
      }
    }
    this._justPressed = {};
  }

  isJustPressed(code) {
    return !!this._justPressed[code];
  }
}
