import { Box3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createDinoKit } from './dinos.js';

export const ENEMY_IDS = ['compy', 'dilo', 'stego', 'ptero', 'trike', 'anky', 'rex'];

/** Bind the exported Blender pivot metadata to the existing gameplay rig. */
export function instantiateEnemy(template, id) {
  const group = template.clone(true);
  const pivots = new Map();
  const materials = new Map();
  group.traverse(object => {
    if (object.userData.role) pivots.set(object.userData.role, object);
    if (!object.isMesh) return;
    object.castShadow = object.receiveShadow = true;
    const copy = material => {
      if (!materials.has(material)) materials.set(material, material.clone());
      return materials.get(material);
    };
    object.material = Array.isArray(object.material)
      ? object.material.map(copy) : copy(object.material);
  });
  const required = role => {
    const pivot = pivots.get(role);
    if (!pivot) throw new Error(`${id}: missing Blender pivot ${role}`);
    return pivot;
  };
  const head = required('Head');
  if (!Array.isArray(head.userData.muzzle) || head.userData.muzzle.length !== 3) {
    throw new Error(`${id}: missing mouth attachment`);
  }
  const legCount = ['stego', 'trike', 'anky'].includes(id) ? 4 : 2;
  // Root scale belongs on group so health-bar heights and body motion use game units.
  const root = group.children.find(object => object.userData.species === id);
  if (!root) throw new Error(`${id}: missing species root`);
  group.scale.copy(root.scale);
  root.scale.setScalar(1);
  return {
    group, body: required('Body'), head, tail: required('Tail'),
    barHeight: new Box3().setFromObject(group).max.y + .22,
    legs: Array.from({ length: legCount }, (_, i) => required(`Leg${i}`)),
    muzzle: [...head.userData.muzzle],
    skins: [...materials.values()].filter(material => material.emissive),
    dispose() { for (const material of materials.values()) material.dispose(); },
  };
}

export function createBlenderDinoKit({ base = import.meta.env.BASE_URL, loader = new GLTFLoader() } = {}) {
  const templates = new Map();
  const failed = new Set();
  let fallback;
  const kit = { loaded: false, failed };
  for (const id of ENEMY_IDS) {
    kit[id] = { id, spawn() {
      if (templates.has(id)) return instantiateEnemy(templates.get(id), id);
      if (!failed.has(id)) throw new Error(`Enemy assets still loading: ${id}`);
      fallback ??= createDinoKit();
      return fallback[id].spawn();
    } };
  }
  kit.ready = Promise.all(ENEMY_IDS.map(async id => {
    try {
      const gltf = await loader.loadAsync(`${base}models/enemies/${id}.glb`);
      // Validate once at load time; a malformed asset falls back before the game starts.
      const rig = instantiateEnemy(gltf.scene, id);
      rig.dispose();
      templates.set(id, gltf.scene);
    } catch (error) {
      failed.add(id);
      console.warn(`Could not load Blender enemy ${id}; using procedural model.`, error);
    }
  })).then(() => { kit.loaded = true; });
  kit.prewarm = ids => {
    const missing = ids.filter(id => failed.has(id));
    if (missing.length) {
      fallback ??= createDinoKit();
      fallback.prewarm(missing);
    }
  };
  return kit;
}
