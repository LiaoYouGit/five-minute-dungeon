import { MathUtils } from '../../engine/MathUtils.js';

export class ProjectileSystem {
  constructor(world, lw, lh, onHit) {
    this.world = world;
    this.lw = lw;
    this.lh = lh;
    this.onHit = onHit;
    this.tileMap = null;
  }

  setTileMap(tileMap) {
    this.tileMap = tileMap;
  }

  update(dt) {
    const projectiles = this.world.query('Transform', 'ProjectileTag', 'Damage');

    for (const p of projectiles) {
      if (!p.active) continue;
      const t = p.components.Transform;
      const v = p.components.Velocity;

      // Boomerang: travel out, then return
      const boom = p.components.Boomerang;
      if (boom) {
        boom.traveled += Math.sqrt(v.x * v.x + v.y * v.y) * dt;
        if (!boom.returning && boom.traveled >= boom.maxDist) {
          boom.returning = true;
          if (p.components.HitTracker) p.components.HitTracker.hitSet.clear();
        }
        if (boom.returning) {
          const player = this.world.query('Transform', 'PlayerTag')[0];
          if (player) {
            const pp = player.components.Transform;
            const dx = pp.x - t.x;
            const dy = pp.y - t.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 14) {
              this.world.removeEntity(p.id);
              continue;
            }
            const speed = Math.sqrt(v.x * v.x + v.y * v.y);
            v.x = (dx / d) * speed;
            v.y = (dy / d) * speed;
          }
        }
      }

      // Homing: turn toward target
      const homing = p.components.Homing;
      if (homing) {
        const target = this._getHomingTarget(homing.target);
        if (target) {
          const tt = target.components.Transform;
          const dx = tt.x - t.x;
          const dy = tt.y - t.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 5) {
            const desiredAngle = Math.atan2(dy, dx);
            const currentAngle = Math.atan2(v.y, v.x);
            let diff = desiredAngle - currentAngle;
            // Normalize to [-PI, PI]
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const maxTurn = homing.turnRate * dt;
            const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));
            const newAngle = currentAngle + turn;
            const speed = Math.sqrt(v.x * v.x + v.y * v.y);
            v.x = Math.cos(newAngle) * speed;
            v.y = Math.sin(newAngle) * speed;
          }
        }
      }

      t.x += v.x * dt;
      t.y += v.y * dt;

      const lt = p.components.Lifetime;
      if (lt) {
        lt.remaining -= dt;
        if (lt.remaining <= 0) {
          // Poison pool on expire
          if (p.components.PoisonPoolOnImpact) {
            this._spawnPoisonZone(t.x, t.y, p.components.PoisonPoolOnImpact);
          }
          this.world.removeEntity(p.id);
          continue;
        }
      }

      if (t.x < -20 || t.x > this.lw + 20 || t.y < -20 || t.y > this.lh + 20) {
        this.world.removeEntity(p.id);
        continue;
      }

      // Wall collision (boomerang passes through walls on return)
      if (this.tileMap && !boom) {
        const ts = this.tileMap.tileSize;
        const col = Math.floor(t.x / ts);
        const row = Math.floor(t.y / ts);
        if (this.tileMap.isWall(col, row)) {
          if (p.components.PoisonPoolOnImpact) {
            this._spawnPoisonZone(t.x, t.y, p.components.PoisonPoolOnImpact);
          }
          this.world.removeEntity(p.id);
          continue;
        }
      }
    }

    // Update poison zones
    this._updatePoisonZones(dt);
  }

  _getHomingTarget(targetType) {
    if (targetType === 'player') {
      return this.world.query('Transform', 'PlayerTag')[0];
    }
    return this.world.query('Transform', 'PlayerTag')[0];
  }

  _spawnPoisonZone(x, y, def) {
    const zone = this.world.createEntity();
    this.world.addComponent(zone, 'Transform', { x, y });
    this.world.addComponent(zone, 'Sprite', { w: def.radius * 2, h: def.radius * 2, color: '#2ecc71' });
    this.world.addComponent(zone, 'PoisonZone', {
      radius: def.radius,
      damage: def.damage,
      duration: def.duration,
      tickTimer: 0,
      tickInterval: 0.5,
    });
    this.world.addComponent(zone, 'Lifetime', { remaining: def.duration });
  }

  _updatePoisonZones(dt) {
    const zones = this.world.query('Transform', 'PoisonZone');
    const players = this.world.query('Transform', 'PlayerTag', 'Health');
    if (players.length === 0) return;
    const player = players[0];
    const pt = player.components.Transform;
    const ph = player.components.Health;

    for (const z of zones) {
      if (!z.active) continue;
      const zone = z.components.PoisonZone;
      const zt = z.components.Transform;

      zone.duration -= dt;
      zone.tickTimer += dt;

      if (zone.tickTimer >= zone.tickInterval) {
        zone.tickTimer = 0;
        const dist = MathUtils.distance(pt, zt);
        if (dist < zone.radius && ph.invTimer <= 0) {
          ph.hp -= zone.damage;
        }
      }

      if (zone.duration <= 0) {
        this.world.removeEntity(z.id);
      }
    }
  }

  checkHits() {
    const projectiles = this.world.query('Transform', 'ProjectileTag', 'Damage');
    const enemies = this.world.query('Transform', 'EnemyTag', 'Health');
    const hits = [];

    for (const p of projectiles) {
      if (!p.active) continue;

      const tracker = p.components.HitTracker;
      const ps = p.components.Sprite;

      for (const e of enemies) {
        if (!e.active) continue;

        if (tracker && tracker.hitSet.has(e.id)) continue;

        const es = e.components.Sprite;
        const dist = MathUtils.distance(p.components.Transform, e.components.Transform);
        if (dist < (ps.w + es.w) / 2) {
          hits.push({ projectile: p, enemy: e });

          if (tracker) {
            tracker.hitSet.add(e.id);

            if (tracker.pierceLeft > 0) {
              tracker.pierceLeft--;
              continue;
            } else if (tracker.ricochetLeft > 0) {
              tracker.ricochetLeft--;
              let nearest = null;
              let nearDist = 200;
              for (const ne of enemies) {
                if (ne.id === e.id || !ne.active || tracker.hitSet.has(ne.id)) continue;
                const d = MathUtils.distance(p.components.Transform, ne.components.Transform);
                if (d < nearDist) {
                  nearDist = d;
                  nearest = ne;
                }
              }
              if (nearest) {
                const angle = MathUtils.angleBetween(p.components.Transform, nearest.components.Transform);
                const speed = Math.sqrt(p.components.Velocity.x ** 2 + p.components.Velocity.y ** 2);
                p.components.Velocity.x = Math.cos(angle) * speed;
                p.components.Velocity.y = Math.sin(angle) * speed;
                continue;
              }
            }
          }

          this.world.removeEntity(p.id);
          break;
        }
      }
    }

    if (this.onHit) this.onHit(hits);
  }
}
