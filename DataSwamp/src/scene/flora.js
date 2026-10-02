import * as THREE from 'three';
import { noise } from '../creature/hide.js';
import { batchParts, leaf, mesh, link } from './geometry.js';

const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x71834e, roughness: .91, side: THREE.DoubleSide });

function fernGeometry() {
  const plant = new THREE.Group();
  // Curved fronds with paired leaflets keep their silhouette at game distance.
  for (let frond = 0; frond < 7; frond++) {
    const branch = new THREE.Group();
    branch.rotation.y = frond * Math.PI * 2 / 7;
    plant.add(branch);
    const points = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      points.push([0, .08 + Math.sin(t * 2.1) * .48, t * .82]);
      if (i > 0 && i % 2 === 0) link(branch, leafMaterial, points[i - 2], points[i], .009 * (1 - t * .7));
      if (i === 0 || i === 8) continue;
      const width = Math.sin(t * Math.PI) * .23;
      for (const side of [-1, 1]) {
        const y = points[i][1], z = points[i][2];
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, y, z, side * width * .55, y + .045, z + .015, side * width, y + .015, z + .1, side * width * .5, y - .008, z + .065], 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, .5, 0, 1, 1, .5, 1], 2));
        geometry.setIndex([0, 1, 2, 0, 2, 3]);
        geometry.computeVertexNormals();
        mesh(branch, geometry, leafMaterial);
      }
    }
  }
  plant.updateMatrixWorld(true);
  const flat = new THREE.Group();
  plant.traverse(object => {
    if (object.isMesh) mesh(flat, object.geometry.clone().applyMatrix4(object.matrixWorld), leafMaterial);
  });
  batchParts(flat);
  return flat.children[0].geometry;
}

function horsetailGeometry() {
  const plant = new THREE.Group();
  link(plant, leafMaterial, [0, 0, 0], [0, 1.2, 0], .021);
  for (let tier = 1; tier < 7; tier++) for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + tier * .4;
    const reach = .24 * (1 - tier / 9);
    link(plant, leafMaterial, [0, tier * .17, 0], [Math.cos(a) * reach, tier * .17 + .11, Math.sin(a) * reach], .008);
  }
  batchParts(plant);
  return plant.children[0].geometry;
}

function cycadGeometry() {
  const plant = new THREE.Group();
  mesh(plant, new THREE.CylinderGeometry(.11, .18, .55, 9), leafMaterial, [0, .27, 0]);
  const blade = leaf(.95, .065, .2);
  for (let i = 0; i < 11; i++) mesh(plant, blade, leafMaterial, [0, .5, 0], [1, 1, 1], [-.28, i * Math.PI * 2 / 11, 0]);
  batchParts(plant);
  return plant.children[0].geometry;
}

function reedGeometry() {
  const plant = new THREE.Group();
  const blade = leaf(1.5, .045, .13);
  for (let i = 0; i < 5; i++) mesh(plant, blade, leafMaterial, [0, 0, 0], [1, 1, .7 + i * .12], [-1.05 - i * .07, i * 2.4, 0]);
  link(plant, leafMaterial, [0, 0, 0], [.1, 1.65, 0], .018);
  mesh(plant, new THREE.CapsuleGeometry(.048, .22, 3, 6), leafMaterial, [.1, 1.58, 0]);
  batchParts(plant);
  return plant.children[0].geometry;
}

export function createFlora(scene, { radius, obstacles, lean = false }) {
  const random = noise(241);
  const placer = new THREE.Object3D();
  const color = new THREE.Color();
  const planted = [];
  const types = [
    { make: fernGeometry, count: 145, size: .85, inner: .47, outer: 1.04 },
    { make: horsetailGeometry, count: 110, size: .9, inner: .7, outer: 1.1 },
    { make: cycadGeometry, count: 38, size: 1.3, inner: .76, outer: 1.14 },
    { make: reedGeometry, count: 235, size: 1, inner: 1.02, outer: 1.17 },
  ];
  for (const type of types) {
    const count = Math.round(type.count * (lean ? .65 : 1));
    const plants = new THREE.InstancedMesh(type.make(), leafMaterial, count);
    let used = 0;
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2;
      const distance = radius * (type.inner + random() * (type.outer - type.inner));
      const x = Math.cos(angle) * distance, z = Math.sin(angle) * distance;
      if (obstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.radius + 1.1)) continue;
      const size = type.size * (.65 + random() * .65);
      placer.position.set(x, distance > radius + 1 ? -.22 : 0, z);
      placer.rotation.set(0, random() * Math.PI * 2, (random() - .5) * .13);
      placer.scale.set(size, size * (.85 + random() * .3), size);
      placer.updateMatrix();
      plants.setMatrixAt(used, placer.matrix);
      plants.setColorAt(used++, color.setHSL(.19 + random() * .055, .2 + random() * .15, .54 + random() * .2));
    }
    plants.count = used;
    plants.castShadow = plants.receiveShadow = true;
    plants.computeBoundingSphere();
    scene.add(plants);
    planted.push(plants);
  }
  return { planted };
}
