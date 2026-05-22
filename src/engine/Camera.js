export class Camera {
  constructor(viewW, viewH, mapW, mapH) {
    this.x = 0;
    this.y = 0;
    this.viewW = viewW;
    this.viewH = viewH;
    this.mapW = mapW;
    this.mapH = mapH;
    this.smoothing = 0.08;
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this._shakeTimer = 0;
    this._offsetX = 0;
    this._offsetY = 0;
  }

  follow(targetX, targetY, dt) {
    const tx = targetX - this.viewW / 2;
    const ty = targetY - this.viewH / 2;
    this.x += (tx - this.x) * this.smoothing;
    this.y += (ty - this.y) * this.smoothing;
    this.x = Math.round(Math.max(0, Math.min(this.x, this.mapW - this.viewW)));
    this.y = Math.round(Math.max(0, Math.min(this.y, this.mapH - this.viewH)));

    if (this._shakeTimer > 0) {
      this._shakeTimer -= dt;
      const t = this._shakeTimer / this.shakeDuration;
      this._offsetX = (Math.random() * 2 - 1) * this.shakeIntensity * t;
      this._offsetY = (Math.random() * 2 - 1) * this.shakeIntensity * t;
    } else {
      this._offsetX = 0;
      this._offsetY = 0;
    }
  }

  shake(intensity, duration) {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this._shakeTimer = duration;
  }

  worldToScreen(wx, wy) {
    return { x: wx - this.x + this._offsetX, y: wy - this.y + this._offsetY };
  }

  get offsetX() { return this.x - this._offsetX; }
  get offsetY() { return this.y - this._offsetY; }
}
