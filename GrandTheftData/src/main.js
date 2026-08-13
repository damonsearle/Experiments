import * as THREE from 'three';
import './style.css';
import { createJerry } from './jerry.js';

const canvas = document.querySelector('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07110f);
scene.fog = new THREE.FogExp2(0x07110f, 0.038);

const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 120);

// Two framings: a close one for the idle turntable, and the wide gameplay shot. The camera
// eases between them, so starting a run reads as pulling back rather than a cut.
// Aimed above Jerry so he sits low in frame, clear of the headline and the start panel.
const inspectPose = { position: new THREE.Vector3(2, 3, 6.2), target: new THREE.Vector3(-2.1, 2.35, -.6) };
const runPose = { position: new THREE.Vector3(10.5, 5.4, 13.5), target: new THREE.Vector3(0, 1.4, 0) };
const pose = { position: inspectPose.position.clone(), target: inspectPose.target.clone() };

scene.add(new THREE.HemisphereLight(0xbfffc5, 0x07110f, 1.6));
const keyLight = new THREE.DirectionalLight(0xc7ff38, 4.5);
keyLight.position.set(-2, 9, 6);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
scene.add(keyLight);
const rim = new THREE.PointLight(0xff5936, 24, 20);
rim.position.set(5, 2, -5);
scene.add(rim);

const materials = {
  accent: new THREE.MeshStandardMaterial({ color: 0xc7ff38, roughness: .68, metalness: .05 }),
  cream: new THREE.MeshStandardMaterial({ color: 0xf4f2e9, roughness: .72 }),
};

function mesh(geometry, material, parent, position, rotation = [0, 0, 0]) {
  const part = new THREE.Mesh(geometry, material);
  part.position.set(...position);
  part.rotation.set(...rotation);
  part.castShadow = true;
  part.receiveShadow = true;
  parent.add(part);
  return part;
}

const jerry = createJerry(scene);

const ground = mesh(new THREE.PlaneGeometry(200, 18), new THREE.MeshStandardMaterial({ color: 0x0b1915, roughness: .95 }), scene, [0, -.02, 0], [-Math.PI / 2, 0, 0]);
ground.receiveShadow = true;

const grid = new THREE.GridHelper(200, 130, 0x345d45, 0x173126);
grid.position.y = .015;
grid.material.opacity = .32;
grid.material.transparent = true;
scene.add(grid);

const horizonLines = new THREE.Group();
for (let i = 0; i < 18; i++) {
  const bar = mesh(new THREE.BoxGeometry(.025, Math.random() * 4 + .5, .025), materials.accent, horizonLines, [Math.random() * 40 - 10, Math.random() * 2, -8 - Math.random() * 10]);
  bar.material = bar.material.clone();
  bar.material.transparent = true;
  bar.material.opacity = .12 + Math.random() * .18;
}
scene.add(horizonLines);

const fileTypes = [
  { ext: '.CSV', color: 0xc7ff38 }, { ext: '.PDF', color: 0xff5a36 },
  { ext: '.XLS', color: 0x62d98b }, { ext: '.TXT', color: 0xf4f2e9 },
  { ext: '.JSON', color: 0xffc857 }, { ext: '.ZIP', color: 0xa98cff },
  { ext: '.DOC', color: 0x65b7ff }, { ext: '.XML', color: 0xff80a4 },
];
const obstacles = [];
const textureCache = new Map();

function fileTexture(type) {
  if (textureCache.has(type.ext)) return textureCache.get(type.ext);
  const c = document.createElement('canvas'); c.width = 512; c.height = 640;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f4f2e9'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = `#${type.color.toString(16).padStart(6, '0')}`; ctx.fillRect(0, 0, c.width, 98);
  ctx.fillStyle = '#07110f'; ctx.font = 'bold 72px Arial'; ctx.fillText(type.ext, 34, 73);
  ctx.fillStyle = '#07110f';
  for (let i = 0; i < 7; i++) ctx.fillRect(38, 170 + i * 55, i % 2 ? 300 : 390, 12);
  ctx.font = 'bold 28px monospace'; ctx.fillText('DATA OBJECT', 38, 590);
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(type.ext, texture); return texture;
}

function spawnObstacle(x = 12) {
  const type = fileTypes[Math.floor(Math.random() * fileTypes.length)];
  const group = new THREE.Group();
  const height = .9 + Math.random() * .48;
  const card = mesh(new THREE.BoxGeometry(.88, height, .14), new THREE.MeshStandardMaterial({ map: fileTexture(type), roughness: .62 }), group, [0, height / 2, 0]);
  const tab = mesh(new THREE.BoxGeometry(.26, .12, .16), new THREE.MeshStandardMaterial({ color: type.color }), group, [-.25, height + .04, 0]);
  group.position.set(x, 0, (Math.random() - .5) * .25);
  group.userData = { type, cleared: false, hit: false, radius: .48, card, tab };
  scene.add(group); obstacles.push(group);
}

const dust = [];
for (let i = 0; i < 55; i++) {
  const dot = mesh(new THREE.BoxGeometry(.025, .025, .025), materials.cream, scene, [Math.random() * 30 - 8, Math.random() * 3.5, Math.random() * 10 - 8]);
  dot.material = dot.material.clone(); dot.material.transparent = true; dot.material.opacity = Math.random() * .3;
  dust.push(dot);
}

const ui = {
  score: document.querySelector('#score'), highScore: document.querySelector('#highScore'), lives: document.querySelector('#lives'),
  start: document.querySelector('#startPanel'), over: document.querySelector('#gameOverPanel'), final: document.querySelector('#finalScore'),
  pause: document.querySelector('#pauseBadge'), toast: document.querySelector('#toast'), sound: document.querySelector('#soundButton'),
};

let state = 'ready';
let score = 0, lives = 3, speed = 5.8, spawnTimer = 0, elapsed = 0, soundOn = true, audioContext;
let highScore = Number(localStorage.getItem('dataDashHighScore') || 0);
ui.highScore.textContent = String(highScore).padStart(6, '0');

function renderLives() {
  ui.lives.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const life = document.createElement('i'); life.className = `life${i >= lives ? ' lost' : ''}`; ui.lives.appendChild(life);
  }
  ui.lives.setAttribute('aria-label', `${lives} lives`);
}
renderLives();

function beep(frequency, duration, type = 'square', volume = .035) {
  if (!soundOn) return;
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain();
  oscillator.type = type; oscillator.frequency.value = frequency; gain.gain.value = volume;
  oscillator.connect(gain); gain.connect(audioContext.destination);
  gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + duration);
  oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
}

function resetGame() {
  obstacles.forEach(o => scene.remove(o)); obstacles.length = 0;
  score = 0; lives = 3; speed = 5.8; spawnTimer = .8; elapsed = 0;
  jerry.group.position.y = 0; jerry.group.rotation.set(0, 0, 0); jerry.velocity = 0;
  ui.score.textContent = '000000'; renderLives();
}

function startGame() {
  resetGame();
  state = 'running';
  document.body.classList.add('game-started');
  document.body.classList.remove('game-help-hidden');
  clearTimeout(startGame.helpTimer);
  startGame.helpTimer = setTimeout(() => document.body.classList.add('game-help-hidden'), 5000);
  ui.start.classList.add('hidden'); ui.over.classList.add('hidden'); ui.pause.classList.add('hidden'); beep(420, .09); setTimeout(() => beep(650, .12), 90);
}

function jump() {
  if (state === 'ready') return startGame();
  if (state !== 'running' || jerry.group.position.y > .04) return;
  jerry.velocity = 8.1; beep(520, .11, 'triangle', .04);
}

function togglePause() {
  if (state === 'running') { state = 'paused'; ui.pause.classList.remove('hidden'); }
  else if (state === 'paused') { state = 'running'; ui.pause.classList.add('hidden'); }
}

function showToast(type) {
  ui.toast.innerHTML = `+100 <span>${type.ext} CLEARED</span>`; ui.toast.classList.add('show');
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => ui.toast.classList.remove('show'), 600);
}

function collision(obstacle) {
  const dx = Math.abs(obstacle.position.x - jerry.group.position.x);
  return dx < .75 && jerry.group.position.y < obstacle.userData.card.geometry.parameters.height - .05;
}

function hit(obstacle) {
  obstacle.userData.hit = true; lives--; renderLives(); beep(115, .28, 'sawtooth', .06);
  obstacle.rotation.z = -.55; obstacle.userData.card.material.emissive.set(0xff2200); obstacle.userData.card.material.emissiveIntensity = 1;
  jerry.group.rotation.z = -.18; setTimeout(() => { if (state !== 'over') jerry.group.rotation.z = 0; }, 180);
  if (lives <= 0) {
    state = 'over'; highScore = Math.max(highScore, score); localStorage.setItem('dataDashHighScore', highScore);
    ui.highScore.textContent = String(highScore).padStart(6, '0'); ui.final.textContent = score.toLocaleString(); ui.over.classList.remove('hidden');
  }
}

function update(dt) {
  elapsed += dt; speed = Math.min(11.5, 5.8 + elapsed * .075);
  jerry.velocity -= 20.5 * dt; jerry.group.position.y += jerry.velocity * dt;
  if (jerry.group.position.y <= 0) { jerry.group.position.y = 0; jerry.velocity = 0; }
  const run = elapsed * speed * 1.15;
  jerry.legs[0].rotation.z = Math.sin(run) * .62; jerry.legs[1].rotation.z = Math.sin(run + Math.PI) * .62;
  jerry.tail.rotation.y = Math.sin(elapsed * 5) * .1;
  jerry.arms[0].rotation.z = -.5 + Math.sin(run) * .16;
  jerry.arms[1].rotation.z = -.5 + Math.sin(run + Math.PI) * .16;
  jerry.head.rotation.z = Math.sin(run * 2) * .035;
  jerry.propeller.rotation.y += dt * (10 + speed * .8);
  jerry.group.rotation.z = THREE.MathUtils.lerp(jerry.group.rotation.z, jerry.velocity * -.012, .1);

  grid.position.x = (grid.position.x - speed * dt) % (200 / 130);
  dust.forEach(dot => { dot.position.x -= speed * dt * .2; if (dot.position.x < -9) dot.position.x = 22; });
  spawnTimer -= dt;
  if (spawnTimer <= 0) { spawnObstacle(); spawnTimer = Math.max(.88, 1.75 - speed * .055) + Math.random() * .48; }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i]; o.position.x -= speed * dt; o.rotation.y = Math.sin(elapsed * 1.5 + i) * .06;
    if (!o.userData.hit && collision(o)) hit(o);
    if (!o.userData.cleared && o.position.x < jerry.group.position.x - .85) {
      o.userData.cleared = true;
      if (!o.userData.hit) { score += 100; ui.score.textContent = String(score).padStart(6, '0'); showToast(o.userData.type); beep(760, .07, 'sine', .025); }
    }
    if (o.position.x < -12) { scene.remove(o); obstacles.splice(i, 1); }
  }
}

document.querySelector('#startButton').addEventListener('click', startGame);
document.querySelector('#restartButton').addEventListener('click', startGame);
ui.sound.addEventListener('click', () => { soundOn = !soundOn; ui.sound.textContent = `SOUND: ${soundOn ? 'ON' : 'OFF'}`; if (soundOn) beep(500, .08); });
window.addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) { e.preventDefault(); jump(); }
  if (e.code === 'KeyP') togglePause();
});
canvas.addEventListener('pointerdown', jump);

function frameCamera() {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
  const narrow = innerWidth < 760;
  runPose.position.set(10.5, narrow ? 5.2 : 5.4, narrow ? 17.5 : 13.5);
  // On a narrow screen the panels crowd the middle, so hold the turntable a little further off.
  // Wide: Jerry sits low, under the headline and left of the start panel. Narrow: the panel
  // eats the lower half, so hold further back and aim lower to lift him clear of it.
  inspectPose.position.set(narrow ? 5.15 : 2, narrow ? 2.1 : 3, narrow ? 15.2 : 6.2);
  inspectPose.target.set(-2.1, narrow ? 1.98 : 2.35, -.6);
}
frameCamera();
window.addEventListener('resize', frameCamera);

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .04);
  if (state === 'running') update(dt);
  else if (state === 'ready') {
    // Idle turntable, so Jerry can be looked over from every side before the run begins.
    elapsed += dt;
    jerry.group.position.y = Math.sin(elapsed * 2) * .03;
    jerry.group.rotation.y += dt * .45;
    jerry.tail.rotation.y = Math.sin(elapsed * 3) * .12;
    jerry.head.rotation.z = Math.sin(elapsed * 1.6) * .03;
    jerry.propeller.rotation.y += dt * 2.4;
  }
  const wanted = state === 'ready' ? inspectPose : runPose;
  const ease = 1 - Math.pow(.05, dt);
  pose.position.lerp(wanted.position, ease);
  pose.target.lerp(wanted.target, ease);
  camera.position.copy(pose.position);
  camera.position.y += jerry.group.position.y * .08;
  camera.lookAt(pose.target);
  renderer.render(scene, camera);
}
animate();
