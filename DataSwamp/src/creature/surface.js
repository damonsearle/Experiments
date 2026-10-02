import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';

// Unlike a radial blob, an isosurface can follow the concave neck and bent
// knees of an animal. Geometry is extracted once per species, never per spawn.
export function animalSurface(masses) {
  const low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity];
  for (const { at, size } of masses) for (let axis = 0; axis < 3; axis++) {
    low[axis] = Math.min(low[axis], at[axis] - size[axis] * 1.35);
    high[axis] = Math.max(high[axis], at[axis] + size[axis] * 1.35);
  }
  const extent = high.map((v, i) => v - low[i]);
  const smoothing = Math.min(...extent) * .14;
  // MarchingCubes skips boundary cells to calculate its normals. Leave empty
  // cells around the complete blended surface, including narrow snout tips.
  for (let axis = 0; axis < 3; axis++) {
    low[axis] -= extent[axis] * .18;
    high[axis] += extent[axis] * .18;
  }
  const span = high.map((v, i) => v - low[i]);
  const resolution = 30;
  const field = new MarchingCubes(resolution, undefined, false, false, 24000);
  field.isolation = 0;
  // Short tapered connectors prevent separated ellipsoids becoming floating
  // tail segments. The original masses retain the silhouette and proportions.
  const joints = masses.slice(1).map((b, i) => {
    const a = masses[i];
    const delta = b.at.map((v, axis) => v - a.at[axis]);
    return { a, b, delta, lengthSq: delta.reduce((sum, v) => sum + v * v, 0) };
  });
  for (let z = 0; z < resolution; z++) for (let y = 0; y < resolution; y++) for (let x = 0; x < resolution; x++) {
    const p = [x, y, z].map((v, axis) => low[axis] + v / resolution * span[axis]);
    let distance = Infinity;
    const blend = d => {
      const h = Math.max(smoothing - Math.abs(distance - d), 0) / smoothing;
      distance = Math.min(distance, d) - h * h * smoothing * .25;
    };
    for (const m of masses) {
      const d = Math.hypot(...p.map((v, axis) => (v - m.at[axis]) / m.size[axis]));
      blend((d - 1) * Math.min(...m.size));
    }
    for (const { a, b, delta, lengthSq } of joints) {
      const t = THREE.MathUtils.clamp(p.reduce((sum, v, axis) => sum + (v - a.at[axis]) * delta[axis], 0) / (lengthSq || 1), 0, 1);
      const radius = THREE.MathUtils.lerp(Math.min(...a.size), Math.min(...b.size), t);
      blend(Math.hypot(...p.map((v, axis) => v - a.at[axis] - delta[axis] * t)) - radius);
    }
    field.field[x + y * resolution + z * resolution * resolution] = -distance;
  }
  field.update();
  const count = field.geometry.drawRange.count;
  const geometry = new THREE.BufferGeometry();
  for (const name of ['position', 'normal']) {
    geometry.setAttribute(name, new THREE.Float32BufferAttribute(field.geometry.attributes[name].array.slice(0, count * 3), 3));
  }
  geometry.scale(...span.map(v => v / 2));
  geometry.translate(...span.map((v, i) => low[i] + v / 2));
  const p = geometry.attributes.position;
  const uv = [];
  for (let i = 0; i < p.count; i++) uv.push((p.getX(i) - low[0]) / span[0], Math.atan2(p.getZ(i), p.getY(i)) / (Math.PI * 2) + .5);
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  field.geometry.dispose();
  return geometry;
}
