import { MathUtils } from '../../engine/MathUtils.js';

const SKILLS = {
  CHARGE: { name: 'charge', cooldown: 20 },
  EARTHQUAKE: { name: 'earthquake', cooldown: 10 },
  FIRE_BREATH: { name: 'fire', cooldown: 10 },
  NORMAL: { name: 'normal', cooldown: 0 },
};

export class MiniBossController {
  constructor(world, LW, LH, maxAttackRange) {
    this.world = world;
    this.LW = LW;
    this.LH = LH;
    this.maxAttackRange = maxAttackRange || 180;
    this.entity = null;
    this.hp = 0;
    this.maxHp = 0;
    this.active = false;
    this.timer = 0;
    this.onDeath = null;

    // Skill cooldowns - start at 0 so boss can use skills immediately on spawn
    this.skillCooldowns = {
      charge: 0,
      earthquake: 0,
      fire: 0,
      normal: 0,
    };

    // Charge state
    this.chargeState = null; // { phase: 'marking'|'charging'|'cooldown', targetPos, chainCount, timer }

    // Fire breath patches
    this.firePatches = [];

    // Casting state for normal attack and fire breath
    this._casting = null; // { skill, timer, maxTimer, angle, targetX, targetY }
  }

  spawn(x, y, maxHp = 40, onDeath = null) {
    this.entity = this.world.createEntity();
    this.world.addComponent(this.entity, 'Transform', { x, y });
    this.world.addComponent(this.entity, 'Sprite', { w: 32, h: 32, color: '#9b59b6', imageKey: 'mini_boss' });
    this.world.addComponent(this.entity, 'Health', { hp: maxHp, maxHp });
    this.world.addComponent(this.entity, 'EnemyTag', {});
    this.world.addComponent(this.entity, 'Damage', { value: 10 });
    this.world.addComponent(this.entity, 'Speed', { value: 50 });
    this.world.addComponent(this.entity, 'ScoreValue', { value: 200 });
    this.world.addComponent(this.entity, 'Collider', { radius: 16 });
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.active = true;
    this.timer = 0;
    this.onDeath = onDeath;
    // Reset cooldowns to 0 so boss can use skills immediately
    this.skillCooldowns = { charge: 0, earthquake: 0, fire: 0, normal: 0 };
    this.chargeState = null;
    this.firePatches = [];
    this._casting = null;
  }

  update(dt) {
    if (!this.active || !this.entity || !this.entity.active) return;
    this.timer += dt;

    // Tick cooldowns
    for (const key of Object.keys(this.skillCooldowns)) {
      if (this.skillCooldowns[key] > 0) {
        this.skillCooldowns[key] -= dt;
      }
    }

    const h = this.entity.components.Health;
    this.hp = h.hp;
    if (h.hp <= 0) {
      this.active = false;
      const t = this.entity.components.Transform;
      const cb = this.onDeath;
      this.world.removeEntity(this.entity.id);
      this.entity = null;
      this.firePatches = [];
      if (cb) cb(t.x, t.y);
      return;
    }

    // Update charge state if active
    if (this.chargeState) {
      this._updateCharge(dt);
      return; // Charge takes priority
    }

    // Update casting state
    if (this._casting) {
      this._updateCasting(dt);
      return; // Casting takes priority
    }

    // Update fire patches
    this._updateFirePatches(dt);

    // Move towards player (basic movement)
    this._updateMovement(dt);

    // Choose and execute skill
    this._chooseAndExecuteSkill(dt);
  }

  _updateMovement(dt) {
    const players = this.world.query('Transform', 'PlayerTag');
    if (players.length === 0) return;
    const pt = players[0].components.Transform;
    const bt = this.entity.components.Transform;

    // Keep moderate distance, circle around player
    const dist = MathUtils.distance(bt, pt);
    let targetDist = 100;
    let moveAngle = MathUtils.angleBetween(bt, pt);

    if (dist < 80) {
      // Move away
      moveAngle += Math.PI;
    } else if (dist > 150) {
      // Move closer
      // keep angle towards player
    } else {
      // Circle
      moveAngle += Math.PI / 2 + Math.sin(this.timer * 0.5) * 0.5;
    }

    const speed = this.entity.components.Speed.value;
    bt.x += Math.cos(moveAngle) * speed * dt;
    bt.y += Math.sin(moveAngle) * speed * dt;
    bt.x = MathUtils.clamp(bt.x, 20, this.LW - 20);
    bt.y = MathUtils.clamp(bt.y, 20, this.LH - 20);
  }

  _chooseAndExecuteSkill(dt) {
    // Build available skills (cooldown <= 0)
    const available = [];
    if (this.skillCooldowns.charge <= 0) available.push('charge');
    if (this.skillCooldowns.earthquake <= 0) available.push('earthquake');
    if (this.skillCooldowns.fire <= 0) available.push('fire');
    if (this.skillCooldowns.normal <= 0) available.push('normal');

    if (available.length === 0) return;

    // Random selection
    const choice = available[Math.floor(Math.random() * available.length)];

    switch (choice) {
      case 'charge': this._startCharge(); break;
      case 'earthquake': this._earthquake(); break;
      case 'fire': this._fireBreath(); break;
      case 'normal': this._normalAttack(); break;
    }
  }

  // ── Skills ──────────────────────────────────────────

  _startCharge() {
    const players = this.world.query('Transform', 'PlayerTag');
    if (players.length === 0) return;
    const pt = players[0].components.Transform;
    const bt = this.entity.components.Transform;

    const angle = MathUtils.angleBetween(bt, pt);
    const targetDist = 400; // Charge through entire arena
    const targetX = MathUtils.clamp(bt.x + Math.cos(angle) * targetDist, 20, this.LW - 20);
    const targetY = MathUtils.clamp(bt.y + Math.sin(angle) * targetDist, 20, this.LH - 20);

    this.chargeState = {
      phase: 'marking',
      startX: bt.x,
      startY: bt.y,
      targetX,
      targetY,
      chainCount: 3,
      timer: 0.5, // 0.5s marking phase
      damage: 300,
    };

    this.skillCooldowns.charge = SKILLS.CHARGE.cooldown;
  }

  _updateCharge(dt) {
    const players = this.world.query('Transform', 'PlayerTag');
    if (players.length === 0) {
      this.chargeState = null;
      return;
    }

    this.chargeState.timer -= dt;
    const bt = this.entity.components.Transform;

    if (this.chargeState.phase === 'marking') {
      // Stay in place, show warning line
      if (this.chargeState.timer <= 0) {
        // Start charging
        this.chargeState.phase = 'charging';
        this.chargeState.timer = 0.5; // 0.5s charge duration (very fast)
        this.chargeState.speed = MathUtils.distance(
          { x: this.chargeState.startX, y: this.chargeState.startY },
          { x: this.chargeState.targetX, y: this.chargeState.targetY }
        ) / 0.5;
      }
    } else if (this.chargeState.phase === 'charging') {
      // Move towards target at high speed
      const dirX = (this.chargeState.targetX - bt.x);
      const dirY = (this.chargeState.targetY - bt.y);
      const dist = Math.sqrt(dirX * dirX + dirY * dirY);
      if (dist > 5) {
        const speed = this.chargeState.speed;
        bt.x += (dirX / dist) * speed * dt;
        bt.y += (dirY / dist) * speed * dt;
      }

      // Check collision with player during charge
      const pt = players[0].components.Transform;
      const ph = players[0].components.Health;
      if (MathUtils.distance(bt, pt) < 20 && ph.hp > 0) {
        ph.hp -= this.chargeState.damage;
        ph.invTimer = 0.5;
      }

      if (this.chargeState.timer <= 0 || dist <= 5) {
        // Reached target or time expired
        this.chargeState.chainCount--;
        if (this.chargeState.chainCount > 0) {
          // Chain to next position
          const newAngle = MathUtils.angleBetween(bt, pt);
          const newTargetDist = 300;
          this.chargeState.startX = bt.x;
          this.chargeState.startY = bt.y;
          this.chargeState.targetX = MathUtils.clamp(bt.x + Math.cos(newAngle) * newTargetDist, 20, this.LW - 20);
          this.chargeState.targetY = MathUtils.clamp(bt.y + Math.sin(newAngle) * newTargetDist, 20, this.LH - 20);
          this.chargeState.phase = 'marking';
          this.chargeState.timer = 0.3; // shorter marking for chains
        } else {
          this.chargeState = null;
        }
      }
    }
  }

  _earthquake() {
    const bt = this.entity.components.Transform;
    const radius = 80;
    const damage = 20;

    // Damage all enemies in radius (actually damage player)
    const players = this.world.query('Transform', 'Health', 'PlayerTag');
    for (const p of players) {
      if (!p.active) continue;
      const pt = p.components.Transform;
      const ph = p.components.Health;
      if (MathUtils.distance(bt, pt) <= radius) {
        ph.hp -= damage;
        ph.invTimer = 0.8;
      }
    }

    // Create shockwave visual (expanding ring)
    this._createShockwave(bt.x, bt.y, radius);

    this.skillCooldowns.earthquake = SKILLS.EARTHQUAKE.cooldown;
  }

  _createShockwave(x, y, radius) {
    const fx = this.world.createEntity();
    this.world.addComponent(fx, 'Transform', { x, y });
    this.world.addComponent(fx, 'BurstFX', { radius, life: 0.4, maxLife: 0.4 });
  }

  _updateFirePatches(dt) {
    const players = this.world.query('Transform', 'PlayerTag', 'Health');
    for (const patch of this.firePatches) {
      patch.timer -= dt;
      // Check player collision
      for (const p of players) {
        if (!p.active) continue;
        const pt = p.components.Transform;
        const ph = p.components.Health;
        if (MathUtils.distance(patch, pt) <= patch.radius) {
          if (!patch._lastHitTime || (patch.duration - patch.timer) - patch._lastHitTime > 0.5) {
            ph.hp -= patch.damage;
            patch._lastHitTime = patch.duration - patch.timer;
          }
        }
      }
    }
    // Remove expired patches
    this.firePatches = this.firePatches.filter(p => p.timer > 0);
  }

  _normalAttack() {
    const players = this.world.query('Transform', 'PlayerTag');
    if (players.length === 0) return;
    const pt = players[0].components.Transform;
    const bt = this.entity.components.Transform;

    if (MathUtils.distance(bt, pt) > this.maxAttackRange) return;

    const angle = MathUtils.angleBetween(bt, pt);
    this._casting = { skill: 'normal', timer: 0.6, maxTimer: 0.6, angle, targetX: pt.x, targetY: pt.y };
  }

  _fireBreath() {
    const players = this.world.query('Transform', 'PlayerTag');
    if (players.length === 0) return;
    const pt = players[0].components.Transform;
    const bt = this.entity.components.Transform;

    const angle = MathUtils.angleBetween(bt, pt);
    this._casting = { skill: 'fire', timer: 0.8, maxTimer: 0.8, angle, targetX: pt.x, targetY: pt.y };

    this.skillCooldowns.fire = SKILLS.FIRE_BREATH.cooldown;
  }

  _updateCasting(dt) {
    if (!this._casting) return;
    this._casting.timer -= dt;
    if (this._casting.timer <= 0) {
      const cast = this._casting;
      this._casting = null;
      const bt = this.entity.components.Transform;

      if (cast.skill === 'normal') {
        const p = this.world.createEntity();
        this.world.addComponent(p, 'Transform', { x: bt.x, y: bt.y });
        this.world.addComponent(p, 'Velocity', { x: Math.cos(cast.angle) * 120, y: Math.sin(cast.angle) * 120 });
        this.world.addComponent(p, 'Sprite', { w: 6, h: 6, color: '#bb66ff', imageKey: 'mini_boss_bullet' });
        this.world.addComponent(p, 'ProjectileTag', {});
        this.world.addComponent(p, 'Damage', { value: 50 });
        this.world.addComponent(p, 'Lifetime', { remaining: 3.0 });
        this.skillCooldowns.normal = 4.0;
      } else if (cast.skill === 'fire') {
        const spreadAngles = [-0.2, 0, 0.2];
        for (const spread of spreadAngles) {
          const a = cast.angle + spread;
          const dist = 60 + Math.random() * 40;
          const fx = {
            x: MathUtils.clamp(bt.x + Math.cos(a) * dist, 20, this.LW - 20),
            y: MathUtils.clamp(bt.y + Math.sin(a) * dist, 20, this.LH - 20),
            radius: 25,
            damage: 30,
            duration: 3.0,
            timer: 3.0,
          };
          this.firePatches.push(fx);
        }
      }
    }
  }

  // ── Rendering ──────────────────────────────────────────

  render(renderer, cam) {
    if (!this.active) return;

    // Render charge warning line
    if (this.chargeState && this.chargeState.phase === 'marking') {
      const ctx = renderer.ctx;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const sx = this.chargeState.startX * renderer._sx - cam.offsetX * renderer._sx;
      const sy = this.chargeState.startY * renderer._sy - cam.offsetY * renderer._sy;
      const tx = this.chargeState.targetX * renderer._sx - cam.offsetX * renderer._sx;
      const ty = this.chargeState.targetY * renderer._sy - cam.offsetY * renderer._sy;

      const pulse = 0.5 + Math.sin(this.timer * 10) * 0.3;
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 3 * renderer.dpr;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.restore();
    }

    // Render casting indicator
    if (this._casting) {
      const ctx = renderer.ctx;
      const bt = this.entity.components.Transform;
      const bsx = bt.x - cam.offsetX;
      const bsy = bt.y - cam.offsetY;
      const progress = 1 - (this._casting.timer / this._casting.maxTimer);

      ctx.save();
      // Pulsing glow
      const glowPulse = 0.4 + progress * 0.5;
      ctx.globalAlpha = glowPulse;
      const castColor = this._casting.skill === 'fire' ? '#ff4400' : '#bb66ff';
      ctx.fillStyle = castColor;
      ctx.beginPath();
      ctx.arc(bsx, bsy, 22 + progress * 6, 0, Math.PI * 2);
      ctx.fill();

      // Progress arc
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(bsx, bsy, 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();

      // Aim line toward target
      ctx.globalAlpha = 0.5 + Math.sin(this.timer * 12) * 0.3;
      ctx.strokeStyle = castColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(bsx, bsy);
      const aimLen = 60;
      ctx.lineTo(bsx + Math.cos(this._casting.angle) * aimLen, bsy + Math.sin(this._casting.angle) * aimLen);
      ctx.stroke();
      ctx.setLineDash([]);

      // "!" warning text
      ctx.globalAlpha = 0.8 + Math.sin(this.timer * 10) * 0.2;
      ctx.fillStyle = '#ff0';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('!', bsx, bsy - 22);

      ctx.restore();
    }

    // Render fire patches
    const ctx = renderer.ctx;
    for (const patch of this.firePatches) {
      ctx.save();
      const px = patch.x - cam.offsetX;
      const py = patch.y - cam.offsetY;
      const pr = patch.radius;
      ctx.globalAlpha = 0.4 + Math.sin(this.timer * 8) * 0.2;
      ctx.fillStyle = '#ff3300';
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }
}