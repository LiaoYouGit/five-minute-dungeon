export class FlowField {
  constructor(tileMap) {
    this.tileMap = tileMap;
    this.cols = tileMap.cols;
    this.rows = tileMap.rows;
    this.field = new Int8Array(this.cols * this.rows);
    this.field.fill(-1);
    this._playerCol = -1;
    this._playerRow = -1;
  }

  update(playerX, playerY) {
    const ts = this.tileMap.tileSize;
    const col = Math.floor(playerX / ts);
    const row = Math.floor(playerY / ts);
    if (col === this._playerCol && row === this._playerRow) return;
    this._playerCol = col;
    this._playerRow = row;

    this.field.fill(-1);

    // 8 directions: up, right, down, left, up-left, up-right, down-right, down-left
    const DX = [0, 1, 0, -1, -1, 1, 1, -1];
    const DY = [-1, 0, 1, 0, -1, -1, 1, 1];
    // Opposite direction index (flow points BACK toward player)
    const OPP = [2, 3, 0, 1, 6, 7, 4, 5];

    const startIdx = col + row * this.cols;
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
    if (this.tileMap.isWall(col, row)) return;

    const queue = new Int32Array(this.cols * this.rows);
    let head = 0, tail = 0;
    queue[tail++] = startIdx;
    this.field[startIdx] = 8; // 8 = goal marker

    while (head < tail) {
      const idx = queue[head++];
      const cx = idx % this.cols;
      const cy = (idx - cx) / this.cols;

      for (let d = 0; d < 8; d++) {
        const nx = cx + DX[d];
        const ny = cy + DY[d];
        if (nx < 0 || nx >= this.cols || ny < 0 || ny >= this.rows) continue;
        const nIdx = nx + ny * this.cols;
        if (this.field[nIdx] !== -1) continue;
        if (this.tileMap.isWall(nx, ny)) continue;

        // Diagonal: prevent corner cutting
        if (d >= 4) {
          if (this.tileMap.isWall(cx + DX[d], cy) || this.tileMap.isWall(cx, cy + DY[d])) continue;
        }

        this.field[nIdx] = OPP[d];
        queue[tail++] = nIdx;
      }
    }
  }

  getDirection(x, y) {
    const ts = this.tileMap.tileSize;
    const col = Math.floor(x / ts);
    const row = Math.floor(y / ts);
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return null;
    const d = this.field[col + row * this.cols];
    if (d < 0 || d > 7) return null;

    const DX = [0, 1, 0, -1, -1, 1, 1, -1];
    const DY = [-1, 0, 1, 0, -1, -1, 1, 1];
    return { x: DX[d], y: DY[d] };
  }
}
