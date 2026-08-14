import * as THREE from 'three';

/* --------------------------------------------------------------------------
   Ferns, horsetails and cycads, instanced.

   Three base meshes and a few hundred copies each, all through InstancedMesh,
   so the whole understorey is three draw calls. Nothing here is interactive —
   plants are dressing, and Jerry walks straight through them — which is why
   they can be this cheap and this numerous.

   Everything is planted clear of the platforms, because a fern growing out of
   the top of a boardwalk reads as a bug rather than as a swamp.
   -------------------------------------------------------------------------- */

// Fronds fan out from a stem: a handful of stretched, tilted boxes merged by
// being instanced together rather than by building real geometry per plant.
// Everything here is scaled against Jerry at three units tall. Undergrowth that
// reaches his shoulder stops being undergrowth and becomes a forest you cannot
// fight in — the arena has to stay readable from a camera eleven units back.
function frondGeometry() {
  const blade = new THREE.ConeGeometry(.22, .62, 4);
  blade.translate(0, .31, 0);
  return blade;
}

function horsetailGeometry() {
  const stem = new THREE.CylinderGeometry(.035, .055, 1.15, 5);
  stem.translate(0, .58, 0);
  return stem;
}

function cycadGeometry() {
  const crown = new THREE.ConeGeometry(.5, .8, 6);
  crown.translate(0, .62, 0);
  return crown;
}

const SPECIES = [
  { make: frondGeometry, count: 190, color: 0x4f6236, scale: [.7, 1.35], tilt: .3 },
  { make: horsetailGeometry, count: 150, color: 0x66713f, scale: [.6, 1.25], tilt: .16 },
  { make: cycadGeometry, count: 44, color: 0x3f5730, scale: [.8, 1.4], tilt: .12 },
];

// Planting is pushed out towards the reeds, leaving the middle of the flat open.
// Scattering evenly filled the fighting ground with cover the ranged AI cannot
// see through, which quietly breaks every enemy on the roster.
const INNER_CLEARING = .42;

export function createFlora(scene, { radius, obstacles }) {
  const placer = new THREE.Object3D();
  const planted = [];

  // Rejection sampling against the platforms. Cheap at these counts, and it
  // keeps the exclusion rule in one place instead of hand-authored positions.
  function findSpot() {
    for (let attempt = 0; attempt < 12; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const spread = INNER_CLEARING + (1 - INNER_CLEARING) * Math.sqrt(Math.random());
      const distance = spread * (radius + 3);
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      let clear = true;
      for (const obstacle of obstacles) {
        const dx = x - obstacle.x;
        const dz = z - obstacle.z;
        if (dx * dx + dz * dz < (obstacle.radius + .8) ** 2) {
          clear = false;
          break;
        }
      }
      // And never right on top of Jerry's spawn.
      if (clear && x * x + z * z > 9) return { x, z };
    }
    return null;
  }

  for (const species of SPECIES) {
    const mesh = new THREE.InstancedMesh(
      species.make(),
      new THREE.MeshStandardMaterial({ color: species.color, roughness: 1 }),
      species.count,
    );

    let used = 0;
    for (let i = 0; i < species.count; i++) {
      const spot = findSpot();
      if (!spot) continue;
      placer.position.set(spot.x, 0, spot.z);
      placer.rotation.set(
        (Math.random() - .5) * species.tilt,
        Math.random() * Math.PI * 2,
        (Math.random() - .5) * species.tilt,
      );
      const size = species.scale[0] + Math.random() * (species.scale[1] - species.scale[0]);
      placer.scale.set(size, size * (.8 + Math.random() * .5), size);
      placer.updateMatrix();
      mesh.setMatrixAt(used++, placer.matrix);
    }
    // Unused slots would otherwise render as a pile of identity-matrix plants
    // sitting at the world origin, right on top of Jerry.
    mesh.count = used;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    planted.push(mesh);
  }

  return { planted };
}
