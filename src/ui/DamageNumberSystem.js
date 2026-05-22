import { DamageNumber } from './DamageNumber.js';

export class DamageNumberSystem {
  constructor(poolSize = 100) {
    this.numbers = [];
    this.active = [];
  }

  add(x, y, value, opts = {}) {
    const crit = opts.crit || (Math.random() < 0.08);
    const color = crit ? '#ff4444' : opts.color || (value >= 2 ? '#ff6b35' : '#fff');
    this.numbers.push(new DamageNumber(x, y, value, { color, size: opts.size || 10, crit }));
  }

  update(dt) {
    for (let i = this.numbers.length - 1; i >= 0; i--) {
      this.numbers[i].update(dt);
      if (!this.numbers[i].active) {
        this.numbers.splice(i, 1);
      }
    }
  }

  render(ctx) {
    for (const n of this.numbers) {
      n.render(ctx);
    }
  }

  clear() {
    this.numbers = [];
  }
}
