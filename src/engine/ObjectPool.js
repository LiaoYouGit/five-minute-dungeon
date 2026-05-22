export class ObjectPool {
  constructor(factory, reset, initialSize = 50) {
    this._factory = factory;
    this._reset = reset;
    this.pool = [];
    this.active = new Set();
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  acquire() {
    let obj;
    if (this.pool.length > 0) {
      obj = this.pool.pop();
    } else {
      obj = this._factory();
    }
    obj.active = true;
    this.active.add(obj);
    return obj;
  }

  release(obj) {
    obj.active = false;
    this._reset(obj);
    this.active.delete(obj);
    this.pool.push(obj);
  }

  releaseAll() {
    for (const obj of this.active) {
      obj.active = false;
      this._reset(obj);
      this.pool.push(obj);
    }
    this.active.clear();
  }

  get activeCount() {
    return this.active.size;
  }

  get poolSize() {
    return this.pool.length;
  }
}
