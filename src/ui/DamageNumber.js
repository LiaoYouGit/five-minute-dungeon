export class DamageNumber {
  constructor(x, y, value, { color = '#fff', size = 10, crit = false } = {}) {
    this.x = x + (Math.random() - 0.5) * 10;
    this.y = y;
    this.vy = -60;
    this.life = 0.8;
    this.maxLife = 0.8;
    this.value = value;
    this.color = color;
    this.size = crit ? size + 4 : size;
    this.crit = crit;
    this.active = true;
  }

  update(dt) {
    this.y += this.vy * dt;
    this.vy *= 0.96;
    this.life -= dt;
    if (this.life <= 0) this.active = false;
  }

  render(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    const scale = this.crit ? 1 + (1 - alpha) * 0.3 : 1;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.font = `bold ${Math.floor(this.size * scale)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.ceil(this.value)}`, Math.floor(this.x), Math.floor(this.y));
    ctx.globalAlpha = 1;
  }
}
