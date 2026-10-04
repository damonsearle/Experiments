import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export const REX_MODEL_URL = `${import.meta.env?.BASE_URL ?? './'}models/tyrannosaurus-rex.glb`;

/** Preserve Blender's local rest transforms when animating in the game's axes. */
export function createRexRig(template, { height = 7.5 } = {}) {
  const model = clone(template);
  const group = new THREE.Group(); group.name = 'Tyrannosaurus'; group.add(model);
  const pivots = {};
  model.traverse(o => {
    if (o.isBone) pivots[o.userData.role ?? o.name] = o;
    if (o.isMesh) { o.castShadow = o.receiveShadow = true; }
  });
  for (const role of ['Body', 'Head', 'Jaw', 'Tail', 'TailTip', 'Leg0', 'Leg1', 'Knee0', 'Knee1', 'ToeContact0', 'ToeContact1', 'HeelContact0', 'HeelContact1']) {
    if (!pivots[role]) throw new Error(`T. rex is missing its ${role} control`);
  }
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model, true);
  const scale = height / (box.max.y - box.min.y);
  const baseY = -box.min.y; model.position.y = baseY; group.scale.setScalar(scale);
  // Refresh each SkinnedMesh bind inverse after scaling its attached skeleton.
  group.updateMatrixWorld(true);
  const delta = new THREE.Quaternion(), axis = new THREE.Vector3(0, 0, 1);
  const binds = {};
  for (const [role, target] of Object.entries(pivots)) {
    const rotation = target.getWorldQuaternion(new THREE.Quaternion());
    binds[role] = { target, rest: target.quaternion.clone(), axis: axis.clone().applyQuaternion(rotation.invert()) };
  }
  function turn(role, angle, yaw = false) {
    const b = binds[role]; if (!b) return;
    // Yaw uses the corresponding local up axis; pitch bends in the side-view plane.
    const turnAxis = yaw ? new THREE.Vector3(0, 1, 0).applyQuaternion(b.target.parent.getWorldQuaternion(new THREE.Quaternion()).invert()).applyQuaternion(b.rest.clone().invert()) : b.axis;
    b.target.quaternion.copy(b.rest).multiply(delta.setFromAxisAngle(turnAxis, angle));
  }
  const contact = new THREE.Vector3();
  const feet = ['ToeContact0', 'ToeContact1', 'HeelContact0', 'HeelContact1'].map(name => pivots[name]);
  return {
    group, pivots,
    update(time, { running = true, roar = 0 } = {}) {
      const gait = time * (running ? 6.4 : 1.3);
      turn('Body', Math.sin(gait * 2) * (running ? .024 : .009));
      turn('Head', Math.sin(gait + .4) * (running ? .028 : .018) + roar * .06);
      turn('Jaw', -(.035 + Math.max(0, Math.sin(time * 1.5)) * .035 + roar * .32));
      for (let i = 0; i < 2; i++) {
        const stride = Math.sin(gait + i * Math.PI);
        turn(`Leg${i}`, running ? stride * .28 : 0);
        turn(`Knee${i}`, running ? Math.max(0, -stride) * .33 : 0);
        turn(`Arm${i}`, Math.sin(gait + i) * (running ? .06 : .018));
      }
      turn('Tail', Math.sin(gait - .7) * .028, true);
      turn('TailTip', Math.sin(gait - 1.5) * .055, true);
      model.position.y = baseY;
      group.updateMatrixWorld(true);
      // Anchor the lowest foot so a weighty gait cannot skate vertically through the floor.
      const lowest = Math.min(...feet.map(foot => foot.getWorldPosition(contact).y));
      model.position.y += (group.position.y - lowest) / scale;
      group.updateMatrixWorld(true);
    },
  };
}
