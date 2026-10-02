import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { animalSurface } from '../src/creature/surface.js';
import { batchParts, mesh } from '../src/scene/geometry.js';

test('bent anatomy produces a closed surface with intact narrow extremities', () => {
  const geometry = animalSurface([
    { at: [0, 0, 0], size: [.3, .3, .25] },
    { at: [.35, .15, 0], size: [.18, .22, .16] },
    { at: [.5, .5, 0], size: [.1, .18, .1] },
    { at: [.7, .65, 0], size: [.2, .08, .08] },
  ]);
  const positions = geometry.attributes.position;
  assert.ok(positions.count > 0);
  assert.ok([...positions.array].every(Number.isFinite));
  geometry.computeBoundingBox();
  assert.ok(geometry.boundingBox.max.x > .87, 'snout must not be clipped by the voxel boundary');
  assert.ok(geometry.boundingBox.min.x < -.28, 'back must not be clipped');
  const edges = new Map();
  const key = i => [positions.getX(i), positions.getY(i), positions.getZ(i)].map(v => v.toFixed(5)).join(',');
  for (let i = 0; i < positions.count; i += 3) {
    const points = [key(i), key(i + 1), key(i + 2)];
    if (new Set(points).size < 3) continue;
    for (let j = 0; j < 3; j++) {
      const edge = [points[j], points[(j + 1) % 3]].sort().join('|');
      edges.set(edge, (edges.get(edge) || 0) + 1);
    }
  }
  assert.equal([...edges.values()].filter(count => count !== 2).length, 0, 'every surface edge must have two neighbours');
});

test('batching preserves placement and independent animation pivots', () => {
  const group = new THREE.Group();
  const pivot = new THREE.Group();
  pivot.position.set(.4, 1.2, -.3); pivot.rotation.z = .5; group.add(pivot);
  const material = new THREE.MeshStandardMaterial();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  mesh(pivot, geometry, material, [.1, .4, -.3], [.1, .2, .3], [.2, .4, .1]);
  mesh(pivot, geometry, material, [-.4, .2, .1]);
  const before = new THREE.Box3().setFromObject(group, true);
  batchParts(group);
  const after = new THREE.Box3().setFromObject(group, true);
  assert.ok(before.min.distanceTo(after.min) < 1e-6);
  assert.ok(before.max.distanceTo(after.max) < 1e-6);
  assert.equal(group.children[0], pivot);
  assert.equal(pivot.children.length, 1);
  pivot.rotation.z += .5;
  assert.ok(new THREE.Box3().setFromObject(group, true).min.distanceTo(after.min) > .01);
});

test('mirrored wings retain matching triangle winding and lighting normals', () => {
  const group = new THREE.Group();
  mesh(group, new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial(), [0, 0, 0], [-1, 1, 1]);
  batchParts(group);
  const { position, normal } = group.children[0].geometry.attributes;
  const a = new THREE.Vector3().fromBufferAttribute(position, 0);
  const b = new THREE.Vector3().fromBufferAttribute(position, 1).sub(a);
  const c = new THREE.Vector3().fromBufferAttribute(position, 2).sub(a);
  const n = new THREE.Vector3().fromBufferAttribute(normal, 0);
  assert.ok(b.cross(c).normalize().dot(n) > .99);
});
