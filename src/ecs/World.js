import { createEntity, addComponent, getComponent, hasComponent } from './Entity.js';

export class World {
  constructor() {
    this.entities = new Map();
    this._index = new Map();
    this._queryCache = new Map(); // 查询结果缓存
    this._cacheInvalid = true; // 缓存失效标记
  }

  addEntity(entity) {
    this.entities.set(entity.id, entity);
    for (const name of Object.keys(entity.components)) {
      this._addToIndex(name, entity.id);
    }
    this._cacheInvalid = true; // 新增实体，缓存失效
    return entity;
  }

  createEntity() {
    const entity = createEntity();
    this.addEntity(entity);
    return entity;
  }

  addComponent(entity, name, data) {
    addComponent(entity, name, data);
    if (entity.id !== undefined && this.entities.has(entity.id)) {
      this._addToIndex(name, entity.id);
      this._cacheInvalid = true; // 新增组件，缓存失效
    }
  }

  removeEntity(id) {
    const entity = this.entities.get(id);
    if (!entity) return;
    for (const name of Object.keys(entity.components)) {
      this._removeFromIndex(name, id);
    }
    this.entities.delete(id);
    this._cacheInvalid = true; // 删除实体，缓存失效
  }

  query(...componentNames) {
    if (componentNames.length === 0) return [];

    // 检查缓存
    const cacheKey = componentNames.join(',');
    if (!this._cacheInvalid && this._queryCache.has(cacheKey)) {
      // 返回缓存的过滤结果（重新检查active状态）
      const cachedIds = this._queryCache.get(cacheKey);
      const result = [];
      for (const id of cachedIds) {
        const entity = this.entities.get(id);
        if (entity && entity.active) result.push(entity);
      }
      return result;
    }

    // 执行查询
    let candidateIds = this._index.get(componentNames[0]);
    if (!candidateIds) return [];

    for (let i = 1; i < componentNames.length; i++) {
      const nextIds = this._index.get(componentNames[i]);
      if (!nextIds) return [];
      candidateIds = new Set([...candidateIds].filter((id) => nextIds.has(id)));
    }

    const result = [];
    for (const id of candidateIds) {
      const entity = this.entities.get(id);
      if (entity && entity.active) result.push(entity);
    }

    // 缓存查询结果
    this._queryCache.set(cacheKey, Array.from(candidateIds));
    this._cacheInvalid = false;

    return result;
  }

  getEntity(id) {
    return this.entities.get(id);
  }

  forEach(fn) {
    for (const entity of this.entities.values()) {
      if (entity.active) fn(entity);
    }
  }

  clear() {
    this.entities.clear();
    this._index.clear();
    this._queryCache.clear();
    this._cacheInvalid = true;
  }

  get size() {
    return this.entities.size;
  }

  // 清除缓存（手动调用）
  invalidateCache() {
    this._cacheInvalid = true;
    this._queryCache.clear();
  }

  _addToIndex(name, id) {
    if (!this._index.has(name)) this._index.set(name, new Set());
    this._index.get(name).add(id);
  }

  _removeFromIndex(name, id) {
    const set = this._index.get(name);
    if (set) set.delete(id);
  }
}
