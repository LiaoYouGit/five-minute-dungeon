export class SpatialGrid {
  constructor(cellSize = 64) {
    this.cellSize = cellSize;
    this.grid = new Map(); // key: "col,row" -> Set of entities
    this.entityCells = new Map(); // entityId -> Set of cell keys
  }

  clear() {
    this.grid.clear();
    this.entityCells.clear();
  }

  _getCellKey(col, row) {
    return `${col},${row}`;
  }

  _getCellCoords(x, y) {
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    return { col, row, key: this._getCellKey(col, row) };
  }

  insert(entityId, x, y, radius = 0) {
    // 计算实体占据的所有格子
    const minCol = Math.floor((x - radius) / this.cellSize);
    const maxCol = Math.floor((x + radius) / this.cellSize);
    const minRow = Math.floor((y - radius) / this.cellSize);
    const maxRow = Math.floor((y + radius) / this.cellSize);

    const cells = new Set();

    for (let col = minCol; col <= maxCol; col++) {
      for (let row = minRow; row <= maxRow; row++) {
        const key = this._getCellKey(col, row);

        // 添加到格子
        if (!this.grid.has(key)) {
          this.grid.set(key, new Set());
        }
        this.grid.get(key).add(entityId);

        // 记录实体所在的格子
        cells.add(key);
      }
    }

    this.entityCells.set(entityId, cells);
  }

  remove(entityId) {
    const cells = this.entityCells.get(entityId);
    if (!cells) return;

    // 从所有格子中移除实体
    for (const key of cells) {
      const cellSet = this.grid.get(key);
      if (cellSet) {
        cellSet.delete(entityId);
        if (cellSet.size === 0) {
          this.grid.delete(key);
        }
      }
    }

    this.entityCells.delete(entityId);
  }

  // 查询附近的实体（基于位置）
  queryNearby(x, y, radius = 0) {
    const result = new Set();

    const minCol = Math.floor((x - radius) / this.cellSize);
    const maxCol = Math.floor((x + radius) / this.cellSize);
    const minRow = Math.floor((y - radius) / this.cellSize);
    const maxRow = Math.floor((y + radius) / this.cellSize);

    for (let col = minCol; col <= maxCol; col++) {
      for (let row = minRow; row <= maxRow; row++) {
        const key = this._getCellKey(col, row);
        const cellSet = this.grid.get(key);
        if (cellSet) {
          for (const entityId of cellSet) {
            result.add(entityId);
          }
        }
      }
    }

    return Array.from(result);
  }

  // 查询附近的实体（基于实体）
  queryNearbyEntity(entityId, x, y, radius = 0) {
    const result = this.queryNearby(x, y, radius);
    return result.filter((id) => id !== entityId);
  }

  // 获取格子统计信息（调试用）
  getStats() {
    return {
      totalCells: this.grid.size,
      totalEntities: this.entityCells.size,
      avgEntitiesPerCell:
        this.grid.size > 0
          ? Array.from(this.grid.values()).reduce((sum, set) => sum + set.size, 0) / this.grid.size
          : 0,
    };
  }
}