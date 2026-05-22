export class Transition {
  constructor(duration = 0.4) {
    this.duration = duration;
    this.timer = 0;
    this.active = false;
    this.phase = 'none';
    this.onComplete = null;
  }

  fadeOut(duration, onComplete) {
    this.duration = duration || 0.4;
    this.timer = 0;
    this.active = true;
    this.phase = 'out';
    this.onComplete = onComplete;
  }

  update(dt) {
    if (!this.active) return;
    this.timer += dt;
    if (this.phase === 'out' && this.timer >= this.duration) {
      if (this.onComplete) this.onComplete();
      this.phase = 'in';
      this.timer = 0;
    } else if (this.phase === 'in' && this.timer >= this.duration) {
      this.active = false;
      this.phase = 'none';
    }
  }

  get alpha() {
    if (!this.active) return 0;
    if (this.phase === 'out') return Math.min(1, this.timer / this.duration);
    return Math.max(0, 1 - this.timer / this.duration);
  }

  render(ctx, w, h) {
    if (!this.active) return;
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }
}
