export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this._mainCtx = canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;
    this.logicalHeight = 640;
    this.logicalWidth = 360;

    // Offscreen buffer at screen resolution — crisp text, no scaling blur
    this.buffer = document.createElement('canvas');
    this.ctx = this.buffer.getContext('2d');

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

    this.logicalWidth = Math.ceil(this.logicalHeight * w / h);

    // Buffer matches main canvas size (physical pixels)
    this.buffer.width = this.canvas.width;
    this.buffer.height = this.canvas.height;

    // Scale from logical coords to physical pixels
    this._sx = this.canvas.width / this.logicalWidth;
    this._sy = this.canvas.height / this.logicalHeight;

    this.scale = w / this.logicalWidth;
    this.screenWidth = w;
    this.screenHeight = h;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  clear() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.buffer.width, this.buffer.height);
  }

  applyTransform() {
    this.ctx.save();
    this.ctx.setTransform(this._sx, 0, 0, this._sy, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  restoreTransform() {
    this.ctx.restore();
  }

  /** Blit the offscreen buffer to the main canvas, 1:1 copy */
  present() {
    const mctx = this._mainCtx;
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    mctx.drawImage(this.buffer, 0, 0);
  }

  drawRect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }

  drawCircle(x, y, r, color) {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawText(text, x, y, { color = '#ffffff', size = 12, align = 'left', font = 'monospace', bold = false } = {}) {
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${font}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    ctx.fillText(text, x, y);
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
