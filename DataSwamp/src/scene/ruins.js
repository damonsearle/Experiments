import * as THREE from 'three';
import { batchParts, mesh, link } from './geometry.js';
import { surfaceMap } from './terrain.js';

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
const rackBlade = new THREE.BoxGeometry(1.35, .18, .08);
const cardGeometry = new THREE.BoxGeometry(.42, .01, .19);
const trimBox = new THREE.BoxGeometry(1, 1, 1);

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
const rust = new THREE.MeshStandardMaterial({ color: 0x745037, map: surfaceMap('stone', 71), roughness: .98 });
const moss = new THREE.MeshStandardMaterial({ color: 0x485535, roughness: 1 });
steelDark.map = surfaceMap('stone', 45);
steelWorn.map = surfaceMap('stone', 23);

function archiveLabel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const context = canvas.getContext('2d');
  context.fillStyle = '#9e987a'; context.fillRect(0, 0, 256, 64);
  context.fillStyle = '#313c32'; context.font = 'bold 26px monospace';
  context.fillText(text, 12, 40);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map, roughness: .95 });
}
const labelMaterial = archiveLabel('ARCHIVE / 07');

function panelDetail(parent, x, y, z, width) {
  for (let v = 0; v < 5; v++) mesh(parent, trimBox, steelDark, [x - width * .22 + v * width * .075, y, z], [.025, .085, .009]);
  mesh(parent, trimBox, deadLamp, [x + width * .34, y, z], [.034, .032, .015]);
  for (const side of [-1, 1]) mesh(parent, trimBox, rust, [x + side * width * .43, y, z], [.025, .035, .013]);
}

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
    blade.position.set(0, 1 - i * .3, .5);
    rack.add(blade);
    panelDetail(rack, 0, 1 - i * .3, .545, 1.35);
  }
  for (const side of [-1, 1]) mesh(rack, trimBox, rust, [side * .69, 0, .55], [.065, 2.55, .06]);
  mesh(rack, trimBox, moss, [0, 1.31, 0], [1.5, .065, .95]);
  mesh(rack, new THREE.PlaneGeometry(.83, .20), labelMaterial, [0, 1.13, .557]);
  rack.add(buildVine([.6, 1.28, .6], [-.4, -1.6, .8]));
  return rack;
}

function buildVine(from, to) {
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const mid = start.clone().lerp(end, .5);
  mid.y -= .6;
  const curve = new THREE.CatmullRomCurve3([start, start.clone().lerp(end, .23).add(new THREE.Vector3(.13, -.32, .1)), mid, end]);
  const vine = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, .045, 5, false), vineSkin);
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
      panelDetail(frame, column * .95, 3.5 - row * .42, 1.349, .81);
    }
  }
  for (const x of [-1.7, -.49, .49, 1.7]) mesh(frame, trimBox, rust, [x, 1.7, 1.36], [.07, 3.9, .08]);
  mesh(frame, trimBox, moss, [0, 3.74, 0], [3.55, .09, 2.55]);
  mesh(frame, new THREE.PlaneGeometry(1.6, .4), labelMaterial, [0, 3.5, 1.405]);
  // Broken conduit and access door on the side of the mainframe.
  mesh(frame, trimBox, steelWorn, [1.82, 1.8, 0], [.04, 2.5, 1.65], [0, .08, 0]);
  for (let i = 0; i < 4; i++) link(frame, rust, [1.88, 3.6, -.75 + i * .32], [1.9, .2, -.75 + i * .32], .055);

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
  const cardCanvas = document.createElement('canvas');
  cardCanvas.width = 128; cardCanvas.height = 64;
  const ink = cardCanvas.getContext('2d');
  ink.fillStyle = '#cfc39b'; ink.fillRect(0, 0, 128, 64);
  ink.fillStyle = '#544f3b';
  for (let col = 0; col < 18; col++) for (let row = 0; row < 4; row++) {
    if ((col * 7 + row * 3) % 5 < 2) ink.fillRect(6 + col * 6, 10 + row * 12, 3, 6);
  }
  cardStock.map = new THREE.CanvasTexture(cardCanvas);
  cardStock.map.colorSpace = THREE.SRGBColorSpace;
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

  batchParts(ruins);
  update(0);
  // Cards move over a fixed region; don't retain a bound from the first frame.
  cards.frustumCulled = false;
  return { update };
}
