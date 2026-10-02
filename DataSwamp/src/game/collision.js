import * as THREE from 'three';

const box = new THREE.Box3();
const point = new THREE.Vector3();
const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

// Match the arena's circular cover footprints, including the top surfaces.
function obstacleDistance(ray, obstacle, padding) {
  const x = ray.origin.x - obstacle.x, z = ray.origin.z - obstacle.z;
  const r = obstacle.radius + padding;
  const a = ray.direction.x ** 2 + ray.direction.z ** 2;
  const b = x * ray.direction.x + z * ray.direction.z;
  const c = x * x + z * z - r * r;
  let near = 0, far = Infinity;
  if (a < 1e-10) { if (c > 0) return null; }
  else {
    const discriminant = b * b - a * c;
    if (discriminant < 0) return null;
    const root = Math.sqrt(discriminant);
    near = Math.max(near, (-b - root) / a);
    far = (-b + root) / a;
  }
  if (Math.abs(ray.direction.y) < 1e-10) {
    if (ray.origin.y < -1 || ray.origin.y > obstacle.height + padding) return null;
  } else {
    const bottom = (-1 - ray.origin.y) / ray.direction.y;
    const top = (obstacle.height + padding - ray.origin.y) / ray.direction.y;
    near = Math.max(near, Math.min(bottom, top));
    far = Math.min(far, Math.max(bottom, top));
  }
  return near <= far ? near : null;
}

// The crosshair and shots use the same body-height hit volumes, including flyers.
export function enemyBounds(enemy, into = new THREE.Box3(), padding = 0) {
  const base = enemy.rig?.group.position.y ?? 0;
  const low = enemy.traits?.fly ? enemy.rig.body.position.y - .5 : 0;
  const high = enemy.traits?.fly ? low + 1.1 : (enemy.traits?.bar ?? 2) * (enemy.rig?.group.scale.y ?? 1);
  const radius = enemy.radius + padding;
  into.min.set(enemy.x - radius, base + low - padding, enemy.z - radius);
  into.max.set(enemy.x + radius, base + high + padding, enemy.z + radius);
  return into;
}

// Return the nearest enemy, 'world', or null; write the contact into `into`.
export function traceWorld(ray, arena, enemies, maxDistance, into, padding = 0, excluded = []) {
  let nearest = maxDistance;
  let result = null;
  const consider = target => {
    const hit = box.containsPoint(ray.origin) ? point.copy(ray.origin) : ray.intersectBox(box, point);
    if (!hit) return;
    const distance = ray.origin.distanceTo(point);
    if (distance > nearest) return;
    nearest = distance;
    into.copy(point);
    result = target;
  };
  for (const obstacle of arena.obstacles) {
    const distance = obstacleDistance(ray, obstacle, padding);
    if (distance !== null && distance <= nearest) {
      nearest = distance; ray.at(distance, into); result = 'world';
    }
  }
  floor.constant = -padding;
  if (ray.intersectPlane(floor, point)) {
    const distance = ray.origin.distanceTo(point);
    if (distance <= nearest) { nearest = distance; into.copy(point); result = 'world'; }
  }
  for (const enemy of enemies) {
    if (!enemy.alive || excluded.includes(enemy)) continue;
    enemyBounds(enemy, box, padding);
    consider(enemy);
  }
  return result;
}
