import * as THREE from 'three';

import { hideMaps, hideMaterial } from './hide.js';
import { blob, paint, bellyTone, BACK, BELLY } from './blob.js';
import { addMesh, strut, claw, eyeCap } from './parts.js';

/* --------------------------------------------------------------------------
   Jerry — rebuilt from the JerryImages turnaround.

   Read of the reference: a squat, upright, egg-bodied dino toy. He stands on
   his own two feet with a vertical spine, not a tail-counterweighted lean. The
   silhouette is three stacked masses — a big round head almost as wide as his
   shoulders, a barrel belly at its widest around the navel, and short columnar
   legs — with a stubby tail poking out low at the back. Everything else is
   dressing: a red/cream propeller beanie, chunky round brick-red spectacles
   over bulging eyes, a blue leather harness with a nameplate on the chest, and
   a row of rounded scutes running from the back of the skull to the tail tip.

   Proportions are taken off the front view: from the sole to the top of the
   skull is ~3.0, of which the head is ~0.95, the visible torso ~1.45 and the
   legs ~0.35. He is built facing +x, so a heading of zero points down the
   positive x axis, which is what player.js assumes. The sole sits on y = 0.
   -------------------------------------------------------------------------- */

// A constant vertex colour, for pieces that want to read as hide without
// picking up the belly-to-back gradient (scutes, eyelids).
function flatTone(color, scale = 1) {
  return shade => shade.copy(color).multiplyScalar(scale);
}

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

// The reference plate: aged cream enamel in a metal surround, a thin dark
// keyline, four corner screws, and condensed black caps.
function badgeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 460;
  canvas.height = 500;
  const context = canvas.getContext('2d');

  context.fillStyle = '#ece5d1';
  context.fillRect(0, 0, canvas.width, canvas.height);
  const age = context.createLinearGradient(0, 0, canvas.width * .7, canvas.height);
  age.addColorStop(0, 'rgba(255,255,255,.45)');
  age.addColorStop(.6, 'rgba(190,166,126,.14)');
  age.addColorStop(1, 'rgba(120,96,62,.32)');
  context.fillStyle = age;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = '#9aa0a4';
  context.lineWidth = 24;
  roundedRect(context, 12, 12, canvas.width - 24, canvas.height - 24, 16);
  context.stroke();
  context.strokeStyle = '#4a4038';
  context.lineWidth = 4;
  roundedRect(context, 46, 46, canvas.width - 92, canvas.height - 92, 8);
  context.stroke();

  context.fillStyle = '#7b8087';
  for (const [x, y] of [[38, 38], [canvas.width - 38, 38], [38, canvas.height - 38], [canvas.width - 38, canvas.height - 38]]) {
    context.beginPath();
    context.arc(x, y, 9, 0, Math.PI * 2);
    context.fill();
  }

  // Condensed caps. Canvas has no narrow face it can rely on everywhere, so the
  // text is squeezed horizontally rather than trusting a font stack.
  const line = (text, y, size) => {
    context.save();
    context.translate(canvas.width / 2, y);
    context.scale(.8, 1);
    context.textAlign = 'center';
    context.font = `900 ${size}px "Arial Black", Impact, Arial, sans-serif`;
    context.fillStyle = '#181310';
    context.fillText(text, 0, 0);
    context.restore();
  };
  line('JERRY', 228, 110);
  line('BACKUP', 330, 66);
  line('ENGINEER', 414, 66);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/* ------------------------------------------------------------------ the dino */

export function createJerry() {
  // Warm mustard-caramel hide with big distinct warts over a dark-rimmed
  // mottle; the wart multiplier pushes the stamps past fine grain.
  const hide = hideMaps({ base: '#c1913f', spot: '#7d4c1c', glow: '#e8cd93', seed: 91, pebbles: 950, wart: 1.25 });

  const materials = {
    body: hideMaterial(hide, [2.6, 2]),
    head: hideMaterial(hide, [2.2, 1.7]),
    limb: hideMaterial(hide, [1.5, 1.15]),
    // The mouth sits deep under the brow and the lip, so it is mixed lighter
    // than the reference reads — at that depth a literal match goes to black.
    mouth: new THREE.MeshStandardMaterial({ color: 0x74302a, roughness: .55 }),
    tongue: new THREE.MeshStandardMaterial({ color: 0xc0736a, roughness: .38 }),
    tooth: new THREE.MeshStandardMaterial({ color: 0xf0e6cc, roughness: .4 }),
    nail: new THREE.MeshStandardMaterial({ color: 0xcdb282, roughness: .48 }),
    horn: new THREE.MeshStandardMaterial({ color: 0x8a6234, roughness: .5 }),
    sclera: new THREE.MeshStandardMaterial({ color: 0xfbf5e6, roughness: .26 }),
    iris: new THREE.MeshStandardMaterial({ color: 0x5d3818, roughness: .3 }),
    pupil: new THREE.MeshStandardMaterial({ color: 0x140c06, roughness: .25 }),
    spark: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    dark: new THREE.MeshStandardMaterial({ color: 0x33200f, roughness: .7 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x9f3825, roughness: .42, metalness: .12 }),
    crease: new THREE.MeshStandardMaterial({ color: 0x8b612c, roughness: .72 }),
    nostrilRim: new THREE.MeshStandardMaterial({ color: 0xc79443, roughness: .72 }),
    capRed: new THREE.MeshStandardMaterial({ color: 0xb4402c, roughness: .62 }),
    capCream: new THREE.MeshStandardMaterial({ color: 0xe9dcb6, roughness: .68 }),
    strap: new THREE.MeshStandardMaterial({ color: 0x2e6f96, roughness: .74 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: .32, metalness: .8 }),
    lens: new THREE.MeshPhysicalMaterial({
      color: 0xd6f0ea,
      roughness: .07,
      metalness: 0,
      transparent: true,
      opacity: .14,
      transmission: .55,
      depthWrite: false,
    }),
  };

  // Scutes and eyelids read as hide but must not pick up the belly gradient,
  // since both sit where that gradient would paint them the wrong way round.
  const scuteGeometry = paint(new THREE.SphereGeometry(1, 16, 12), flatTone(BACK, 1.24));

  const scute = (parent, at, radius) =>
    addMesh(parent, scuteGeometry, materials.limb, at, [0, 0, 0], [radius * 1.25, radius, radius]);

  const jerry = new THREE.Group();
  jerry.name = 'Jerry';

  /* -- torso: one egg from the hips to the neck, widest at the navel --------- */
  const TORSO_Y = 1.32;
  const torso = new THREE.Group();
  torso.position.set(0, TORSO_Y, 0);
  jerry.add(torso);
  addMesh(torso, paint(blob([
    { at: [.02, -.36, 0], size: [.50, .30, .50] },    // hips; the legs emerge below this
    { at: [.10, -.22, 0], size: [.60, .38, .60] },    // heavy lower belly
    { at: [.12, -.04, 0], size: [.65, .42, .66] },    // widest point, just under the navel
    { at: [.02, .26, 0], size: [.58, .38, .62] },     // chest
    { at: [-.02, .52, 0], size: [.46, .30, .52] },    // narrow, sloping shoulders
    { at: [.02, .74, 0], size: [.26, .22, .30] },     // neck stub, buried in the head
  ], { segments: 88, rings: 56, smooth: .16 }), bellyTone(.70)), materials.body);

  // Scutes down the spine, half-buried in the back, swelling over the ribs and
  // tapering away at both ends.
  for (const [y, x, radius] of [
    [1.95, -.43, .060], [1.84, -.47, .070], [1.70, -.51, .080], [1.58, -.54, .088],
    [1.44, -.52, .090], [1.30, -.52, .090], [1.15, -.50, .084], [1.00, -.48, .074],
    [.88, -.45, .062],
  ]) scute(torso, [x, y - TORSO_Y, 0], radius);

  /* -- head: cranium, brow, cheeks and a tapered turtle snout ---------------- */
  const head = new THREE.Group();
  head.position.set(0, 2.50, 0);
  head.scale.setScalar(1.05);
  jerry.add(head);

  addMesh(head, paint(blob([
    { at: [-.14, .09, 0], size: [.50, .46, .53] },    // tall, broad cranium
    { at: [.06, .31, 0], size: [.36, .18, .43] },     // heavy brow shelf above the spectacles
    // Each eye sits on a separate fleshy mound, with a full cheek below it.
    // That paired structure is the strongest feature in the turnaround.
    { at: [.23, .17, -.32], size: [.28, .27, .25] },
    { at: [.23, .17, .32], size: [.28, .27, .25] },
    { at: [.10, -.15, -.35], size: [.34, .29, .27] },
    { at: [.10, -.15, .35], size: [.34, .29, .27] },
    { at: [-.16, -.30, 0], size: [.34, .28, .36] },   // throat, sinking into the collar
    { at: [.38, .06, 0], size: [.28, .28, .25] },     // raised bridge between the eyes
    { at: [.58, -.02, 0], size: [.29, .24, .23] },    // pear-shaped nose
    { at: [.75, -.11, 0], size: [.18, .18, .19] },    // downturned beak tip
    { at: [.43, -.18, 0], size: [.35, .105, .29] },   // overhanging upper lip
  ], { segments: 96, rings: 60, smooth: .13 }), bellyTone(.6, .35)), materials.head);

  for (const [x, y, radius] of [[-.50, .24, .062], [-.53, .04, .072], [-.46, -.16, .062]]) {
    scute(head, [x, y, 0], radius);
  }

  // Raised nostril rims and dark insets. A pair of bare black dots disappeared
  // at game scale and made the nose look flat rather than softly moulded.
  for (const z of [-.08, .08]) {
    addMesh(head, new THREE.SphereGeometry(.034, 12, 9), materials.dark, [.947, .035, z * 1.32], [0, 0, -.35], [1, .70, .82]);
    addMesh(head, new THREE.TorusGeometry(.040, .010, 8, 20), materials.nostrilRim, [.96, .038, z * 1.32], [0, Math.PI / 2, 0], [1, .92, 1]);
  }

  // The vertical seam is what turns the muzzle from a generic rounded snout
  // into the little two-lobed beak seen head-on in every front reference.
  strut(head, materials.crease, [.955, .035, 0], [.975, -.065, 0], .0045, 7);
  strut(head, materials.crease, [.975, -.065, 0], [.94, -.185, 0], .0045, 7);

  /* -- the grin ------------------------------------------------------------- */
  // Swinging the jaw open leaves a hole in the head — back faces are culled, so
  // without a plug you see straight through it. The plug is a near-copy of the
  // upper-lip ellipsoid dropped a little way down: same width, same curve, so
  // it can only ever show as a crescent hugging the lip line, and never breaks
  // the surface at the sides the way a free-standing ball does.
  addMesh(head, new THREE.SphereGeometry(1, 26, 18), materials.mouth, [.43, -.285, 0], [0, 0, 0], [.36, .17, .34]);

  // Blunt upper teeth hanging off that lip line. They climb faster than the lip
  // does towards the corners, so the outer ones tuck up out of sight instead of
  // hanging below it as tusks.
  for (let i = 0; i < 5; i++) {
    const angle = (i / 4 - .5) * 1.7;
    addMesh(
      head,
      new THREE.BoxGeometry(.036, .032, .036),
      materials.tooth,
      [.46 + Math.cos(angle) * .24, -.285 + Math.abs(angle) * .065, Math.sin(angle) * .24],
      [0, -angle, 0],
    );
  }

  // Lower jaw, hinged behind the cheeks. player.js drives it from a -0.32
  // baseline, so the mouth hangs open in the neutral pose. The reference shows
  // a pale lower lip and no lower fangs, which the belly tone gives for free.
  const jaw = new THREE.Group();
  jaw.position.set(.05, -.17, 0);
  jaw.rotation.z = -.32;
  head.add(jaw);
  addMesh(jaw, paint(blob([
    // A shallow U-shaped lip rather than another chin-sized ellipsoid. Keeping
    // the corners behind the cheeks leaves a clean opening without growing a
    // pale wedge from the mouth all the way down to the collar.
    { at: [.50, -.05, 0], size: [.27, .085, .27] },
    { at: [.33, .00, -.23], size: [.20, .10, .16] },
    { at: [.33, .00, .23], size: [.20, .10, .16] },
  ], { segments: 48, rings: 30, smooth: .15 }), (shade, point) => {
    shade.copy(BACK).lerp(BELLY, THREE.MathUtils.smoothstep(-point.y * 2.4 + .3, -.8, .8));
  }), materials.limb);
  // The tongue rides on the jaw rather than the skull, so it stays in the mouth
  // while the grin flaps.
  addMesh(jaw, new THREE.SphereGeometry(1, 18, 12), materials.tongue, [.51, -.02, 0], [0, 0, .32], [.19, .035, .17]);

  /* -- bulging eyes behind chunky round spectacles --------------------------- */
  const eyes = [];
  for (const z of [-.30, .30]) {
    const side = Math.sign(z);
    const socket = new THREE.Group();
    socket.position.set(.55, .19, z);
    socket.rotation.y = -side * .10;
    head.add(socket);

    const eye = addMesh(socket, new THREE.SphereGeometry(.185, 28, 22), materials.sclera);

    // Iris, pupil and catchlight are shells of the eyeball, so they can never
    // sink into it however the socket is turned. The iris is kept narrow enough
    // that white shows all round it — that ring of white is what makes the eye
    // read as a startled cartoon eye rather than a dark socket.
    const gaze = new THREE.Group();
    gaze.rotation.set(0, side * .05, -.06);
    socket.add(gaze);
    addMesh(gaze, eyeCap(.187, .50), materials.iris);
    const pupil = addMesh(gaze, eyeCap(.190, .26), materials.pupil);
    addMesh(gaze, eyeCap(.194, .105), materials.spark, [0, 0, 0], [0, -side * .38, .45]);
    eyes.push({ eye, pupil });

    // Spectacles: a thick rim framing the eye, a barely there lens, and a temple
    // running back over the cheek to the skull. The rim's *opening* has to clear
    // the eyeball — a rim narrower than the eye crops it into a dark slot.
    addMesh(socket, new THREE.TorusGeometry(.238, .040, 10, 32), materials.frame, [.225, 0, 0], [0, Math.PI / 2, 0], [1, .98, 1]);
    addMesh(socket, new THREE.CircleGeometry(.225, 28), materials.lens, [.235, 0, 0], [0, Math.PI / 2, 0]);
    addMesh(socket, new THREE.SphereGeometry(.019, 10, 8), materials.steel, [.255, .14, side * .185]);
    strut(head, materials.frame, [.61, .22, side * .42], [-.28, .28, side * .47], .028);
  }
  // Bridge across the upper nose, safely above the pupils.
  strut(head, materials.frame, [.805, .27, -.16], [.805, .27, .16], .034);

  /* -- propeller beanie ----------------------------------------------------- */
  const cap = new THREE.Group();
  cap.position.set(-.06, .30, 0);
  cap.rotation.set(0, 0, .12);
  head.add(cap);

  for (let i = 0; i < 6; i++) {
    addMesh(
      cap,
      new THREE.SphereGeometry(1, 16, 12, i * Math.PI / 3, Math.PI / 3, 0, Math.PI / 2),
      i % 2 ? materials.capCream : materials.capRed,
      [0, 0, 0],
      [0, 0, 0],
      [.55, .41, .55],
    );
  }
  addMesh(cap, new THREE.TorusGeometry(.55, .05, 10, 32), materials.capRed, [0, .01, 0], [Math.PI / 2, 0, 0], [1.02, 1.02, 1]);
  // Short bill over the brow. Cylinder theta starts at +z, so the sector is
  // swung round to +x; the extra tilt undoes the cap's backward cant.
  addMesh(
    cap,
    new THREE.CylinderGeometry(.74, .74, .05, 28, 1, false, Math.PI / 2 - .58, 1.16),
    materials.capRed,
    [0, .05, 0],
    [0, 0, -.3],
  );
  addMesh(cap, new THREE.SphereGeometry(.07, 12, 10), materials.capRed, [0, .41, 0]);
  addMesh(cap, new THREE.CylinderGeometry(.02, .024, .15, 10), materials.steel, [0, .49, 0]);

  const propeller = new THREE.Group();
  propeller.position.set(0, .58, 0);
  cap.add(propeller);
  addMesh(propeller, new THREE.SphereGeometry(.055, 12, 10), materials.frame);
  for (const side of [-1, 1]) {
    // Long tapered paddles rather than slabs, pitched like a real prop. The
    // pitch is kept shallow so the blades still read as blades from the front.
    addMesh(propeller, new THREE.SphereGeometry(1, 14, 10), materials.strap, [side * .34, 0, 0], [side * .26, 0, 0], [.34, .028, .12]);
  }

  /* -- blue harness and the backup-engineer nameplate ------------------------ */
  // A collar at the base of the neck, a belt round the barrel, and two shoulder
  // straps crossing at a steel ring in the middle of the back.
  const collar = new THREE.Group();
  collar.position.set(0, 1.97, 0);
  collar.rotation.z = -.16;
  jerry.add(collar);
  addMesh(collar, new THREE.TorusGeometry(.46, .05, 10, 36), materials.strap, [0, 0, 0], [Math.PI / 2, 0, 0], [1.06, 1, 1]);

  // The barrel is an ellipse in plan, so the belt is a scaled ring rather than
  // a circle — a circle would either float at the belly or cut into the flanks.
  addMesh(jerry, new THREE.TorusGeometry(.62, .048, 10, 40), materials.strap, [.02, 1.62, 0], [Math.PI / 2, 0, 0], [.94, 1, 1]);

  for (const side of [-1, 1]) {
    strut(jerry, materials.strap, [.20, 1.92, side * .34], [-.16, 1.86, side * .44], .044);
    strut(jerry, materials.strap, [-.16, 1.86, side * .44], [-.52, 1.45, 0], .044);
    strut(jerry, materials.strap, [-.52, 1.45, 0], [-.34, 1.30, side * .50], .044);
  }
  addMesh(jerry, new THREE.TorusGeometry(.085, .022, 8, 20), materials.steel, [-.56, 1.45, 0], [0, Math.PI / 2, 0]);

  // The plate clips to the front of the collar and lies back against the chest.
  // The chest slopes out hard on the way down to the navel, so the plate is
  // raked to match it; hung vertically its bottom half disappears into the gut.
  addMesh(jerry, new THREE.BoxGeometry(.09, .16, .12), materials.steel, [.50, 1.92, 0], [0, 0, .4]);
  addMesh(
    jerry,
    new THREE.BoxGeometry(.04, .54, .50),
    new THREE.MeshStandardMaterial({ map: badgeTexture(), roughness: .58 }),
    [.66, 1.66, 0],
    [0, 0, .4],
  );

  /* -- short arms with three stubby clawed fingers --------------------------- */
  const armGeometry = paint(blob([
    { at: [0, -.06, 0], size: [.20, .20, .20] },
    { at: [.02, -.24, 0], size: [.17, .17, .17] },
    { at: [.04, -.40, 0], size: [.155, .155, .155] },
    { at: [.08, -.54, 0], size: [.145, .145, .145] },
    { at: [.13, -.66, 0], size: [.16, .13, .16] },
  ], { segments: 40, rings: 26, smooth: .14 }), bellyTone(.34));

  const arms = [];
  for (const z of [-.62, .62]) {
    const side = Math.sign(z);
    const arm = new THREE.Group();
    arm.position.set(.06, 1.80, z);
    // The outward splay lives on x, because player.js owns rotation.z here.
    // It has to clear the widest part of the belly or the hand vanishes into it.
    arm.rotation.x = -side * .3;
    jerry.add(arm);

    // player.js swings the arm from a -0.5 baseline, so the limb carries +0.5
    // and the neutral pose is straight down at Jerry's side.
    const limb = new THREE.Group();
    limb.rotation.z = .5;
    arm.add(limb);
    addMesh(limb, armGeometry, materials.limb);

    // Fat little fingers, near enough merged into a mitt, tipped with dark horn.
    for (let i = 0; i < 3; i++) {
      const spread = (i - 1) * .08;
      const tip = [.21, -.80 + Math.abs(i - 1) * .015, spread * 1.3];
      strut(limb, materials.limb, [.14, -.70, spread], tip, .062);
      claw(limb, materials.horn, tip, [.45, -.95, spread * 3], .028, .05);
    }
    arms.push(arm);
  }

  /* -- stubby legs and broad three-toed feet -------------------------------- */
  const legGeometry = paint(blob([
    { at: [0, -.02, 0], size: [.28, .26, .28] },
    { at: [.02, -.24, 0], size: [.23, .20, .23] },
    { at: [.05, -.40, 0], size: [.20, .18, .20] },
  ], { segments: 44, rings: 28, smooth: .14 }), bellyTone(.4));
  const footGeometry = paint(blob([
    { at: [0, 0, 0], size: [.26, .14, .25] },
    { at: [.20, -.01, 0], size: [.24, .12, .26] },
  ], { segments: 36, rings: 22, smooth: .14 }), bellyTone(.3, .4));

  const legs = [];
  for (const z of [-.30, .30]) {
    const side = Math.sign(z);
    const leg = new THREE.Group();
    leg.position.set(0, .84, z);
    jerry.add(leg);
    addMesh(leg, legGeometry, materials.limb, [0, 0, 0], [0, side * .08, 0]);

    const foot = new THREE.Group();
    foot.position.set(.06, -.70, 0);
    foot.rotation.y = side * .18;
    leg.add(foot);
    addMesh(foot, footGeometry, materials.limb);
    for (let i = 0; i < 3; i++) {
      const spread = (i - 1) * .16;
      const tip = [.40, -.04, spread * 1.5];
      strut(foot, materials.limb, [.18, -.02, spread * .6], tip, .07);
      // Broad rounded nails, not talons — the reference toes end in flat caps.
      addMesh(foot, new THREE.SphereGeometry(.05, 14, 10), materials.nail, [tip[0] + .05, tip[1] + .012, tip[2] * 1.04], [0, 0, -.25], [1.5, .8, .95]);
    }
    legs.push(leg);
  }

  /* -- short fat tail -------------------------------------------------------- */
  const tail = new THREE.Group();
  tail.position.set(-.48, .98, 0);
  tail.rotation.z = .55;
  jerry.add(tail);
  addMesh(tail, paint(blob([
    { at: [0, 0, 0], size: [.26, .28, .26] },
    { at: [-.24, 0, 0], size: [.20, .21, .20] },
    { at: [-.44, .03, 0], size: [.13, .14, .13] },
    { at: [-.60, .08, 0], size: [.07, .07, .07] },
  ], { segments: 44, rings: 28, smooth: .14 }), bellyTone(.5)), materials.limb);
  for (const [x, y, radius] of [[0, .25, .050], [-.24, .18, .040], [-.44, .14, .030], [-.60, .13, .020]]) {
    scute(tail, [x, y, 0], radius);
  }

  // No carried fill light here. Data Dash needed one because its key light was near-
  // monochrome lime, which flattened the hide; the swamp lights neutrally, so a fill would
  // only add a travelling pool of light on the ground and an extra light to shade against.
  return { group: jerry, torso, head, jaw, legs, tail, arms, eyes, propeller };
}
