import * as THREE from 'three';

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

const shell = new THREE.BoxGeometry(.42, .05, .42);
const shutter = new THREE.BoxGeometry(.17, .022, .13);
const label = new THREE.BoxGeometry(.26, .02, .16);
const disc = new THREE.CylinderGeometry(.25, .25, .018, 22);
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
  },
  // Flat, mirror-bright, and it flies edge-on so the disc face catches the key.
  cd(group) {
    mount(group, disc, platter);
    mount(group, hub, spool, [0, .012, 0]);
  },
  tape(group) {
    mount(group, caseBody, plastic);
    mount(group, reel, spool, [-.11, .07, 0]);
    mount(group, reel, spool, [.11, .07, 0]);
    mount(group, label, paper, [0, .065, 0]);
  },
  hdd(group) {
    mount(group, driveBody, metal);
    mount(group, driveTop, platter, [0, .075, 0]);
    mount(group, hub, spool, [0, .09, 0]);
  },
};

// Incoming formats are sheets of paper with a coloured header band. They are
// emissive as well as lit, because a shot flying out of the fog at Jerry has to
// be readable before it is close enough for the key light to reach it.
const sheet = new THREE.BoxGeometry(.34, .022, .26);
const band = new THREE.BoxGeometry(.34, .006, .07);

function buildPage(format, group) {
  mount(group, sheet, new THREE.MeshStandardMaterial({
    color: 0xf0ead8,
    roughness: .85,
    emissive: new THREE.Color(format.tint).multiplyScalar(.25),
  }));
  mount(group, band, new THREE.MeshStandardMaterial({
    color: format.tint,
    roughness: .5,
    emissive: new THREE.Color(format.tint).multiplyScalar(.6),
  }), [0, .016, -.088]);
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
    prototypes.set(spec.id, group);
  }
  return prototypes.get(spec.id).clone();
}
