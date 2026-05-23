import { TileMap, TILE } from './TileMap.js';

export class DungeonGenerator {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
  }

  generate() {
    const map = new TileMap(this.cols, this.rows);
    const rooms = [];

    const attempts = 300;
    const minSize = 10;
    const maxSize = 22;
    const maxRoomCount = 14;

    for (let i = 0; i < attempts && rooms.length < maxRoomCount; i++) {
      const w = minSize + Math.floor(Math.random() * (maxSize - minSize));
      const h = minSize + Math.floor(Math.random() * (maxSize - minSize));
      const x = 4 + Math.floor(Math.random() * (this.cols - w - 8));
      const y = 4 + Math.floor(Math.random() * (this.rows - h - 8));

      const newRoom = { x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) };

      let overlap = false;
      for (const r of rooms) {
        if (x < r.x + r.w + 4 && x + w + 4 > r.x && y < r.y + r.h + 4 && y + h + 4 > r.y) {
          overlap = true;
          break;
        }
      }
      if (overlap) continue;

      rooms.push(newRoom);
      map.fillRect(x, y, w, h, TILE.FLOOR);
    }

    // Guarantee at least 2 rooms
    if (rooms.length < 2) {
      rooms.length = 0;
      const r1 = { x: 4, y: 4, w: 14, h: 14, cx: 11, cy: 11 };
      const r2 = { x: this.cols - 18, y: this.rows - 18, w: 14, h: 14, cx: this.cols - 11, cy: this.rows - 11 };
      rooms.push(r1, r2);
      for (const r of rooms) map.fillRect(r.x, r.y, r.w, r.h, TILE.FLOOR);
    }

    // connect rooms with corridors
    for (let i = 1; i < rooms.length; i++) {
      const a = rooms[i - 1];
      const b = rooms[i];
      this._carveCorridor(map, a.cx, a.cy, b.cx, b.cy);
    }

    // Mark border walls (adjacent to floor) as WALL_TOP; interior walls stay WALL (won't render)
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (map.get(x, y) !== TILE.WALL) continue;
        let border = false;
        for (let dy = -1; dy <= 1 && !border; dy++) {
          for (let dx = -1; dx <= 1 && !border; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (map.get(x + dx, y + dy) === TILE.FLOOR) border = true;
          }
        }
        if (border) map.set(x, y, TILE.WALL_TOP);
      }
    }

    // first room is spawn
    if (rooms.length > 1) {
      rooms[0].isSpawn = true;
      rooms[rooms.length - 1].isBoss = true;
    } else if (rooms.length === 1) {
      rooms[0].isSpawn = true;
      rooms[0].isBoss = true;
    }

    // Guarantee spawn area is fully clear (10x10 floor around spawn center)
    if (rooms.length > 0) {
      const sr = rooms.find(r => r.isSpawn) || rooms[0];
      const scx = sr.cx;
      const scy = sr.cy;
      for (let dy = -5; dy <= 5; dy++) {
        for (let dx = -5; dx <= 5; dx++) {
          map.set(scx + dx, scy + dy, TILE.FLOOR);
        }
      }
    }

    // Generate enemy spawn points at room edges
    const enemySpawnPoints = this._generateSpawnPoints(map, rooms);

    // Pick 4 supply points from non-spawn, non-boss rooms
    const supplyTypes = ['heal', 'bomb', 'mission', 'miniboss'];
    const candidates = rooms.filter(r => !r.isSpawn && !r.isBoss);
    // Shuffle
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    // Fallback: if not enough rooms, reuse from all rooms
    const pool = candidates.length >= 4 ? candidates : [...candidates, ...rooms.filter(r => !candidates.includes(r))];
    const supplyPoints = [];
    const ts = map.tileSize;
    for (let i = 0; i < 4 && i < pool.length; i++) {
      const room = pool[i];
      supplyPoints.push({
        type: supplyTypes[i],
        cx: room.cx,
        cy: room.cy,
        x: room.cx * ts + ts / 2,
        y: room.cy * ts + ts / 2,
      });
    }

    return { map, rooms, supplyPoints, enemySpawnPoints };
  }

  /** Generate exactly 4 enemy spawn points, one in each corner of non-spawn rooms */
  _generateSpawnPoints(map, rooms) {
    const ts = map.tileSize;
    const spawnPoints = [];

    // Collect all non-spawn rooms
    const eligibleRooms = rooms.filter(r => !r.isSpawn);
    if (eligibleRooms.length === 0) return spawnPoints;

    // Pick 4 different rooms (repeat if not enough rooms)
    const pickedRooms = [];
    for (let i = 0; i < 4; i++) {
      pickedRooms.push(eligibleRooms[i % eligibleRooms.length]);
    }

    for (const room of pickedRooms) {
      // Place spawn point in a random corner of the room
      const corners = [
        { tx: room.x + 2, ty: room.y + 2 },           // top-left
        { tx: room.x + room.w - 3, ty: room.y + 2 },  // top-right
        { tx: room.x + 2, ty: room.y + room.h - 3 },  // bottom-left
        { tx: room.x + room.w - 3, ty: room.y + room.h - 3 }, // bottom-right
      ];
      const corner = corners[Math.floor(Math.random() * corners.length)];
      spawnPoints.push({
        x: corner.tx * ts + ts / 2,
        y: corner.ty * ts + ts / 2,
      });
    }

    return spawnPoints;
  }

  _carveCorridor(map, x1, y1, x2, y2) {
    let x = x1, y = y1;
    if (x === x2 && y === y2) { map.set(x, y, TILE.FLOOR); return; }
    const carveH = (cx, cy) => {
      map.set(cx, cy, TILE.FLOOR);
      for (let d = 1; d <= 2; d++) {
        if (cy - d >= 0) map.set(cx, cy - d, TILE.FLOOR);
        if (cy + d < this.rows) map.set(cx, cy + d, TILE.FLOOR);
      }
    };
    const carveV = (cx, cy) => {
      map.set(cx, cy, TILE.FLOOR);
      for (let d = 1; d <= 2; d++) {
        if (cx - d >= 0) map.set(cx - d, cy, TILE.FLOOR);
        if (cx + d < this.cols) map.set(cx + d, cy, TILE.FLOOR);
      }
    };
    if (Math.random() < 0.5) {
      while (x !== x2) { carveH(x, y); x += x < x2 ? 1 : -1; }
      while (y !== y2) { carveV(x, y); y += y < y2 ? 1 : -1; }
    } else {
      while (y !== y2) { carveV(x, y); y += y < y2 ? 1 : -1; }
      while (x !== x2) { carveH(x, y); x += x < x2 ? 1 : -1; }
    }
    // Clear destination
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x2 + dx, ny = y2 + dy;
        if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows) map.set(nx, ny, TILE.FLOOR);
      }
    }
  }
}
