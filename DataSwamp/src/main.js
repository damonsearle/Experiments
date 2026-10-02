import * as THREE from 'three';
import './style.css';
import { createArena } from './scene/arena.js';
import { createPlayer } from './game/player.js';
import { createInput } from './game/input.js';
import { createArenaCamera, screenToWorld } from './game/camera.js';
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

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, .1, 300);
const cameraRig = createArenaCamera(camera);
cameraRig.resize(innerWidth, innerHeight);
cameraRig.reset(player.group.position);
// Stored in world space, so releasing either stick cannot reinterpret facing.
const aimDirection = new THREE.Vector2(1, 0);

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
    if (input.aimActive) screenToWorld(input.aim.x, input.aim.y, aimDirection);
    aimPoint.set(
      player.group.position.x + aimDirection.x * AIM_REACH,
      FLIGHT_Y,
      player.group.position.z + aimDirection.y * AIM_REACH,
    );
  } else {
    raycaster.setFromCamera(input.pointer, camera);
    if (!raycaster.ray.intersectPlane(aimPlane, aimPoint)) return;
    const dx = aimPoint.x - player.group.position.x;
    const dz = aimPoint.z - player.group.position.z;
    if (dx * dx + dz * dz > .04) aimDirection.set(dx, dz).normalize();
  }
  reticle.position.set(aimPoint.x, .04, aimPoint.z);
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
  input.aimMode = 'direction';
  aimDirection.set(1, 0);
  cameraRig.reset(player.group.position);
}

function begin() {
  if (started || !player.rig.loaded) return;
  started = true;
  resetControls();
  startPanel.classList.remove('shown');
  // The gesture that dismissed the panel is the one that lets mobile browsers
  // start an AudioContext at all, so this is the only place it can happen.
  audio.unlock();
}

startPanel.classList.add('shown');
startPanel.addEventListener('pointerdown', event => {
  event.preventDefault();
  event.stopPropagation();
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
  resetControls();
}

addEventListener('keydown', event => {
  if (event.repeat) return;
  // "Press any key to begin" has to mean any key, including the ones that do
  // something else once the game is running.
  if (!started) {
    begin();
    return;
  }
  if (event.code === 'KeyR') restart();
  else if (event.code === 'KeyP') setPaused(!paused);
  else if (paused) setPaused(false);
});

pausePanel.addEventListener('pointerdown', event => {
  event.preventDefault();
  event.stopPropagation();
  setPaused(false);
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
  screenToWorld(input.move.x, input.move.y, input.worldMove);
  player.update(dt, input, arena);
  cameraRig.update(dt, player.group.position);
  updateAim();
  player.aim(aimPoint);
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

  player.rig.update();
  renderer.render(scene, camera);
}

frame();
