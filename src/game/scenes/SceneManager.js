export class SceneManager {
  constructor() {
    this.scenes = new Map();
    this.stack = [];
    this.current = null;
    this.transition = null;
  }

  register(name, scene) {
    this.scenes.set(name, scene);
  }

  push(name, data) {
    const scene = this.scenes.get(name);
    if (!scene) return;
    if (this.current) this.current.onExit?.();
    this.stack.push(name);
    this.current = scene;
    this.current.onEnter?.(data);
  }

  pop() {
    if (this.stack.length <= 1) return;
    this.current.onExit?.();
    this.stack.pop();
    const name = this.stack[this.stack.length - 1];
    this.current = this.scenes.get(name);
    this.current.onResume?.();
  }

  switchTo(name, data) {
    this.current?.onExit?.();
    this.stack = [name];
    this.current = this.scenes.get(name);
    this.current.onEnter?.(data);
  }

  update(dt) {
    if (this.transition) {
      this.transition.update(dt);
      if (this.transition.done) this.transition = null;
      return;
    }
    this.current?.update?.(dt);
  }

  render(alpha) {
    if (this.transition) {
      this.transition.render?.(alpha);
      return;
    }
    // Render full stack: bottom scene first, then overlay scenes on top
    for (const name of this.stack) {
      this.scenes.get(name)?.render?.(alpha);
    }
  }

  getCurrentName() {
    return this.stack[this.stack.length - 1];
  }
}
