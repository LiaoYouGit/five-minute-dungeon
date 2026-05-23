export class PoisonCircleSystem {
  constructor() {
    this.centerX = 0;
    this.centerY = 0;
    this.targetRadius = 200;
    this.maxRadius = 3000;
    this.currentRadius = 3000;
    this.shrinkDuration = 60;
    this.shrinkTimer = 0;
    this.state = 'idle'; // 'idle' | 'shrinking' | 'stable'
    this.damagePerSecond = 10;
    this._damageAccum = 0;
  }

  trigger(centerX, centerY, targetRadius, maxRadius) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.targetRadius = targetRadius || 200;
    this.maxRadius = maxRadius || 3000;
    this.currentRadius = this.maxRadius;
    this.shrinkTimer = 0;
    this.state = 'shrinking';
    this._damageAccum = 0;
  }

  isActive() {
    return this.state !== 'idle';
  }

  isInsideSafeZone(x, y) {
    const dx = x - this.centerX;
    const dy = y - this.centerY;
    return Math.sqrt(dx * dx + dy * dy) <= this.currentRadius;
  }

  update(dt, player) {
    if (this.state === 'idle') return;

    // Shrink circle over shrinkDuration
    if (this.state === 'shrinking') {
      this.shrinkTimer += dt;
      const t = Math.min(this.shrinkTimer / this.shrinkDuration, 1);
      this.currentRadius = this.maxRadius + (this.targetRadius - this.maxRadius) * t;
      if (t >= 1) {
        this.currentRadius = this.targetRadius;
        this.state = 'stable';
      }
    }

    // Damage player outside safe zone
    if (player && player.active) {
      const pt = player.components.Transform;
      const ph = player.components.Health;
      if (!this.isInsideSafeZone(pt.x, pt.y)) {
        this._damageAccum += this.damagePerSecond * dt;
        if (this._damageAccum >= 1) {
          const dmg = Math.floor(this._damageAccum);
          ph.hp -= dmg;
          this._damageAccum -= dmg;
        }
      }
    }
  }

  reset() {
    this.state = 'idle';
    this.currentRadius = this.maxRadius;
    this.shrinkTimer = 0;
    this._damageAccum = 0;
  }

  render(renderer, cam) {
    if (this.state === 'idle') return;

    const { ctx } = renderer;
    const sx = this.centerX - cam.offsetX;
    const sy = this.centerY - cam.offsetY;
    const r = this.currentRadius;

    // Draw poison fog outside the safe zone
    // Use clip to cut a circular hole for the safe zone
    ctx.save();
    ctx.beginPath();
    // Outer rectangle covering the visible area
    ctx.rect(-1000, -1000, 10000, 10000);
    // Inner circle (counter-clockwise to create hole)
    ctx.arc(sx, sy, r, 0, Math.PI * 2, true);
    ctx.closePath();

    // Poison fog color: pulsing purple/green
    const alpha = this.state === 'shrinking'
      ? 0.25 + Math.sin(this.shrinkTimer * 3) * 0.08
      : 0.3;
    ctx.fillStyle = `rgba(120, 40, 180, ${alpha})`;
    ctx.fill();
    ctx.restore();

    // Draw safe zone border circle
    ctx.save();
    ctx.strokeStyle = this.state === 'shrinking'
      ? `rgba(255, 80, 80, ${0.6 + Math.sin(this.shrinkTimer * 4) * 0.3})`
      : 'rgba(255, 80, 80, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash(this.state === 'shrinking' ? [8, 4] : []);
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Target zone indicator (final radius)
    if (this.state === 'shrinking') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx, sy, this.targetRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}
