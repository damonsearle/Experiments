import * as THREE from 'three';

export const ARENA_RADIUS = 26;

// Placeholder swamp. M4 replaces the ground and props with real water, islands and flora;
// for now this exists to give the camera something to read against and Jerry something to
// bump into and jump over.
export function createArena(scene) {
  scene.background = new THREE.Color(0x0e1512);
  scene.fog = new THREE.FogExp2(0x16211c, .018);

  // A broadly neutral key with coloured fill — a coloured key flattens Jerry's hide, which
  // is the mistake the first game made.
  const key = new THREE.DirectionalLight(0xfff2dc, 3.1);
  key.position.set(14, 22, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -ARENA_RADIUS;
  key.shadow.camera.right = ARENA_RADIUS;
  key.shadow.camera.top = ARENA_RADIUS;
  key.shadow.camera.bottom = -ARENA_RADIUS;
  key.shadow.camera.far = 70;
  key.shadow.bias = -.0012;
  scene.add(key);

  scene.add(new THREE.HemisphereLight(0xa8c2a0, 0x241f14, 1.6));

  const bounce = new THREE.DirectionalLight(0x5f7d4e, .5);
  bounce.position.set(-10, 4, -12);
  scene.add(bounce);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(ARENA_RADIUS + 8, 72),
    new THREE.MeshStandardMaterial({ color: 0x44513a, roughness: .97, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Obstacles are circles on the XZ plane with a height — Jerry is blocked by them unless
  // he is airborne above their top.
  const obstacles = [];
  const props = new THREE.Group();
  scene.add(props);

  const logMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3a26, roughness: .95 });
  const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0x3d4139, roughness: .9 });

  const layout = [
    { x: 6, z: -4, radius: 1.5, height: 1.1, kind: 'log' },
    { x: -7, z: 3, radius: 1.8, height: 1.4, kind: 'stone' },
    { x: 2, z: 9, radius: 1.3, height: .9, kind: 'log' },
    { x: -4, z: -10, radius: 2.1, height: 1.7, kind: 'stone' },
    { x: 12, z: 7, radius: 1.6, height: 1.2, kind: 'log' },
    { x: -13, z: -3, radius: 1.4, height: 1, kind: 'log' },
  ];

  for (const spot of layout) {
    const mesh = new THREE.Mesh(
      spot.kind === 'log'
        ? new THREE.CylinderGeometry(spot.radius, spot.radius * 1.05, spot.height, 14)
        : new THREE.DodecahedronGeometry(spot.radius, 0),
      spot.kind === 'log' ? logMaterial : stoneMaterial,
    );
    mesh.position.set(spot.x, spot.height / 2, spot.z);
    if (spot.kind === 'stone') mesh.scale.y = spot.height / spot.radius / 1.6;
    mesh.rotation.y = Math.random() * Math.PI;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    props.add(mesh);
    obstacles.push({ x: spot.x, z: spot.z, radius: spot.radius, height: spot.height });
  }

  // A ring of reeds marking the arena edge, so the boundary is visible rather than invisible.
  const reed = new THREE.ConeGeometry(.16, 2.6, 5);
  const reedMaterial = new THREE.MeshStandardMaterial({ color: 0x54633c, roughness: 1 });
  const reeds = new THREE.InstancedMesh(reed, reedMaterial, 220);
  const placer = new THREE.Object3D();
  for (let i = 0; i < reeds.count; i++) {
    const angle = (i / reeds.count) * Math.PI * 2 + Math.random() * .1;
    const distance = ARENA_RADIUS + Math.random() * 3;
    placer.position.set(Math.cos(angle) * distance, 1.3, Math.sin(angle) * distance);
    placer.rotation.set((Math.random() - .5) * .3, Math.random() * Math.PI, (Math.random() - .5) * .3);
    placer.scale.setScalar(.7 + Math.random() * .9);
    placer.updateMatrix();
    reeds.setMatrixAt(i, placer.matrix);
  }
  reeds.castShadow = true;
  scene.add(reeds);

  return { obstacles, radius: ARENA_RADIUS };
}
