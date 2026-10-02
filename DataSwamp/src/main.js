import * as THREE from 'three';
import './style.css';
import { createArena } from './scene/arena.js';
import { createPlayer } from './game/player.js';
import { createInput } from './game/input.js';
import { createShoulderCamera } from './game/camera.js';
import { traceWorld } from './game/collision.js';
import { createProjectiles } from './game/projectiles.js';
import { createEnemies } from './game/enemies.js';
import { createPickups, HEALTH_AMOUNT } from './game/pickups.js';
import { createWaves } from './game/waves.js';
import { createBlenderDinoKit } from './creature/blender-dinos.js';
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
const againButton = document.querySelector('#again');
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
const input = createInput(canvas, { enabled: () => started && !paused && player.alive });
const projectiles = createProjectiles(scene);

// Load the Blender models during the opening screen; spawns share geometry.
const dinoKit = createBlenderDinoKit();
const enemyStatus = document.createElement('p');
enemyStatus.className = 'hint';
enemyStatus.setAttribute('role', 'status');
enemyStatus.textContent = 'Loading swamp wildlife…';
startPanel.append(enemyStatus);
dinoKit.ready.then(() => {
  enemyStatus.textContent = dinoKit.failed.size
    ? 'Some wildlife models could not load; using the original versions.' : '';
});
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

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, .1, 300);
const cameraRig = createShoulderCamera(camera);
cameraRig.resize(innerWidth, innerHeight);
cameraRig.reset(player.group.position);
const crosshair = document.querySelector('#crosshair');
const lookHint = document.querySelector('#look-hint');
const aimRay = new THREE.Ray();
const muzzleRay = new THREE.Ray();
const aimPoint = new THREE.Vector3();
const shotOrigin = new THREE.Vector3();
const shotDirection = new THREE.Vector3();
const heading = new THREE.Vector2();
const obstruction = new THREE.Vector3();

function updateAim() {
  camera.getWorldDirection(aimRay.direction);
  aimRay.origin.copy(camera.position);
  const target = traceWorld(aimRay, arena, enemies.list, 100, aimPoint);
  if (!target) aimRay.at(100, aimPoint);
  cameraRig.moveToWorld(0, 1, heading);
  // Throw from Jerry's right shoulder toward the point under the crosshair.
  shotOrigin.set(player.x + heading.x * .55 - heading.y * .5,
    player.lift + 2.1, player.z + heading.y * .55 + heading.x * .5);
  shotDirection.copy(aimPoint).sub(shotOrigin).normalize();
  muzzleRay.set(shotOrigin, shotDirection);
  const blocked = traceWorld(muzzleRay, arena, [],
    shotOrigin.distanceTo(aimPoint) - .1, obstruction);
  crosshair.classList.toggle('blocked', Boolean(blocked));
  crosshair.classList.toggle('target', Boolean(target && target !== 'world' && !blocked));
  // Body facing follows view yaw even when the crosshair is on very close cover.
  player.aim(obstruction.set(player.x + heading.x * 10, player.lift, player.z + heading.y * 10));
}

/* ------------------------------------------------------------------------ loop */

addEventListener('resize', () => {
  cameraRig.resize(innerWidth, innerHeight);
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
    camera,
    input,
    cameraRig,
    arena,
    aimPoint,
    shotOrigin,
    shotDirection,
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

const touch = createTouch(input, document.querySelector('#touch'), {
  surface: canvas,
  enabled: () => started && !paused && player.alive,
});

function resetControls() {
  input.reset();
  touch.reset();
}

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
    overGrace = MOURNING;
    audio.over();
  } else if (player.alive) {
    mourned = false;
  }
  overGrace = Math.max(0, overGrace - dt);
  overPanel.classList.toggle('shown', !player.alive);
  againButton.disabled = overGrace > 0;
  crosshair.hidden = !player.alive;
  lookHint.hidden = !player.alive || document.pointerLockElement === canvas || document.body.classList.contains('touching');
  if (!player.alive && document.pointerLockElement === canvas) document.exitPointerLock();

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

// Long enough that whatever you were doing when you died cannot carry through
// into dismissing the panel. You throw by clicking, so without this the click
// already in flight as Jerry goes down restarts the run before the words are
// even on screen — which is exactly what it looked like from the outside: a
// game that restarts itself without admitting it ended.
const MOURNING = 1.4;
let overGrace = 0;

function restart() {
  if (player.alive || overGrace > 0) return;
  player.reset();
  enemies.clear();
  projectiles.clear();
  pickups.reset();
  waves.reset();
  resetControls();
  cameraRig.reset(player.group.position);
}

function begin() {
  if (started || !player.rig.loaded || !dinoKit.loaded) return;
  started = true;
  resetControls();
  startPanel.classList.remove('shown');
  // The gesture that dismissed the panel is the one that lets mobile browsers
  // start an AudioContext at all, so this is the only place it can happen.
  audio.unlock();
}

startPanel.classList.add('shown');
startPanel.addEventListener('pointerdown', event => {
  if (event.target.closest('a')) return;
  event.preventDefault();
  event.stopPropagation();
  begin();
  if (event.pointerType === 'mouse') input.lock();
});

function setPaused(on) {
  // Never pause over the top of a panel — the opening screen and the death
  // screen are already a stopped game, and stacking a third one on them just
  // means two things to dismiss.
  if (on && (!started || !player.alive)) return;
  paused = on;
  pausePanel.classList.toggle('shown', paused);
  // Let go of the throw, or Jerry resumes mid-burst having never released it.
  resetControls();
  crosshair.hidden = on;
  lookHint.hidden = on;
  if (on && document.pointerLockElement === canvas) document.exitPointerLock();
}

addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas) setPaused(true);
});

addEventListener('keydown', event => {
  if (event.repeat || event.code === 'Tab' || event.target.closest?.('a, button, input, select')) return;
  // "Press any key to begin" has to mean any key, including the ones that do
  // something else once the game is running.
  if (!started) {
    begin();
    return;
  }
  if (event.code === 'KeyR') restart();
  else if (event.code === 'Escape') setPaused(true);
  else if (event.code === 'KeyP') setPaused(!paused);
  else if (paused) setPaused(false);
});

pausePanel.addEventListener('pointerdown', event => {
  if (event.target.closest('a')) return;
  event.preventDefault();
  event.stopPropagation();
  setPaused(false);
  if (event.pointerType === 'mouse') input.lock();
});

// Backgrounding the tab is a pause whether or not anyone asked for one. Without
// this, coming back to it hands the loop one enormous delta and teleports every
// dinosaur onto Jerry at once.
addEventListener('visibilitychange', () => {
  if (document.hidden) { resetControls(); setPaused(true); }
});
addEventListener('blur', () => { resetControls(); setPaused(true); });

// There is no R key on a phone, so the panel itself is the button.
// Only the button restarts, not the whole overlay. The overlay covers the
// screen, so making all of it a restart target meant every stray click was one.
againButton.addEventListener('pointerdown', event => {
  event.preventDefault();
  event.stopPropagation();
  restart();
});
overPanel.addEventListener('pointerdown', event => event.preventDefault());

/* ------------------------------------------------------------------------ loop */

const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), .05);

  // Still rendered while paused, so the swamp is visible behind the panel — but
  // nothing advances, and the clamped delta means resuming never jumps.
  if (paused) {
    player.rig.update();
    renderer.render(scene, camera);
    return;
  }

  if (!started) {
    player.rig.update();
    renderer.render(scene, camera);
    return;
  }

  input.sample();
  cameraRig.look(input.lookDelta.x + input.lookRate.x * dt * 1.8,
    input.lookDelta.y + input.lookRate.y * dt * 1.4);
  input.lookDelta.set(0, 0);
  cameraRig.moveToWorld(input.move.x, input.move.y, input.worldMove);
  player.update(dt, input, arena);
  cameraRig.update(dt, player.group.position, arena);
  updateAim();
  if (player.shoot(dt, input, projectiles, shotOrigin, shotDirection)) audio.throw();
  projectiles.update(dt, {
    arena,
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

  player.rig.update();
  renderer.render(scene, camera);
}

frame();
