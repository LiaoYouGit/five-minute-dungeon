import { MathUtils } from '../../engine/MathUtils.js';

const PHASE_2_THRESHOLD = 0.5;
const ENRAGED_THRESHOLD = 0.2;

export class BossController {
  constructor(world, LW, LH) {
    this.world = world;
    this.LW = LW;
    this.LH = LH;
    this.entity = null;
    this.hp = 0;
    this.maxHp = 0;
    this.phase = 1;
    this.active = false;
    this.timer = 0;
    this.attackTimer = 0;
    this.attackCooldown = 2.0;
    this.moveTimer = 0;
    this.moveTarget = null;
    this.onDeath = null;
  }

  spawn(x, y, maxHp = 50) {
    this.entity = this.world.createEntity();
    this.world.addComponent(this.entity, 'Transform', { x, y: y - 100 });
    this.world.addComponent(this.entity, 'Sprite', { w: 32, h: 32, color: '#e74c3c', imageKey: 'boss_phase1' });
    this.world.addComponent(this.entity, 'Health', { hp: maxHp, maxHp });
    this.world.addComponent(this.entity, 'EnemyTag', {});
    this.world.addComponent(this.entity, 'Damage', { value: 2 });
    this.world.addComponent(this.entity, 'Speed', { value: 40 });
    this.world.addComponent(this.entity, 'ScoreValue', { value: 500 });
    this.world.addComponent(this.entity, 'BossTag', {});
    this.world.addComponent(this.entity, 'Collider', { radius: 16 });
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.phase = 1;
    this.active = true;
    this.timer = 0;
    this.attackTimer = 1.5;
    this.moveTarget = { x, y };
  }

  update(dt) {
    if (!this.active || !this.entity || !this.entity.active) return;

    this.timer += dt;
    const h = this.entity.components.Health;
    this.hp = h.hp;
    const hpRatio = this.hp / this.maxHp;

    // Phase transitions
    if (hpRatio <= ENRAGED_THRESHOLD && this.phase < 3) {
      this.phase = 3;
      this.attackCooldown = 1.0;
      this.entity.components.Speed.value = 70;
      this.entity.components.Sprite.color = '#ff0000';
      this.entity.components.Sprite.imageKey = 'boss_phase3';
    } else if (hpRatio <= PHASE_2_THRESHOLD && this.phase < 2) {
      this.phase = 2;
      this.attackCooldown = 1.5;
      this.entity.components.Speed.value = 55;
      this.entity.components.Sprite.color = '#c0392b';
      this.entity.components.Sprite.imageKey = 'boss_phase2';
    }

    // Movement: move toward a random point near player
    const players = this.world.query('Transform', 'PlayerTag');
    if (players.length > 0) {
      const pt = players[0].components.Transform;
      this.moveTimer -= dt;
      if (this.moveTimer <= 0) {
        this.moveTimer = 2.0 + Math.random();
        const angle = Math.random() * Math.PI * 2;
        const dist = 60 + Math.random() * 80;
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

    // Attack patterns
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      this.attackTimer = this.attackCooldown;
      this._attack(players[0]?.components.Transform);
    }

    // Check death
    if (h.hp <= 0) {
      this.active = false;
      if (this.onDeath) this.onDeath();
    }
  }

  _attack(playerTransform) {
    if (!playerTransform) return;
    const bt = this.entity.components.Transform;
    const pattern = Math.random();

    if (pattern < 0.3) {
      this._fanBarrage(bt, playerTransform);
    } else if (pattern < 0.55) {
      this._ringBarrage(bt);
    } else if (pattern < 0.75) {
      this._dash(bt, playerTransform);
    } else {
      this._spiralBarrage(bt);
    }
  }

  _fanBarrage(bt, pt) {
    const baseAngle = MathUtils.angleBetween(bt, pt);
    const count = 5 + this.phase * 2;
    const spread = 0.6;
    for (let i = 0; i < count; i++) {
      const a = baseAngle - spread / 2 + (spread / (count - 1)) * i;
      this._fireProjectile(bt.x, bt.y, a, 120 + this.phase * 20);
    }
  }

  _ringBarrage(bt) {
    const count = 8 + this.phase * 4;
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 / count) * i + this.timer * 0.5;
      this._fireProjectile(bt.x, bt.y, a, 80 + this.phase * 10);
    }
  }

  _dash(bt, pt) {
    const angle = MathUtils.angleBetween(bt, pt);
    const dist = 100;
    bt.x = MathUtils.clamp(pt.x - Math.cos(angle) * dist, 20, this.LW - 20);
    bt.y = MathUtils.clamp(pt.y - Math.sin(angle) * dist, 20, this.LH - 20);
    this._ringBarrage(bt);
  }

  _spiralBarrage(bt) {
    const count = 6 + this.phase * 3;
    const baseAngle = this.timer * 3;
    for (let i = 0; i < count; i++) {
      const a = baseAngle + (Math.PI * 2 / count) * i;
      this._fireProjectile(bt.x, bt.y, a, 90);
    }
  }

  _fireProjectile(x, y, angle, speed) {
    const p = this.world.createEntity();
    this.world.addComponent(p, 'Transform', { x, y });
    this.world.addComponent(p, 'Velocity', { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed });
    this.world.addComponent(p, 'Sprite', { w: 6, h: 6, color: '#ff4444', imageKey: 'boss_bullet' });
    this.world.addComponent(p, 'ProjectileTag', {});
    this.world.addComponent(p, 'Damage', { value: 1 });
    this.world.addComponent(p, 'Lifetime', { remaining: 3.0 });
  }
}
