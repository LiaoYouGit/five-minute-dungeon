import { MathUtils } from '../../engine/MathUtils.js';
import { WEAPONS, calcDmg, calcInterval, MAX_LEVEL } from '../data/weapons.js';

export class WeaponSystem {
  constructor(world, getBuffs, onMeleeHit) {
    this.world = world;
    this.getBuffs = getBuffs || (() => ({}));
    this.onMeleeHit = onMeleeHit || (() => {});
    this.orbitAngle = 0;
  }

  isMaxLevel(level) {
    return level >= MAX_LEVEL;
  }

  update(dt) {
    const players = this.world.query('Transform', 'PlayerTag', 'Weapons');
    for (const player of players) {
      const weapons = player.components.Weapons;
      const buffs = this.getBuffs();
      const pt = player.components.Transform;

      // Orbit speed: faster at max level
      const orbitSlot = weapons.slots.melee_orbit;
      const orbitSpeed = (orbitSlot && this.isMaxLevel(orbitSlot.level)) ? 5.0 : 3.5;
      this.orbitAngle += dt * orbitSpeed;

      // Orbit weapon: continuous hit detection (not cooldown-gated for visuals)
      if (weapons.slots.melee_orbit && weapons.slots.melee_orbit.level > 0) {
        this._tickOrbit(pt, weapons.slots.melee_orbit, buffs, dt);
      }

      for (const [weaponId, slot] of Object.entries(weapons.slots)) {
        if (slot.level <= 0) continue;
        slot.cooldown -= dt;
        if (slot.cooldown > 0) continue;

        const def = WEAPONS[weaponId];
        if (!def) continue;
        const level = slot.level;
        const globalDmgMult = buffs.damageMult || 1;
        const globalCdMult = buffs.intervalMult || 1;
        const dmg = calcDmg(def, level) * globalDmgMult;
        const interval = calcInterval(def, level) * globalCdMult;

        let fired = false;
        switch (weaponId) {
          case 'ranged':          fired = this._fireRanged(pt, dmg, def, level, buffs); break;
          case 'melee_slash':     fired = this._slash(pt, dmg, def, level, buffs); break;
          case 'melee_orbit':     fired = true; /* orbit handled separately, just reset CD */ break;
          case 'melee_burst':     fired = this._burst(pt, dmg, def, level, buffs); break;
          case 'pierce_spear':    fired = this._fireSpear(pt, dmg, def, level, buffs); break;
          case 'fireball':        fired = this._fireFireball(pt, dmg, def, level, buffs); break;
          case 'chain_lightning': fired = this._fireChainLightning(pt, dmg, def, level, buffs); break;
          case 'boomerang':       fired = this._fireBoomerang(pt, dmg, def, level, buffs); break;
          case 'ice_shard':       fired = this._fireIceShard(pt, dmg, def, level, buffs); break;
        }
        // Always reset cooldown so we don't busy-spin when no target
        slot.cooldown = fired ? interval : 0.15;
      }
    }
  }

  /** Find nearest enemy with clear line-of-sight (no walls blocking) */
  _findNearestVisible(pt, maxRange) {
    const enemies = this.world.query('Transform', 'EnemyTag');
    // Sort by distance so we try closest first
    const sorted = [];
    for (const e of enemies) {
      if (!e.active) continue;
      const d = MathUtils.distance(pt, e.components.Transform);
      if (d < maxRange) sorted.push({ e, d });
    }
    sorted.sort((a, b) => a.d - b.d);
    for (const { e } of sorted) {
      const et = e.components.Transform;
      if (this._hasLineOfSight(pt.x, pt.y, et.x, et.y)) {
        return e;
      }
    }
    return null;
  }

  _findNearestEnemy(pt, maxRange) {
    const enemies = this.world.query('Transform', 'EnemyTag');
    let nearest = null;
    let nearDist = maxRange;
    for (const e of enemies) {
      if (!e.active) continue;
      const d = MathUtils.distance(pt, e.components.Transform);
      if (d < nearDist) {
        nearDist = d;
        nearest = e;
      }
    }
    return nearest;
  }

  /** Check line-of-sight between two points using the tilemap */
  _hasLineOfSight(ax, ay, bx, by) {
    if (!this._tileMap) return true;
    const ts = this._tileMap.tileSize;
    const dx = bx - ax;
    const dy = by - ay;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(dist / (ts * 0.5));
    if (steps === 0) return true;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const col = Math.floor((ax + dx * t) / ts);
      const row = Math.floor((ay + dy * t) / ts);
      if (this._tileMap.isWall(col, row)) return false;
    }
    return true;
  }

  setTileMap(tileMap) {
    this._tileMap = tileMap;
  }

  _fireRanged(pt, dmg, def, level, buffs) {
    const rangeMult = buffs.rangeMult || 1;
    const range = 500 * rangeMult;
    const nearest = this._findNearestEnemy(pt, range);
    if (!nearest) return false;

    const et = nearest.components.Transform;
    const angle = MathUtils.angleBetween(pt, et);
    let count = (buffs.projectileCount || 1);
    const speed = (def.baseSpeed || 220) * (buffs.projectileSpeedMult || 1);
    let pierce = buffs.pierce || 0;
    const ricochet = buffs.ricochet || 0;
    const bigProj = buffs.bigProjectile || 0;
    const burn = buffs.burn || 0;
    let projSize = 4 + bigProj * 3;
    let finalDmg = dmg * (bigProj > 0 ? 1 + bigProj * 0.5 : 1);
    let projColor = burn > 0 ? '#ff6b35' : '#ffcc00';

    // Max level transformation: triple shot, larger bullets, gold color, extra pierce
    if (this.isMaxLevel(level)) {
      count += 2;
      projSize += 2;
      pierce += 2;
      finalDmg *= 1.5;
      projColor = '#ffd700';
    }

    const projImageKey = burn > 0 ? 'bullet_fire' : (bigProj > 0 ? 'bullet_big' : 'bullet');
    for (let i = 0; i < count; i++) {
      const spread = count > 1 ? (i - (count - 1) / 2) * 0.15 : 0;
      const a = angle + spread;
      const p = this.world.createEntity();
      this.world.addComponent(p, 'Transform', { x: pt.x, y: pt.y });
      this.world.addComponent(p, 'Velocity', { x: Math.cos(a) * speed, y: Math.sin(a) * speed });
      this.world.addComponent(p, 'Sprite', { w: projSize, h: projSize, color: projColor, imageKey: projImageKey });
      this.world.addComponent(p, 'ProjectileTag', {});
      this.world.addComponent(p, 'Damage', { value: finalDmg });
      this.world.addComponent(p, 'Lifetime', { remaining: 2.0 });
      this.world.addComponent(p, 'HitTracker', { hitSet: new Set(), pierceLeft: pierce, ricochetLeft: ricochet });
      if (burn > 0) this.world.addComponent(p, 'Burn', { value: burn });
    }
    return true;
  }

  _slash(pt, dmg, def, level, buffs) {
    let range = def.range * (1 + (level - 1) * def.rangePerLevel) * (buffs.rangeMult || 1);
    let arc = def.arc;
    let finalDmg = dmg;
    // Max level transformation: 180° arc, +50% range, double damage
    if (this.isMaxLevel(level)) {
      arc = Math.PI;
      range *= 1.5;
      finalDmg *= 2;
    }
    const nearest = this._findNearestEnemy(pt, range);
    if (!nearest) return false;

    const angle = MathUtils.angleBetween(pt, nearest.components.Transform);
    const halfArc = arc / 2;
    const hits = [];

    const enemies = this.world.query('Transform', 'EnemyTag', 'Health');
    for (const e of enemies) {
      if (!e.active) continue;
      const et = e.components.Transform;
      const d = MathUtils.distance(pt, et);
      if (d > range) continue;
      const eAngle = MathUtils.angleBetween(pt, et);
      let diff = Math.abs(((eAngle - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff <= halfArc) {
        hits.push({ enemy: e, dmg: finalDmg });
      }
    }

    // Visual: spawn a slash effect entity (lives ~0.18s)
    const fx = this.world.createEntity();
    this.world.addComponent(fx, 'Transform', { x: pt.x, y: pt.y });
    this.world.addComponent(fx, 'SlashFX', { angle, range, arc, life: 0.18, maxLife: 0.18, maxLevel: this.isMaxLevel(level) });

    if (hits.length > 0) this.onMeleeHit(hits, 'slash');
    return true;
  }

  _tickOrbit(pt, slot, buffs, dt) {
    const def = WEAPONS.melee_orbit;
    const level = slot.level;
    let blades = def.baseBlades + (level - 1);
    let radius = def.orbitRadius;
    let dmg = calcDmg(def, level) * (buffs.damageMult || 1);
    // Max level transformation: 6 blades, +30% radius, +50% damage
    if (this.isMaxLevel(level)) {
      blades = 6;
      radius *= 1.3;
      dmg *= 1.5;
      slot.maxLevel = true;
    } else {
      slot.maxLevel = false;
    }
    const hitCooldown = this.isMaxLevel(level) ? 0.25 : 0.4;
    if (!slot.hitTimers) slot.hitTimers = new Map();
    // decay timers
    for (const [id, t] of slot.hitTimers) {
      const nt = t - dt;
      if (nt <= 0) slot.hitTimers.delete(id);
      else slot.hitTimers.set(id, nt);
    }

    const enemies = this.world.query('Transform', 'EnemyTag', 'Health');
    const hits = [];
    for (let i = 0; i < blades; i++) {
      const ang = this.orbitAngle + (Math.PI * 2 / blades) * i;
      const bx = pt.x + Math.cos(ang) * radius;
      const by = pt.y + Math.sin(ang) * radius;
      for (const e of enemies) {
        if (!e.active) continue;
        const et = e.components.Transform;
        if (slot.hitTimers.has(e.id)) continue;
        const d = MathUtils.distance({ x: bx, y: by }, et);
        if (d < 10) {
          hits.push({ enemy: e, dmg });
          slot.hitTimers.set(e.id, hitCooldown);
        }
      }
    }
    if (hits.length > 0) this.onMeleeHit(hits, 'orbit');
  }

  _burst(pt, dmg, def, level, buffs) {
    let radius = def.radius * (1 + (level - 1) * def.radiusPerLevel) * (buffs.rangeMult || 1);
    let finalDmg = dmg;
    // Max level transformation: +50% radius, double damage
    if (this.isMaxLevel(level)) {
      radius *= 1.5;
      finalDmg *= 2;
    }
    const enemies = this.world.query('Transform', 'EnemyTag', 'Health');
    const hits = [];
    for (const e of enemies) {
      if (!e.active) continue;
      const et = e.components.Transform;
      if (MathUtils.distance(pt, et) <= radius) {
        hits.push({ enemy: e, dmg: finalDmg });
      }
    }
    // Visual fx
    const fx = this.world.createEntity();
    this.world.addComponent(fx, 'Transform', { x: pt.x, y: pt.y });
    this.world.addComponent(fx, 'BurstFX', { radius, life: 0.35, maxLife: 0.35, maxLevel: this.isMaxLevel(level) });

    // Always trigger (it's an AoE around player, fires even with no enemies)
    if (hits.length > 0) this.onMeleeHit(hits, 'burst');
    return true;
  }

  _fireSpear(pt, dmg, def, level, buffs) {
    const range = 300 * (buffs.rangeMult || 1);
    const nearest = this._findNearestEnemy(pt, range);
    if (!nearest) return false;

    const angle = MathUtils.angleBetween(pt, nearest.components.Transform);
    const speed = def.baseSpeed;
    let pierceCount = level + 2 + (buffs.pierce || 0);
    let projW = 14;
    let projDmg = dmg;
    // Max level transformation: infinite pierce, longer spear, +50% damage
    if (this.isMaxLevel(level)) {
      pierceCount = 999;
      projW = 18;
      projDmg *= 1.5;
    }

    const p = this.world.createEntity();
    this.world.addComponent(p, 'Transform', { x: pt.x, y: pt.y });
    this.world.addComponent(p, 'Velocity', { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed });
    this.world.addComponent(p, 'Sprite', { w: projW, h: 4, color: '#9b6ef3', imageKey: 'spear' });
    this.world.addComponent(p, 'ProjectileTag', {});
    this.world.addComponent(p, 'Damage', { value: projDmg });
    this.world.addComponent(p, 'Lifetime', { remaining: 2.5 });
    this.world.addComponent(p, 'HitTracker', { hitSet: new Set(), pierceLeft: pierceCount, ricochetLeft: 0 });
    return true;
  }

  _fireFireball(pt, dmg, def, level, buffs) {
    const nearest = this._findNearestEnemy(pt, 250 * (buffs.rangeMult || 1));
    if (!nearest) return false;
    const angle = MathUtils.angleBetween(pt, nearest.components.Transform);
    const speed = def.baseSpeed;
    let explodeRadius = def.explodeRadius * (1 + (level - 1) * def.radiusPerLevel) * (buffs.rangeMult || 1);
    let projDmg = dmg;
    let projSize = 9;
    // Max level transformation: massive explosion, +50% damage, larger fireball
    if (this.isMaxLevel(level)) {
      explodeRadius *= 1.5;
      projDmg *= 1.5;
      projSize = 12;
    }
    const p = this.world.createEntity();
    this.world.addComponent(p, 'Transform', { x: pt.x, y: pt.y });
    this.world.addComponent(p, 'Velocity', { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed });
    this.world.addComponent(p, 'Sprite', { w: projSize, h: projSize, color: '#ff5522', imageKey: 'fireball' });
    this.world.addComponent(p, 'ProjectileTag', {});
    this.world.addComponent(p, 'Damage', { value: projDmg });
    this.world.addComponent(p, 'Lifetime', { remaining: 2.5 });
    this.world.addComponent(p, 'HitTracker', { hitSet: new Set(), pierceLeft: 0, ricochetLeft: 0 });
    this.world.addComponent(p, 'ExplodeOnHit', { radius: explodeRadius, damage: projDmg, maxLevel: this.isMaxLevel(level) });
    return true;
  }

  _fireChainLightning(pt, dmg, def, level, buffs) {
    const range = def.range * (buffs.rangeMult || 1);
    const nearest = this._findNearestEnemy(pt, range);
    if (!nearest) return false;

    let jumps = def.baseJumps + (level - 1);
    let jumpRange = def.jumpRange;
    let finalDmg = dmg;
    // Max level transformation: 8 jumps, +30% jump range, +50% damage
    if (this.isMaxLevel(level)) {
      jumps = 8;
      jumpRange *= 1.3;
      finalDmg *= 1.5;
    }
    const hits = [];
    const chainPositions = [{ x: pt.x, y: pt.y }];
    const hitSet = new Set();
    let current = nearest;
    let currentPos = current.components.Transform;
    const enemies = this.world.query('Transform', 'EnemyTag', 'Health');

    for (let i = 0; i < jumps && current; i++) {
      hits.push({ enemy: current, dmg: finalDmg });
      hitSet.add(current.id);
      chainPositions.push({ x: currentPos.x, y: currentPos.y });
      // find next nearest unhit enemy within jumpRange
      let next = null;
      let nextDist = jumpRange;
      for (const e of enemies) {
        if (!e.active || hitSet.has(e.id)) continue;
        const d = MathUtils.distance(currentPos, e.components.Transform);
        if (d < nextDist) {
          nextDist = d;
          next = e;
        }
      }
      current = next;
      if (current) currentPos = current.components.Transform;
    }

    // Spawn lightning visual fx
    const fx = this.world.createEntity();
    this.world.addComponent(fx, 'Transform', { x: pt.x, y: pt.y });
    this.world.addComponent(fx, 'LightningFX', { points: chainPositions, life: 0.25, maxLife: 0.25 });

    if (hits.length > 0) this.onMeleeHit(hits, 'lightning');
    return true;
  }

  _fireBoomerang(pt, dmg, def, level, buffs) {
    const nearest = this._findNearestEnemy(pt, 250 * (buffs.rangeMult || 1));
    if (!nearest) return false;
    const angle = MathUtils.angleBetween(pt, nearest.components.Transform);
    const speed = def.baseSpeed;
    const travelDist = def.travelDist * (buffs.rangeMult || 1);
    let projDmg = dmg;
    let count = 1;
    // Max level transformation: double boomerang, +30% damage
    if (this.isMaxLevel(level)) {
      count = 2;
      projDmg *= 1.3;
    }
    for (let i = 0; i < count; i++) {
      const spreadAngle = angle + (count > 1 ? (i - 0.5) * 0.25 : 0);
      const p = this.world.createEntity();
      this.world.addComponent(p, 'Transform', { x: pt.x, y: pt.y });
      this.world.addComponent(p, 'Velocity', { x: Math.cos(spreadAngle) * speed, y: Math.sin(spreadAngle) * speed });
      this.world.addComponent(p, 'Sprite', { w: 8, h: 8, color: '#88ddff', imageKey: 'boomerang' });
      this.world.addComponent(p, 'ProjectileTag', {});
      this.world.addComponent(p, 'Damage', { value: projDmg });
      this.world.addComponent(p, 'Lifetime', { remaining: 4.0 });
      this.world.addComponent(p, 'HitTracker', { hitSet: new Set(), pierceLeft: 99, ricochetLeft: 0 });
      this.world.addComponent(p, 'Boomerang', { traveled: 0, maxDist: travelDist, returning: false });
    }
    return true;
  }

  _fireIceShard(pt, dmg, def, level, buffs) {
    const nearest = this._findNearestEnemy(pt, 250 * (buffs.rangeMult || 1));
    if (!nearest) return false;
    const angle = MathUtils.angleBetween(pt, nearest.components.Transform);
    const speed = def.baseSpeed;
    let pierceCount = 2 + (level - 1) + (buffs.pierce || 0);
    let slowDuration = def.slowDuration + (level - 1) * def.slowDurationPerLevel;
    let projDmg = dmg;
    let projSize = 6;
    // Max level transformation: freeze (root) on hit, double slow duration, +50% damage
    const isMax = this.isMaxLevel(level);
    if (isMax) {
      pierceCount += 3;
      slowDuration *= 2;
      projDmg *= 1.5;
      projSize = 8;
    }
    const p = this.world.createEntity();
    this.world.addComponent(p, 'Transform', { x: pt.x, y: pt.y });
    this.world.addComponent(p, 'Velocity', { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed });
    this.world.addComponent(p, 'Sprite', { w: projSize, h: projSize, color: '#7fdbff', imageKey: 'icicle' });
    this.world.addComponent(p, 'ProjectileTag', {});
    this.world.addComponent(p, 'Damage', { value: projDmg });
    this.world.addComponent(p, 'Lifetime', { remaining: 2.0 });
    this.world.addComponent(p, 'HitTracker', { hitSet: new Set(), pierceLeft: pierceCount, ricochetLeft: 0 });
    this.world.addComponent(p, 'SlowOnHit', { duration: slowDuration, amount: def.slowAmount });
    if (isMax) this.world.addComponent(p, 'RootOnHit', { duration: 1.0 });
    return true;
  }
}
