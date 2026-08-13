import * as THREE from 'three';

import { hideMaps, hideMaterial } from './hide.js';
import { blob, paint, bellyTone } from './blob.js';
import { addMesh } from './parts.js';

/* --------------------------------------------------------------------------
   The swamp's wildlife. Three species for M2, built from the same blob kit as
   Jerry so they share his silhouette language, and all facing +x so a heading
   of zero points down the positive x axis exactly as the player does.

   The rule this file exists to enforce is the trap PLAN.md flags: blob()
   ray-marches thousands of vertices with 26 bisection steps each, which is
   fine once at boot and catastrophic per spawn. Every geometry here is built
   once by createDinoKit() and shared by every individual of that species.
   spawn() only ever allocates Groups, Meshes and materials.

   Materials are cloned per individual rather than shared, because a hit has to
   flash one dinosaur without tinting every other member of its species. Clones
   keep the same texture objects, so that costs a uniform block, not a texture.
   -------------------------------------------------------------------------- */

// A tight blend radius. The smooth union rounds away any feature narrower than
// `smooth`, and these bodies are mostly thin necks and tapering tails hung off
// fat torsos — at Jerry's .15 the necks dissolved into the chest and every
// species came out a seal.
const SHELL = { segments: 48, rings: 30, smooth: .07 };

// Unit primitives for the trim — eyes, crests, plates, spikes. Scaled at the
// call site rather than rebuilt per size, so spawn() allocates no geometry at
// all, not even the cheap kind. None of these use a hide material, so none of
// them need paint().
const BEAD = new THREE.SphereGeometry(1, 10, 8);
const FIN = new THREE.SphereGeometry(1, 12, 10);
const SPIKE = new THREE.ConeGeometry(1, 1, 7);

// Enemies are read at ten metres against dark water, so they get a coarser
// mesh and a coarser hide than Jerry — the detail would not survive the trip.
function scales(spec) {
  return hideMaps({ ...spec, pebbles: 420, wart: 1.5 });
}

/* ------------------------------------------------------------ Compsognathus */
// .TXT. Knee-high, quick, and only dangerous because it never travels alone.

function buildCompy() {
  const hide = scales({ base: '#7f8a52', spot: '#39411f', glow: '#c3cf8e', seed: 17 });
  return {
    hide,
    // A horizontal spine that turns up into a real neck at the front. Running
    // the torso straight into the skull is what makes a small theropod read as
    // a seal instead of a dinosaur.
    torso: paint(blob([
      { at: [-.20, -.01, 0], size: [.17, .16, .16] },
      { at: [-.02, .01, 0], size: [.19, .17, .18] },
      { at: [.16, .03, 0], size: [.16, .16, .16] },
      { at: [.30, .10, 0], size: [.10, .10, .10] },
      { at: [.38, .20, 0], size: [.075, .085, .08] },
    ], SHELL), bellyTone(.22)),
    head: paint(blob([
      { at: [0, 0, 0], size: [.09, .085, .085] },
      { at: [.14, -.03, 0], size: [.10, .055, .06] },
      { at: [.24, -.04, 0], size: [.05, .04, .045] },
    ], SHELL), bellyTone(.16, .25)),
    tail: paint(blob([
      { at: [0, 0, 0], size: [.14, .14, .14] },
      { at: [-.26, .03, 0], size: [.10, .10, .10] },
      { at: [-.50, .07, 0], size: [.06, .06, .06] },
      { at: [-.72, .12, 0], size: [.03, .03, .03] },
    ], SHELL), bellyTone(.2)),
    leg: paint(blob([
      { at: [0, -.04, 0], size: [.10, .11, .09] },
      { at: [.07, -.17, 0], size: [.06, .08, .06] },
      { at: [.01, -.29, 0], size: [.045, .07, .045] },
      { at: [.08, -.36, 0], size: [.075, .03, .07] },
    ], SHELL), bellyTone(.14)),
  };
}

function makeCompy(parts, materials) {
  const group = new THREE.Group();

  const body = new THREE.Group();
  body.position.y = .51;
  group.add(body);
  addMesh(body, parts.torso, materials.body);

  const tail = new THREE.Group();
  tail.position.set(-.30, .02, 0);
  tail.rotation.z = .1;
  body.add(tail);
  addMesh(tail, parts.tail, materials.limb);

  const head = new THREE.Group();
  head.position.set(.44, .28, 0);
  head.rotation.z = -.12;
  body.add(head);
  addMesh(head, parts.head, materials.limb);
  for (const z of [-.055, .055]) {
    addMesh(head, BEAD, materials.eye, [.05, .04, z], [0, 0, 0], [.026, .026, .026]);
  }

  const legs = [];
  for (const z of [-.10, .10]) {
    const leg = new THREE.Group();
    leg.position.set(-.10, -.12, z);
    body.add(leg);
    addMesh(leg, parts.leg, materials.limb);
    legs.push(leg);
  }

  return { group, body, head, tail, legs, muzzle: [.24, -.04, 0] };
}

/* ----------------------------------------------------------- Dilophosaurus */
// .CSV. Twin head crests, and a volley of three comma-separated values.

function buildDilo() {
  const hide = scales({ base: '#6d7f8c', spot: '#2c3a45', glow: '#b6c8d2', seed: 53 });
  return {
    hide,
    // A deep chest over narrow hips, and a neck that climbs steeply to a large
    // head. A tube of even diameter with a stub on the front reads as a seal
    // however good the head is, so the profile has to do the work.
    torso: paint(blob([
      { at: [-.30, .04, 0], size: [.22, .24, .22] },
      { at: [-.06, .00, 0], size: [.24, .27, .25] },
      { at: [.18, .06, 0], size: [.26, .30, .27] },
      { at: [.38, .18, 0], size: [.19, .23, .21] },
      { at: [.52, .38, 0], size: [.11, .16, .12] },
      { at: [.62, .58, 0], size: [.09, .15, .10] },
    ], SHELL), bellyTone(.36)),
    head: paint(blob([
      { at: [0, 0, 0], size: [.17, .16, .15] },
      { at: [.20, -.05, 0], size: [.20, .11, .12] },
      { at: [.38, -.08, 0], size: [.10, .08, .09] },
      { at: [.18, -.14, 0], size: [.19, .06, .11] },
    ], SHELL), bellyTone(.26, .25)),
    // Steps down hard from the chest and keeps tapering. A tail base as thick
    // as the ribcage gives one unbroken sausage from nose to tip.
    tail: paint(blob([
      { at: [0, 0, 0], size: [.17, .19, .17] },
      { at: [-.30, .04, 0], size: [.11, .12, .11] },
      { at: [-.58, .09, 0], size: [.065, .07, .065] },
      { at: [-.84, .15, 0], size: [.03, .03, .03] },
    ], SHELL), bellyTone(.3)),
    // A digitigrade zig-zag — thigh forward, shin back, foot forward again.
    // A straight diagonal from hip to toe reads as a flipper, which is most of
    // what made this thing look aquatic.
    leg: paint(blob([
      { at: [0, -.06, 0], size: [.21, .23, .20] },
      { at: [.14, -.32, 0], size: [.13, .16, .13] },
      { at: [.02, -.60, 0], size: [.09, .13, .09] },
      { at: [.16, -.76, 0], size: [.14, .055, .12] },
    ], SHELL), bellyTone(.24)),
  };
}

function makeDilo(parts, materials) {
  const group = new THREE.Group();

  const body = new THREE.Group();
  body.position.y = 1.04;
  group.add(body);
  addMesh(body, parts.torso, materials.body);

  const tail = new THREE.Group();
  tail.position.set(-.44, .06, 0);
  tail.rotation.z = .14;
  body.add(tail);
  addMesh(tail, parts.tail, materials.limb);

  const head = new THREE.Group();
  head.position.set(.72, .74, 0);
  head.rotation.z = -.16;
  body.add(head);
  addMesh(head, parts.head, materials.limb);
  for (const z of [-.11, .11]) {
    addMesh(head, BEAD, materials.eye, [.10, .04, z], [0, 0, 0], [.042, .042, .042]);
    // The crests. Flat fins rather than blobs — they want a hard edge against
    // the skull, which is the one thing a smooth union cannot give.
    addMesh(head, FIN, materials.crest, [.14, .18, z * .5], [0, 0, .25], [.21, .15, .022]);
  }

  const legs = [];
  for (const z of [-.17, .17]) {
    const leg = new THREE.Group();
    leg.position.set(-.14, -.20, z);
    body.add(leg);
    addMesh(leg, parts.leg, materials.limb);
    legs.push(leg);
  }

  return { group, body, head, tail, legs, muzzle: [.42, -.10, 0] };
}

/* -------------------------------------------------------------- Stegosaurus */
// .XLS. Slow, plated, and lobs spreadsheets on a high arc.

function buildStego() {
  const hide = scales({ base: '#8a6f45', spot: '#3f2e17', glow: '#cdb37e', seed: 88 });
  return {
    hide,
    // The back arches over high hips and drops away to low shoulders, which is
    // what lets the short front legs reach the ground from an attachment point
    // that is still inside the body.
    torso: paint(blob([
      { at: [-.42, .10, 0], size: [.40, .38, .38] },
      { at: [-.06, .12, 0], size: [.44, .40, .42] },
      { at: [.28, .02, 0], size: [.36, .34, .38] },
      { at: [.58, -.08, 0], size: [.26, .26, .30] },
      { at: [.78, -.14, 0], size: [.16, .16, .18] },
    ], SHELL), bellyTone(.48)),
    head: paint(blob([
      { at: [0, 0, 0], size: [.13, .12, .13] },
      { at: [.16, -.03, 0], size: [.14, .09, .11] },
      { at: [.30, -.05, 0], size: [.08, .06, .08] },
    ], SHELL), bellyTone(.2, .25)),
    tail: paint(blob([
      { at: [0, 0, 0], size: [.32, .30, .30] },
      { at: [-.38, .04, 0], size: [.22, .21, .21] },
      { at: [-.72, .10, 0], size: [.14, .14, .14] },
      { at: [-1.0, .16, 0], size: [.08, .08, .08] },
    ], SHELL), bellyTone(.4)),
    leg: paint(blob([
      { at: [0, -.08, 0], size: [.19, .22, .19] },
      { at: [.02, -.34, 0], size: [.15, .17, .15] },
      { at: [.05, -.54, 0], size: [.13, .10, .14] },
    ], SHELL), bellyTone(.26)),
  };
}

function makeStego(parts, materials) {
  const group = new THREE.Group();

  const body = new THREE.Group();
  body.position.y = .86;
  group.add(body);
  addMesh(body, parts.torso, materials.body);

  // The plates: a staggered double row following the arch of the back, biggest
  // over the hips. Hand-placed rather than swept along a formula, because the
  // spine they have to sit on is not a straight line.
  for (const [x, y, z, size] of [
    [.50, .22, .08, .13], [.28, .38, -.08, .18], [.04, .50, .08, .23],
    [-.20, .55, -.08, .25], [-.44, .52, .08, .22], [-.66, .44, -.08, .17],
  ]) {
    addMesh(body, FIN, materials.crest, [x, y, z], [0, 0, x * .3], [size * .8, size, .03]);
  }

  const tail = new THREE.Group();
  tail.position.set(-.70, .06, 0);
  tail.rotation.z = .12;
  body.add(tail);
  addMesh(tail, parts.tail, materials.limb);
  for (const [x, y, z, size] of [[-.18, .28, .08, .12], [-.40, .22, -.08, .09]]) {
    addMesh(tail, FIN, materials.crest, [x, y, z], [0, 0, -.2], [size * .8, size, .03]);
  }
  // Thagomizer.
  for (const [x, y, z, pitch] of [[-.86, .14, -.10, .5], [-.86, .14, .10, .5], [-.66, .18, -.12, .2], [-.66, .18, .12, .2]]) {
    addMesh(tail, SPIKE, materials.crest, [x, y, z], [0, 0, Math.PI / 2 + pitch], [.05, .26, .05]);
  }

  const head = new THREE.Group();
  head.position.set(.98, -.18, 0);
  head.rotation.z = -.1;
  body.add(head);
  addMesh(head, parts.head, materials.limb);
  for (const z of [-.09, .09]) {
    addMesh(head, BEAD, materials.eye, [.08, .04, z], [0, 0, 0], [.034, .034, .034]);
  }

  // Front legs are shorter, so they hang from a lower attachment; both pairs are
  // sized and placed so the feet land on y = 0. Ordered front-left, front-right,
  // back-right, back-left, so alternating the swing sign gives a diagonal trot
  // rather than a bunny hop.
  const legs = [];
  for (const [x, y, z, scale] of [
    [.44, -.361, -.26, .78], [.44, -.361, .26, .78],
    [-.42, -.22, .28, 1], [-.42, -.22, -.28, 1],
  ]) {
    const leg = new THREE.Group();
    leg.position.set(x, y, z);
    leg.scale.setScalar(scale);
    body.add(leg);
    addMesh(leg, parts.leg, materials.limb);
    legs.push(leg);
  }

  return { group, body, head, tail, legs, muzzle: [.32, -.05, 0] };
}

/* ------------------------------------------------------------------- the kit */

const BUILDERS = {
  compy: { build: buildCompy, make: makeCompy, crest: 0x4d5a2c },
  dilo: { build: buildDilo, make: makeDilo, crest: 0xb4452f },
  stego: { build: buildStego, make: makeStego, crest: 0x6d5330 },
};

// Call once, at boot. Every blob() in the file runs here and nowhere else.
export function createDinoKit() {
  const kit = {};

  for (const [id, entry] of Object.entries(BUILDERS)) {
    const parts = entry.build();
    const prototypeMaterials = {
      body: hideMaterial(parts.hide, [2, 1.6]),
      limb: hideMaterial(parts.hide, [1.4, 1.1]),
      eye: new THREE.MeshStandardMaterial({ color: 0x140d07, roughness: .3 }),
      crest: new THREE.MeshStandardMaterial({ color: entry.crest, roughness: .6 }),
    };

    kit[id] = {
      id,
      // Fresh materials per individual so a hit flashes one dinosaur, not the
      // whole species. `skins` is the subset a flash should tint.
      spawn() {
        const materials = {
          body: prototypeMaterials.body.clone(),
          limb: prototypeMaterials.limb.clone(),
          eye: prototypeMaterials.eye,
          crest: prototypeMaterials.crest.clone(),
        };
        const rig = entry.make(parts, materials);
        rig.skins = [materials.body, materials.limb, materials.crest];
        return rig;
      },
    };
  }

  return kit;
}
