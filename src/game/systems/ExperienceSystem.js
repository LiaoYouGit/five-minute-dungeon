import { MathUtils } from '../../engine/MathUtils.js';

export class ExperienceSystem {
  constructor(world) {
    this.world = world;
    this.totalExp = 0;
    this.level = 1;
    this.expToNext = 10;
    this.onLevelUp = null;
  }

  addExp(amount, mult = 1) {
    this.totalExp += amount * mult;
    while (this.totalExp >= this.expToNext) {
      this.totalExp -= this.expToNext;
      this.level++;
      this.expToNext = Math.floor(10 * this.level * 1.2);
      if (this.onLevelUp) this.onLevelUp(this.level);
    }
  }

  getProgress() {
    return this.totalExp / this.expToNext;
  }

  spawnGem(x, y, value = 1, mult = 1) {
    const finalValue = Math.max(1, Math.ceil(value * mult));
    const g = this.world.createEntity();
    this.world.addComponent(g, 'Transform', { x: x + MathUtils.randomRange(-8, 8), y: y + MathUtils.randomRange(-8, 8) });
    this.world.addComponent(g, 'Sprite', { w: 5, h: 5, color: '#4ecdc4', imageKey: 'exp_gem' });
    this.world.addComponent(g, 'PickupTag', {});
    this.world.addComponent(g, 'ExperienceValue', { value: finalValue });
    this.world.addComponent(g, 'Magnet', { active: false });
  }

  update(dt) {
    const gems = this.world.query('Transform', 'PickupTag', 'ExperienceValue');
    const players = this.world.query('Transform', 'PlayerTag');
    if (players.length === 0) return;
    const pt = players[0].components.Transform;
    const pickupRange = 20;
    const magnetRange = 80;

    for (const g of gems) {
      if (!g.active) continue;
      const gt = g.components.Transform;
      const dist = MathUtils.distance(pt, gt);

      if (dist < magnetRange) {
        g.components.Magnet.active = true;
      }

      if (g.components.Magnet.active || dist < pickupRange) {
        const dir = MathUtils.normalize({ x: pt.x - gt.x, y: pt.y - gt.y });
        const speed = g.components.Magnet.active ? 250 : 100;
        gt.x += dir.x * speed * dt;
        gt.y += dir.y * speed * dt;
      }

      if (dist < 10) {
        this.addExp(g.components.ExperienceValue.value);
        this.world.removeEntity(g.id);
      }
    }
  }

  reset() {
    this.totalExp = 0;
    this.level = 1;
    this.expToNext = 10;
  }
}
