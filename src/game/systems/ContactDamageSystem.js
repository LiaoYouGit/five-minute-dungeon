import { MathUtils } from '../../engine/MathUtils.js';

export class ContactDamageSystem {
  constructor(world, onPlayerHit, getBuffs) {
    this.world = world;
    this.onPlayerHit = onPlayerHit;
    this.getBuffs = getBuffs || (() => ({}));
  }

  update(dt) {
    const players = this.world.query('Transform', 'PlayerTag', 'Health');
    const enemies = this.world.query('Transform', 'EnemyTag', 'Damage', 'Health');
    const buffs = this.getBuffs();
    const thorns = buffs.thorns || 0;
    const invincibleBonus = buffs.invincibleBonus || 0;

    for (const player of players) {
      const ph = player.components.Health;
      if (ph.hp <= 0) continue;
      if (ph.invTimer > 0) {
        ph.invTimer -= dt;
        continue;
      }
      const pt = player.components.Transform;
      const pr = player.components.Collider?.radius ?? 7;

      for (const e of enemies) {
        if (!e.active) continue;

        // PhaseShift: elite invulnerability
        if (e.components.PhaseShift) continue;

        const es = e.components.Sprite;
        const dist = MathUtils.distance(pt, e.components.Transform);
        if (dist < pr + es.w / 2) {
          ph.hp -= e.components.Damage.value;
          ph.invTimer = 1.0 + invincibleBonus;

          // Thorns: reflect damage back to enemy
          if (thorns > 0) {
            e.components.Health.hp -= thorns;
            if (e.components.Health.hp <= 0) {
              this.onPlayerHit?.(player, e);
            }
          }

          if (this.onPlayerHit) this.onPlayerHit(player, e);
          break;
        }
      }

      // Hazard zone damage
      const hazards = this.world.query('Transform', 'HazardZone');
      for (const h of hazards) {
        if (!h.active) continue;
        const hz = h.components.HazardZone;
        const ht = h.components.Transform;

        // Delay before hazard becomes active
        if (hz.delay > 0) {
          hz.delay -= dt;
          continue;
        }

        hz._tickTimer = (hz._tickTimer || 0) + dt;
        if (hz._tickTimer >= 0.5) {
          hz._tickTimer = 0;
          const dist = MathUtils.distance(pt, ht);
          if (dist < hz.radius && ph.invTimer <= 0) {
            ph.hp -= hz.damage;
            ph.invTimer = 0.5;

            // Apply slow effect if defined
            if (hz.slowAmount && player.components.PlayerSpeed) {
              player.components.PlayerSpeed.value *= (1 - hz.slowAmount);
            }

            if (this.onPlayerHit) this.onPlayerHit(player, h);
          }
        }

        hz.duration -= dt;
        if (hz.duration <= 0) {
          this.world.removeEntity(h.id);
        }
      }
    }
  }
}
