let _nextId = 0;

export function createEntity() {
  return {
    id: _nextId++,
    active: true,
    components: {},
  };
}

export function addComponent(entity, name, data) {
  entity.components[name] = data;
}

export function getComponent(entity, name) {
  return entity.components[name];
}

export function hasComponent(entity, name) {
  return name in entity.components;
}

export function removeComponent(entity, name) {
  delete entity.components[name];
}
