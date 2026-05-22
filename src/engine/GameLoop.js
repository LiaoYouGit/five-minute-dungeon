export class GameLoop {
  constructor({ update, render } = {}) {
    this.update = update;
    this.render = render;
    this.fixedDt = 1 / 60;
    this.maxDt = 0.1;
    this.accumulator = 0;
    this.lastTime = 0;
    this.running = false;
    this._rafId = null;
    this.elapsed = 0;
    this.fps = 0;
    this._frameCount = 0;
    this._fpsTimer = 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this._rafId = requestAnimationFrame((t) => this._loop(t));
  }

  stop() {
    this.running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  pause() {
    this.running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  resume() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this._rafId = requestAnimationFrame((t) => this._loop(t));
  }

  _loop(timestamp) {
    if (!this.running) return;

    let dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    dt = Math.min(dt, this.maxDt);

    this._fpsTimer += dt;
    this._frameCount++;
    if (this._fpsTimer >= 1) {
      this.fps = this._frameCount;
      this._frameCount = 0;
      this._fpsTimer -= 1;
    }

    this.accumulator += dt;
    while (this.accumulator >= this.fixedDt) {
      this.update?.(this.fixedDt);
      this.elapsed += this.fixedDt;
      this.accumulator -= this.fixedDt;
    }

    const alpha = this.accumulator / this.fixedDt;
    this.render?.(alpha);

    this._rafId = requestAnimationFrame((t) => this._loop(t));
  }
}
