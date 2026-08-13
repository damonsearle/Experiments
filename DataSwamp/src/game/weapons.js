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

// What the wildlife throws back. The other half of the joke: the bigger the
// dinosaur, the more complicated the format, the more it hurts. These are the
// only saturated things on screen besides the pickups, so they read against the
// swamp's mossy greens no matter how busy the arena gets.
export const FORMATS = [
  { id: 'txt', name: '.TXT', damage: 4, speed: 14, range: 26, tint: 0xe8e2d0, arc: .35 },
  { id: 'csv', name: '.CSV', damage: 8, speed: 16, range: 26, tint: 0xe0912f, arc: .4 },
  { id: 'xls', name: '.XLS', damage: 14, speed: 12, range: 30, tint: 0x46b06e, arc: 1.5 },
];

export const FORMAT_BY_ID = new Map(FORMATS.map(format => [format.id, format]));

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

// Incoming formats are sheets of paper with a coloured header band. They are
// emissive as well as lit, because a shot flying out of the fog at Jerry has to
// be readable before it is close enough for the key light to reach it.
const sheet = new THREE.BoxGeometry(.34, .022, .26);
const band = new THREE.BoxGeometry(.34, .006, .07);

function buildPage(format) {
  const page = new THREE.Group();
  const paperMesh = new THREE.Mesh(sheet, new THREE.MeshStandardMaterial({
    color: 0xf0ead8,
    roughness: .85,
    emissive: new THREE.Color(format.tint).multiplyScalar(.25),
  }));
  paperMesh.castShadow = true;
  page.add(paperMesh);

  const header = new THREE.Mesh(band, new THREE.MeshStandardMaterial({
    color: format.tint,
    roughness: .5,
    emissive: new THREE.Color(format.tint).multiplyScalar(.6),
  }));
  header.position.set(0, .016, -.088);
  page.add(header);
  return page;
}

const prototypes = new Map();
const pageIds = new Set(FORMATS.map(format => format.id));

export function projectileMesh(spec) {
  if (!prototypes.has(spec.id)) {
    let prototype;
    if (pageIds.has(spec.id)) prototype = buildPage(spec);
    else if (spec.id === 'floppy') prototype = buildFloppy();
    else prototype = buildGeneric(spec);
    prototypes.set(spec.id, prototype);
  }
  return prototypes.get(spec.id).clone();
}
