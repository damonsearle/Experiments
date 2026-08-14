import * as THREE from 'three';
import './style.css';
import { createArena } from './scene/arena.js';
import { createPlayer } from './game/player.js';
import { createInput } from './game/input.js';
import { createProjectiles, FLIGHT_Y } from './game/projectiles.js';
import { createEnemies } from './game/enemies.js';
import { createPickups, HEALTH_AMOUNT } from './game/pickups.js';
import { createWaves } from './game/waves.js';
import { createDinoKit } from './creature/dinos.js';
import { createTouch } from './ui/touch.js';
import { createAudio } from './audio.js';
import { ARSENAL } from './game/weapons.js';

const canvas = document.querySelector('#game');
const readout = document.querySelector('#readout');
const healthFill = document.querySelector('#health-fill');
const hurtVeil = document.querySelector('#hurt');
const overPanel = document.querySelector('#over');
const startPanel = document.querySelector('#start');
const pausePanel = document.querySelector('#pause');
const bannerPanel = document.querySelector('#banner');
const tierList = document.querySelector('#tiers');

// A phone is assumed to be the tighter budget: fewer pixels and a smaller shadow
// map. Detected from the pointer rather than the user agent, because what
// actually correlates with a weak GPU here is being a touch device.
const LEAN = matchMedia('(pointer: coarse)').matches;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LEAN });
// Capped hard on phones. At a device pixel ratio of 3 the honest number is four
// times the fragments of a desktop at 1.5, for a screen a few inches across.
renderer.setPixelRatio(Math.min(devicePixelRatio, LEAN ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const arena = createArena(scene, { lean: LEAN });
const player = createPlayer(scene);
const input = createInput(canvas);
const projectiles = createProjectiles(scene);

// Every blob() in the game runs here, once. Spawning must never touch it.
const dinoKit = createDinoKit();
const enemies = createEnemies(scene, dinoKit);

const pickups = createPickups(scene);
const waves = createWaves(enemies, arena);
const audio = createAudio();
waves.reset();

// Nothing spawns until the player dismisses the opening panel, so there is time
// to look at the swamp and find out what the sticks do before anything arrives.
let started = false;
let paused = false;

/* ---------------------------------------------------------------------- camera */

// A 3/4 follow: fixed yaw, about 50 degrees above the horizon, trailing Jerry with lag.
// The yaw stays fixed so that screen-up is always world -z and movement never inverts.
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, .1, 300);
// ~31 degrees above the horizon. Steeper than this and Jerry reads as a hat seen from above;
// shallower and the arena stops being legible.
const CAMERA_DISTANCE = 11;
const CAMERA_LIFT = 6.6;
const LOOK_LIFT = 1.4;

// Which way round the camera sits, as a yaw in Jerry's own convention. Mouse aim
// pins it: you can see and click anywhere on screen, so the camera never needs to
// turn, and a fixed yaw keeps screen-up welded to world -z so movement can never
// invert. Stick aim cannot work that way — pointing somewhere off-camera would be
// aiming blind — so there the camera swings round behind whatever Jerry is facing.
//
// PI/2 is the historical fixed view: camera on +z looking down -z.
const PINNED_YAW = Math.PI / 2;
let cameraYaw = PINNED_YAW;

const cameraGoal = new THREE.Vector3();
const lookAt = new THREE.Vector3();
const moveBasis = new THREE.Vector2();
const offsetScratch = new THREE.Vector3();

function cameraOffset(yaw, into) {
  return into.set(-Math.cos(yaw) * CAMERA_DISTANCE, CAMERA_LIFT, Math.sin(yaw) * CAMERA_DISTANCE);
}

camera.position.copy(player.group.position).add(cameraOffset(cameraYaw, new THREE.Vector3()));
lookAt.copy(player.group.position);

// Screen intent to world direction, against wherever the camera currently is.
// Everything the player pushes — move stick, aim stick, WASD — goes through here,
// so a turning camera can never leave the controls pointing the old way.
function toWorld(x, y, into) {
  const cos = Math.cos(cameraYaw);
  const sin = Math.sin(cameraYaw);
  return into.set(cos * y + sin * x, -sin * y + cos * x);
}

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
    // A stick vector is screen intent, so it resolves against the camera and
    // needs no projection — there is no point on screen to project from.
    toWorld(input.aim.x, input.aim.y, moveBasis);
    aimPoint.set(
      player.group.position.x + moveBasis.x * AIM_REACH,
      FLIGHT_Y,
      player.group.position.z + moveBasis.y * AIM_REACH,
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
let mourned = false;      // so the death sting plays once, not every frame
let announced = '';       // ditto the wave sting

function updateHud(dt) {
  // The hurt flash is raised by player.hurt() and drained here, so the damage
  // rule stays in the player and the presentation stays in main.
  if (player.hurtFlash > 0) {
    veil = 1;
    player.hurtFlash = 0;
  }
  veil = Math.max(0, veil - dt * 3.2);
  hurtVeil.style.opacity = veil.toFixed(3);

  if (!player.alive && !mourned) {
    mourned = true;
    audio.over();
  } else if (player.alive) {
    mourned = false;
  }
  overPanel.classList.toggle('shown', !player.alive);
  reticle.visible = player.alive;

  // The banner carries the breather: it names what is coming and disappears the
  // moment it arrives, so it is never covering the fight it announced.
  const showBanner = started && player.alive && waves.state.banner &&
    (waves.state.phase === 'breather' || waves.state.cleared);
  bannerPanel.classList.toggle('shown', Boolean(showBanner));
  if (showBanner && announced !== waves.state.banner) {
    announced = waves.state.banner;
    bannerPanel.textContent = waves.state.banner;
    audio.wave();
  }

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
  const taken = pickup.kind === 'health'
    ? player.heal(HEALTH_AMOUNT)
    : player.give(pickup.weapon, pickup.weapon.magazine);
  if (taken) audio.pickup();
  return taken;
}

function restart() {
  if (player.alive) return;
  player.reset();
  enemies.clear();
  projectiles.clear();
  pickups.reset();
  waves.reset();
  cameraYaw = PINNED_YAW;
  camera.position.copy(player.group.position).add(cameraOffset(cameraYaw, offsetScratch));
  lookAt.copy(player.group.position);
}

function begin() {
  if (started) return;
  started = true;
  startPanel.classList.remove('shown');
  // The gesture that dismissed the panel is the one that lets mobile browsers
  // start an AudioContext at all, so this is the only place it can happen.
  audio.unlock();
}

startPanel.classList.add('shown');
startPanel.addEventListener('pointerdown', event => {
  event.preventDefault();
  begin();
});

function setPaused(on) {
  // Never pause over the top of a panel — the opening screen and the death
  // screen are already a stopped game, and stacking a third one on them just
  // means two things to dismiss.
  if (on && (!started || !player.alive)) return;
  paused = on;
  pausePanel.classList.toggle('shown', paused);
  // Let go of the throw, or Jerry resumes mid-burst having never released it.
  input.firing = false;
  input.stick.firing = false;
}

addEventListener('keydown', event => {
  if (event.code === 'KeyR') restart();
  else if (event.code === 'KeyP') setPaused(!paused);
  else if (!started) begin();
  else if (paused) setPaused(false);
});

pausePanel.addEventListener('pointerdown', event => {
  event.preventDefault();
  setPaused(false);
});

// Backgrounding the tab is a pause whether or not anyone asked for one. Without
// this, coming back to it hands the loop one enormous delta and teleports every
// dinosaur onto Jerry at once.
addEventListener('visibilitychange', () => {
  if (document.hidden) setPaused(true);
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

  // Still rendered while paused, so the swamp is visible behind the panel — but
  // nothing advances, and the clamped delta means resuming never jumps.
  if (paused) {
    renderer.render(scene, camera);
    return;
  }

  input.sample();
  updateAim();
  // Resolve the move stick against the camera before the player ever sees it,
  // so player.js stays a pure "go this way in the world" and never has to know
  // which way round the view is.
  toWorld(input.move.x, input.move.y, input.worldMove);
  player.update(dt, input, aimPoint, arena);
  if (player.shoot(dt, input, projectiles)) audio.throw();
  projectiles.update(dt, {
    hostiles: enemies.list,
    player,
    hit(target, amount, x, z) {
      const wasAlive = target.alive;
      enemies.damage(target, amount, x, z);
      if (wasAlive && !target.alive) audio.kill();
      else audio.hit();
    },
    hurtPlayer(amount) {
      if (player.hurt(amount)) audio.hurt();
    },
  });
  enemies.update(dt, {
    camera,
    target: player,
    arena,
    projectiles,
    hurt: amount => { if (player.hurt(amount)) audio.hurt(); },
  });
  pickups.update(dt, player, collect);
  arena.update(dt, player.group.position);
  if (started && player.alive) waves.update(dt);
  updateHud(dt);

  // Frame-rate independent easing: the same fraction of the gap closes per second
  // regardless of how often we tick.
  const ease = 1 - Math.pow(.0006, dt);

  // Swing round behind Jerry when he is being aimed by stick, and hold the pinned
  // view when he is being aimed by mouse. The swing is deliberately slower than
  // his turn, so the camera trails the throw rather than whipping with it.
  const wantedYaw = input.aimMode === 'direction' ? player.group.rotation.y : PINNED_YAW;
  let swing = wantedYaw - cameraYaw;
  swing = Math.atan2(Math.sin(swing), Math.cos(swing));
  cameraYaw += swing * (1 - Math.pow(.06, dt));

  cameraGoal.copy(player.group.position).add(cameraOffset(cameraYaw, offsetScratch));
  camera.position.lerp(cameraGoal, ease);
  lookAt.lerp(player.group.position, ease);
  camera.lookAt(lookAt.x, lookAt.y + LOOK_LIFT, lookAt.z);

  renderer.render(scene, camera);
}

frame();
