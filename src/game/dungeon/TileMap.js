export const TILE = {
  FLOOR: 0,
  WALL: 1,
  WALL_TOP: 2,
  DOOR: 3,
  DECORATION: 4,
};

export class TileMap {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.tileSize = 16;
    this.data = [];
    for (let r = 0; r < rows; r++) {
      this.data[r] = new Array(cols).fill(TILE.WALL);
    }
  }

  set(x, y, type) {
    if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
      this.data[y][x] = type;
    }
  }

  get(x, y) {
    if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
      return this.data[y][x];
    }
    return TILE.WALL;
  }

  isWall(x, y) {
    const t = this.get(x, y);
    return t === TILE.WALL || t === TILE.WALL_TOP;
  }

  fillRect(rx, ry, rw, rh, type) {
    for (let y = ry; y < ry + rh && y < this.rows; y++) {
      for (let x = rx; x < rx + rw && x < this.cols; x++) {
        this.set(x, y, type);
      }
    }
  }

  get width() { return this.cols * this.tileSize; }
  get height() { return this.rows * this.tileSize; }
}
