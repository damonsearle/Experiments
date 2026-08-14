import * as THREE from 'three';

import { noise } from '../creature/hide.js';
import { createFlora } from './flora.js';
import { createRuins } from './ruins.js';

export const ARENA_RADIUS = 26;

const WATER_Y = -.45;

/* --------------------------------------------------------------------------
   The swamp. A prehistoric wetland that is also, quietly, a data centre that
   lost.

   The floor is one continuous mud flat rather than a scatter of true islands.
   Real islands with water between them would fragment an arena that has to
   support free movement in every direction, and the first thing that breaks
   when you fragment it is the swarm — Compsognathus need somewhere to swarm
   *to*. So the water rings the flat and pools around its edge, and the height
   variation comes from platforms sitting on top of it instead.
   -------------------------------------------------------------------------- */

// Rippled tannin water. Generated rather than loaded, like every other surface
// in the game, so there is still nothing to fetch at boot.
function waterMaps(seed) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  const random = noise(seed);

  context.fillStyle = '#808080';
  context.fillRect(0, 0, size, size);

  // Overlapping soft rings read as scum and slow surface ripple once they are
  // scrolling against each other.
  for (let i = 0; i < 70; i++) {
    const x = random() * size;
    const y = random() * size;
    const radius = 8 + random() * 46;
    const wash = context.createRadialGradient(x, y, 0, x, y, radius);
    const strength = .06 + random() * .12;
    wash.addColorStop(0, `rgba(255,255,255,${strength})`);
    wash.addColorStop(.55, `rgba(255,255,255,0)`);
    wash.addColorStop(.8, `rgba(0,0,0,${strength * .7})`);
    wash.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = wash;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 7);
  return texture;
}

function mudMap(seed) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  const random = noise(seed);

  // The map carries the whole colour, because a material that has both a `map`
  // and a `color` multiplies them — two mid greens make one near-black, which
  // is exactly what happened to the mud flat the first time round.
  context.fillStyle = '#6b7350';
  context.fillRect(0, 0, size, size);
  for (let i = 0; i < 260; i++) {
    const radius = 4 + random() * 34;
    const tint = random() < .5 ? '90,80,48' : '48,60,40';
    context.save();
    context.translate(random() * size, random() * size);
    const blob = context.createRadialGradient(0, 0, 0, 0, 0, radius);
    blob.addColorStop(0, `rgba(${tint},${.06 + random() * .16})`);
    blob.addColorStop(1, `rgba(${tint},0)`);
    context.fillStyle = blob;
    context.fillRect(-radius, -radius, radius * 2, radius * 2);
    context.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(9, 9);
  return texture;
}

export function createArena(scene, { lean = false } = {}) {
  scene.background = new THREE.Color(0x121a15);
  // Thicker than M1's. The fog is doing real work now: it hides where the mud
  // flat ends and stops the ruins reading as props sitting on a disc. Any denser
  // and the far side of the arena stops being readable, which matters more —
  // you have to be able to see a Stegosaurus winding up from across the map.
  scene.fog = new THREE.FogExp2(0x1b2a20, .019);

  /* ------------------------------------------------------------------ light */

  // Broadly neutral key with coloured fill. A coloured key flattens Jerry's tan
  // hide to a silhouette, which is the mistake the first game made.
  const key = new THREE.DirectionalLight(0xfff2dc, 2.6);
  key.position.set(14, 22, 10);
  key.castShadow = true;
  // Halved on phones. Because the shadow camera already travels with Jerry and
  // covers only ±15 units, 1024 there still lands more texels per metre than a
  // 2048 map stretched across the whole arena would have.
  const shadowSize = lean ? 1024 : 2048;
  key.shadow.mapSize.set(shadowSize, shadowSize);
  // The §8 shadow decision: rather than one map stretched over the whole arena,
  // a tight camera that travels with Jerry. Same memory, roughly six times the
  // texel density where anyone is actually looking. The light and its target
  // are moved together each frame so the shadow direction never changes.
  const SHADOW_REACH = 15;
  key.shadow.camera.left = -SHADOW_REACH;
  key.shadow.camera.right = SHADOW_REACH;
  key.shadow.camera.top = SHADOW_REACH;
  key.shadow.camera.bottom = -SHADOW_REACH;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 90;
  key.shadow.bias = -.0016;
  key.shadow.normalBias = .02;
  scene.add(key);
  scene.add(key.target);

  scene.add(new THREE.HemisphereLight(0x8aa483, 0x1d2413, 1.1));

  const bounce = new THREE.DirectionalLight(0x5f7d4e, .45);
  bounce.position.set(-10, 4, -12);
  scene.add(bounce);

  // The volcano, expressed only as the warm rim it throws back at everything.
  //
  // §5 asked for it glowing on the horizon, and that turns out to be impossible
  // with this camera: at ~31 degrees down and a 45 degree field, the visible
  // band stops several degrees *below* the horizontal, so the sky and the
  // horizon are never on screen at any distance. A mountain tall enough to see
  // is a mountain above the top of the frame. The light is the part that
  // survives, and it is the part that was doing the work anyway.
  const emberLight = new THREE.DirectionalLight(0xff7a2e, .5);
  emberLight.position.set(-40, 9, -52);
  scene.add(emberLight);

  /* ------------------------------------------------------------------ water */

  const waterGeometry = new THREE.PlaneGeometry(190, 190, 60, 60);
  waterGeometry.rotateX(-Math.PI / 2);
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x46543a,
    roughness: .22,
    metalness: .1,
    bumpMap: waterMaps(7),
    bumpScale: .35,
  });

  // The ripple runs on the GPU. Doing it in JS meant rewriting nearly four
  // thousand vertices and re-uploading the buffer every single frame, for a
  // surface that is mostly hidden behind the reeds — by far the largest
  // per-frame cost in the scene, and all of it avoidable. Normals are left
  // alone deliberately: the bump map is what actually sells the water, and
  // recomputing them would put the whole cost straight back.
  let waterUniforms = null;
  waterMaterial.onBeforeCompile = shader => {
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       transformed.y += sin(position.x * 0.18 + uTime * 0.9) * 0.10
                      + sin(position.z * 0.23 - uTime * 0.7) * 0.08;`,
    );
    waterUniforms = shader.uniforms;
  };

  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.position.y = WATER_Y;
  water.receiveShadow = true;
  scene.add(water);

  /* -------------------------------------------------------------- the flat */

  // Stops just past the reeds so the water ring is actually visible from inside
  // the arena rather than being a plane nobody ever sees.
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(ARENA_RADIUS + 2, 96),
    new THREE.MeshStandardMaterial({ roughness: .98, metalness: 0, map: mudMap(3) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  /* -------------------------------------------------------- raised platforms */

  // Circles on the XZ plane with a height. Jerry is blocked by one while he is
  // below its top and stands on it once he is above, so the same list is both
  // the collision set and the walkable height field.
  const obstacles = [];
  const props = new THREE.Group();
  scene.add(props);

  const mudMaterial = new THREE.MeshStandardMaterial({ roughness: .96, map: mudMap(11) });
  const boardMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3a26, roughness: .92 });
  const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0x555b4d, roughness: .9 });

  const layout = [
    { x: 6, z: -4, radius: 2.4, height: 1, kind: 'bank' },
    { x: -7, z: 3, radius: 2.9, height: 1.5, kind: 'stone' },
    { x: 2, z: 10, radius: 2.2, height: .8, kind: 'board' },
    { x: -5, z: -11, radius: 3.2, height: 1.8, kind: 'bank' },
    { x: 13, z: 8, radius: 2.6, height: 1.2, kind: 'board' },
    { x: -14, z: -4, radius: 2.3, height: 1, kind: 'bank' },
    { x: 15, z: -12, radius: 2.7, height: 1.6, kind: 'stone' },
    { x: -12, z: 13, radius: 2.5, height: 1.1, kind: 'board' },
  ];

  for (const spot of layout) {
    let mesh;
    if (spot.kind === 'stone') {
      mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(spot.radius, 0), stoneMaterial);
      mesh.position.set(spot.x, spot.height - spot.radius * .55, spot.z);
      mesh.scale.y = .8;
    } else {
      // Banks and boardwalks are flat-topped cylinders, so the top really is at
      // `height` and standing on one cannot leave Jerry hovering.
      mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(spot.radius, spot.radius * 1.12, spot.height + 1, 18),
        spot.kind === 'board' ? boardMaterial : mudMaterial,
      );
      mesh.position.set(spot.x, spot.height - (spot.height + 1) / 2, spot.z);
    }
    mesh.rotation.y = Math.random() * Math.PI;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    props.add(mesh);
    obstacles.push({ x: spot.x, z: spot.z, radius: spot.radius, height: spot.height, standable: spot.kind !== 'stone' });
  }

  /* ------------------------------------------------------------------ edging */

  const reed = new THREE.ConeGeometry(.16, 2.6, 5);
  const reedMaterial = new THREE.MeshStandardMaterial({ color: 0x54633c, roughness: 1 });
  const reeds = new THREE.InstancedMesh(reed, reedMaterial, 260);
  const placer = new THREE.Object3D();
  for (let i = 0; i < reeds.count; i++) {
    const angle = (i / reeds.count) * Math.PI * 2 + Math.random() * .1;
    const distance = ARENA_RADIUS + Math.random() * 4;
    placer.position.set(Math.cos(angle) * distance, 1.1, Math.sin(angle) * distance);
    placer.rotation.set((Math.random() - .5) * .3, Math.random() * Math.PI, (Math.random() - .5) * .3);
    placer.scale.setScalar(.7 + Math.random() * .9);
    placer.updateMatrix();
    reeds.setMatrixAt(i, placer.matrix);
  }
  reeds.castShadow = true;
  scene.add(reeds);

  /* ------------------------------------------------------------------- spores */

  const SPORES = 260;
  const sporePositions = new Float32Array(SPORES * 3);
  const sporeDrift = new Float32Array(SPORES);
  for (let i = 0; i < SPORES; i++) {
    sporePositions[i * 3] = (Math.random() - .5) * ARENA_RADIUS * 2.4;
    sporePositions[i * 3 + 1] = Math.random() * 9;
    sporePositions[i * 3 + 2] = (Math.random() - .5) * ARENA_RADIUS * 2.4;
    sporeDrift[i] = .12 + Math.random() * .5;
  }
  const sporeGeometry = new THREE.BufferGeometry();
  sporeGeometry.setAttribute('position', new THREE.BufferAttribute(sporePositions, 3));
  const spores = new THREE.Points(sporeGeometry, new THREE.PointsMaterial({
    color: 0xcfe0b0,
    size: .11,
    transparent: true,
    opacity: .5,
    depthWrite: false,
  }));
  scene.add(spores);

  // Ruins first: the mainframe adds itself to the obstacle list, and the flora
  // planter reads that list to avoid growing ferns through it.
  const ruins = createRuins(scene, { obstacles });
  createFlora(scene, { radius: ARENA_RADIUS, obstacles });

  /* -------------------------------------------------------------------- api */

  // The walkable height under a point: the top of the tallest platform covering
  // it, or the mud flat. Stones are deliberately excluded — they are cover to
  // hide behind, not furniture to stand on.
  function groundHeight(x, z) {
    let top = 0;
    for (const obstacle of obstacles) {
      if (!obstacle.standable) continue;
      const dx = x - obstacle.x;
      const dz = z - obstacle.z;
      if (dx * dx + dz * dz > obstacle.radius * obstacle.radius) continue;
      if (obstacle.height > top) top = obstacle.height;
    }
    return top;
  }

  let elapsed = 0;

  function update(dt, focus) {
    elapsed += dt;
    ruins.update(dt);

    if (waterUniforms) waterUniforms.uTime.value = elapsed;

    // Scroll the scum across the surface, slower than the waves so the two do
    // not lock together into an obviously repeating pattern.
    water.material.bumpMap.offset.set(elapsed * .012, elapsed * .008);

    spores.rotation.y = elapsed * .015;
    const sporeArray = sporeGeometry.attributes.position.array;
    for (let i = 0; i < SPORES; i++) {
      sporeArray[i * 3 + 1] += sporeDrift[i] * dt;
      if (sporeArray[i * 3 + 1] > 9) sporeArray[i * 3 + 1] = 0;
    }
    sporeGeometry.attributes.position.needsUpdate = true;

    // Carry the shadow camera with Jerry. Light and target move as a pair so the
    // sun direction is unchanged and only the covered area moves.
    if (focus) {
      key.position.set(focus.x + 14, 22, focus.z + 10);
      key.target.position.set(focus.x, 0, focus.z);
      key.target.updateMatrixWorld();
    }
  }

  return { obstacles, radius: ARENA_RADIUS, groundHeight, update, waterY: WATER_Y };
}
