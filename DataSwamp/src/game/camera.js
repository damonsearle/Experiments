import * as THREE from 'three';
import { traceWorld } from './collision.js';

// View rotation belongs to the player, never to Jerry's animated body heading.
export function createShoulderCamera(camera) {
  const anchor = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const ray = new THREE.Ray();
  const contact = new THREE.Vector3();
  let yaw = Math.PI / 2;
  let pitch = -.14;
  let boom = 5;

  function look(dx, dy) {
    yaw = THREE.MathUtils.euclideanModulo(yaw + dx, Math.PI * 2);
    pitch = THREE.MathUtils.clamp(pitch + dy, -.9, .7);
  }

  function moveToWorld(x, y, into) {
    return into.set(Math.cos(yaw) * x + Math.sin(yaw) * y,
      Math.sin(yaw) * x - Math.cos(yaw) * y);
  }

  function update(dt, position, arena = { obstacles: [] }) {
    // Match horizontal motion exactly; soften the jump without adding aim lag.
    anchor.x = position.x;
    anchor.z = position.z;
    anchor.y = THREE.MathUtils.damp(anchor.y, position.y + 2.8, 18, dt);
    forward.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    right.set(Math.cos(yaw), 0, Math.sin(yaw));
    const shoulder = camera.aspect < .8 ? .85 : 1.25;
    desired.copy(anchor).addScaledVector(forward, -5).addScaledVector(right, shoulder);
    ray.origin.copy(anchor);
    ray.direction.copy(desired).sub(anchor).normalize();
    const length = desired.distanceTo(anchor);
    const blocked = traceWorld(ray, arena, [], length, contact, .3);
    const safe = blocked ? Math.max(.05, anchor.distanceTo(contact) - .08) : length;
    // Retract immediately at cover; ease back out after clearing it.
    boom = safe < boom ? safe : THREE.MathUtils.damp(boom, safe, 8, dt);
    camera.position.copy(anchor).addScaledVector(ray.direction, boom);
    camera.lookAt(desired.copy(camera.position).add(forward));
    camera.updateMatrixWorld();
  }

  function reset(position) {
    yaw = Math.PI / 2;
    pitch = -.14;
    anchor.set(position.x, position.y + 2.8, position.z);
    boom = 5;
    update(1, position);
  }

  function resize(width, height) {
    camera.aspect = width / Math.max(height, 1);
    camera.fov = camera.aspect < .8 ? 82 : 65;
    camera.updateProjectionMatrix();
  }

  return { look, moveToWorld, update, reset, resize };
}
