import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

// Vite emits this asset into each game's build, including nested Pages deployments.
export const JERRY_MODEL_URL = new URL('./Jerry_Game_Rev6.glb', import.meta.url).href;
let assetPromise;
const loadAsset = () => assetPromise ??= new GLTFLoader().loadAsync(JERRY_MODEL_URL)
  .catch(error => { assetPromise = undefined; throw error; });

/** Synchronous game controls; ready resolves once the skinned Blender asset is attached. */
export function createJerry({ height = 3.6 } = {}) {
  const control = () => new THREE.Object3D();
  const rig = {
    group: new THREE.Group(), torso: control(), head: control(), jaw: control(),
    legs: [control(), control()], arms: [control(), control()], tail: control(),
    propeller: control(), eyes: [], velocity: 0, loaded: false, error: null,
    update() {},
  };
  rig.group.name = 'Jerry';
  rig.arms.forEach(arm => { arm.rotation.z = -.5; });
  rig.jaw.rotation.z = -.32;
  rig.ready = loadAsset().then(gltf => {
    // SkeletonUtils keeps each instance's bones independent while sharing immutable assets.
    const model = clone(gltf.scene);
    model.updateMatrixWorld(true);
    const bones = new Map();
    model.traverse(object => {
      if (object.isBone) bones.set(object.name, object);
      if (object.isMesh) {
        object.castShadow = object.receiveShadow = true;
        // The imported rest bounds cannot cover every gameplay pose.
        object.frustumCulled = false;
      }
    });
    // GLTFLoader sanitizes periods in Blender bone names.
    const bone = name => {
      const found = bones.get(name) ?? bones.get(name.replaceAll('.', ''));
      if (!found) throw new Error(`Jerry model is missing bone: ${name}`);
      return found;
    };
    const bindings = [];
    function bind(name, axis, value) {
      const target = bone(name);
      // Express a model-space rotation axis in the bone's rest coordinate system.
      const inverse = target.getWorldQuaternion(new THREE.Quaternion()).invert();
      bindings.push({ target, rest: target.quaternion.clone(),
        axis: axis.clone().applyQuaternion(inverse), value });
    }
    const x = new THREE.Vector3(1, 0, 0), y = new THREE.Vector3(0, 1, 0);
    bind('head', x, () => -rig.head.rotation.z);
    bind('jaw', x, () => -(rig.jaw.rotation.z + .32));
    for (const [i, side] of ['L', 'R'].entries()) {
      bind(`thigh.${side}`, x, () => -rig.legs[i].rotation.z);
      bind(`upper_arm.${side}`, x, () => -(rig.arms[i].rotation.z + .5));
    }
    bind('tail.01', y, () => rig.tail.rotation.y);
    bind('propeller', y, () => rig.propeller.rotation.y);
    const bounds = new THREE.Box3().setFromObject(model, true);
    const scale = height / (bounds.max.y - bounds.min.y);
    // Blender -Y becomes glTF +Z. Both games expect +X forward and soles on Y=0.
    const visual = new THREE.Group();
    visual.rotation.y = Math.PI / 2;
    visual.scale.setScalar(scale);
    model.position.y -= bounds.min.y;
    visual.add(model);
    rig.group.add(visual);
    const delta = new THREE.Quaternion();
    rig.update = () => {
      for (const binding of bindings) {
        delta.setFromAxisAngle(binding.axis, binding.value());
        binding.target.quaternion.copy(binding.rest).multiply(delta);
      }
    };
    rig.update();
    rig.loaded = true;
    return rig;
  }).catch(error => { rig.error = error; throw error; });
  return rig;
}

/** Keep loading and network failure visible instead of starting with an invisible player. */
export function showJerryLoading(rig, parent = document.body) {
  const status = document.createElement('div');
  status.setAttribute('role', 'status');
  status.textContent = 'Loading Jerry…';
  Object.assign(status.style, {
    position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
    zIndex: '10000', padding: '12px 18px', borderRadius: '8px',
    background: '#17221f', color: '#fff', font: '16px sans-serif',
  });
  parent.appendChild(status);
  rig.ready.then(() => status.remove()).catch(error => {
    status.setAttribute('role', 'alert');
    status.textContent = 'Jerry could not load. Reload the page to try again.';
    console.error('Jerry model loading failed:', error);
  });
}
