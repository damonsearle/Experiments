import * as THREE from 'three';

/* ------------------------------------------------------------------ helpers */

function noise(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function rgba(hex, alpha) {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
}

// Repeats a stamp across the texture edges it overlaps so the hide tiles seamlessly.
function tiled(size, x, y, radius, draw) {
  const ox = x < radius ? size : x > size - radius ? -size : 0;
  const oy = y < radius ? size : y > size - radius ? -size : 0;
  draw(x, y);
  if (ox) draw(x + ox, y);
  if (oy) draw(x, y + oy);
  if (ox && oy) draw(x + ox, y + oy);
}

/* -------------------------------------------------------------- pebbled hide */

const HIDE_SIZE = 512;

// Jerry's skin in the reference art is a warty, pebbled hide: hundreds of little raised
// bumps over a blotchy tan. One pass paints them, the same pass embosses a bump map.
function hideMaps({ base, spot, glow, seed, pebbles = 760 }) {
  const colorCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  colorCanvas.width = colorCanvas.height = bumpCanvas.width = bumpCanvas.height = HIDE_SIZE;
  const color = colorCanvas.getContext('2d');
  const bump = bumpCanvas.getContext('2d');
  const random = noise(seed);

  color.fillStyle = base;
  color.fillRect(0, 0, HIDE_SIZE, HIDE_SIZE);
  bump.fillStyle = '#6b6b6b';
  bump.fillRect(0, 0, HIDE_SIZE, HIDE_SIZE);

  // Broad blotches keep the hide from reading as flat paint.
  for (let i = 0; i < 90; i++) {
    const radius = 28 + random() * 118;
    const tint = random() < .5 ? spot : glow;
    const alpha = .05 + random() * .1;
    tiled(HIDE_SIZE, random() * HIDE_SIZE, random() * HIDE_SIZE, radius, (x, y) => {
      const wash = color.createRadialGradient(x, y, 0, x, y, radius);
      wash.addColorStop(0, rgba(tint, alpha));
      wash.addColorStop(1, rgba(tint, 0));
      color.fillStyle = wash;
      color.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    });
  }

  // The warts themselves: a lit crown with a darker rim, embossed to match.
  for (let i = 0; i < pebbles; i++) {
    const radius = 1.4 + random() * random() * 5.4;
    const strength = .22 + random() * .44;
    tiled(HIDE_SIZE, random() * HIDE_SIZE, random() * HIDE_SIZE, radius + 2, (x, y) => {
      const shell = color.createRadialGradient(x - radius * .32, y - radius * .32, 0, x, y, radius * 1.05);
      shell.addColorStop(0, rgba(glow, strength * .55));
      shell.addColorStop(.48, rgba(glow, 0));
      shell.addColorStop(.78, rgba(spot, strength * .5));
      shell.addColorStop(1, rgba(spot, strength));
      color.fillStyle = shell;
      color.beginPath();
      color.arc(x, y, radius * 1.05, 0, Math.PI * 2);
      color.fill();

      const dome = bump.createRadialGradient(x, y, 0, x, y, radius);
      dome.addColorStop(0, `rgba(255,255,255,${strength})`);
      dome.addColorStop(.68, `rgba(255,255,255,${strength * .28})`);
      dome.addColorStop(1, 'rgba(255,255,255,0)');
      bump.fillStyle = dome;
      bump.beginPath();
      bump.arc(x, y, radius, 0, Math.PI * 2);
      bump.fill();
    });
  }

  // Dark freckles scattered between the warts, then fine grain on the bump map alone.
  for (let i = 0; i < 1700; i++) {
    const radius = 1 + random() * random() * 3.4;
    color.fillStyle = rgba(spot, .14 + random() * .34);
    color.beginPath();
    color.arc(random() * HIDE_SIZE, random() * HIDE_SIZE, radius, 0, Math.PI * 2);
    color.fill();
  }
  for (let i = 0; i < 6000; i++) {
    bump.fillStyle = random() < .5 ? 'rgba(0,0,0,.1)' : 'rgba(255,255,255,.1)';
    bump.fillRect(random() * HIDE_SIZE, random() * HIDE_SIZE, 1.7, 1.7);
  }

  const upload = (canvas, srgb) => {
    const texture = new THREE.CanvasTexture(canvas);
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    return texture;
  };
  return { map: upload(colorCanvas, true), bumpMap: upload(bumpCanvas, false) };
}

function hideMaterial(maps, repeat, options = {}) {
  const map = maps.map.clone();
  const bumpMap = maps.bumpMap.clone();
  map.needsUpdate = bumpMap.needsUpdate = true;
  map.repeat.set(...repeat);
  bumpMap.repeat.set(...repeat);
  return new THREE.MeshStandardMaterial({
    map,
    bumpMap,
    bumpScale: 1,
    roughness: .84,
    metalness: 0,
    vertexColors: true,
    ...options,
  });
}

/* -------------------------------------------------------------- blob shaping */

function deform(geometry, transform) {
  const position = geometry.attributes.position;
  const vertex = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    transform(vertex);
    position.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

// Jerry is built from soft blended masses rather than stuck-together primitives. Each part
// is a unit sphere whose vertices are pushed out along their own direction until they land
// on the smooth union of a handful of ellipsoids — one continuous, organic surface.
// Maps a unit direction to the radius at which it meets the smooth union of the ellipsoids.
// Shared so a patch can be laid exactly onto a surface another mesh already generated.
function blobSurface(masses, smooth = .13) {
  const distances = new Float64Array(masses.length);
  let reach = 0;
  for (const mass of masses) {
    reach = Math.max(reach, Math.hypot(...mass.at) + Math.max(...mass.size) * 1.6);
  }

  // Smooth minimum of the normalised ellipsoid distances; 1 is the surface.
  const field = (x, y, z) => {
    let closest = Infinity;
    for (let i = 0; i < masses.length; i++) {
      const { at, size } = masses[i];
      const dx = (x - at[0]) / size[0];
      const dy = (y - at[1]) / size[1];
      const dz = (z - at[2]) / size[2];
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      distances[i] = distance;
      if (distance < closest) closest = distance;
    }
    let total = 0;
    for (let i = 0; i < masses.length; i++) total += Math.exp((closest - distances[i]) / smooth);
    return closest - smooth * Math.log(total);
  };

  return direction => {
    let low = 0;
    let high = reach;
    for (let i = 0; i < 26; i++) {
      const mid = (low + high) * .5;
      if (field(direction.x * mid, direction.y * mid, direction.z * mid) < 1) low = mid;
      else high = mid;
    }
    return (low + high) * .5;
  };
}

// Pass a partial sphere as `geometry` and a `swell` just over 1 to get a patch that hugs the
// surface a hair proud of it — a decal that follows every bulge, with no gap and no z-fight.
function blob(masses, { geometry, segments = 72, rings, smooth = .13, swell = 1 } = {}) {
  const shape = geometry ?? new THREE.SphereGeometry(1, segments, rings ?? Math.round(segments * .62));
  const surface = blobSurface(masses, smooth);
  return deform(shape, direction => direction.multiplyScalar(surface(direction) * swell));
}

// three's sphere parameterisation, so patches and surface probes agree on where a point is.
function onSphere(theta, phi, target = new THREE.Vector3()) {
  return target.set(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
}

// Bakes the belly-to-back gradient of the reference art straight into the mesh.
function paint(geometry, tone) {
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const colors = new Float32Array(position.count * 3);
  const point = new THREE.Vector3();
  const facing = new THREE.Vector3();
  const shade = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i);
    facing.fromBufferAttribute(normal, i);
    shade.setRGB(1, 1, 1);
    tone(shade, point, facing);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

const BACK = new THREE.Color(.68, .61, .50);
const BELLY = new THREE.Color(1.2, 1.13, .96);
const LIP = new THREE.Color(1.32, 1.22, 1.04);

// Lighter towards the belly (+x, low), darker over the spine.
function bellyTone(spread, lift = 0) {
  return (shade, point) => {
    const t = THREE.MathUtils.smoothstep(point.x / spread - point.y * .25 + lift, -.85, .85);
    shade.copy(BACK).lerp(BELLY, t);
  };
}

// The muzzle carries the same gradient plus a pale band along the lip line, the way the
// reference art lightens the skin right around Jerry's mouth.
function headTone(shade, point) {
  const t = THREE.MathUtils.smoothstep(point.x / .6 - point.y * .25 + .35, -.85, .85);
  shade.copy(BACK).lerp(BELLY, t);
  const band = 1 - THREE.MathUtils.smoothstep(Math.abs(point.y + .19), .04, .17);
  shade.lerp(LIP, band * THREE.MathUtils.smoothstep(point.x, .18, .44) * .85);
}

/* ---------------------------------------------------------------- assembling */

function addMesh(parent, geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.rotation.set(...rotation);
  object.scale.set(...scale);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

const UP = new THREE.Vector3(0, 1, 0);

// A capsule stretched between two points — straps, fingers, glasses arms. Every geometry
// gets a colour attribute so it stays valid under the vertex-coloured hide materials.
function strut(parent, material, from, to, radius, segments = 10) {
  const start = new THREE.Vector3(...from);
  const direction = new THREE.Vector3(...to).sub(start);
  const length = direction.length();
  const geometry = new THREE.CapsuleGeometry(radius, Math.max(length - radius * 2, .002), 4, segments);
  const object = addMesh(parent, paint(geometry, () => {}), material);
  object.position.copy(start).addScaledVector(direction, .5);
  object.quaternion.setFromUnitVectors(UP, direction.normalize());
  return object;
}

// A tapered claw pointing along a direction.
function claw(parent, material, from, direction, radius, length) {
  const aim = new THREE.Vector3(...direction).normalize();
  const object = addMesh(parent, paint(new THREE.ConeGeometry(radius, length, 7), () => {}), material);
  object.position.set(...from).addScaledVector(aim, length * .5);
  object.quaternion.setFromUnitVectors(UP, aim);
  return object;
}

// A cap of the eyeball surface, poled towards +x — iris, pupil and catchlight all sit flush.
function eyeCap(radius, spread) {
  const geometry = new THREE.SphereGeometry(radius, 30, 20, 0, Math.PI * 2, 0, spread);
  geometry.rotateZ(-Math.PI / 2);
  return geometry;
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

export function createJerry(scene) {
  const hide = hideMaps({ base: '#b8843e', spot: '#4b2a0c', glow: '#e2bd7f', seed: 91, pebbles: 1100 });

  const materials = {
    body: hideMaterial(hide, [3, 2.2]),
    head: hideMaterial(hide, [2.4, 1.8]),
    limb: hideMaterial(hide, [1.6, 1.2]),
    // Fully rough and unlit-looking, so the opening never catches a highlight and turns back
    // into a shiny lump.
    mouth: new THREE.MeshStandardMaterial({ color: 0x35120f, roughness: 1, metalness: 0, side: THREE.DoubleSide }),
    tongue: new THREE.MeshStandardMaterial({ color: 0xb9645b, roughness: .34 }),
    nostril: new THREE.MeshStandardMaterial({ color: 0x2e1c0e, roughness: .86 }),
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
      color: 0xe8f6f2,
      roughness: .05,
      metalness: 0,
      transparent: true,
      opacity: .1,
      transmission: .75,
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

  // One continuous face, jaw included — in the reference art Jerry has no separate hanging
  // jaw, just a mouth cut into a solid muzzle.
  const headMasses = [
    { at: [-.06, .04, 0], size: [.55, .54, .55] },    // cranium
    { at: [.26, .19, -.28], size: [.22, .22, .22] },  // mounds the eyeballs sit in
    { at: [.26, .19, .28], size: [.22, .22, .22] },
    { at: [.12, -.16, -.32], size: [.30, .28, .24] }, // cheeks
    { at: [.12, -.16, .32], size: [.30, .28, .24] },
    { at: [.4, .02, 0], size: [.37, .25, .39] },      // muzzle
    { at: [.56, .02, 0], size: [.29, .23, .33] },     // blunt, rounded snout
    { at: [.44, -.26, 0], size: [.34, .19, .34] },    // jaw and chin
    { at: [-.14, -.30, 0], size: [.34, .26, .33] },   // throat into the collar
  ];
  const HEAD_SMOOTH = .15;
  addMesh(head, paint(blob(headMasses, { segments: 96, rings: 60, smooth: HEAD_SMOOTH }), headTone), materials.head);
  const headSurface = blobSurface(headMasses, HEAD_SMOOTH);

  // Nostrils: dark slanted ovals set into the front of the snout, as in the mugshots.
  for (const z of [-.11, .11]) {
    addMesh(head, new THREE.SphereGeometry(1, 14, 10), materials.nostril, [.85, .09, z], [0, 0, -.55], [.055, .066, .038]);
  }

  /* -- open, toothy grin ---------------------------------------------------- */
  // The mouth is a patch laid onto the muzzle's own surface rather than a blob parked in
  // front of it: it follows every bulge, sits a hair proud, and so reads as an opening.
  const MOUTH_THETA = 2.06;
  const MOUTH_HALF = .19;
  const MOUTH_PHI = .58;
  const mouth = new THREE.Group();
  head.add(mouth);
  addMesh(mouth, blob(headMasses, {
    geometry: new THREE.SphereGeometry(1, 44, 26, Math.PI - MOUTH_PHI, MOUTH_PHI * 2, MOUTH_THETA - MOUTH_HALF, MOUTH_HALF * 2),
    smooth: HEAD_SMOOTH,
    swell: 1.004,
  }), materials.mouth);

  // Tongue: the same trick again, a smaller patch riding just proud of the mouth.
  addMesh(mouth, blob(headMasses, {
    geometry: new THREE.SphereGeometry(1, 30, 16, Math.PI - .36, .72, MOUTH_THETA + .01, .16),
    smooth: HEAD_SMOOTH,
    swell: 1.045,
  }), materials.tongue);

  // Teeth stand on the rim of the patch, aimed across the opening at its centre.
  const rim = new THREE.Vector3();
  const mouthCentre = onSphere(MOUTH_THETA, Math.PI).multiplyScalar(headSurface(onSphere(MOUTH_THETA, Math.PI)));
  const toothAim = new THREE.Vector3();
  for (const [count, edge, radius, length] of [[7, -1, .022, .055], [5, 1, .016, .038]]) {
    for (let i = 0; i < count; i++) {
      const phi = Math.PI + (i / (count - 1) - .5) * MOUTH_PHI * (edge < 0 ? 1.7 : 1.15);
      onSphere(MOUTH_THETA + edge * MOUTH_HALF * .92, phi, rim);
      rim.multiplyScalar(headSurface(rim) * 1.005);
      toothAim.copy(mouthCentre).sub(rim);
      claw(mouth, materials.ivory, rim.toArray(), toothAim.toArray(), radius, length);
    }
  }

  /* -- big bulging eyes behind chunky round glasses ------------------------- */
  const eyes = [];
  for (const z of [-.28, .28]) {
    const side = Math.sign(z);
    const socket = new THREE.Group();
    socket.position.set(.4, .22, z);
    socket.rotation.y = -side * .12;
    head.add(socket);

    const eye = addMesh(socket, new THREE.SphereGeometry(.22, 26, 20), materials.sclera);

    // Iris, pupil and catchlight are shells of the eyeball, so they can never sink into it.
    const gaze = new THREE.Group();
    gaze.rotation.set(0, side * .05, -.03);
    socket.add(gaze);
    addMesh(gaze, eyeCap(.222, .8), materials.iris);
    const pupil = addMesh(gaze, eyeCap(.226, .42), materials.pupil);
    addMesh(gaze, eyeCap(.231, .17), materials.spark, [0, 0, 0], [.9, 0, -.55]);
    eyes.push({ eye, pupil });

    // Glasses: slim round wire rims, a near-clear lens, and a stem back over the cheek.
    addMesh(socket, new THREE.TorusGeometry(.215, .021, 10, 40), materials.frame, [.18, -.01, 0], [0, Math.PI / 2, 0], [1, .97, 1]);
    addMesh(socket, new THREE.CircleGeometry(.21, 32), materials.lens, [.225, -.01, 0], [0, Math.PI / 2, 0]);
    strut(socket, materials.frame, [.14, .02, side * .21], [-.22, -.04, side * .3], .018);
  }
  // Bridge: a small arc hopping over the snout between the two rims.
  addMesh(head, new THREE.TorusGeometry(.09, .02, 8, 20, Math.PI), materials.frame, [.62, .13, 0], [0, Math.PI / 2, 0]);

  /* -- propeller beanie ----------------------------------------------------- */
  const cap = new THREE.Group();
  cap.position.set(-.04, .35, 0);
  cap.rotation.set(.08, 0, .19);
  head.add(cap);

  for (let i = 0; i < 6; i++) {
    addMesh(
      cap,
      new THREE.SphereGeometry(1, 16, 12, i * Math.PI / 3, Math.PI / 3, 0, Math.PI / 2),
      i % 2 ? materials.capCream : materials.capRed,
      [0, 0, 0],
      [0, 0, 0],
      [.52, .44, .53],
    );
  }
  addMesh(cap, new THREE.TorusGeometry(.512, .05, 10, 32), materials.capRed, [0, .02, 0], [Math.PI / 2, 0, 0], [1.01, 1.01, 1]);
  // Short brim over the brow: a torus arc swung round to +x and flattened into a peak, so it
  // stays closed geometry rather than a cylinder sector with open sides.
  const brimArc = 1.5;
  const brim = new THREE.TorusGeometry(.46, .11, 8, 26, brimArc);
  brim.rotateZ(-brimArc / 2);
  brim.rotateX(-Math.PI / 2);
  brim.scale(1, .3, 1);
  addMesh(cap, brim, materials.capRed, [0, .03, 0], [0, 0, .1]);
  addMesh(cap, new THREE.SphereGeometry(.068, 12, 10), materials.capRed, [0, .44, 0]);
  addMesh(cap, new THREE.CylinderGeometry(.02, .024, .14, 10), materials.steel, [0, .52, 0]);

  const propeller = new THREE.Group();
  propeller.position.set(0, .61, 0);
  cap.add(propeller);
  addMesh(propeller, new THREE.SphereGeometry(.052, 12, 10), materials.frame);
  for (const side of [-1, 1]) {
    addMesh(propeller, new THREE.BoxGeometry(.32, .026, .12), materials.strap, [side * .18, 0, 0], [side * .38, 0, 0]);
  }

  /* -- lanyard and the backup-engineer badge -------------------------------- */
  // Straps ride over the shoulders and meet at the clip, the way the reference badge hangs.
  // The straps run wide of the chin, down the sides of the chest, and meet at the clip.
  for (const side of [-1, 1]) {
    strut(jerry, materials.strap, [.06, 1.94, side * .48], [.46, 1.68, side * .38], .034);
    strut(jerry, materials.strap, [.46, 1.68, side * .38], [.76, 1.52, side * .06], .034);
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

  // The scene's key light is near-monochrome lime, which flattens the hide. A short-range warm
  // fill rides along with Jerry so his own colouring still reads without relighting the level.
  const fill = new THREE.PointLight(0xffd2a0, 30, 9, 2);
  fill.position.set(2.8, 2.6, 3);
  jerry.add(fill);
  const wrap = new THREE.PointLight(0xffb070, 12, 7, 2);
  wrap.position.set(-1.2, 1.8, -2.4);
  jerry.add(wrap);

  jerry.position.set(-2.9, 0, 0);
  scene.add(jerry);
  return { group: jerry, torso, head, mouth, legs, tail, arms, eyes, propeller, velocity: 0 };
}
