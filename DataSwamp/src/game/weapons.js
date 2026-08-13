import * as THREE from 'three';

// The storage ladder. Damage climbs with modernity, ammo falls, and handling differs so the
// early tiers keep a niche. Only the floppy is wired up at M1 — the rest are here as the
// design record and get their handling in M3.
export const WEAPONS = [
  { id: 'floppy', name: 'Floppy Disk', damage: 10, cooldown: .17, speed: 27, range: 21, magazine: Infinity, tint: 0x2f3238 },
  { id: 'cd', name: 'CD-ROM', damage: 18, cooldown: .16, speed: 32, range: 24, magazine: 40, tint: 0xc9d6dd },
  { id: 'tape', name: 'Tape Drive', damage: 26, cooldown: .48, speed: 19, range: 20, magazine: 24, tint: 0x4a4038 },
  { id: 'hdd', name: 'Hard Drive', damage: 38, cooldown: .55, speed: 17, range: 18, magazine: 18, tint: 0x8d9299 },
  { id: 'usb', name: 'USB Drive', damage: 50, cooldown: .3, speed: 44, range: 30, magazine: 14, tint: 0x2e6f9e },
  { id: 'ssd', name: 'SSD', damage: 68, cooldown: .34, speed: 62, range: 34, magazine: 10, tint: 0x1f6f5c },
  { id: 'cloud', name: 'Cloud', damage: 90, cooldown: .8, speed: 15, range: 26, magazine: 6, tint: 0xdfe8ef },
];

export const WEAPON_BY_ID = new Map(WEAPONS.map(weapon => [weapon.id, weapon]));

// Shared geometry and materials — a projectile mesh is cloned from a prototype, never rebuilt.
const shell = new THREE.BoxGeometry(.42, .05, .42);
const shutter = new THREE.BoxGeometry(.17, .022, .13);
const label = new THREE.BoxGeometry(.26, .02, .16);

const plastic = new THREE.MeshStandardMaterial({ color: 0x2f3238, roughness: .55 });
const metal = new THREE.MeshStandardMaterial({ color: 0xa9b0b6, roughness: .32, metalness: .75 });
const paper = new THREE.MeshStandardMaterial({ color: 0xd8cfae, roughness: .9 });
const generic = new THREE.MeshStandardMaterial({ color: 0x8d9299, roughness: .45, metalness: .4 });

function buildFloppy() {
  const disk = new THREE.Group();
  const body = new THREE.Mesh(shell, plastic);
  body.castShadow = true;
  disk.add(body);
  const slide = new THREE.Mesh(shutter, metal);
  slide.position.set(.12, .036, 0);
  disk.add(slide);
  const sticker = new THREE.Mesh(label, paper);
  sticker.position.set(-.06, .036, 0);
  disk.add(sticker);
  return disk;
}

// M3 gives the other tiers their own silhouettes; until then they fall back to a plain slug
// rather than throwing, so selecting one can never break a run.
function buildGeneric(weapon) {
  const material = generic.clone();
  material.color = new THREE.Color(weapon.tint);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(.19, .19, .06, 14), material);
  mesh.rotation.x = Math.PI / 2;
  mesh.castShadow = true;
  const holder = new THREE.Group();
  holder.add(mesh);
  return holder;
}

const prototypes = new Map();

export function projectileMesh(weapon) {
  if (!prototypes.has(weapon.id)) {
    prototypes.set(weapon.id, weapon.id === 'floppy' ? buildFloppy() : buildGeneric(weapon));
  }
  return prototypes.get(weapon.id).clone();
}
