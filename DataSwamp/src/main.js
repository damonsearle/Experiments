import * as THREE from 'three';
import './style.css';
import { createArena } from './scene/arena.js';
import { createPlayer } from './game/player.js';
import { createInput } from './game/input.js';
import { createProjectiles, FLIGHT_Y } from './game/projectiles.js';
import { createEnemies } from './game/enemies.js';
import { createPickups, HEALTH_AMOUNT } from './game/pickups.js';
import { createDinoKit } from './creature/dinos.js';
import { createTouch } from './ui/touch.js';
import { ARSENAL } from './game/weapons.js';

const canvas = document.querySelector('#game');
const readout = document.querySelector('#readout');
const healthFill = document.querySelector('#health-fill');
const hurtVeil = document.querySelector('#hurt');
const overPanel = document.querySelector('#over');
const tierList = document.querySelector('#tiers');

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

// Every blob() in the game runs here, once. Spawning must never touch it.
const dinoKit = createDinoKit();
const enemies = createEnemies(scene, dinoKit);

// A fixed encounter until the wave director arrives at M5. The mix is chosen to
// show all three behaviours at once: compies rush, dilos hold the middle, the
// stego stands off and lobs.
const ENCOUNTER = [
  ['compy', 7, -8], ['compy', 10, -5], ['compy', 4, -12],
  ['dilo', -9, -7], ['dilo', 12, 4],
  ['stego', -3, -15],
];

function populate() {
  for (const [species, x, z] of ENCOUNTER) enemies.spawn(species, x, z);
}
populate();

const pickups = createPickups(scene);

// Placeholder for the wave director at M5. Without it a cleared arena leaves
// nothing to do, and M3 is meant to be the build you can actually sit and play.
let restock = 0;

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

// How far out a stick or IJKL aim puts the aim point. It only has to be far
// enough that Jerry turns to face it and the reticle sits in front of him —
// direction aiming has no distance of its own to honour.
const AIM_REACH = 7;

function updateAim() {
  if (input.aimMode === 'direction') {
    // The camera holds a fixed yaw, so screen-up is world -z and a stick vector
    // maps straight onto the ground plane with no projection needed.
    aimPoint.set(
      player.group.position.x + input.aim.x * AIM_REACH,
      FLIGHT_Y,
      player.group.position.z - input.aim.y * AIM_REACH,
    );
  } else {
    raycaster.setFromCamera(input.pointer, camera);
    // A ray parallel to the ground never lands; keep the previous point when that happens.
    if (!raycaster.ray.intersectPlane(aimPlane, aimPoint)) return;
  }
  reticle.position.set(aimPoint.x, .04, aimPoint.z);
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

/* ------------------------------------------------------------------------ hud */

// One chip per tier, built once. Each carries a swatch in the tier's own tint,
// so the selector, the projectile in flight and the cache beacon across the
// arena are all the same colour.
const tierChips = ARSENAL.map((weapon, index) => {
  const item = document.createElement('li');
  item.className = 'tier';

  const swatch = document.createElement('span');
  swatch.className = 'tier-swatch';
  swatch.style.background = `#${weapon.tint.toString(16).padStart(6, '0')}`;
  item.append(swatch);

  const key = document.createElement('span');
  key.className = 'tier-key';
  key.textContent = index + 1;
  item.append(key);

  const name = document.createElement('span');
  name.className = 'tier-name';
  name.textContent = weapon.name;
  item.append(name);

  const ammo = document.createElement('span');
  ammo.className = 'tier-ammo';
  item.append(ammo);

  // Tapping a chip is the only way to swap tiers without a keyboard or a wheel,
  // and it costs desktop nothing to have it too.
  item.addEventListener('pointerdown', event => {
    event.preventDefault();
    event.stopPropagation();
    player.select(weapon);
  });

  tierList.append(item);
  return { weapon, item, ammo };
});

createTouch(input, document.querySelector('#touch'));

let sinceReadout = 0;
let veil = 0;

function updateHud(dt) {
  // The hurt flash is raised by player.hurt() and drained here, so the damage
  // rule stays in the player and the presentation stays in main.
  if (player.hurtFlash > 0) {
    veil = 1;
    player.hurtFlash = 0;
  }
  veil = Math.max(0, veil - dt * 3.2);
  hurtVeil.style.opacity = veil.toFixed(3);

  overPanel.classList.toggle('shown', !player.alive);
  reticle.visible = player.alive;

  sinceReadout += dt;
  if (sinceReadout < .12) return;
  sinceReadout = 0;

  healthFill.style.transform = `scaleX(${(player.hp / player.maxHp).toFixed(3)})`;

  for (const chip of tierChips) {
    const held = player.rounds(chip.weapon);
    chip.item.classList.toggle('active', player.weapon === chip.weapon);
    chip.item.classList.toggle('empty', held <= 0);
    chip.ammo.textContent = held === Infinity ? '∞' : held;
  }

  const standing = enemies.list.filter(enemy => enemy.alive).length;
  readout.textContent =
    `targets ${standing}  shots ${String(projectiles.live.length).padStart(2)}  ` +
    `${player.grounded ? 'grounded' : 'airborne'}`;
}

// Returning false leaves the cache standing, so walking over coffee at full
// integrity does not waste it.
function collect(pickup) {
  if (pickup.kind === 'health') return player.heal(HEALTH_AMOUNT);
  return player.give(pickup.weapon, pickup.weapon.magazine);
}

function restart() {
  if (player.alive) return;
  player.reset();
  enemies.clear();
  projectiles.clear();
  pickups.reset();
  populate();
  restock = 0;
  camera.position.copy(player.group.position).add(CAMERA_OFFSET);
  lookAt.copy(player.group.position);
}

addEventListener('keydown', event => {
  if (event.code === 'KeyR') restart();
});

// There is no R key on a phone, so the panel itself is the button.
overPanel.addEventListener('pointerdown', event => {
  event.preventDefault();
  restart();
});

/* ------------------------------------------------------------------------ loop */

const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), .05);

  input.sample();
  updateAim();
  player.update(dt, input, aimPoint, arena);
  player.shoot(dt, input, projectiles);
  projectiles.update(dt, {
    hostiles: enemies.list,
    player,
    hit: enemies.damage,
    hurtPlayer: player.hurt,
  });
  enemies.update(dt, { camera, target: player, arena, projectiles });
  pickups.update(dt, player, collect);
  updateHud(dt);

  // Placeholder wave behaviour: once the swamp is clear, another lot wanders in.
  if (player.alive && enemies.list.length === 0) {
    restock += dt;
    if (restock > 4) {
      restock = 0;
      populate();
    }
  } else {
    restock = 0;
  }

  // Frame-rate independent easing: the same fraction of the gap closes per second
  // regardless of how often we tick.
  const ease = 1 - Math.pow(.0006, dt);
  cameraGoal.copy(player.group.position).add(CAMERA_OFFSET);
  camera.position.lerp(cameraGoal, ease);
  lookAt.lerp(player.group.position, ease);
  camera.lookAt(lookAt.x, lookAt.y + LOOK_LIFT, lookAt.z);

  renderer.render(scene, camera);
}

frame();
