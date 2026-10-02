import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Bake decorative parts into one draw call per material, while retaining the
// groups used as animation pivots. Run only when building a cached prototype.
export function batchParts(group) {
  for (const child of [...group.children]) if (child.isGroup) batchParts(child);
  const batches = new Map();
  for (const child of [...group.children]) {
    if (!child.isMesh || child.isInstancedMesh || Array.isArray(child.material)) continue;
    child.updateMatrix();
    const geometry = child.geometry.clone().applyMatrix4(child.matrix);
    // Mirrored wings need reversed winding after their transform is baked;
    // the renderer can no longer infer it from a negative object scale.
    if (child.matrix.determinant() < 0) {
      if (geometry.index) {
        const indices = geometry.index.array;
        for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
      } else {
        for (const attribute of Object.values(geometry.attributes)) {
          const { array, itemSize } = attribute;
          for (let i = 0; i < attribute.count; i += 3) for (let c = 0; c < itemSize; c++) {
            const a = (i + 1) * itemSize + c, b = (i + 2) * itemSize + c;
            [array[a], array[b]] = [array[b], array[a]];
          }
        }
      }
    }
    // Decorative geometry doesn't use vertex colours; hide geometry does.
    if (!child.material.vertexColors) geometry.deleteAttribute('color');
    const key = child.material;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(geometry.index ? geometry.toNonIndexed() : geometry);
    if (geometry.index) geometry.dispose();
    group.remove(child);
  }
  for (const [material, parts] of batches) {
    const geometry = mergeGeometries(parts);
    for (const part of parts) part.dispose();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
}

export function mesh(parent, geometry, material, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.scale.set(...scale);
  object.rotation.set(...rotation);
  object.castShadow = object.receiveShadow = true;
  parent.add(object);
  return object;
}

// Ends are buried in joints; open pentagonal rods are enough for tiny stems.
const rod = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
const up = new THREE.Vector3(0, 1, 0);
export function link(parent, material, from, to, radius) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to).sub(a);
  const object = mesh(parent, rod, material);
  object.position.copy(a).addScaledVector(b, .5);
  object.scale.set(radius, b.length(), radius);
  object.quaternion.setFromUnitVectors(up, b.normalize());
  return object;
}

// A tapered leaf with a raised midrib, useful for both ferns and reed blades.
export function leaf(length, width, arch = .2) {
  const vertices = [], indices = [], uvs = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const w = Math.sin(Math.PI * t) * width;
    const y = Math.sin(t * Math.PI) * arch;
    vertices.push(-w, y, t * length, 0, y + w * .2, t * length, w, y, t * length);
    uvs.push(0, t, .5, t, 1, t);
    if (i < 8) for (let side = 0; side < 2; side++) {
      const a = i * 3 + side;
      indices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
