import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createJerry } from '../../shared/jerry/jerry.js';
import { buildWorld } from './world.js';
import { createSession, tick, STEP, LEVEL_END, checkpointRespawn, encounterPose, createEncounterPreview } from './game.js';
import { createAudio } from './audio.js';
import { createRexRig, REX_MODEL_URL } from './rex.js';
import './style.css';

const $ = id => document.getElementById(id);
const ui = Object.fromEntries(['game', 'hud', 'menu', 'start', 'load-status', 'bits', 'cores', 'hearts', 'core-dots', 'rewind', 'rewind-fill', 'rewind-time', 'help', 'chapter', 'toast', 'modal', 'modal-title', 'modal-copy', 'modal-kicker', 'resume', 'restart', 'pause', 'sound', 'touch', 'encounter-caption', 'preview-encounter'].map(id => [id, $(id)]));
const renderer = new THREE.WebGLRenderer({ canvas: ui.game, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#294854'); scene.fog = new THREE.Fog('#294854', 30, 93);
const camera = new THREE.OrthographicCamera(-18, 18, 11, -11, .1, 150);
const fill = new THREE.HemisphereLight('#c9edee', '#486751', 2.2); scene.add(fill);
const sun = new THREE.DirectionalLight('#ffe6af', 3.1); sun.position.set(-8, 20, 14); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 22, bottom: -15, near: 1, far: 70 }); sun.shadow.bias = -.001; sun.shadow.normalBias = .04; scene.add(sun, sun.target);
const rim = new THREE.DirectionalLight('#5ad9d8', 2.4); rim.position.set(-10, 12, -16); scene.add(rim);
const world = buildWorld(scene);
const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .25, .5, 1.2)); composer.addPass(new OutputPass());

const jerry = createJerry({ height: 2.85 }); scene.add(jerry.group);
const ghosts = Array.from({ length: 3 }, () => { const rig = createJerry({ height: 2.85 }); scene.add(rig.group); rig.group.visible = false; return rig; });
const loader = new GLTFLoader();
const enemyURL = new URL('../../DataSwamp/public/models/enemies/compy.glb', import.meta.url).href;
const rexURL = REX_MODEL_URL;
function dinoRig(template, height) {
  const group = template.clone(true);
  const pivots = {};
  group.traverse(o => { if (o.userData.role) pivots[o.userData.role] = o; if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group), size = bounds.getSize(new THREE.Vector3());
  const container = new THREE.Group(); group.position.y -= bounds.min.y; container.scale.setScalar(height / size.y); container.add(group); scene.add(container);
  return { group: container, pivots };
}
let enemies = [], rex, loaded = false;
const audio = createAudio();
let session = createSession(), mode = 'intro';
let toastUntil = 0, time = 0, accumulator = 0, last = performance.now(), rewindSound = 0;
let cameraX = -.8, cameraY = 2, cameraHeight = 10;
const keys = new Set(), touch = new Set();
let jumpPending = false, padJump = false, padPause = false;

function showToast(message, seconds = 3.5) { ui.toast.textContent = message; ui.toast.classList.add('show'); toastUntil = performance.now() + seconds * 1000; }
function clearInput() { keys.clear(); touch.clear(); jumpPending = false; }
function start(preview = false) {
  if (!loaded) return;
  audio.unlock(); session = preview === true ? createEncounterPreview() : createSession(); mode = 'playing'; clearInput(); accumulator = 0;
  ui.menu.classList.add('hidden'); ui.modal.classList.add('hidden');
  ['hud', 'rewind', 'help', 'chapter', 'pause', 'touch'].forEach(id => ui[id].classList.remove('hidden'));
  cameraX = session.state.x + 7; cameraY = 3.8; cameraHeight = 19;
  ui.game.tabIndex = 0; ui.game.focus();
  if (preview !== true) showToast('Recover 5 cores. Jump onto raptors. Hold R to undo a mistake.', 6);
}
function openModal(type) {
  mode = type; clearInput();
  ui.modal.classList.remove('hidden');
  if (type === 'paused') {
    ui['modal-kicker'].textContent = 'CONNECTION SUSPENDED'; ui['modal-title'].textContent = 'Taking a byte.';
    ui['modal-copy'].textContent = 'Even backup engineers need a break. Your progress is safe.'; ui.resume.textContent = 'BACK TO THE PARK →';
  } else if (type === 'over') {
    ui['modal-kicker'].textContent = 'RESTORE POINT AVAILABLE'; ui['modal-title'].textContent = 'Well. That happened.';
    ui['modal-copy'].textContent = 'Jerry’s disaster recovery plan: try again. Return to your checkpoint with recovered data intact.'; ui.resume.textContent = 'RESTORE CHECKPOINT ↶';
  } else {
    ui['modal-kicker'].textContent = 'ALL SYSTEMS RESTORED'; ui['modal-title'].textContent = 'Extinction averted.';
    ui['modal-copy'].textContent = `Five cores secured. ${session.state.bits.length * 10} bits recovered in ${Math.floor(session.state.time / 60)}:${String(Math.floor(session.state.time % 60)).padStart(2, '0')}. Jerry would like to remind everyone that he absolutely meant to do that.`;
    ui.resume.textContent = 'ANOTHER DAY AT THE OFFICE →'; audio.play('win');
  }
  ui.resume.focus();
}
function resume() {
  if (mode === 'won') { start(); return; }
  if (mode === 'over') checkpointRespawn(session);
  mode = 'playing'; clearInput(); ui.modal.classList.add('hidden'); ui.game.focus(); accumulator = 0;
}
function togglePause() { if (mode === 'playing') openModal('paused'); else if (mode === 'paused') resume(); }
ui['preview-encounter'].addEventListener('click', () => start(true));
ui.start.addEventListener('click', start); ui.resume.addEventListener('click', resume); ui.restart.addEventListener('click', start); ui.pause.addEventListener('click', togglePause);
ui.sound.addEventListener('click', () => { audio.unlock(); const enabled = audio.toggle(); ui.sound.textContent = enabled ? 'SOUND ON' : 'SOUND OFF'; ui.sound.setAttribute('aria-label', enabled ? 'Mute sound' : 'Enable sound'); if (mode === 'playing') ui.game.focus(); });
window.addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && mode === 'playing') e.preventDefault();
  if (e.code === 'Escape' || e.code === 'KeyP') { if (!e.repeat) togglePause(); return; }
  if (e.code === 'Tab' && !ui.modal.classList.contains('hidden')) {
    e.preventDefault(); (document.activeElement === ui.resume ? ui.restart : ui.resume).focus(); return;
  }
  if (mode !== 'playing') return;
  if (!e.repeat && ['Space', 'KeyW', 'ArrowUp'].includes(e.code)) jumpPending = true;
  keys.add(e.code);
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => { clearInput(); if (mode === 'playing') openModal('paused'); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'playing') openModal('paused'); });
ui.touch.querySelectorAll('button').forEach(button => {
  const control = button.dataset.control;
  button.addEventListener('pointerdown', e => { e.preventDefault(); button.setPointerCapture(e.pointerId); touch.add(control); if (control === 'jump') jumpPending = true; });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(event => button.addEventListener(event, () => touch.delete(control)));
});
function input() {
  const pad = [...(navigator.getGamepads?.() || [])].find(p => p?.connected);
  const jump = !!(pad?.buttons[0]?.pressed), pause = !!pad?.buttons[9]?.pressed;
  if (jump && !padJump) { if (mode === 'intro') start(); else if (mode === 'playing') jumpPending = true; else resume(); }
  if (pause && !padPause) togglePause();
  padJump = jump; padPause = pause;
  let axis = (keys.has('KeyD') || keys.has('ArrowRight') || touch.has('right') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') || touch.has('left') ? 1 : 0);
  if (pad && Math.abs(pad.axes[0]) > .18) axis = pad.axes[0];
  if (pad?.buttons[14]?.pressed) axis = -1; if (pad?.buttons[15]?.pressed) axis = 1;
  return { axis, rewind: keys.has('KeyR') || touch.has('rewind') || !!pad?.buttons[6]?.pressed };
}
function poseJerry(rig, s, phase = s.time, preview = false) {
  const cinematic = preview ? null : encounterPose(s);
  const moving = preview ? 0 : Math.min(1, Math.abs(s.vx) / 8);
  const stride = Math.sin(phase * 14) * .65 * moving;
  rig.group.position.set(s.x, s.y, 0);
  rig.group.scale.set(1, 1 - (cinematic?.duck ?? 0) * .42, 1);
  rig.group.rotation.y = preview ? -.95 : s.facing > 0 ? -.28 : Math.PI + .28;
  rig.legs[0].rotation.z = s.grounded ? stride : -.35;
  rig.legs[1].rotation.z = s.grounded ? -stride : .4;
  rig.arms[0].rotation.z = -.5 - stride * .4 + (s.grounded ? 0 : -.35);
  rig.arms[1].rotation.z = -.5 + stride * .4 + (s.grounded ? 0 : -.35);
  rig.head.rotation.z = Math.sin(phase * 3) * .035 + (cinematic && cinematic.turn === 0 && cinematic.duck < .2 ? .28 : 0);
  rig.jaw.rotation.z = -.38 - Math.sin(phase * 2) * .04;
  rig.tail.rotation.y = Math.sin(phase * 5) * .16;
  rig.propeller.rotation.y = phase * (moving > 0 ? 18 : 5);
  rig.update();
}
function renderDino(rig, x, direction, phase, active = true) {
  rig.group.visible = active; rig.group.position.set(x, 0, 0); rig.group.rotation.y = direction > 0 ? 0 : Math.PI;
  for (let i = 0; i < 2; i++) if (rig.pivots[`Leg${i}`]) rig.pivots[`Leg${i}`].rotation.z = Math.sin(phase * 8 + i * Math.PI) * .4;
  if (rig.pivots.Tail) rig.pivots.Tail.rotation.y = Math.sin(phase * 4) * .1;
}
function render(dt) {
  const s = session.state, intro = mode === 'intro', cinematic = intro ? null : encounterPose(s);
  world.update(s, mode === 'playing' ? s.time : time);
  if (loaded) {
    poseJerry(jerry, intro ? { ...s, x: 3.8, y: 0 } : s, intro ? time : s.time, intro);
    jerry.group.visible = !(s.invulnerable > 0 && Math.floor(s.time * 13) % 2 === 0 && !intro && !cinematic);
    enemies.forEach((rig, i) => { const e = s.enemies[i]; renderDino(rig, e.x, e.direction, s.time + i, e.alive); });
    rex.group.position.set(s.rex.x, 0, s.rex.active ? -1.5 : -1.5 * (cinematic?.turn ?? 0));
    rex.group.rotation.y = s.rex.active ? 0 : -Math.PI * (1 - (cinematic?.turn ?? 0));
    rex.update(s.time, { running: s.rex.active, roar: cinematic?.roar ?? (s.rex.active ? .45 : 0) });
    ghosts.forEach((rig, i) => {
      const old = session.history[session.history.length - 1 - (i + 1) * 10];
      rig.group.visible = !!old && session.rewinding && mode === 'playing';
      if (rig.group.visible) poseJerry(rig, old);
    });
  }
  const lookAhead = Math.min(4.5, 19 * innerWidth / innerHeight * .15);
  const targetX = cinematic ? 151 : intro ? (innerWidth < 800 ? 1.1 : -.5) : Math.max(innerWidth < 800 ? 5 : 9, Math.min(LEVEL_END - 8, s.x + (s.rex.active ? 0 : s.facing * lookAhead)));
  const targetY = cinematic ? 3.7 : intro ? 2.35 : 3.7 + Math.max(0, s.y - 2) * .22;
  const blend = 1 - Math.exp(-dt * 4);
  cameraX += (targetX - cameraX) * blend; cameraY += (targetY - cameraY) * blend;
  cameraHeight += ((cinematic ? Math.max(13.5, 22 / (innerWidth / innerHeight)) : intro ? 8.5 : 19) - cameraHeight) * blend;
  const width = cameraHeight * innerWidth / innerHeight;
  camera.left = -width / 2; camera.right = width / 2; camera.top = cameraHeight / 2; camera.bottom = -cameraHeight / 2; camera.updateProjectionMatrix();
  camera.position.set(cameraX, cameraY + 3.6, 28); camera.lookAt(cameraX, cameraY, 0);
  sun.position.set(cameraX - 9, 20, 14); sun.target.position.set(cameraX, 0, 0);
  ui.bits.textContent = String(s.bits.length * 10).padStart(4, '0'); ui.cores.textContent = `${s.cores.length} / 5`;
  ui.hearts.textContent = '♥ '.repeat(s.health) + '♡ '.repeat(3 - s.health); ui.hearts.setAttribute('aria-label', `${s.health} health`);
  ui['core-dots'].textContent = Array.from({ length: 5 }, (_, i) => s.cores.includes(i) ? '◆' : '◇').join(' ');
  const available = Math.min(session.charge, session.history.length * STEP);
  ui['rewind-fill'].style.width = `${available / 3 * 100}%`; ui['rewind-time'].textContent = `${available.toFixed(1)}s`;
  document.body.classList.toggle('cinematic', !!cinematic);
  ui['encounter-caption'].textContent = cinematic?.caption ?? '';
  document.body.classList.toggle('rewinding', session.rewinding && mode === 'playing');
  if (performance.now() > toastUntil) ui.toast.classList.remove('show');
  composer.render();
}
function resize() { renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); }
window.addEventListener('resize', resize); resize();
const messages = { core: 'Data core secured. Jerry’s plan is almost working.', checkpoint: 'Backup complete · checkpoint saved · health restored', hit: 'Ouch! Hold R to rewind that encounter.', fall: 'Bad sector! Hold R now to rewind the fall.', respawn: 'Backup restored. Your recovered data is safe.', chase: 'HE NOTICED. JUMP THE GAPS! RUN TO THE UPLINK →' };
function frame(now) {
  const dt = Math.min((now - last) / 1000, .08); last = now; time += dt;
  const controls = input();
  if (mode === 'playing') {
    accumulator += dt;
    while (accumulator >= STEP) {
      tick(session, { ...controls, jumpPressed: jumpPending }); jumpPending = false; accumulator -= STEP;
      for (const event of session.events) { audio.play(event); if (messages[event]) showToast(messages[event], event === 'chase' ? 6 : 3); }
      if (session.mode !== 'playing') { openModal(session.mode); accumulator = 0; break; }
    }
    if (session.rewinding && time - rewindSound > .16) { audio.play('rewind'); rewindSound = time; }
    if (session.state.x > LEVEL_END - 3 && session.state.cores.length < 5 && performance.now() > toastUntil) showToast('The uplink needs all 5 cores. Look for cyan beacons on the upper platforms.');
  } else accumulator = 0;
  render(dt); requestAnimationFrame(frame);
}
Promise.all([jerry.ready, ...ghosts.map(g => g.ready), loader.loadAsync(enemyURL), loader.loadAsync(rexURL)]).then(results => {
  enemies = session.state.enemies.map(() => dinoRig(results[4].scene, 1.65)); rex = createRexRig(results[5].scene); scene.add(rex.group);
  ghosts.forEach((rig, i) => rig.group.traverse(o => { if (o.isMesh) { o.material = new THREE.MeshBasicMaterial({ color: '#5affed', transparent: true, opacity: .25 - i * .055, depthWrite: false }); o.castShadow = false; } }));
  loaded = true; ui['preview-encounter'].disabled = false; ui.start.disabled = false; ui.start.innerHTML = 'ENTER THE PARK <span>→</span>'; ui['load-status'].textContent = 'Jerry is ready. The park definitely isn’t.';
}).catch(error => {
  console.error('Park assets failed to load', error); ui['load-status'].textContent = 'Could not load the park. Reload to try again.'; ui.start.textContent = 'RELOAD THE PARK'; ui.start.disabled = false;
  ui.start.addEventListener('click', () => location.reload(), { once: true });
});
ui.game.addEventListener('webglcontextlost', e => { e.preventDefault(); if (mode === 'playing') openModal('paused'); showToast('Graphics connection lost. Reload to restore the park.', 60); });
requestAnimationFrame(frame);
