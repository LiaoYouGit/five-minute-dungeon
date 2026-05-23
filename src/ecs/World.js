import { createEntity, addComponent, getComponent, hasComponent } from './Entity.js';

export class World {
  constructor() {
    this.entities = new Map();
    this._index = new Map();
  }

  addEntity(entity) {
    this.entities.set(entity.id, entity);
    for (const name of Object.keys(entity.components)) {
      this._addToIndex(name, entity.id);
    }
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
    }
  }

  removeEntity(id) {
    const entity = this.entities.get(id);
    if (!entity) return;

    for (const name of Object.keys(entity.components)) {
      this._removeFromIndex(name, id);
    }
    this.entities.delete(id);
  }

  query(...componentNames) {
    if (componentNames.length === 0) return [];

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
  }

  get size() {
    return this.entities.size;
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
