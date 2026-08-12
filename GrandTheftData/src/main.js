import * as THREE from 'three';
import './style.css';

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
camera.position.set(10.5, 5.4, 13.5);
camera.lookAt(0, 1.4, 0);

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
  dino: new THREE.MeshStandardMaterial({ color: 0xc7ff38, roughness: .68, metalness: .05 }),
  belly: new THREE.MeshStandardMaterial({ color: 0xefffb8, roughness: .8 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x07110f, roughness: .9 }),
  orange: new THREE.MeshStandardMaterial({ color: 0xff5a36, roughness: .58 }),
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

function createDino() {
  const dino = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(.72, 10, 8), materials.dino, dino, [0, 1.1, 0]);
  body.scale.set(1.15, .9, .72);
  const chest = mesh(new THREE.SphereGeometry(.42, 10, 8), materials.belly, dino, [.28, 1.02, .48]);
  chest.scale.set(.78, 1.1, .23);
  const head = mesh(new THREE.BoxGeometry(1.08, .78, .78, 2, 2, 2), materials.dino, dino, [.56, 1.85, 0]);
  head.rotation.z = -.08;
  const snout = mesh(new THREE.BoxGeometry(.72, .36, .73), materials.dino, dino, [1.05, 1.7, 0]);
  const eye = mesh(new THREE.SphereGeometry(.095, 8, 6), materials.dark, dino, [.78, 2.05, .39]);
  const eyeDot = mesh(new THREE.SphereGeometry(.03, 6, 4), materials.cream, dino, [.81, 2.08, .47]);
  const tail = mesh(new THREE.ConeGeometry(.43, 2.05, 7), materials.dino, dino, [-1.15, 1.14, 0], [0, 0, Math.PI / 2 + .15]);
  const arm = mesh(new THREE.CapsuleGeometry(.075, .36, 4, 6), materials.dino, dino, [.62, 1.26, .62], [0, 0, -.9]);
  const legs = [];
  for (const z of [-.32, .32]) {
    const leg = new THREE.Group();
    leg.position.set(-.18, .55, z);
    mesh(new THREE.CapsuleGeometry(.13, .5, 4, 6), materials.dino, leg, [0, 0, 0]);
    mesh(new THREE.BoxGeometry(.48, .16, .25), materials.dino, leg, [.16, -.32, 0]);
    dino.add(leg);
    legs.push(leg);
  }
  for (let i = 0; i < 3; i++) {
    mesh(new THREE.ConeGeometry(.12 + i * .025, .35, 4), materials.orange, dino, [-.48 + i * .3, 1.76 + i * .12, 0], [0, 0, -.12]);
  }
  dino.position.set(-2.9, 0, 0);
  scene.add(dino);
  return { group: dino, legs, tail, arm, eye, baseY: 0, velocity: 0 };
}

const dino = createDino();

const ground = mesh(new THREE.PlaneGeometry(200, 18), new THREE.MeshStandardMaterial({ color: 0x0b1915, roughness: .95 }), scene, [0, -.02, 0], [-Math.PI / 2, 0, 0]);
ground.receiveShadow = true;

const grid = new THREE.GridHelper(200, 130, 0x345d45, 0x173126);
grid.position.y = .015;
grid.material.opacity = .32;
grid.material.transparent = true;
scene.add(grid);

const horizonLines = new THREE.Group();
for (let i = 0; i < 18; i++) {
  const bar = mesh(new THREE.BoxGeometry(.025, Math.random() * 4 + .5, .025), materials.dino, horizonLines, [Math.random() * 40 - 10, Math.random() * 2, -8 - Math.random() * 10]);
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
  dino.group.position.y = 0; dino.group.rotation.set(0, 0, 0); dino.velocity = 0;
  ui.score.textContent = '000000'; renderLives();
}

function startGame() {
  resetGame(); state = 'running'; ui.start.classList.add('hidden'); ui.over.classList.add('hidden'); ui.pause.classList.add('hidden'); beep(420, .09); setTimeout(() => beep(650, .12), 90);
}

function jump() {
  if (state === 'ready') return startGame();
  if (state !== 'running' || dino.group.position.y > .04) return;
  dino.velocity = 8.1; beep(520, .11, 'triangle', .04);
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
  const dx = Math.abs(obstacle.position.x - dino.group.position.x);
  return dx < .75 && dino.group.position.y < obstacle.userData.card.geometry.parameters.height - .05;
}

function hit(obstacle) {
  obstacle.userData.hit = true; lives--; renderLives(); beep(115, .28, 'sawtooth', .06);
  obstacle.rotation.z = -.55; obstacle.userData.card.material.emissive.set(0xff2200); obstacle.userData.card.material.emissiveIntensity = 1;
  dino.group.rotation.z = -.18; setTimeout(() => { if (state !== 'over') dino.group.rotation.z = 0; }, 180);
  if (lives <= 0) {
    state = 'over'; highScore = Math.max(highScore, score); localStorage.setItem('dataDashHighScore', highScore);
    ui.highScore.textContent = String(highScore).padStart(6, '0'); ui.final.textContent = score.toLocaleString(); ui.over.classList.remove('hidden');
  }
}

function update(dt) {
  elapsed += dt; speed = Math.min(11.5, 5.8 + elapsed * .075);
  dino.velocity -= 20.5 * dt; dino.group.position.y += dino.velocity * dt;
  if (dino.group.position.y <= 0) { dino.group.position.y = 0; dino.velocity = 0; }
  const run = elapsed * speed * 1.15;
  dino.legs[0].rotation.z = Math.sin(run) * .62; dino.legs[1].rotation.z = Math.sin(run + Math.PI) * .62;
  dino.tail.rotation.y = Math.sin(elapsed * 5) * .1; dino.arm.rotation.z = -.9 + Math.sin(run) * .16;
  dino.group.rotation.z = THREE.MathUtils.lerp(dino.group.rotation.z, dino.velocity * -.012, .1);

  grid.position.x = (grid.position.x - speed * dt) % (200 / 130);
  dust.forEach(dot => { dot.position.x -= speed * dt * .2; if (dot.position.x < -9) dot.position.x = 22; });
  spawnTimer -= dt;
  if (spawnTimer <= 0) { spawnObstacle(); spawnTimer = Math.max(.88, 1.75 - speed * .055) + Math.random() * .48; }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i]; o.position.x -= speed * dt; o.rotation.y = Math.sin(elapsed * 1.5 + i) * .06;
    if (!o.userData.hit && collision(o)) hit(o);
    if (!o.userData.cleared && o.position.x < dino.group.position.x - .85) {
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

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
  if (innerWidth < 760) { camera.position.set(10.5, 5.2, 17.5); } else { camera.position.set(10.5, 5.4, 13.5); }
  camera.lookAt(0, 1.4, 0);
});

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .04);
  if (state === 'running') update(dt);
  else if (state === 'ready') {
    elapsed += dt; dino.group.position.y = Math.sin(elapsed * 2) * .03; dino.tail.rotation.y = Math.sin(elapsed * 3) * .12;
  }
  camera.position.y += (5.4 + dino.group.position.y * .08 - camera.position.y) * .025;
  renderer.render(scene, camera);
}
animate();
