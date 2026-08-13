import * as THREE from 'three';

import { hideMaps, hideMaterial } from './hide.js';
import { blob, paint, bellyTone, BACK, BELLY } from './blob.js';
import { addMesh, strut, claw, eyeCap } from './parts.js';

/* -------------------------------------------------------------- badge artwork */

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function badgeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 620;
  const context = canvas.getContext('2d');

  context.fillStyle = '#efe6cd';
  context.fillRect(0, 0, canvas.width, canvas.height);
  const paper = context.createLinearGradient(0, 0, 0, canvas.height);
  paper.addColorStop(0, 'rgba(255,255,255,.35)');
  paper.addColorStop(1, 'rgba(120,88,52,.28)');
  context.fillStyle = paper;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = '#3f2a1a';
  context.lineWidth = 14;
  roundedRect(context, 26, 26, canvas.width - 52, canvas.height - 52, 34);
  context.stroke();

  context.textAlign = 'center';
  context.fillStyle = '#2a1a10';
  context.font = '800 104px Georgia, "Times New Roman", serif';
  context.fillText('JERRY', 256, 190);

  context.fillStyle = '#3f2a1a';
  context.font = '700 58px Georgia, "Times New Roman", serif';
  context.fillText('BACKUP', 256, 290);
  context.fillText('ENGINEER', 256, 360);

  context.strokeStyle = '#9c3427';
  context.lineWidth = 7;
  roundedRect(context, 62, 410, canvas.width - 124, 108, 18);
  context.stroke();
  context.fillStyle = '#9c3427';
  context.font = '700 52px Georgia, "Times New Roman", serif';
  context.fillText('(LUNCH MODE)', 256, 483);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/* ------------------------------------------------------------------ the dino */

export function createJerry() {
  const hide = hideMaps({ base: '#b8843e', spot: '#573110', glow: '#e2bd7f', seed: 91, pebbles: 1100 });

  const materials = {
    body: hideMaterial(hide, [3, 2.2]),
    head: hideMaterial(hide, [2.4, 1.8]),
    limb: hideMaterial(hide, [1.6, 1.2]),
    mouth: new THREE.MeshStandardMaterial({ color: 0x50201d, roughness: .55 }),
    tongue: new THREE.MeshStandardMaterial({ color: 0xa8544c, roughness: .38 }),
    ivory: new THREE.MeshStandardMaterial({ color: 0xf5ecd4, roughness: .42 }),
    sclera: new THREE.MeshStandardMaterial({ color: 0xfdf7e8, roughness: .28 }),
    iris: new THREE.MeshStandardMaterial({ color: 0x3d2413, roughness: .3 }),
    pupil: new THREE.MeshStandardMaterial({ color: 0x120b07, roughness: .25 }),
    spark: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    dark: new THREE.MeshStandardMaterial({ color: 0x24160f, roughness: .7 }),
    frame: new THREE.MeshStandardMaterial({ color: 0xa8382a, roughness: .35, metalness: .12 }),
    capRed: new THREE.MeshStandardMaterial({ color: 0xa5372a, roughness: .68 }),
    capCream: new THREE.MeshStandardMaterial({ color: 0xece0be, roughness: .7 }),
    strap: new THREE.MeshStandardMaterial({ color: 0x2c5b80, roughness: .82 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8d9299, roughness: .34, metalness: .8 }),
    lens: new THREE.MeshPhysicalMaterial({
      color: 0xd6f0ea,
      roughness: .07,
      metalness: 0,
      transparent: true,
      opacity: .16,
      transmission: .55,
      depthWrite: false,
    }),
  };

  const jerry = new THREE.Group();
  jerry.name = 'Jerry';

  /* -- torso: one blended mass from hips to neck, belly pushed forward ------- */
  const torso = new THREE.Group();
  torso.position.set(0, 1.26, 0);
  jerry.add(torso);
  addMesh(torso, paint(blob([
    { at: [-.02, -.34, 0], size: [.62, .50, .60] },   // hips
    { at: [.14, -.06, 0], size: [.70, .52, .64] },    // belly
    { at: [.02, .34, 0], size: [.58, .46, .57] },     // chest
    { at: [-.22, .26, 0], size: [.44, .44, .48] },    // rounded back
    { at: [-.02, .54, -.36], size: [.30, .30, .27] }, // shoulders
    { at: [-.02, .54, .36], size: [.30, .30, .27] },
    { at: [.06, .78, 0], size: [.28, .24, .28] },     // neck
  ], { segments: 88, rings: 56, smooth: .16 }), bellyTone(.72)), materials.body);

  /* -- head: cranium, eye mounds, cheeks and snout in one blended shape ------ */
  const head = new THREE.Group();
  head.position.set(.16, 2.24, 0);
  head.scale.setScalar(1.09);
  jerry.add(head);

  addMesh(head, paint(blob([
    { at: [-.06, .04, 0], size: [.55, .54, .55] },    // cranium
    { at: [.26, .22, -.30], size: [.22, .22, .22] },  // mounds the eyeballs sit in
    { at: [.26, .22, .30], size: [.22, .22, .22] },
    { at: [.12, -.16, -.32], size: [.30, .28, .24] }, // cheeks
    { at: [.12, -.16, .32], size: [.30, .28, .24] },
    { at: [.42, -.01, 0], size: [.40, .26, .40] },    // muzzle
    { at: [.58, -.03, 0], size: [.30, .23, .34] },    // snout tip
    { at: [.42, -.15, 0], size: [.38, .13, .37] },    // upper lip
    { at: [-.14, -.30, 0], size: [.34, .26, .33] },   // throat into the collar
  ], { segments: 96, rings: 60, smooth: .15 }), bellyTone(.6, .35)), materials.head);

  // Nostrils sunk into the top of the snout.
  for (const z of [-.11, .11]) {
    addMesh(head, new THREE.SphereGeometry(.048, 10, 8), materials.dark, [.72, .13, z], [0, 0, -.4], [1, .7, .8]);
  }

  /* -- open, toothy grin ---------------------------------------------------- */
  addMesh(head, new THREE.SphereGeometry(1, 20, 14), materials.mouth, [.32, -.38, 0], [0, 0, .08], [.42, .19, .4]);
  addMesh(head, new THREE.SphereGeometry(1, 18, 12), materials.tongue, [.42, -.44, 0], [0, 0, .14], [.26, .08, .23]);

  // Upper teeth follow the lip line; the corners sit higher, which is what makes it a smile.
  for (let i = 0; i < 9; i++) {
    const angle = (i / 8 - .5) * 2.3;
    addMesh(
      head,
      new THREE.ConeGeometry(.036 - Math.abs(angle) * .007, .1, 6),
      materials.ivory,
      [.42 + Math.cos(angle) * .33, -.26 + Math.abs(angle) * .055, Math.sin(angle) * .37],
      [0, 0, Math.PI],
    );
  }

  // Lower jaw, hinged under the cheeks so the grin can flap while Jerry runs.
  const jaw = new THREE.Group();
  jaw.position.set(.12, -.22, 0);
  jaw.rotation.z = -.32;
  head.add(jaw);
  addMesh(jaw, paint(blob([
    { at: [.36, -.1, 0], size: [.3, .13, .29] },
    { at: [.53, -.1, 0], size: [.2, .11, .21] },
    { at: [.13, -.12, -.24], size: [.18, .12, .16] },
    { at: [.13, -.12, .24], size: [.18, .12, .16] },
  ], { segments: 48, rings: 30, smooth: .14 }), (shade, point) => {
    shade.copy(BACK).lerp(BELLY, THREE.MathUtils.smoothstep(-point.y * 2.4 + .3, -.8, .8));
  }), materials.limb);
  for (let i = 0; i < 5; i++) {
    const angle = (i / 4 - .5) * 1.6;
    addMesh(
      jaw,
      new THREE.ConeGeometry(.026, .07, 6),
      materials.ivory,
      [.4 + Math.cos(angle) * .22, .01, Math.sin(angle) * .24],
    );
  }

  /* -- big bulging eyes behind chunky round glasses ------------------------- */
  const eyes = [];
  for (const z of [-.30, .30]) {
    const side = Math.sign(z);
    const socket = new THREE.Group();
    socket.position.set(.40, .26, z);
    socket.rotation.y = -side * .2;
    head.add(socket);

    const eye = addMesh(socket, new THREE.SphereGeometry(.22, 26, 20), materials.sclera);

    // Iris, pupil and catchlight are shells of the eyeball, so they can never sink into it.
    const gaze = new THREE.Group();
    gaze.rotation.set(0, side * .06, -.09);
    socket.add(gaze);
    addMesh(gaze, eyeCap(.222, .8), materials.iris);
    const pupil = addMesh(gaze, eyeCap(.226, .42), materials.pupil);
    addMesh(gaze, eyeCap(.231, .17), materials.spark, [0, 0, 0], [.9, 0, -.55]);
    eyes.push({ eye, pupil });

    // Glasses: a thick rim ringing the eyeball, a faint lens, and a stem over the cheek.
    addMesh(socket, new THREE.TorusGeometry(.235, .042, 10, 32), materials.frame, [.2, -.01, 0], [0, Math.PI / 2, 0], [1, .96, 1]);
    addMesh(socket, new THREE.CircleGeometry(.225, 28), materials.lens, [.252, -.01, 0], [0, Math.PI / 2, 0]);
    strut(socket, materials.frame, [.13, .06, side * .22], [-.36, .12, side * .32], .026);
  }
  // Bridge between the two rims, sitting on the snout.
  strut(head, materials.frame, [.58, .29, -.14], [.58, .29, .14], .038);

  /* -- propeller beanie ----------------------------------------------------- */
  const cap = new THREE.Group();
  cap.position.set(-.04, .27, 0);
  cap.rotation.set(.08, 0, .17);
  head.add(cap);

  for (let i = 0; i < 6; i++) {
    addMesh(
      cap,
      new THREE.SphereGeometry(1, 16, 12, i * Math.PI / 3, Math.PI / 3, 0, Math.PI / 2),
      i % 2 ? materials.capCream : materials.capRed,
      [0, 0, 0],
      [0, 0, 0],
      [.63, .53, .64],
    );
  }
  addMesh(cap, new THREE.TorusGeometry(.62, .06, 10, 32), materials.capRed, [0, .02, 0], [Math.PI / 2, 0, 0], [1.01, 1.01, 1]);
  // Short brim over the brow. Cylinder theta starts at +z, so the sector is swung round to +x.
  addMesh(
    cap,
    new THREE.CylinderGeometry(.82, .82, .055, 28, 1, false, Math.PI / 2 - .46, .92),
    materials.capRed,
    [0, .12, 0],
    [0, 0, .1],
  );
  addMesh(cap, new THREE.SphereGeometry(.08, 12, 10), materials.capRed, [0, .53, 0]);
  addMesh(cap, new THREE.CylinderGeometry(.022, .026, .16, 10), materials.steel, [0, .62, 0]);

  const propeller = new THREE.Group();
  propeller.position.set(0, .72, 0);
  cap.add(propeller);
  addMesh(propeller, new THREE.SphereGeometry(.06, 12, 10), materials.frame);
  for (const side of [-1, 1]) {
    addMesh(propeller, new THREE.BoxGeometry(.38, .028, .14), materials.strap, [side * .21, 0, 0], [side * .38, 0, 0]);
  }

  /* -- lanyard and the backup-engineer badge -------------------------------- */
  // Straps ride over the shoulders and meet at the clip, the way the reference badge hangs.
  // The straps run wide of the chin, down the sides of the chest, and meet at the clip.
  for (const side of [-1, 1]) {
    strut(jerry, materials.strap, [.06, 1.94, side * .48], [.46, 1.68, side * .38], .048);
    strut(jerry, materials.strap, [.46, 1.68, side * .38], [.76, 1.52, side * .06], .048);
  }
  addMesh(jerry, new THREE.BoxGeometry(.06, .13, .09), materials.steel, [.79, 1.48, 0]);
  addMesh(
    jerry,
    new THREE.BoxGeometry(.035, .56, .46),
    new THREE.MeshStandardMaterial({ map: badgeTexture(), roughness: .62 }),
    [.86, 1.2, 0],
    [0, 0, -.06],
  );

  /* -- little arms with three clawed fingers -------------------------------- */
  const armGeometry = paint(blob([
    { at: [0, -.14, 0], size: [.18, .22, .18] },
    { at: [.02, -.34, 0], size: [.15, .15, .15] },
    { at: [.07, -.50, 0], size: [.14, .14, .14] },
    { at: [.14, -.60, 0], size: [.16, .13, .15] },
  ], { segments: 40, rings: 26, smooth: .13 }), bellyTone(.34));

  const arms = [];
  for (const z of [-.56, .56]) {
    const side = Math.sign(z);
    const arm = new THREE.Group();
    arm.position.set(.16, 1.7, z);
    jerry.add(arm);

    // main.js swings these from a -0.5 baseline, so the limb itself is pre-rotated forward.
    const limb = new THREE.Group();
    limb.rotation.set(-side * .2, 0, .78);
    arm.add(limb);
    addMesh(limb, armGeometry, materials.limb);

    for (let i = 0; i < 3; i++) {
      const spread = (i - 1) * .09;
      const tip = [.31, -.69 - Math.abs(i - 1) * .02, spread * 1.7];
      strut(limb, materials.limb, [.15, -.63, spread], tip, .05);
      claw(limb, materials.ivory, tip, [.7, -.5, spread * 4], .026, .065);
    }
    arms.push(arm);
  }

  /* -- sturdy legs and three-toed feet -------------------------------------- */
  const legGeometry = paint(blob([
    { at: [0, -.14, 0], size: [.29, .34, .29] },
    { at: [.04, -.46, 0], size: [.23, .22, .23] },
    { at: [.08, -.70, 0], size: [.20, .19, .20] },
  ], { segments: 44, rings: 28, smooth: .13 }), bellyTone(.4));
  const footGeometry = paint(blob([
    { at: [0, 0, 0], size: [.28, .15, .25] },
    { at: [.20, 0, 0], size: [.24, .13, .23] },
  ], { segments: 36, rings: 22, smooth: .13 }), bellyTone(.3, .4));

  const legs = [];
  for (const z of [-.3, .3]) {
    const side = Math.sign(z);
    const leg = new THREE.Group();
    leg.position.set(-.02, .98, z);
    jerry.add(leg);
    addMesh(leg, legGeometry, materials.limb, [0, 0, 0], [0, side * .1, 0]);

    const foot = new THREE.Group();
    foot.position.set(.08, -.8, 0);
    foot.rotation.y = side * .12;
    leg.add(foot);
    addMesh(foot, footGeometry, materials.limb);
    for (let i = 0; i < 3; i++) {
      const spread = (i - 1) * .14;
      const tip = [.44, -.05, spread * 1.4];
      strut(foot, materials.limb, [.18, -.02, spread * .7], tip, .065);
      claw(foot, materials.ivory, tip, [.85, -.25, spread * 2.2], .045, .12);
    }
    legs.push(leg);
  }

  /* -- short tapered tail ---------------------------------------------------- */
  const tail = new THREE.Group();
  tail.position.set(-.58, 1.16, 0);
  tail.rotation.z = .18;
  jerry.add(tail);
  addMesh(tail, paint(blob([
    { at: [0, 0, 0], size: [.34, .34, .32] },
    { at: [-.32, .06, 0], size: [.25, .25, .24] },
    { at: [-.60, .14, 0], size: [.16, .16, .16] },
    { at: [-.82, .22, 0], size: [.09, .09, .09] },
  ], { segments: 44, rings: 28, smooth: .13 }), bellyTone(.5)), materials.limb);

  // No carried fill light here. Data Dash needed one because its key light was near-
  // monochrome lime, which flattened the hide; the swamp lights neutrally, so a fill would
  // only add a travelling pool of light on the ground and an extra light to shade against.
  return { group: jerry, torso, head, jaw, legs, tail, arms, eyes, propeller };
}
