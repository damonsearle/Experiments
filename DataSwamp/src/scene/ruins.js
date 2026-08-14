import * as THREE from 'three';

/* --------------------------------------------------------------------------
   The data centre that lost.

   Server racks half-sunk in the mud, cable vines drooping off them, punch cards
   still drifting about, and a dead mainframe as the arena's centrepiece. The
   mainframe is the only piece here that is also collision — it is the one bit
   of hard cover the design promised, so it goes into the obstacle list and
   everything else is scenery.

   Kept deliberately at the edge of legible: the joke lands better if you notice
   the swamp is a server room second, not first.
   -------------------------------------------------------------------------- */

const rackShell = new THREE.BoxGeometry(1.5, 2.6, .95);
const rackBlade = new THREE.BoxGeometry(1.35, .13, .82);
const cardGeometry = new THREE.BoxGeometry(.42, .01, .19);
const vineGeometry = new THREE.CylinderGeometry(.035, .035, 1, 5);

const steelDark = new THREE.MeshStandardMaterial({ color: 0x2f3430, roughness: .72, metalness: .45 });
const steelWorn = new THREE.MeshStandardMaterial({ color: 0x474d44, roughness: .85, metalness: .3 });
const cardStock = new THREE.MeshStandardMaterial({ color: 0xcfc39b, roughness: .95 });
const vineSkin = new THREE.MeshStandardMaterial({ color: 0x36452a, roughness: 1 });
const deadLamp = new THREE.MeshStandardMaterial({
  color: 0x1b241d,
  roughness: .5,
  emissive: 0x1d5a3a,
  emissiveIntensity: .6,
});

// Racks lean because they have been sinking for a hundred million years.
function buildRack(x, z, sink, lean, turn) {
  const rack = new THREE.Group();
  rack.position.set(x, 1.3 - sink, z);
  rack.rotation.set(lean, turn, lean * .6);

  const shell = new THREE.Mesh(rackShell, steelDark);
  shell.castShadow = true;
  shell.receiveShadow = true;
  rack.add(shell);

  for (let i = 0; i < 7; i++) {
    const blade = new THREE.Mesh(rackBlade, i % 3 === 0 ? deadLamp : steelWorn);
    blade.position.set(0, 1 - i * .3, .09);
    rack.add(blade);
  }
  return rack;
}

function buildVine(from, to) {
  const start = new THREE.Vector3(...from);
  const direction = new THREE.Vector3(...to).sub(start);
  const length = direction.length();
  const vine = new THREE.Mesh(vineGeometry, vineSkin);
  vine.scale.y = length;
  vine.position.copy(start).addScaledVector(direction, .5);
  vine.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return vine;
}

export function createRuins(scene, { obstacles }) {
  const ruins = new THREE.Group();
  scene.add(ruins);

  /* --------------------------------------------------------- the mainframe */

  // The centrepiece, and the only hard cover on the map. Off-centre and well
  // clear of Jerry's spawn: dead centre would make every fight a circle around
  // one object, and on the spawn it is a wall you start the game facing.
  const MAINFRAME = { x: -1, z: 13, radius: 2.2, height: 4 };

  const frame = new THREE.Group();
  frame.position.set(MAINFRAME.x, 0, MAINFRAME.z);
  frame.rotation.y = .4;
  ruins.add(frame);

  const monolith = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, MAINFRAME.height, 2.6),
    steelDark,
  );
  monolith.position.y = MAINFRAME.height / 2 - .3;
  monolith.castShadow = true;
  monolith.receiveShadow = true;
  frame.add(monolith);

  // A grille of dead indicator banks down the front face.
  for (let row = 0; row < 9; row++) {
    for (let column = -1; column <= 1; column++) {
      const lamp = new THREE.Mesh(rackBlade, row % 4 === 1 ? deadLamp : steelWorn);
      lamp.scale.set(.6, .8, .5);
      lamp.position.set(column * .95, 3.5 - row * .42, 1.32);
      frame.add(lamp);
    }
  }

  // Cable vines spilling off the top and into the mud.
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2;
    frame.add(buildVine(
      [Math.cos(angle) * 1.4, MAINFRAME.height - .5, Math.sin(angle) * 1],
      [Math.cos(angle) * 2.9, .1, Math.sin(angle) * 2.4],
    ));
  }

  obstacles.push({ ...MAINFRAME, standable: false });

  /* -------------------------------------------------------------- the racks */

  // Scenery only. They read as cover but do not collide, because a map with
  // this much real cover on it stops the ranged AI from ever getting a shot.
  for (const [x, z, sink, lean, turn] of [
    [17, 2, .5, .22, .7], [19, -6, 1.1, -.3, 2.1], [-18, 8, .7, .18, 4],
    [-9, 17, 1.4, .35, 1.2], [8, -17, .6, -.2, 5.4], [-20, -13, .9, .28, 3.1],
  ]) {
    ruins.add(buildRack(x, z, sink, lean, turn));
  }

  /* -------------------------------------------------------- drifting cards */

  const CARDS = 34;
  const cards = new THREE.InstancedMesh(cardGeometry, cardStock, CARDS);
  const placer = new THREE.Object3D();
  const drift = [];
  for (let i = 0; i < CARDS; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 6 + Math.random() * 18;
    drift.push({
      x: Math.cos(angle) * distance,
      z: Math.sin(angle) * distance,
      y: 1.5 + Math.random() * 5,
      spin: (Math.random() - .5) * .6,
      bob: Math.random() * Math.PI * 2,
    });
  }
  cards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  ruins.add(cards);

  let elapsed = 0;
  function update(dt) {
    elapsed += dt;
    for (let i = 0; i < CARDS; i++) {
      const card = drift[i];
      placer.position.set(card.x, card.y + Math.sin(elapsed * .5 + card.bob) * .35, card.z);
      placer.rotation.set(elapsed * card.spin * .4, elapsed * card.spin, elapsed * card.spin * .25);
      placer.scale.setScalar(1);
      placer.updateMatrix();
      cards.setMatrixAt(i, placer.matrix);
    }
    cards.instanceMatrix.needsUpdate = true;
  }

  return { update };
}
