import { MathUtils } from './MathUtils.js';

export class CollisionSystem {
  constructor(cellSize = 64) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  clear() {
    this.grid.clear();
  }

  _key(cx, cy) {
    return `${cx},${cy}`;
  }

  insert(entity) {
    const t = entity.components.Transform;
    const r = entity.components.Collider?.radius ?? 8;
    const minCX = Math.floor((t.x - r) / this.cellSize);
    const maxCX = Math.floor((t.x + r) / this.cellSize);
    const minCY = Math.floor((t.y - r) / this.cellSize);
    const maxCY = Math.floor((t.y + r) / this.cellSize);
    for (let cy = minCY; cy <= maxCY; cy++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        const key = this._key(cx, cy);
        if (!this.grid.has(key)) this.grid.set(key, []);
        this.grid.get(key).push(entity);
      }
    }
  }

  query(x, y, radius) {
    const minCX = Math.floor((x - radius) / this.cellSize);
    const maxCX = Math.floor((x + radius) / this.cellSize);
    const minCY = Math.floor((y - radius) / this.cellSize);
    const maxCY = Math.floor((y + radius) / this.cellSize);
    const result = new Set();
    for (let cy = minCY; cy <= maxCY; cy++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        const cell = this.grid.get(this._key(cx, cy));
        if (cell) {
          for (const e of cell) result.add(e);
        }
      }
    }
    return result;
  }

  build(entities) {
    this.clear();
    for (const e of entities) {
      if (e.active && e.components.Transform) {
        this.insert(e);
      }
    }
  }

  resolveWalls(entity, tileMap, oldX, oldY) {
    const t = entity.components.Transform;
    const r = entity.components.Collider?.radius ?? 8;
    const ts = tileMap.tileSize;
    const hasOld = oldX !== undefined && oldY !== undefined;
    const e = 0.01; // shrink collision box slightly to prevent edge jitter

    const collides = (x, y) => {
      const l = Math.floor((x - r + e) / ts);
      const ri = Math.floor((x + r - e) / ts);
      const t2 = Math.floor((y - r + e) / ts);
      const b = Math.floor((y + r - e) / ts);
      return tileMap.isWall(l, t2) || tileMap.isWall(ri, t2) ||
             tileMap.isWall(l, b) || tileMap.isWall(ri, b);
    };

    if (hasOld) {
      // Only resolve if the new position actually collides
      if (!collides(t.x, t.y)) return;
      // Resolve each axis independently: try X first, then Y
      if (collides(t.x, oldY)) {
        t.x = oldX;
      }
      if (collides(t.x, t.y)) {
        t.y = oldY;
      }
      return;
    }

    // Fallback (no old position): push out of walls
    if (!collides(t.x, t.y)) return;

    const left = Math.floor((t.x - r) / ts);
    const right = Math.floor((t.x + r) / ts);
    const top = Math.floor((t.y - r) / ts);
    const bottom = Math.floor((t.y + r) / ts);

    let hitLeft = tileMap.isWall(left, top) || tileMap.isWall(left, bottom);
    let hitRight = tileMap.isWall(right, top) || tileMap.isWall(right, bottom);
    if (hitLeft) t.x = (left + 1) * ts + r;
    else if (hitRight) t.x = right * ts - r;

    const left2 = Math.floor((t.x - r) / ts);
    const right2 = Math.floor((t.x + r) / ts);
    let hitTop = tileMap.isWall(left2, top) || tileMap.isWall(right2, top);
    let hitBottom = tileMap.isWall(left2, bottom) || tileMap.isWall(right2, bottom);
    if (hitTop) t.y = (top + 1) * ts + r;
    else if (hitBottom) t.y = bottom * ts - r;

    // Safety: if still stuck, teleport to nearest floor
    if (collides(t.x, t.y)) {
      const cx = Math.floor(t.x / ts);
      const cy = Math.floor(t.y / ts);
      for (let dist = 1; dist <= 5; dist++) {
        let found = false;
        for (let dy = -dist; dy <= dist && !found; dy++) {
          for (let dx = -dist; dx <= dist && !found; dx++) {
            if (!tileMap.isWall(cx + dx, cy + dy)) {
              t.x = (cx + dx) * ts + ts / 2;
              t.y = (cy + dy) * ts + ts / 2;
              found = true;
            }
          }
        }
        if (found) break;
      }
    }
  }
}
