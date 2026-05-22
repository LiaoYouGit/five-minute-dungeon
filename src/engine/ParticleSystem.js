import { ObjectPool } from './ObjectPool.js';

function createParticle() {
  return { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, color: '#fff', size: 2, active: false };
}

function resetParticle(p) {
  p.x = 0; p.y = 0; p.vx = 0; p.vy = 0;
  p.life = 0; p.maxLife = 1; p.color = '#fff'; p.size = 2;
  p.active = false;
}

export class ParticleSystem {
  constructor(poolSize = 200) {
    this._pool = new ObjectPool(createParticle, resetParticle, poolSize);
    this._particles = this._pool.active;
  }

  emit(x, y, count, { colors = ['#ff6b35', '#ffa500', '#ffcc00'], speed = 80, life = 0.5, sizeMin = 1, sizeMax = 3 } = {}) {
    for (let i = 0; i < count; i++) {
      const p = this._pool.acquire();
      p.x = x;
      p.y = y;
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.5 + Math.random() * 0.5);
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd;
      p.maxLife = life * (0.5 + Math.random() * 0.5);
      p.life = p.maxLife;
      p.color = colors[Math.floor(Math.random() * colors.length)];
      p.size = sizeMin + Math.random() * (sizeMax - sizeMin);
    }
  }

  update(dt) {
    for (const p of this._particles) {
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.life -= dt;
      if (p.life <= 0) {
        this._pool.release(p);
      }
    }
  }

  render(ctx) {
    for (const p of this._particles) {
      if (!p.active) continue;
      const alpha = Math.max(0, p.life / p.maxLife);
      const size = p.size * alpha;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.floor(p.x - size / 2), Math.floor(p.y - size / 2), size, size);
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    this._pool.releaseAll();
  }
}
