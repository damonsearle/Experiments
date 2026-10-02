import * as THREE from 'three';

const PITCH = THREE.MathUtils.degToRad(50);
const LOOK_HEIGHT = 1;
const DISTANCE = 22;
const MIN_HALF_WIDTH = 8.5;

// Fixed bearing: screen right is +x and screen up is -z. Correct for the
// ground's foreshortening so diagonal stick aim lines up with its reticle.
export function screenToWorld(x, y, into) {
  const strength = Math.min(1, Math.hypot(x, y));
  return into.set(x, -y / Math.sin(PITCH)).normalize().multiplyScalar(strength);
}

export function createArenaCamera(camera) {
  const anchor = new THREE.Vector3();
  let distance = DISTANCE;

  function place() {
    camera.position.set(anchor.x, LOOK_HEIGHT + Math.sin(PITCH) * distance, anchor.z + Math.cos(PITCH) * distance);
    camera.lookAt(anchor.x, LOOK_HEIGHT, anchor.z);
    // Mouse picking happens after tracking, using this frame's actual view.
    camera.updateMatrixWorld();
  }

  function resize(width, height) {
    camera.aspect = width / Math.max(height, 1);
    // Open the vertical field on portrait screens before moving farther away.
    // This preserves combat width without pushing Jerry deep into the fog.
    camera.fov = Math.min(75, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(Math.PI / 8) / Math.min(1, camera.aspect))));
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    distance = Math.max(DISTANCE, MIN_HALF_WIDTH / (Math.tan(halfFov) * camera.aspect));
    camera.updateProjectionMatrix();
    place();
  }

  function reset(position) {
    anchor.set(position.x, 0, position.z);
    place();
  }

  function update(dt, position) {
    // Track one ground anchor, not two independently lagged camera/aim points.
    // Jump height and character facing never change the view's orientation.
    const follow = 1 - Math.exp(-12 * dt);
    anchor.x += (position.x - anchor.x) * follow;
    anchor.z += (position.z - anchor.z) * follow;
    place();
  }

  return { resize, reset, update };
}
