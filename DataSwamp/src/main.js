import * as THREE from 'three';
import './style.css';
import { createArena } from './scene/arena.js';
import { createPlayer } from './game/player.js';
import { createInput } from './game/input.js';
import { createProjectiles, FLIGHT_Y } from './game/projectiles.js';
import { createEnemies } from './game/enemies.js';

const canvas = document.querySelector('#game');
const readout = document.querySelector('#readout');
const weaponChip = document.querySelector('#weapon');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const arena = createArena(scene);
const player = createPlayer(scene);
const input = createInput(canvas);
const projectiles = createProjectiles(scene);
const enemies = createEnemies(scene);

// M1 target practice. M2 replaces these with real species and gives them AI.
for (const [x, z, hp] of [[9, -9, 120], [-9, -8, 160], [1, -15, 90]]) {
  enemies.spawn(x, z, { hp });
}

weaponChip.textContent = player.weapon.name;

/* ---------------------------------------------------------------------- camera */

// A 3/4 follow: fixed yaw, about 50 degrees above the horizon, trailing Jerry with lag.
// The yaw stays fixed so that screen-up is always world -z and movement never inverts.
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, .1, 300);
// ~31 degrees above the horizon. Steeper than this and Jerry reads as a hat seen from above;
// shallower and the arena stops being legible.
const CAMERA_OFFSET = new THREE.Vector3(0, 6.6, 11);
const LOOK_LIFT = 1.4;

const cameraGoal = new THREE.Vector3();
const lookAt = new THREE.Vector3();
camera.position.copy(player.group.position).add(CAMERA_OFFSET);
lookAt.copy(player.group.position);

/* ------------------------------------------------------------------------- aim */

// Aim resolves at the height projectiles actually fly at, not at the ground. Resolving on
// the ground would put the aim point beyond anything you point at, because the ray carries
// on past the target and down — enough to miss an enemy you are pointing straight at.
const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -FLIGHT_Y);
const raycaster = new THREE.Raycaster();
const aimPoint = new THREE.Vector3(6, FLIGHT_Y, 0);

// A soft marker where Jerry is pointing. It doubles as the reticle until the HUD exists.
const reticleMaterial = new THREE.MeshBasicMaterial({
  color: 0xe8b94a,
  transparent: true,
  opacity: .85,
  depthWrite: false,
});
const reticle = new THREE.Group();
const ring = new THREE.Mesh(new THREE.RingGeometry(.44, .56, 32), reticleMaterial);
ring.rotation.x = -Math.PI / 2;
reticle.add(ring);
const pip = new THREE.Mesh(new THREE.CircleGeometry(.1, 16), reticleMaterial);
pip.rotation.x = -Math.PI / 2;
reticle.add(pip);
scene.add(reticle);

function updateAim() {
  raycaster.setFromCamera(input.pointer, camera);
  // A ray parallel to the ground never lands; keep the previous point when that happens.
  if (raycaster.ray.intersectPlane(aimPlane, aimPoint)) {
    reticle.position.set(aimPoint.x, .04, aimPoint.z);
  }
}

/* ------------------------------------------------------------------------ loop */

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Dev-only handle so automated runs can aim at a real target instead of guessing pixels.
// Stripped from production builds by the bundler.
if (import.meta.env.DEV) {
  const probe = new THREE.Vector3();
  window.__swamp = {
    player,
    enemies,
    projectiles,
    // Normalised device coords of a living enemy, or null if none are left standing.
    aimAt(index = 0) {
      const target = enemies.list.filter(enemy => enemy.alive)[index];
      if (!target) return null;
      probe.set(target.x, 1.25, target.z).project(camera);
      return { x: probe.x, y: probe.y, hp: target.hp, maxHp: target.maxHp };
    },
  };
}

const clock = new THREE.Clock();
let sinceReadout = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), .05);

  input.sample();
  updateAim();
  player.update(dt, input, aimPoint, arena);
  player.shoot(dt, input, projectiles);
  projectiles.update(dt, enemies.list, (target, shot) => {
    enemies.damage(target, shot.weapon.damage, shot.x, shot.z);
  });
  enemies.update(dt, camera);

  // Frame-rate independent easing: the same fraction of the gap closes per second
  // regardless of how often we tick.
  const ease = 1 - Math.pow(.0006, dt);
  cameraGoal.copy(player.group.position).add(CAMERA_OFFSET);
  camera.position.lerp(cameraGoal, ease);
  lookAt.lerp(player.group.position, ease);
  camera.lookAt(lookAt.x, lookAt.y + LOOK_LIFT, lookAt.z);

  sinceReadout += dt;
  if (sinceReadout > .15) {
    sinceReadout = 0;
    const standing = enemies.list.filter(enemy => enemy.alive).length;
    readout.textContent =
      `targets ${standing}  shots ${String(projectiles.live.length).padStart(2)}  ` +
      `${player.grounded ? 'grounded' : 'airborne'}`;
  }

  renderer.render(scene, camera);
}

frame();
