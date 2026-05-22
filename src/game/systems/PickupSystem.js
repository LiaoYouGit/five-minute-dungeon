import { MathUtils } from '../../engine/MathUtils.js';

const PICKUP_TYPES = {
  coin: { color: '#ffcc00', size: 6, score: 5 },
  healthPotion: { color: '#e74c3c', size: 6, heal: 1 },
  bigHealth: { color: '#ff5577', size: 8, heal: 3 },
  magnet: { color: '#9b59b6', size: 7, magnetBoost: 1.5, duration: 10 },
  expGem: { color: '#4ecdc4', size: 6, exp: 5 },
};

export class PickupSystem {
  constructor(world) {
    this.world = world;
    this.magnetBoost = 0;
    this.magnetTimer = 0;
    this.expSystem = null;
  }

  setExpSystem(expSystem) {
    this.expSystem = expSystem;
  }

  spawnDrop(x, y) {
    const roll = Math.random();
    if (roll < 0.18) {
      this._create(x, y, 'coin');
    } else if (roll < 0.26) {
      this._create(x, y, 'healthPotion');
    } else if (roll < 0.28) {
      this._create(x, y, 'bigHealth');
    } else if (roll < 0.31) {
      this._create(x, y, 'magnet');
    } else if (roll < 0.36) {
      this._create(x, y, 'expGem');
    }
  }

  _create(x, y, type) {
    const def = PICKUP_TYPES[type];
    if (!def) return;
    const p = this.world.createEntity();
    this.world.addComponent(p, 'Transform', {
      x: x + MathUtils.randomRange(-12, 12),
      y: y + MathUtils.randomRange(-12, 12),
    });
    this.world.addComponent(p, 'Sprite', { w: def.size, h: def.size, color: def.color });
    this.world.addComponent(p, 'PickupTag', {});
    this.world.addComponent(p, 'PickupType', { type });
    this.world.addComponent(p, 'Magnet', { active: false, baseRange: 20 });
    this.world.addComponent(p, 'BobTimer', { timer: Math.random() * Math.PI * 2 });
  }

  update(dt, magnetMult = 1) {
    if (this.magnetTimer > 0) {
      this.magnetTimer -= dt;
      if (this.magnetTimer <= 0) this.magnetBoost = 0;
    }

    const players = this.world.query('Transform', 'PlayerTag', 'Health');
    if (players.length === 0) return;
    const pt = players[0].components.Transform;
    const effectiveMagnet = magnetMult * (this.magnetBoost || 1);
    const magnetRange = 80 * effectiveMagnet;

    const pickups = this.world.query('Transform', 'PickupTag', 'PickupType');
    for (const p of pickups) {
      if (!p.active) continue;
      const gt = p.components.Transform;
      const bob = p.components.BobTimer;
      if (bob) {
        bob.timer += dt * 3;
        gt.y += Math.sin(bob.timer) * 0.2;
      }
      const dist = MathUtils.distance(pt, gt);
      const pickupRange = 15;

      if (dist < magnetRange) p.components.Magnet.active = true;

      if (p.components.Magnet.active) {
        const dir = MathUtils.normalize({ x: pt.x - gt.x, y: pt.y - gt.y });
        const speed = 250;
        gt.x += dir.x * speed * dt;
        gt.y += dir.y * speed * dt;
      }

      if (dist < pickupRange) {
        const type = p.components.PickupType.type;
        if (type === 'coin') {
          // score handled externally
        } else if (type === 'healthPotion') {
          const ph = players[0].components.Health;
          ph.hp = Math.min(ph.hp + 1, ph.maxHp);
        } else if (type === 'bigHealth') {
          const ph = players[0].components.Health;
          ph.hp = Math.min(ph.hp + 3, ph.maxHp);
        } else if (type === 'magnet') {
          this.magnetBoost = PICKUP_TYPES.magnet.magnetBoost;
          this.magnetTimer = PICKUP_TYPES.magnet.duration;
        } else if (type === 'expGem') {
          if (this.expSystem) this.expSystem.addExp(PICKUP_TYPES.expGem.exp);
        }
        this.world.removeEntity(p.id);
      }
    }
  }

  reset() {
    this.magnetBoost = 0;
    this.magnetTimer = 0;
  }
}
