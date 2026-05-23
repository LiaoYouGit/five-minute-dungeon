export class AssetLoader {
  constructor() {
    this.images = {};
    this.loaded = false;
    this.loadErrors = [];
  }

  loadAll() {
    const defs = {
      // Sprites
      player_front: 'assets/sprites/player_front.png',
      player_left: 'assets/sprites/player_left.png',
      player_right: 'assets/sprites/player_right.png',
      skeleton: 'assets/sprites/skeleton.png',
      slime: 'assets/sprites/slime.png',
      golem: 'assets/sprites/golem.png',
      bat: 'assets/sprites/bat.png',
      assassin: 'assets/sprites/assassin.png',
      skeleton_archer: 'assets/sprites/skeleton_archer.png',
      dark_mage: 'assets/sprites/dark_mage.png',
      bomber: 'assets/sprites/bomber.png',
      swarm_bomber: 'assets/sprites/swarm_bomber.png',
      necromancer: 'assets/sprites/necromancer.png',
      frost_mage: 'assets/sprites/frost_mage.png',
      vine: 'assets/sprites/vine.png',
      shaman: 'assets/sprites/shaman.png',
      vampire: 'assets/sprites/vampire.png',
      ghost_king: 'assets/sprites/ghost_king.png',
      skeleton_minion: 'assets/sprites/skeleton_minion.png',
      // Boss
      boss_phase1: 'assets/boss/boss_phase1.png',
      boss_phase2: 'assets/boss/boss_phase2.png',
      boss_phase3: 'assets/boss/boss_phase3.png',
      mini_boss: 'assets/boss/mini_boss.png',
      abyss_eye: 'assets/boss/boss_phase1.png',
      abyss_giant_eye: 'assets/boss/boss_phase3.png',
      // Tiles
      floor_a: 'assets/tiles/floor_a.png',
      floor_b: 'assets/tiles/floor_b.png',
      floor_c: 'assets/tiles/floor_c.png',
      spawn_floor: 'assets/tiles/spawn_floor.png',
      boss_floor: 'assets/tiles/boss_floor.png',
      // Projectiles
      bullet: 'assets/projectiles/bullet.png',
      bullet_fire: 'assets/projectiles/bullet_fire.png',
      bullet_big: 'assets/projectiles/bullet_big.png',
      spear: 'assets/projectiles/spear.png',
      fireball: 'assets/projectiles/fireball.png',
      boomerang: 'assets/projectiles/boomerang.png',
      icicle: 'assets/projectiles/icicle.png',
      boss_bullet: 'assets/projectiles/boss_bullet.png',
      mini_boss_bullet: 'assets/projectiles/mini_boss_bullet.png',
      enemy_projectile: 'assets/projectiles/enemy_projectile.png',
      enemy_projectile_ice: 'assets/projectiles/enemy_projectile_ice.png',
      frost_mage_projectile: 'assets/projectiles/frost_mage_projectile.png',
      chain_projectile: 'assets/projectiles/boss_bullet.png',
      elite_projectile: 'assets/projectiles/enemy_projectile.png',
      // Pickups
      coin: 'assets/pickups/coin.png',
      health_potion: 'assets/pickups/health_potion.png',
      big_health_potion: 'assets/pickups/big_health_potion.png',
      magnet: 'assets/pickups/magnet.png',
      exp_gem: 'assets/pickups/exp_gem.png',
      exp_gem_special: 'assets/pickups/exp_gem_special.png',
      // Effects
      slash: 'assets/effects/slash.png',
      blast: 'assets/effects/blast.png',
      lightning: 'assets/effects/lightning.png',
      lightning_tail: 'assets/effects/lightning_tail.png',
      spinning_blade: 'assets/effects/spinning_blade.png',
    };

    const entries = Object.entries(defs);

    let remaining = entries.length;
    let failedLoads = [];

    return new Promise((resolve) => {
      for (const [key, src] of entries) {
        const img = new Image();
        img.src = src;
        img.onload = () => {
          this.images[key] = img;
          remaining--;
          if (remaining === 0) {
            this.loaded = true;
            if (failedLoads.length > 0) {
              this.loadErrors = failedLoads;
            }
            resolve();
          }
        };
        img.onerror = () => {
          failedLoads.push(key);
          this.loadErrors.push(key);
          remaining--;
          if (remaining === 0) {
            this.loaded = true;
            resolve();
          }
        };
      }
    });
  }

  get(key) {
    const img = this.images[key];
    if (!img) {
      console.warn('[AssetLoader] ⚠️ Image not found for key:', key);
      return null;
    }
    return img;
  }

  isLoaded() {
    return this.loaded;
  }

  getLoadErrors() {
    return this.loadErrors;
  }
}
