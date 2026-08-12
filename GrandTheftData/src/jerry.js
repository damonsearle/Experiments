import * as THREE from 'three';

function speckleTexture(base, spot, seed = 7) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = base;
  context.fillRect(0, 0, canvas.width, canvas.height);

  let randomState = seed;
  const random = () => {
    randomState = (randomState * 1664525 + 1013904223) >>> 0;
    return randomState / 4294967296;
  };

  for (let i = 0; i < 145; i++) {
    const radius = 1.5 + random() * 4.6;
    context.globalAlpha = .28 + random() * .38;
    context.fillStyle = spot;
    context.beginPath();
    context.arc(random() * 256, random() * 256, radius, 0, Math.PI * 2);
    context.fill();
  }

  context.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.6, 1.8);
  return texture;
}

function badgeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 620;
  const context = canvas.getContext('2d');

  context.fillStyle = '#e8d6a9';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#57331e';
  context.lineWidth = 24;
  context.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
  context.textAlign = 'center';
  context.fillStyle = '#271711';
  context.font = '700 92px Arial';
  context.fillText('JERRY', 256, 142);
  context.font = '700 52px Arial';
  context.fillText('BACKUP', 256, 252);
  context.fillText('ENGINEER', 256, 320);
  context.fillStyle = '#872b22';
  context.fillRect(45, 394, 422, 145);
  context.fillStyle = '#f1dfb5';
  context.font = '700 49px Arial';
  context.fillText('LUNCH MODE', 256, 482);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addMesh(parent, geometry, material, position, rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.rotation.set(...rotation);
  object.scale.set(...scale);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function addToes(parent, material, z) {
  for (let i = 0; i < 3; i++) {
    addMesh(
      parent,
      new THREE.ConeGeometry(.045, .16, 6),
      material,
      [.19 + i * .105, -.31, z + (i - 1) * .075],
      [0, 0, -Math.PI / 2],
    );
  }
}

export function createJerry(scene) {
  const skinMap = speckleTexture('#b96f2d', '#482515');
  const paleSkinMap = speckleTexture('#cf8c46', '#68401f', 19);
  const materials = {
    skin: new THREE.MeshStandardMaterial({ map: skinMap, roughness: .84, metalness: .01 }),
    paleSkin: new THREE.MeshStandardMaterial({ map: paleSkinMap, roughness: .86 }),
    belly: new THREE.MeshStandardMaterial({ color: 0xc58b49, roughness: .95 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x21140e, roughness: .8 }),
    mouth: new THREE.MeshStandardMaterial({ color: 0x4a1714, roughness: .76 }),
    cream: new THREE.MeshStandardMaterial({ color: 0xf2dfae, roughness: .8 }),
    white: new THREE.MeshStandardMaterial({ color: 0xfff4d5, roughness: .55 }),
    red: new THREE.MeshStandardMaterial({ color: 0x932c21, roughness: .54, metalness: .08 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x155b6c, roughness: .5 }),
    capCream: new THREE.MeshStandardMaterial({ color: 0xe4d29e, roughness: .76 }),
    lens: new THREE.MeshPhysicalMaterial({
      color: 0xbce7df,
      roughness: .12,
      metalness: 0,
      transparent: true,
      opacity: .2,
      transmission: .38,
      depthWrite: false,
    }),
  };

  const jerry = new THREE.Group();
  jerry.name = 'Jerry';

  // Squat body and lighter belly.
  addMesh(jerry, new THREE.SphereGeometry(.72, 20, 16), materials.skin, [0, 1.05, 0], [0, 0, -.04], [1.02, 1.08, .76]);
  addMesh(jerry, new THREE.SphereGeometry(.48, 18, 14), materials.belly, [.27, 1.01, .51], [0, 0, -.07], [.68, 1.08, .16]);

  // Jerry's broad head, beak-like muzzle, smile and teeth.
  addMesh(jerry, new THREE.SphereGeometry(.64, 22, 17), materials.skin, [.36, 1.91, 0], [0, 0, -.06], [1.02, .88, .86]);
  addMesh(jerry, new THREE.SphereGeometry(.49, 20, 14), materials.paleSkin, [.87, 1.72, .02], [0, 0, -.08], [1.04, .58, .82]);
  addMesh(jerry, new THREE.SphereGeometry(.34, 18, 12), materials.mouth, [1.03, 1.55, .03], [0, 0, -.03], [.88, .3, .72]);
  addMesh(jerry, new THREE.SphereGeometry(.33, 18, 12), materials.paleSkin, [1.01, 1.48, .03], [0, 0, -.03], [.84, .25, .68]);
  for (const z of [-.16, .16]) {
    addMesh(jerry, new THREE.ConeGeometry(.043, .14, 6), materials.white, [1.21, 1.58, z], [0, 0, Math.PI]);
  }
  for (const z of [-.17, .17]) {
    addMesh(jerry, new THREE.SphereGeometry(.045, 8, 6), materials.dark, [1.23, 1.81, z], [0, 0, 0], [1.2, .55, 1]);
  }

  // Eyes and chunky red glasses. Both sides are modeled for a convincing turn in 3D.
  const eyes = [];
  for (const z of [-.43, .43]) {
    const eye = addMesh(jerry, new THREE.SphereGeometry(.19, 16, 12), materials.white, [.62, 2.03, z], [0, 0, 0], [.85, 1, .56]);
    const pupil = addMesh(jerry, new THREE.SphereGeometry(.075, 12, 8), materials.dark, [.73, 2.04, z + Math.sign(z) * .095]);
    addMesh(jerry, new THREE.SphereGeometry(.018, 8, 6), materials.white, [.77, 2.075, z + Math.sign(z) * .15]);
    const frame = addMesh(jerry, new THREE.TorusGeometry(.245, .045, 8, 20), materials.red, [.62, 2.03, z + Math.sign(z) * .105]);
    if (z < 0) frame.rotation.y = Math.PI;
    const lens = addMesh(jerry, new THREE.CircleGeometry(.205, 20), materials.lens, [.62, 2.03, z + Math.sign(z) * .11]);
    if (z < 0) lens.rotation.y = Math.PI;
    eyes.push({ eye, pupil });
  }
  addMesh(jerry, new THREE.CapsuleGeometry(.035, .57, 4, 8), materials.red, [.62, 2.04, 0], [Math.PI / 2, 0, 0]);
  for (const z of [-.55, .55]) {
    addMesh(jerry, new THREE.CapsuleGeometry(.03, .34, 4, 8), materials.red, [.4, 2.04, z], [0, 0, Math.PI / 2]);
  }

  // Blue collar and the readable engineer badge from the reference image.
  addMesh(jerry, new THREE.TorusGeometry(.49, .085, 10, 24), materials.blue, [.12, 1.52, 0], [Math.PI / 2, 0, 0], [1.05, 1, .8]);
  const badgeMaterial = new THREE.MeshStandardMaterial({ map: badgeTexture(), roughness: .78 });
  addMesh(jerry, new THREE.BoxGeometry(.51, .61, .045), badgeMaterial, [.31, 1.08, .625], [0, 0, -.03]);
  addMesh(jerry, new THREE.CapsuleGeometry(.018, .28, 3, 6), materials.dark, [.12, 1.47, .61], [0, 0, -.18]);
  addMesh(jerry, new THREE.CapsuleGeometry(.018, .28, 3, 6), materials.dark, [.5, 1.47, .61], [0, 0, .18]);

  // Red-and-cream propeller cap.
  addMesh(jerry, new THREE.SphereGeometry(.45, 18, 10, 0, Math.PI, 0, Math.PI / 2), materials.red, [.22, 2.43, 0], [0, 0, 0], [1, .72, .9]);
  addMesh(jerry, new THREE.SphereGeometry(.45, 18, 10, Math.PI, Math.PI, 0, Math.PI / 2), materials.capCream, [.22, 2.43, 0], [0, 0, 0], [1, .72, .9]);
  addMesh(jerry, new THREE.BoxGeometry(.42, .065, .62), materials.red, [.47, 2.43, 0], [0, 0, -.08]);
  addMesh(jerry, new THREE.CapsuleGeometry(.025, .18, 4, 7), materials.dark, [.22, 2.78, 0]);
  const propeller = new THREE.Group();
  propeller.position.set(.22, 2.9, 0);
  addMesh(propeller, new THREE.BoxGeometry(.68, .045, .1), materials.blue, [0, 0, 0], [0, .12, 0]);
  addMesh(propeller, new THREE.SphereGeometry(.07, 10, 7), materials.red, [0, .015, 0]);
  jerry.add(propeller);

  // Tail, little arms, sturdy running legs and claws.
  const tail = addMesh(jerry, new THREE.ConeGeometry(.38, 1.9, 10), materials.skin, [-1.08, 1.08, 0], [0, 0, Math.PI / 2 + .15]);
  const arms = [];
  for (const z of [-.54, .54]) {
    const arm = new THREE.Group();
    arm.position.set(.43, 1.28, z);
    arm.rotation.z = -.5;
    addMesh(arm, new THREE.CapsuleGeometry(.095, .34, 6, 9), materials.skin, [0, -.13, 0]);
    addMesh(arm, new THREE.SphereGeometry(.12, 10, 8), materials.skin, [.08, -.39, 0], [0, 0, 0], [1.1, .65, .85]);
    for (let i = 0; i < 2; i++) {
      addMesh(arm, new THREE.ConeGeometry(.025, .09, 5), materials.cream, [.14, -.43, (i - .5) * .09], [0, 0, -Math.PI / 2]);
    }
    jerry.add(arm);
    arms.push(arm);
  }

  const legs = [];
  for (const z of [-.32, .32]) {
    const leg = new THREE.Group();
    leg.position.set(-.18, .55, z);
    addMesh(leg, new THREE.CapsuleGeometry(.17, .45, 6, 10), materials.skin, [0, 0, 0]);
    addMesh(leg, new THREE.SphereGeometry(.2, 12, 9), materials.skin, [.17, -.29, 0], [0, 0, 0], [1.55, .48, 1]);
    addToes(leg, materials.cream, 0);
    jerry.add(leg);
    legs.push(leg);
  }

  // Small triangular plates retain just enough dinosaur silhouette behind the cap.
  for (let i = 0; i < 3; i++) {
    addMesh(jerry, new THREE.ConeGeometry(.105 + i * .012, .27, 4), materials.paleSkin, [-.48 + i * .24, 1.74 + i * .14, 0], [0, 0, -.12]);
  }

  jerry.position.set(-2.9, 0, 0);
  scene.add(jerry);
  return { group: jerry, legs, tail, arms, eyes, propeller, velocity: 0 };
}
