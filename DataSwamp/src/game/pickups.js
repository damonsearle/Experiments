import * as THREE from 'three';

import { WEAPON_BY_ID, projectileMesh } from './weapons.js';

/* --------------------------------------------------------------------------
   Ammo caches and coffee. Both float and turn slowly above the mud inside a
   tinted beacon, on a respawn timer, so the arena always has somewhere worth
   running to and the fight has a reason to move around the cover.

   Health is coffee, which is the one bit of the reference art that survived
   into the mechanics: the mug reads "I DON'T NEED BACKUPS, I HAVE LUCK".
   -------------------------------------------------------------------------- */

const HEALTH_TINT = 0xd2a63f;
const REACH = 1.5;

// Where the caches sit. Deliberately out towards the cover rather than in the
// middle, so restocking costs Jerry the safest ground on the map.
export const CACHES = [
  { x: 11, z: -4, weapon: 'cd', respawn: 14 },
  { x: -12, z: 5, weapon: 'tape', respawn: 20 },
  { x: 3, z: 14, weapon: 'hdd', respawn: 26 },
  { x: -5, z: -15, weapon: 'cd', respawn: 14 },
  { x: 15, z: 10, kind: 'health', respawn: 24 },
  { x: -15, z: -8, kind: 'health', respawn: 24 },
];

const HEALTH_AMOUNT = 30;

const beaconGeometry = new THREE.CylinderGeometry(.44, .5, 1.5, 14, 1, true);
const ringGeometry = new THREE.RingGeometry(.5, .62, 22);
const mugBody = new THREE.CylinderGeometry(.17, .14, .26, 16);
const mugHandle = new THREE.TorusGeometry(.09, .028, 8, 14);
const mugBrew = new THREE.CylinderGeometry(.145, .145, .02, 16);

const mugCeramic = new THREE.MeshStandardMaterial({ color: 0xe8e0cb, roughness: .5 });
const mugCoffee = new THREE.MeshStandardMaterial({ color: 0x35200f, roughness: .3 });

function buildMug() {
  const mug = new THREE.Group();
  const body = new THREE.Mesh(mugBody, mugCeramic);
  body.castShadow = true;
  mug.add(body);
  const handle = new THREE.Mesh(mugHandle, mugCeramic);
  handle.position.set(.19, 0, 0);
  handle.rotation.y = Math.PI / 2;
  mug.add(handle);
  const brew = new THREE.Mesh(mugBrew, mugCoffee);
  brew.position.y = .12;
  mug.add(brew);
  return mug;
}

export function createPickups(scene) {
  const list = [];

  for (const spot of CACHES) {
    const weapon = spot.weapon ? WEAPON_BY_ID.get(spot.weapon) : null;
    const tint = weapon ? weapon.tint : HEALTH_TINT;

    const group = new THREE.Group();
    group.position.set(spot.x, 0, spot.z);
    scene.add(group);

    // The beacon is an open-ended cylinder lit from inside — cheap, and it
    // reads from across the arena through the fog, which a floating icon alone
    // does not.
    const beacon = new THREE.Mesh(beaconGeometry, new THREE.MeshBasicMaterial({
      color: tint,
      transparent: true,
      opacity: .3,
      side: THREE.DoubleSide,
      depthWrite: false,
    }));
    beacon.position.y = .75;
    group.add(beacon);

    const ring = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({
      color: tint,
      transparent: true,
      opacity: .5,
      depthWrite: false,
    }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = .04;
    group.add(ring);

    // Ammo shows the thing you are about to be throwing; health shows the mug.
    const icon = weapon ? projectileMesh(weapon) : buildMug();
    icon.position.y = .8;
    if (weapon) icon.scale.setScalar(1.3);
    group.add(icon);

    list.push({
      ...spot,
      weapon,
      group,
      icon,
      beacon,
      ready: true,
      cooldown: 0,
      phase: Math.random() * Math.PI * 2,
    });
  }

  function setReady(pickup, ready) {
    pickup.ready = ready;
    pickup.group.visible = ready;
  }

  return {
    list,

    reset() {
      for (const pickup of list) {
        pickup.cooldown = 0;
        setReady(pickup, true);
      }
    },

    // `collect` is handed the pickup and decides what it grants; returning false
    // means Jerry could not use it, so it stays put rather than being wasted.
    update(dt, player, collect) {
      for (const pickup of list) {
        if (!pickup.ready) {
          pickup.cooldown -= dt;
          if (pickup.cooldown <= 0) setReady(pickup, true);
          continue;
        }

        pickup.phase += dt;
        pickup.icon.rotation.y += dt * 1.1;
        pickup.icon.position.y = .8 + Math.sin(pickup.phase * 1.6) * .12;
        pickup.beacon.material.opacity = .24 + (Math.sin(pickup.phase * 2) + 1) * .06;

        if (!player.alive) continue;
        const dx = player.x - pickup.x;
        const dz = player.z - pickup.z;
        if (dx * dx + dz * dz > REACH * REACH) continue;

        if (collect(pickup) === false) continue;
        setReady(pickup, false);
        pickup.cooldown = pickup.respawn;
      }
    },
  };
}

export { HEALTH_AMOUNT };
