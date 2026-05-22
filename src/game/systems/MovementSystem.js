import { MathUtils } from '../../engine/MathUtils.js';

export class MovementSystem {
  constructor(world, input) {
    this.world = world;
    this.input = input;
    this.bounds = null;
  }

  setBounds(w, h) {
    this.bounds = { w, h };
  }

  update(dt) {
    const players = this.world.query('Transform', 'PlayerTag');
    for (const entity of players) {
      const t = entity.components.Transform;
      const speed = entity.components.PlayerSpeed?.value ?? 120;
      t.x += this.input.direction.x * speed * dt;
      t.y += this.input.direction.y * speed * dt;
      if (this.bounds) {
        const r = entity.components.Collider?.radius ?? 7;
        t.x = MathUtils.clamp(t.x, r, this.bounds.w - r);
        t.y = MathUtils.clamp(t.y, r, this.bounds.h - r);
      }
    }
  }
}
