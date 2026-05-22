import { MathUtils } from '../../engine/MathUtils.js';

/**
 * Lightweight mini-boss for supply events.
 * Single phase, ring-barrage only attack, dies in one go.
 */
export class MiniBossController {
  constructor(world, LW, LH) {
    this.world = world;
    this.LW = LW;
    this.LH = LH;
    this.entity = null;
    this.hp = 0;
    this.maxHp = 0;
    this.active = false;
    this.timer = 0;
    this.attackTimer = 1.5;
    this.attackCooldown = 2.5;
    this.moveTimer = 0;
    this.moveTarget = null;
    this.onDeath = null;
  }

  spawn(x, y, maxHp = 20, onDeath = null) {
    this.entity = this.world.createEntity();
    this.world.addComponent(this.entity, 'Transform', { x, y });
    this.world.addComponent(this.entity, 'Sprite', { w: 22, h: 22, color: '#9b59b6' });
    this.world.addComponent(this.entity, 'Health', { hp: maxHp, maxHp });
    this.world.addComponent(this.entity, 'EnemyTag', {});
    this.world.addComponent(this.entity, 'Damage', { value: 1 });
    this.world.addComponent(this.entity, 'Speed', { value: 50 });
    this.world.addComponent(this.entity, 'ScoreValue', { value: 100 });
    this.world.addComponent(this.entity, 'Collider', { radius: 11 });
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.active = true;
    this.timer = 0;
    this.attackTimer = 1.5;
    this.moveTarget = { x, y };
    this.onDeath = onDeath;
  }

  update(dt) {
    if (!this.active || !this.entity || !this.entity.active) return;
    this.timer += dt;
    const h = this.entity.components.Health;
    this.hp = h.hp;
    if (h.hp <= 0) {
      this.active = false;
      const t = this.entity.components.Transform;
      const cb = this.onDeath;
      // remove entity safely
      this.world.removeEntity(this.entity.id);
      this.entity = null;
      if (cb) cb(t.x, t.y);
      return;
    }

    const players = this.world.query('Transform', 'PlayerTag');
    if (players.length > 0) {
      const pt = players[0].components.Transform;
      this.moveTimer -= dt;
      if (this.moveTimer <= 0) {
        this.moveTimer = 2.0 + Math.random();
        const angle = Math.random() * Math.PI * 2;
        const dist = 50 + Math.random() * 50;
        this.moveTarget = {
          x: MathUtils.clamp(pt.x + Math.cos(angle) * dist, 20, this.LW - 20),
          y: MathUtils.clamp(pt.y + Math.sin(angle) * dist, 20, this.LH - 20),
        };
      }
      const bt = this.entity.components.Transform;
      const dir = MathUtils.normalize({ x: this.moveTarget.x - bt.x, y: this.moveTarget.y - bt.y });
      const speed = this.entity.components.Speed.value;
      bt.x += dir.x * speed * dt;
      bt.y += dir.y * speed * dt;
    }

    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      this.attackTimer = this.attackCooldown;
      this._ringBarrage();
    }
  }

  _ringBarrage() {
    const bt = this.entity.components.Transform;
    const count = 10;
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 / count) * i + this.timer * 0.5;
      const p = this.world.createEntity();
      this.world.addComponent(p, 'Transform', { x: bt.x, y: bt.y });
      this.world.addComponent(p, 'Velocity', { x: Math.cos(a) * 90, y: Math.sin(a) * 90 });
      this.world.addComponent(p, 'Sprite', { w: 5, h: 5, color: '#bb66ff' });
      this.world.addComponent(p, 'ProjectileTag', {});
      this.world.addComponent(p, 'Damage', { value: 1 });
      this.world.addComponent(p, 'Lifetime', { remaining: 3.0 });
    }
  }
}
