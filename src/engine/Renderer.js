import { MathUtils } from './MathUtils.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this._mainCtx = canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;
    this.logicalHeight = 640;
    this.logicalWidth = 360;

    // Offscreen buffer — all game rendering happens here at 1:1 logical resolution
    this.buffer = document.createElement('canvas');
    this.buffer.width = this.logicalWidth;
    this.buffer.height = this.logicalHeight;
    this.ctx = this.buffer.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';

    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);

    // Keep height fixed at 640, adjust width to fill screen aspect ratio
    this.logicalWidth = Math.ceil(this.logicalHeight * w / h);

    if (this.buffer.width !== this.logicalWidth) {
      this.buffer.width = this.logicalWidth;
    }

    this.ctx.imageSmoothingEnabled = false;

    this.scale = w / this.logicalWidth;
    this.screenWidth = w;
    this.screenHeight = h;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);
  }

  applyTransform() {
    this.ctx.save();
  }

  restoreTransform() {
    this.ctx.restore();
  }

  /** Blit the offscreen buffer to the main canvas, filling the entire screen */
  present() {
    const mctx = this._mainCtx;
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.fillStyle = '#000';
    mctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    mctx.imageSmoothingEnabled = false;

    mctx.drawImage(
      this.buffer,
      0, 0, this.logicalWidth, this.logicalHeight,
      0, 0, this.canvas.width, this.canvas.height,
    );
  }

  // ── Native overlay drawing (crisp text/bars at screen resolution) ──

  beginOverlay() {
    const mctx = this._mainCtx;
    mctx.save();
    const s = this.scale * this.dpr;
    mctx.setTransform(s, 0, 0, s, 0, 0);
    mctx.imageSmoothingEnabled = true;
  }

  endOverlay() {
    this._mainCtx.restore();
  }

  drawTextO(text, x, y, { color = '#ffffff', size = 12, align = 'left', font = 'monospace', bold = false } = {}) {
    const mctx = this._mainCtx;
    mctx.fillStyle = color;
    mctx.font = `${bold ? 'bold ' : ''}${size}px ${font}`;
    mctx.textAlign = align;
    mctx.textBaseline = 'top';
    mctx.fillText(text, x, y);
  }

  drawRectO(x, y, w, h, color) {
    this._mainCtx.fillStyle = color;
    this._mainCtx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
  }

  setAlphaO(a) {
    this._mainCtx.globalAlpha = a;
  }

  /** Draw a circle on the overlay (for aura rings etc.) */
  drawCircleO(x, y, r, color) {
    const mctx = this._mainCtx;
    mctx.fillStyle = color;
    mctx.beginPath();
    mctx.arc(Math.floor(x), Math.floor(y), r, 0, Math.PI * 2);
    mctx.fill();
  }

  strokeCircleO(x, y, r, color, lineWidth = 1) {
    const mctx = this._mainCtx;
    mctx.strokeStyle = color;
    mctx.lineWidth = lineWidth;
    mctx.beginPath();
    mctx.arc(Math.floor(x), Math.floor(y), r, 0, Math.PI * 2);
    mctx.stroke();
  }

  drawRect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
  }

  drawCircle(x, y, r, color) {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(Math.floor(x), Math.floor(y), r, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawText(text, x, y, { color = '#ffffff', size = 12, align = 'left', font = 'monospace' } = {}) {
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.font = `${size}px ${font}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    ctx.fillText(text, Math.floor(x), Math.floor(y));
  }

  drawSprite(image, x, y, { frameWidth, frameHeight, frame = 0, scale = 1 } = {}) {
    if (!image) return;
    const { ctx } = this;
    const sx = frame * (frameWidth || image.width);
    const sy = 0;
    const sw = frameWidth || image.width;
    const sh = frameHeight || image.height;
    const dw = sw * scale;
    const dh = sh * scale;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, sx, sy, sw, sh, Math.floor(x - dw / 2), Math.floor(y - dh / 2), dw, dh);
  }

  setAlpha(a) {
    this.ctx.globalAlpha = a;
  }

  screenToLogical(screenX, screenY) {
    return {
      x: screenX / this.scale,
      y: screenY / this.scale,
    };
  }
}
