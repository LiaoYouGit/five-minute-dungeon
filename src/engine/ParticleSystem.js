import { ObjectPool } from './ObjectPool.js';

function createParticle() {
  return {
    x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, color: '#fff', size: 2, active: false,
    // Enhanced properties
    shape: 'rect', // 'rect' | 'circle'
    rotation: 0, rotationSpeed: 0,
    gravity: 0, wind: 0, drag: 0.98,
    glow: false, glowIntensity: 1,
    scaleAnimation: false, scaleStart: 1, scaleEnd: 0,
    trail: false, trailPositions: [],
    bounce: false, bounceDecay: 0.7,
  };
}

function resetParticle(p) {
  p.x = 0; p.y = 0; p.vx = 0; p.vy = 0;
  p.life = 0; p.maxLife = 1; p.color = '#fff'; p.size = 2;
  p.active = false;
  // Reset enhanced properties
  p.shape = 'rect';
  p.rotation = 0; p.rotationSpeed = 0;
  p.gravity = 0; p.wind = 0; p.drag = 0.98;
  p.glow = false; p.glowIntensity = 1;
  p.scaleAnimation = false; p.scaleStart = 1; p.scaleEnd = 0;
  p.trail = false; p.trailPositions = [];
  p.bounce = false; p.bounceDecay = 0.7;
}

export class ParticleSystem {
  constructor(poolSize = 200) {
    this._pool = new ObjectPool(createParticle, resetParticle, poolSize);
    this._particles = this._pool.active;
    this._worldBounds = null; // { minX, maxX, minY, maxY } for bounce
  }

  setWorldBounds(bounds) {
    this._worldBounds = bounds;
  }

  emit(x, y, count, {
    colors = ['#ff6b35', '#ffa500', '#ffcc00'],
    speed = 80,
    life = 0.5,
    sizeMin = 1,
    sizeMax = 3,
    // Enhanced options
    shape = 'rect', // 'rect' | 'circle'
    gravity = 0, // pixels per second
    wind = 0, // pixels per second
    drag = 0.98,
    rotationSpeed = 0, // radians per second
    glow = false,
    glowIntensity = 1,
    scaleAnimation = false,
    scaleStart = 1,
    scaleEnd = 0,
    trail = false,
    trailLength = 5,
    bounce = false,
    bounceDecay = 0.7,
    direction = null, // { angle, spread } - directional emission
  } = {}) {
    for (let i = 0; i < count; i++) {
      const p = this._pool.acquire();
      p.x = x;
      p.y = y;

      // Directional or radial emission
      if (direction && direction.angle !== undefined) {
        const spreadRad = (direction.spread || 0) * Math.PI / 180;
        const angle = direction.angle + (Math.random() - 0.5) * spreadRad;
        const spd = speed * (0.5 + Math.random() * 0.5);
        p.vx = Math.cos(angle) * spd;
        p.vy = Math.sin(angle) * spd;
      } else {
        const angle = Math.random() * Math.PI * 2;
        const spd = speed * (0.5 + Math.random() * 0.5);
        p.vx = Math.cos(angle) * spd;
        p.vy = Math.sin(angle) * spd;
      }

      p.maxLife = life * (0.5 + Math.random() * 0.5);
      p.life = p.maxLife;
      p.color = colors[Math.floor(Math.random() * colors.length)];
      p.size = sizeMin + Math.random() * (sizeMax - sizeMin);

      // Set enhanced properties
      p.shape = shape;
      p.rotation = Math.random() * Math.PI * 2;
      p.rotationSpeed = rotationSpeed * (Math.random() - 0.5) * 2;
      p.gravity = gravity;
      p.wind = wind;
      p.drag = drag;
      p.glow = glow;
      p.glowIntensity = glowIntensity;
      p.scaleAnimation = scaleAnimation;
      p.scaleStart = scaleStart;
      p.scaleEnd = scaleEnd;
      p.trail = trail;
      p.trailPositions = trail ? [] : null;
      p.trailLength = trailLength || 5;
      p.bounce = bounce;
      p.bounceDecay = bounceDecay;
    }
  }

  update(dt) {
    for (const p of this._particles) {
      if (!p.active) continue;

      // Store trail position before movement
      if (p.trail && p.trailPositions) {
        p.trailPositions.unshift({ x: p.x, y: p.y, size: p.size });
        if (p.trailPositions.length > p.trailLength) {
          p.trailPositions.pop();
        }
      }

      // Apply physics
      p.vy += p.gravity * dt;
      p.vx += p.wind * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;

      // Movement
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Bounce collision
      if (p.bounce && this._worldBounds) {
        const bounds = this._worldBounds;
        if (p.x < bounds.minX) {
          p.x = bounds.minX;
          p.vx *= -p.bounceDecay;
        } else if (p.x > bounds.maxX) {
          p.x = bounds.maxX;
          p.vx *= -p.bounceDecay;
        }
        if (p.y < bounds.minY) {
          p.y = bounds.minY;
          p.vy *= -p.bounceDecay;
        } else if (p.y > bounds.maxY) {
          p.y = bounds.maxY;
          p.vy *= -p.bounceDecay;
        }
      }

      // Rotation
      if (p.rotationSpeed !== 0) {
        p.rotation += p.rotationSpeed * dt;
      }

      // Life decay
      p.life -= dt;
      if (p.life <= 0) {
        this._pool.release(p);
      }
    }
  }

  render(ctx) {
    // 按状态分组粒子，减少Canvas状态切换
    const glowParticles = [];
    const circleParticles = [];
    const rectParticles = [];
    const trailParticles = [];

    for (const p of this._particles) {
      if (!p.active) continue;

      // 分类粒子
      if (p.glow) {
        glowParticles.push(p);
      } else if (p.shape === 'circle') {
        circleParticles.push(p);
      } else {
        rectParticles.push(p);
      }

      if (p.trail && p.trailPositions) {
        trailParticles.push(p);
      }
    }

    // 渲染拖尾（在粒子后面）
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    for (const p of trailParticles) {
      const baseAlpha = Math.max(0, p.life / p.maxLife);
      for (let i = 0; i < p.trailPositions.length; i++) {
        const pos = p.trailPositions[i];
        const trailAlpha = baseAlpha * (1 - i / p.trailPositions.length) * 0.3;
        ctx.globalAlpha = trailAlpha;
        ctx.fillStyle = p.color;

        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, pos.size * (1 - i / p.trailPositions.length), 0, Math.PI * 2);
          ctx.fill();
        } else {
          const size = pos.size * (1 - i / p.trailPositions.length);
          ctx.fillRect(Math.floor(pos.x - size / 2), Math.floor(pos.y - size / 2), size, size);
        }
      }
    }

    // 渲染发光粒子（批量设置shadowBlur）
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    for (const p of glowParticles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      let size = p.size;
      if (p.scaleAnimation) {
        const progress = 1 - p.life / p.maxLife;
        size = p.size * (p.scaleStart + (p.scaleEnd - p.scaleStart) * progress);
      } else {
        size = p.size * alpha;
      }

      ctx.globalAlpha = alpha;
      ctx.shadowBlur = size * p.glowIntensity * 2;
      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;

      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        if (p.rotation !== 0) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillRect(-size / 2, -size / 2, size, size);
          ctx.restore();
        } else {
          ctx.fillRect(Math.floor(p.x - size / 2), Math.floor(p.y - size / 2), size, size);
        }
      }
    }

    // 重置阴影
    ctx.shadowBlur = 0;

    // 渲染圆形粒子（批量）
    ctx.globalAlpha = 1;
    for (const p of circleParticles) {
      if (p.glow) continue; // 已在发光组渲染

      const alpha = Math.max(0, p.life / p.maxLife);
      let size = p.size;
      if (p.scaleAnimation) {
        const progress = 1 - p.life / p.maxLife;
        size = p.size * (p.scaleStart + (p.scaleEnd - p.scaleStart) * progress);
      } else {
        size = p.size * alpha;
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 渲染矩形粒子（批量）
    ctx.globalAlpha = 1;
    for (const p of rectParticles) {
      if (p.glow) continue; // 已在发光组渲染

      const alpha = Math.max(0, p.life / p.maxLife);
      let size = p.size;
      if (p.scaleAnimation) {
        const progress = 1 - p.life / p.maxLife;
        size = p.size * (p.scaleStart + (p.scaleEnd - p.scaleStart) * progress);
      } else {
        size = p.size * alpha;
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;

      if (p.rotation !== 0) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.restore();
      } else {
        ctx.fillRect(Math.floor(p.x - size / 2), Math.floor(p.y - size / 2), size, size);
      }
    }

    // 重置所有状态
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  clear() {
    this._pool.releaseAll();
  }
}
