import { MathUtils } from '../../engine/MathUtils.js';

export class AutoAttackSystem {
  constructor(world) {
    this.world = world;
  }

  update(dt) {
    const players = this.world.query('Transform', 'PlayerTag', 'Attack');
    for (const player of players) {
      const atk = player.components.Attack;
      atk.cooldown -= dt;
      if (atk.cooldown > 0) continue;

      const enemies = this.world.query('Transform', 'EnemyTag');
      let nearest = null;
      let nearDist = (atk.range ?? 200) * (atk.rangeMult ?? 1);
      const pt = player.components.Transform;

      for (const e of enemies) {
        const d = MathUtils.distance(pt, e.components.Transform);
        if (d < nearDist) {
          nearDist = d;
          nearest = e;
        }
      }
      if (!nearest) continue;

      atk.cooldown = (atk.interval ?? 0.8) * (atk.intervalMult ?? 1);
      const et = nearest.components.Transform;
      const angle = MathUtils.angleBetween(pt, et);
      const count = atk.projectileCount ?? 1;
      const speed = (atk.projectileSpeed ?? 200) * (atk.projectileSpeedMult ?? 1);
      const damage = (atk.damage ?? 1) * (atk.damageMult ?? 1);
      const pierce = atk.pierce ?? 0;
      const ricochet = atk.ricochet ?? 0;
      const bigProj = atk.bigProjectile ?? 0;
      const burn = atk.burn ?? 0;

      const projSize = 4 + bigProj * 3;
      const projColor = burn > 0 ? '#ff6b35' : '#ffcc00';

      for (let i = 0; i < count; i++) {
        let spread = 0;
        if (count > 1) {
          spread = (i - (count - 1) / 2) * 0.15;
        }
        const a = angle + spread;

        const p = this.world.createEntity();
        this.world.addComponent(p, 'Transform', { x: pt.x, y: pt.y });
        this.world.addComponent(p, 'Velocity', { x: Math.cos(a) * speed, y: Math.sin(a) * speed });
        this.world.addComponent(p, 'Sprite', { w: projSize, h: projSize, color: projColor });
        this.world.addComponent(p, 'ProjectileTag', {});
        this.world.addComponent(p, 'Damage', { value: damage });
        this.world.addComponent(p, 'Lifetime', { remaining: 2.0 });
        this.world.addComponent(p, 'HitTracker', { hitSet: new Set(), pierceLeft: pierce, ricochetLeft: ricochet });
        if (burn > 0) {
          this.world.addComponent(p, 'Burn', { value: burn });
        }
      }
    }
  }
}
