import * as THREE from 'three';
import { batchParts } from '../scene/geometry.js';

/* --------------------------------------------------------------------------
   The storage ladder. Damage climbs with modernity, ammo falls, and each tier
   handles differently so the older ones keep a niche.

   Strictly ascending damage would normally make the low tiers dead weight.
   Three things stop that, and all three live in this table: scarcity (you
   cannot hold enough of a high tier to clear a fight), handling (the tape's
   slow field and the drive's shrapnel solve problems raw damage does not), and
   the floppy being infinite so there is always a floor to fall back to.

   M3 ships the first four. Tiers 5-7 keep their stats here as the design record
   and get their handling at M5.
   -------------------------------------------------------------------------- */

export const WEAPONS = [
  {
    id: 'floppy', name: 'Floppy Disk', tier: 1,
    damage: 10, cooldown: .17, speed: 27, range: 21, magazine: Infinity,
    tint: 0x2f3238, arc: .45,
  },
  {
    id: 'cd', name: 'CD-ROM', tier: 2,
    damage: 18, cooldown: .16, speed: 32, range: 24, magazine: 40,
    tint: 0xc9d6dd, arc: .3,
    // Skips off its first target to a second one. Rewards firing into a pack.
    ricochet: 1, ricochetReach: 9,
  },
  {
    id: 'tape', name: 'Tape Drive', tier: 3,
    damage: 26, cooldown: .48, speed: 19, range: 20, magazine: 24,
    tint: 0x4a4038, arc: .35,
    // Punches through a line of them and unspools as it goes; the spilt tape
    // is what makes this tier worth carrying past the point its damage is beaten.
    pierce: 3,
    trail: { every: 1.4, radius: 1.15, life: 5, slow: .45 },
  },
  {
    id: 'hdd', name: 'Hard Drive', tier: 4,
    damage: 38, cooldown: .55, speed: 17, range: 18, magazine: 18,
    tint: 0x8d9299, arc: 1.9,
    // Lobbed, and the platter comes apart on landing. The blast is what lets it
    // answer a swarm that a bigger single hit cannot.
    blast: { radius: 2.5, damage: 16 },
  },
  {
    id: 'usb', name: 'USB Drive', tier: 5,
    damage: 50, cooldown: .3, speed: 44, range: 30, magazine: 14,
    tint: 0x2e6f9e, arc: .08,
    // Flat and fast. No arc worth the name, which is the point — this is the
    // tier you reach for when something is charging and you need it dead now.
  },
  {
    id: 'ssd', name: 'SSD', tier: 6,
    damage: 68, cooldown: .34, speed: 62, range: 34, magazine: 10,
    tint: 0x1f6f5c, arc: .04,
    pierce: 2,
  },
  {
    id: 'cloud', name: 'Cloud', tier: 7,
    damage: 90, cooldown: .8, speed: 15, range: 26, magazine: 6,
    tint: 0xdfe8ef, arc: 1.1,
    // Slow, homing, and it rains on everything nearby when it arrives. The only
    // tier that will find a target you did not aim at.
    homing: 5.5, homingReach: 12,
    blast: { radius: 4, damage: 30 },
  },
];

// The full ladder is armed from M5. Tiers 5-7 are rare enough that the floppy is
// still doing most of the work.
export const ARSENAL = WEAPONS;

export const WEAPON_BY_ID = new Map(WEAPONS.map(weapon => [weapon.id, weapon]));

// What the wildlife throws back. The other half of the joke: the bigger the
// dinosaur, the more complicated the format, the more it hurts. These are the
// only saturated things on screen besides the pickups, so they read against the
// swamp's mossy greens no matter how busy the arena gets.
export const FORMATS = [
  { id: 'txt', name: '.TXT', damage: 4, speed: 14, range: 26, tint: 0xe8e2d0, arc: .35 },
  { id: 'csv', name: '.CSV', damage: 8, speed: 16, range: 26, tint: 0xe0912f, arc: .4 },
  { id: 'xls', name: '.XLS', damage: 14, speed: 12, range: 30, tint: 0x46b06e, arc: 1.5 },
  // Dropped from above, so `fromAbove` opts it out of the jump dodge. The
  // Pteranodon punishes standing still instead of punishing being on the ground.
  { id: 'pdf', name: '.PDF', damage: 18, speed: 15, range: 28, tint: 0xd0453a, arc: .5, fromAbove: true },
  { id: 'zip', name: '.ZIP', damage: 26, speed: 18, range: 26, tint: 0xc9a227, arc: .6 },
  { id: 'iso', name: '.ISO', damage: 34, speed: 10, range: 30, tint: 0x8f7fd0, arc: .8 },
  { id: 'sql', name: '.SQL', damage: 50, speed: 13, range: 32, tint: 0x3fa9c9, arc: .7 },
];

export const FORMAT_BY_ID = new Map(FORMATS.map(format => [format.id, format]));

/* ------------------------------------------------------------- shared stock */

// Geometry and materials are module-level and shared. A projectile mesh is
// cloned from a prototype built on first use; nothing here allocates per shot.
const plastic = new THREE.MeshStandardMaterial({ color: 0x2f3238, roughness: .55 });
const metal = new THREE.MeshStandardMaterial({ color: 0xa9b0b6, roughness: .32, metalness: .75 });
const paper = new THREE.MeshStandardMaterial({ color: 0xd8cfae, roughness: .9 });
const platter = new THREE.MeshStandardMaterial({ color: 0xd6dde2, roughness: .12, metalness: .95 });
const spool = new THREE.MeshStandardMaterial({ color: 0x1d1a16, roughness: .7 });
const gold = new THREE.MeshStandardMaterial({ color: 0xc5a65b, metalness: .65, roughness: .35 });
const pcb = new THREE.MeshStandardMaterial({ color: 0x376554, roughness: .65, metalness: .15 });
const blue = new THREE.MeshStandardMaterial({ color: 0x376784, roughness: .42 });
const cloudSkin = new THREE.MeshStandardMaterial({ color: 0xdbe5de, roughness: .96, emissive: 0x334b50, emissiveIntensity: .3 });
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const puff = new THREE.SphereGeometry(1, 14, 10);
const discRing = new THREE.RingGeometry(.035, .25, 32);
discRing.rotateX(-Math.PI / 2);
const discColors = [];
const discColor = new THREE.Color();
for (let i = 0; i < discRing.attributes.position.count; i++) {
  const p = discRing.attributes.position;
  discColor.setHSL((Math.atan2(p.getZ(i), p.getX(i)) / (Math.PI * 2) + 1) % 1, .25, .75);
  discColors.push(discColor.r, discColor.g, discColor.b);
}
discRing.setAttribute('color', new THREE.Float32BufferAttribute(discColors, 3));
const discSkin = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .24, metalness: .4, side: THREE.DoubleSide });
const groove = new THREE.TorusGeometry(.19, .002, 4, 32);
groove.rotateX(Math.PI / 2);

function block(group, material, position, scale) {
  const object = mount(group, unitBox, material, position);
  object.scale.set(...scale);
  return object;
}

const shell = new THREE.BoxGeometry(.42, .05, .42);
const shutter = new THREE.BoxGeometry(.17, .022, .13);
const label = new THREE.BoxGeometry(.26, .02, .16);
const hub = new THREE.CylinderGeometry(.07, .07, .026, 14);
const caseBody = new THREE.BoxGeometry(.46, .12, .30);
const reel = new THREE.CylinderGeometry(.09, .09, .13, 14);
const driveBody = new THREE.BoxGeometry(.40, .13, .30);
const driveTop = new THREE.CylinderGeometry(.11, .11, .02, 16);

function mount(group, geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

const BUILD = {
  floppy(group) {
    mount(group, shell, plastic);
    mount(group, shutter, metal, [.12, .036, 0]);
    mount(group, label, paper, [-.06, .036, 0]);
    for (let i = 0; i < 3; i++) block(group, blue, [-.06, .047, -.045 + i * .035], [.18, .003, .006]);
    block(group, spool, [.12, .05, .01], [.035, .006, .07]);
    for (const z of [-.16, .16]) block(group, spool, [-.17, .029, z], [.024, .004, .028]);
  },
  // Flat, mirror-bright, and it flies edge-on so the disc face catches the key.
  cd(group) {
    mount(group, discRing, discSkin);
    mount(group, groove, metal, [0, .003, 0]);
    const ring = mount(group, groove, blue, [0, .004, 0]); ring.scale.setScalar(.62);
  },
  tape(group) {
    mount(group, caseBody, plastic);
    for (const x of [-.11, .11]) {
      mount(group, reel, spool, [x, .015, 0]);
      const centre = mount(group, hub, paper, [x, .087, 0]); centre.scale.set(.6, .4, .6);
      for (let i = 0; i < 3; i++) block(group, spool, [x + Math.cos(i * 2.094) * .023, .094, Math.sin(i * 2.094) * .023], [.014, .003, .014]);
    }
    block(group, paper, [0, .066, -.115], [.34, .006, .04]);
    block(group, metal, [0, .005, .151], [.15, .035, .008]);
  },
  hdd(group) {
    mount(group, driveBody, metal);
    block(group, spool, [0, .067, 0], [.36, .008, .26]);
    const disk = mount(group, driveTop, platter, [-.035, .079, 0]); disk.scale.setScalar(1.08);
    const centre = mount(group, hub, metal, [-.035, .095, 0]); centre.scale.set(.43, .5, .43);
    const arm = block(group, metal, [.08, .103, .04], [.17, .016, .026]); arm.rotation.y = -.6;
    for (const x of [-.175, .175]) for (const z of [-.125, .125]) block(group, spool, [x, .072, z], [.02, .008, .02]);
  },
  usb(group) {
    block(group, blue, [-.045, 0, 0], [.32, .10, .16]);
    block(group, metal, [.18, 0, 0], [.14, .075, .135]);
    block(group, spool, [.252, .003, 0], [.003, .047, .10]);
    for (const z of [-.035, .035]) block(group, spool, [.18, .04, z], [.038, .003, .02]);
    block(group, paper, [-.045, .052, 0], [.16, .003, .018]);
  },
  ssd(group) {
    block(group, pcb, [0, 0, 0], [.48, .025, .20]);
    for (const x of [-.15, -.015, .12]) {
      block(group, plastic, [x, .029, 0], [.095, .035, .13]);
      for (const z of [-.078, .078]) block(group, metal, [x, .02, z], [.085, .009, .013]);
    }
    for (let i = 0; i < 7; i++) block(group, gold, [.232, .015, -.077 + i * .024], [.04, .007, .015]);
    block(group, paper, [-.15, .048, 0], [.07, .003, .065]);
  },
  cloud(group) {
    for (const [x, y, z, size] of [[-.18, 0, 0, .17], [0, .08, 0, .22], [.2, .02, 0, .16], [0, -.025, .1, .16], [0, -.025, -.1, .16]]) {
      const ball = mount(group, puff, cloudSkin, [x, y, z]); ball.scale.setScalar(size);
    }
  },
};

// Incoming formats are sheets of paper with a coloured header band. They are
// emissive as well as lit, because a shot flying out of the fog at Jerry has to
// be readable before it is close enough for the key light to reach it.
const sheet = new THREE.BoxGeometry(.34, .022, .26);

function buildPage(format, group) {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const c = canvas.getContext('2d');
  const tint = '#' + new THREE.Color(format.tint).getHexString();
  c.fillStyle = '#e8e1cc'; c.fillRect(0, 0, 128, 128);
  c.fillStyle = tint; c.fillRect(0, 0, 128, 37);
  c.fillStyle = '#17261e'; c.font = 'bold 26px monospace'; c.fillText(format.name, 9, 28);
  c.fillStyle = '#737c6d';
  if (format.id === 'xls' || format.id === 'csv') {
    for (let x = 12; x < 120; x += 25) c.fillRect(x, 49, 2, 65);
    for (let y = 49; y < 120; y += 16) c.fillRect(12, y, 101, 2);
  } else if (format.id === 'zip') {
    for (let y = 46; y < 119; y += 10) c.fillRect(y % 20 ? 58 : 66, y, 9, 7);
  } else if (format.id === 'iso') {
    c.beginPath(); c.arc(64, 80, 29, 0, Math.PI * 2); c.strokeStyle = tint; c.lineWidth = 9; c.stroke();
    c.beginPath(); c.arc(64, 80, 6, 0, Math.PI * 2); c.stroke();
  } else {
    for (let y = 51; y < 117; y += 13) c.fillRect(13, y, y % 3 ? 94 : 64, 4);
  }
  c.fillStyle = '#fff5df'; c.beginPath(); c.moveTo(104, 128); c.lineTo(104, 104); c.lineTo(128, 104); c.fill();
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  mount(group, sheet, new THREE.MeshStandardMaterial({
    map,
    color: 0xffffff,
    roughness: .85,
    emissive: new THREE.Color(format.tint).multiplyScalar(.25),
  }));
}

// Tiers without a silhouette yet fall back to a tinted slug rather than
// throwing, so selecting one can never break a run.
function buildGeneric(spec, group) {
  const material = metal.clone();
  material.color = new THREE.Color(spec.tint);
  mount(group, new THREE.CylinderGeometry(.19, .19, .06, 14), material);
}

const prototypes = new Map();
const pageIds = new Set(FORMATS.map(format => format.id));

export function projectileMesh(spec) {
  if (!prototypes.has(spec.id)) {
    const group = new THREE.Group();
    if (pageIds.has(spec.id)) buildPage(spec, group);
    else if (BUILD[spec.id]) BUILD[spec.id](group);
    else buildGeneric(spec, group);
    batchParts(group);
    prototypes.set(spec.id, group);
  }
  return prototypes.get(spec.id).clone();
}
