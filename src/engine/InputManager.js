export class InputManager {
  constructor() {
    this.direction = { x: 0, y: 0 };
    this._keys = {};
    this._justPressed = {};
    this._touchActive = false;
    this._pointerScreenPos = null;
    this._bound = false;
    this._enabled = true;
  }

  setEnabled(enabled) {
    this._enabled = enabled;
    if (!enabled) {
      this._pointerScreenPos = null;
      this._touchActive = false;
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
    this._touchActive = true;
    return true;
  }

  handleTouchMove(touch) {
    if (!this._enabled || !this._touchActive) return;
    this._pointerScreenPos = { x: touch.clientX, y: touch.clientY };
  }

  handleTouchEnd() {
    this._pointerScreenPos = null;
    this._touchActive = false;
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
      this.direction = { x: 0, y: 0 };
    }
    this._justPressed = {};
  }

  isJustPressed(code) {
    return !!this._justPressed[code];
  }
}
