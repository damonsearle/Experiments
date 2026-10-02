import * as THREE from 'three';
import { noise } from '../creature/hide.js';
import { mesh, link, leaf, batchParts } from './geometry.js';

const box = new THREE.BoxGeometry(1, 1, 1);
const rock = new THREE.DodecahedronGeometry(1, 1);
const wood = new THREE.MeshStandardMaterial({ color: 0x82715a, roughness: .94 });
const endgrain = new THREE.MeshStandardMaterial({ color: 0xa4946d, roughness: 1 });
const moss = new THREE.MeshStandardMaterial({ color: 0x52663b, roughness: 1 });
const stone = new THREE.MeshStandardMaterial({ color: 0x737568, roughness: .96, flatShading: true });

export function surfaceMap(kind, seed = 7) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d');
  const random = noise(seed);
  c.fillStyle = kind === 'wood' ? '#9a886a' : '#929481';
  c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2000; i++) {
    c.fillStyle = random() < .5 ? 'rgba(31,26,18,.12)' : 'rgba(231,215,172,.12)';
    const x = random() * 256, y = random() * 256;
    c.fillRect(x, y, kind === 'wood' ? .5 + random() : random() * 3, kind === 'wood' ? 12 + random() * 65 : random() * 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
wood.map = surfaceMap('wood');
wood.bumpMap = wood.map;
wood.bumpScale = .035;
stone.map = surfaceMap('stone');
stone.bumpMap = stone.map;
stone.bumpScale = .08;

export function groundGeometry(radius) {
  const geometry = new THREE.RingGeometry(.01, radius + 6, 144, 28);
  geometry.rotateX(-Math.PI / 2);
  const p = geometry.attributes.position;
  const colors = [];
  const color = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), distance = Math.hypot(x, z);
    const angle = Math.atan2(z, x);
    const edge = radius + 1.3 + Math.sin(angle * 7) * .7 + Math.sin(angle * 13) * .35;
    // The fighting floor stays at y=0. All vertical relief is outside the
    // movement boundary, so feet, aiming and the existing collision agree.
    const fall = THREE.MathUtils.smoothstep(distance, edge, edge + 3.8);
    p.setY(i, -.015 - fall * 1.45);
    const patches = (Math.sin(x * .37 + Math.cos(z * .4)) + Math.sin(z * .51 - x * .17)) * .5;
    color.setRGB(.82 + patches * .1, .85 + patches * .12, .72 + patches * .06);
    color.multiplyScalar(1 - fall * .35);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function buildPlatform(spot, mudMaterial) {
  const group = new THREE.Group();
  group.position.set(spot.x, 0, spot.z);
  const { radius: r, height: h } = spot;
  if (spot.kind === 'board') {
    // Actual circular decking: the chord of each plank follows the collider.
    for (let z = -r + .18; z < r; z += .32) {
      const half = Math.sqrt(Math.max(0, r * r - z * z));
      mesh(group, box, wood, [0, h - .075, z], [half * 2, .15, .30]);
      for (const side of [-1, 1]) mesh(group, box, stone, [side * Math.max(0, half - .14), h + .002, z], [.028, .008, .028]);
    }
    for (const x of [-r * .64, r * .64]) {
      mesh(group, box, wood, [x, h - .25, 0], [.2, .22, r * 1.6]);
      for (const z of [-r * .55, r * .55]) mesh(group, box, wood, [x, (h - .3) / 2, z], [.23, h + .3, .23]);
    }
  } else if (spot.kind === 'stone') {
    mesh(group, rock, stone, [0, h * .43, 0], [r * .94, h * .6, r * .9], [.08, .4, .05]);
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      mesh(group, rock, i % 2 ? moss : stone, [Math.cos(a) * r * .7, .15, Math.sin(a) * r * .7], [r * .35, h * .28, r * .3], [0, a, .15]);
    }
    mesh(group, rock, moss, [-r * .12, h * .93, .1], [r * .66, .07, r * .58]);
  } else {
    const geometry = new THREE.CylinderGeometry(r, r * .94, h + .5, 48, 7);
    const p = geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = (p.getY(i) + (h + .5) / 2) / (h + .5);
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const ripple = 1 + Math.sin(a * 9 + t * 3) * .065 * Math.sin(t * Math.PI);
      p.setX(i, p.getX(i) * ripple); p.setZ(i, p.getZ(i) * ripple);
    }
    geometry.computeVertexNormals();
    mesh(group, geometry, mudMaterial, [0, (h - .5) / 2, 0]);
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      mesh(group, rock, i % 3 ? moss : stone, [Math.cos(a) * r * .98, .05, Math.sin(a) * r * .98], [.3, .15, .24], [0, a, 0]);
    }
    const cap = new THREE.RingGeometry(r * .86, r * .99, 48);
    cap.rotateX(-Math.PI / 2);
    const capPosition = cap.attributes.position;
    for (let i = 0; i < capPosition.count; i++) {
      const a = Math.atan2(capPosition.getZ(i), capPosition.getX(i));
      if (Math.hypot(capPosition.getX(i), capPosition.getZ(i)) < r * .9) {
        const variation = .92 + Math.sin(a * 7) * .07;
        capPosition.setX(i, capPosition.getX(i) * variation);
        capPosition.setZ(i, capPosition.getZ(i) * variation);
      }
    }
    mesh(group, cap, moss, [0, h + .003, 0]);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      const from = [Math.cos(a) * r * .98, h - .04, Math.sin(a) * r * .98];
      const to = [Math.cos(a + .13) * r * 1.01, .08, Math.sin(a + .13) * r * 1.01];
      link(group, wood, from, to, .035);
      mesh(group, rock, stone, [Math.cos(a) * r * .96, h * .35, Math.sin(a) * r * .96], [.21, .16, .15], [0, a, .2]);
    }
  }
  batchParts(group);
  return group;
}

export function dressTerrain(scene, { radius, obstacles, lean }) {
  const random = noise(83);
  const group = new THREE.Group();
  const wet = new THREE.MeshStandardMaterial({ color: 0x536351, roughness: .18, metalness: .25 });
  const silt = new THREE.MeshStandardMaterial({ color: 0x514c37, roughness: .95 });
  const puddle = new THREE.CircleGeometry(1, 32);
  puddle.rotateX(-Math.PI / 2);
  // Flat shallow pools are decoration, not invisible pits in the movement mesh.
  for (let i = 0; i < (lean ? 15 : 25); i++) {
    const a = random() * Math.PI * 2, d = 4 + random() * (radius - 5);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const size = .6 + random() * 1.25;
    if (obstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.radius + size + .5)) continue;
    const geometry = puddle.clone();
    const p = geometry.attributes.position;
    for (let v = 1; v < p.count; v++) {
      const angle = Math.atan2(p.getZ(v), p.getX(v));
      const wobble = 1 + Math.sin(angle * 5) * .14 + Math.cos(angle * 3) * .12;
      p.setX(v, p.getX(v) * wobble); p.setZ(v, p.getZ(v) * wobble);
    }
    mesh(group, geometry, silt, [x, .002, z], [size * 1.08, 1, size * .59]);
    mesh(group, geometry, wet, [x, .006, z], [size, 1, size * .53]);
  }
  const lily = new THREE.CircleGeometry(1, 16, .17, Math.PI * 2 - .34);
  lily.rotateX(-Math.PI / 2);
  for (let i = 0; i < (lean ? 40 : 80); i++) {
    const a = random() * Math.PI * 2, d = radius + 4.6 + random() * 6;
    const size = .18 + random() * .33;
    mesh(group, lily, moss, [Math.cos(a) * d, -.24, Math.sin(a) * d], [size, 1, size * .8], [0, a, 0]);
  }
  // Rooted tree ferns beyond the playable rim establish a layered wetland.
  const frond = leaf(2.6, .22, .55);
  const foliage = new THREE.MeshStandardMaterial({ color: 0x506441, roughness: 1, side: THREE.DoubleSide });
  for (let i = 0; i < (lean ? 13 : 20); i++) {
    const a = i * Math.PI * 2 / (lean ? 13 : 20) + random() * .17;
    const d = radius + 6 + random() * 7;
    const x = Math.cos(a) * d, z = Math.sin(a) * d, h = 3.5 + random() * 3.5;
    const trunk = new THREE.CylinderGeometry(.17, .42, h, 9, 5);
    mesh(group, trunk, wood, [x, h / 2 - .4, z], [1, 1, 1], [0, 0, .06]);
    for (let root = 0; root < 5; root++) {
      const ra = root * Math.PI * 2 / 5;
      link(group, wood, [x, .7, z], [x + Math.cos(ra) * 1.4, -.42, z + Math.sin(ra) * 1.4], .13);
    }
    for (let f = 0; f < 9; f++) mesh(group, frond, foliage, [x - h * .06, h - .5, z], [1, 1, 1], [.16, f * Math.PI * 2 / 9 + a, 0]);
  }
  // Fallen timber stays outside the fighting floor.
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4, d = radius + 2;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const log = new THREE.Group();
    log.position.set(x, -.02, z); log.rotation.y = a;
    mesh(log, new THREE.CylinderGeometry(.26, .32, 3, 10), wood, [0, 0, 0], [1, 1, 1], [0, 0, Math.PI / 2]);
    mesh(log, new THREE.CircleGeometry(.245, 10), endgrain, [1.505, 0, 0], [1, 1, 1], [0, Math.PI / 2, 0]);
    link(log, wood, [0, 0, 0], [.3, .6, .32], .07);
    group.add(log);
  }
  batchParts(group);
  scene.add(group);
}
