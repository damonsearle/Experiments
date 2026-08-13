import * as THREE from 'three';

import { paint } from './blob.js';

/* ---------------------------------------------------------------- assembling */

function addMesh(parent, geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.rotation.set(...rotation);
  object.scale.set(...scale);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

const UP = new THREE.Vector3(0, 1, 0);

// A capsule stretched between two points — straps, fingers, glasses arms. Every geometry
// gets a colour attribute so it stays valid under the vertex-coloured hide materials.
function strut(parent, material, from, to, radius, segments = 10) {
  const start = new THREE.Vector3(...from);
  const direction = new THREE.Vector3(...to).sub(start);
  const length = direction.length();
  const geometry = new THREE.CapsuleGeometry(radius, Math.max(length - radius * 2, .002), 4, segments);
  const object = addMesh(parent, paint(geometry, () => {}), material);
  object.position.copy(start).addScaledVector(direction, .5);
  object.quaternion.setFromUnitVectors(UP, direction.normalize());
  return object;
}

// A tapered claw pointing along a direction.
function claw(parent, material, from, direction, radius, length) {
  const aim = new THREE.Vector3(...direction).normalize();
  const object = addMesh(parent, paint(new THREE.ConeGeometry(radius, length, 7), () => {}), material);
  object.position.set(...from).addScaledVector(aim, length * .5);
  object.quaternion.setFromUnitVectors(UP, aim);
  return object;
}

// A cap of the eyeball surface, poled towards +x — iris, pupil and catchlight all sit flush.
function eyeCap(radius, spread) {
  const geometry = new THREE.SphereGeometry(radius, 30, 20, 0, Math.PI * 2, 0, spread);
  geometry.rotateZ(-Math.PI / 2);
  return geometry;
}

export { addMesh, strut, claw, eyeCap, UP };
