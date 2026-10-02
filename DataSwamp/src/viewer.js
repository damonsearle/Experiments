import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createJerry } from './creature/jerry.js';
import { createBlenderDinoKit, ENEMY_IDS } from './creature/blender-dinos.js';
import { ARSENAL, projectileMesh } from './game/weapons.js';
import './style.css';
import './viewer.css';

const names = ['Compsognathus', 'Dilophosaurus', 'Stegosaurus', 'Pteranodon', 'Triceratops', 'Ankylosaurus', 'Tyrannosaurus rex'];
const formats = ['.TXT', '.CSV', '.XLS', '.PDF', '.ZIP', '.ISO', '.SQL'];
const catalog = {
  jerry: [{ id: 'jerry', name: 'Jerry', detail: 'Backup engineer · propeller beanie · glasses' }],
  enemies: ENEMY_IDS.map((id, i) => ({ id, name: names[i], detail: `${formats[i]} · ${id === 'ptero' ? 'Flying enemy' : id === 'rex' ? 'Boss' : 'Swamp wildlife'}` })),
  weapons: ARSENAL.map(w => ({ id: w.id, name: w.name, detail: `Tier ${w.tier} · ${w.damage} damage · ${w.magazine === Infinity ? 'Unlimited' : w.magazine} ammo`, spec: w })),
};
let category = new URLSearchParams(location.search).get('view');
let selection = 0, token = 0, active = null;
const cache = new Map();
let enemies, jerry;

document.body.className = 'model-viewer';
document.body.innerHTML = `
  <header class="viewer-header"><a href="./" class="viewer-brand">Data <em>Swamp</em><span>Model room</span></a><a class="viewer-back" href="./">← Back to game</a></header>
  <main class="viewer-layout">
    <aside class="viewer-sidebar">
      <p class="viewer-eyebrow">Collection</p>
      <nav class="viewer-categories" aria-label="Model categories">
        <button data-category="jerry">View Jerry</button><button data-category="enemies">View enemies</button><button data-category="weapons">View weapons</button>
      </nav>
      <div class="viewer-list" role="group" aria-label="Choose a model"></div>
      <div class="viewer-options">
        <label><input type="checkbox" id="turntable" checked> Auto rotate</label>
        <label><input type="checkbox" id="animate"> Animate</label>
        <label><input type="checkbox" id="wireframe"> Wireframe</label>
      </div>
      <p class="viewer-note">The same models used in the game.</p>
    </aside>
    <section class="viewer-stage" aria-label="Interactive model preview">
      <canvas id="model-canvas" aria-label="3D model — drag to rotate, scroll to zoom" tabindex="0"></canvas>
      <div class="viewer-title"><p class="viewer-eyebrow" id="model-index"></p><h1 id="model-name"></h1><p id="model-detail"></p></div>
      <p class="viewer-status" role="status"></p>
      <div class="viewer-views" aria-label="Camera views"><button data-angle="front">Front</button><button data-angle="side">Side</button><button data-angle="back">Back</button><button data-angle="reset">Reset view</button></div>
      <p class="viewer-help">Drag to orbit · scroll or pinch to zoom · right-drag to pan</p>
    </section>
  </main>`;
const $ = selector => document.querySelector(selector);
const canvas = $('#model-canvas'), stage = $('.viewer-stage');
const status = $('.viewer-status');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#182421');
const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
const environment = pmrem.fromScene(room, .04);
scene.environment = environment.texture;
scene.environmentIntensity = .65;
room.dispose(); pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xe9f3ed, 0x435346, 1.2));
const key = new THREE.DirectionalLight(0xffe3bd, 2);
key.position.set(4, 7, 5); key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = key.shadow.camera.bottom = -8;
key.shadow.camera.right = key.shadow.camera.top = 8;
key.shadow.normalBias = .025;
scene.add(key);
const rim = new THREE.DirectionalLight(0x8bcbd0, 2); rim.position.set(-4, 3, -4); scene.add(rim);
const floor = new THREE.Mesh(new THREE.CircleGeometry(1, 80), new THREE.MeshStandardMaterial({color:0x253832,roughness:.94}));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const camera = new THREE.PerspectiveCamera(38, 1, .001, 1000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.autoRotateSpeed = 1.1;
controls.maxPolarAngle = Math.PI * .94;
const display = new THREE.Group(); scene.add(display);
let radius = 2, focusHeight = 1;
function resize() {
  const width = stage.clientWidth, height = stage.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height; camera.updateProjectionMatrix();
  if (active) setView();
}
new ResizeObserver(resize).observe(stage);

function setView(angle = 'reset') {
  const distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.2 / Math.min(1, camera.aspect);
  const directions = { front:[1,.08,0],side:[0,.08,1],back:[-1,.08,0],reset:[1,.45,1.7] };
  controls.target.set(0, focusHeight, 0);
  camera.position.copy(new THREE.Vector3(...directions[angle]).normalize().multiplyScalar(distance).add(controls.target));
  controls.minDistance = radius * .3; controls.maxDistance = distance * 5;
  camera.near = Math.max(.001, radius / 100); camera.far = distance * 20;
  camera.updateProjectionMatrix(); controls.update();
}
function wireframe() {
  active?.group.traverse(o => {
    if (o.isMesh) for (const material of Array.isArray(o.material) ? o.material : [o.material]) material.wireframe = $('#wireframe').checked;
  });
}
async function getModel(entry, kind) {
  if (cache.has(entry.id)) return cache.get(entry.id);
  let rig;
  if (kind === 'jerry') {
    jerry ??= createJerry(); await jerry.ready; rig = jerry;
  } else if (kind === 'enemies') {
    enemies ??= createBlenderDinoKit(); await enemies.ready; rig = enemies[entry.id].spawn();
  } else {
    const group = projectileMesh(entry.spec);
    // Projectile prototypes are shared by gameplay; keep inspection materials independent.
    group.traverse(o => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone(); });
    rig = {group};
  }
  rig.group.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  rig.rest = (rig.legs || []).map(o => o.rotation.clone());
  cache.set(entry.id, rig); return rig;
}
async function select(index) {
  selection = index; const request = ++token, kind = category, entry = catalog[kind][index];
  $('#model-name').textContent = entry.name;
  $('#model-detail').textContent = entry.detail;
  $('#model-index').textContent = `${kind === 'jerry' ? 'Character' : kind} / ${String(index+1).padStart(2,'0')} of ${String(catalog[kind].length).padStart(2,'0')}`;
  for (const [i, button] of [...$('.viewer-list').children].entries()) button.setAttribute('aria-pressed', String(i === index));
  display.clear(); active = null; status.textContent = `Loading ${entry.name}…`;
  try {
    const rig = await getModel(entry, kind);
    if (request !== token) return;
    active = rig; display.add(rig.group); display.position.set(0,0,0);
    display.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(rig.group, true);
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    display.position.set(-center.x, -box.min.y, -center.z);
    radius = size.length() / 2; focusHeight = size.y / 2;
    floor.scale.setScalar(Math.max(size.x, size.z) * .85);
    floor.position.y = -.015 * radius;
    setView(); wireframe();
    status.textContent = kind === 'enemies' && enemies.failed.has(entry.id) ? 'Blender model unavailable — showing original.' : '';
  } catch (error) {
    if (request !== token) return;
    status.textContent = 'This model could not load. Select it again to retry.';
    console.error('Model viewer:',error);
  }
}
function showCategory(kind, updateUrl = true) {
  category = kind;
  $('#animate').disabled = kind === 'weapons';
  if (kind === 'weapons') $('#animate').checked = false;
  if (updateUrl) { const url = new URL(location.href); url.searchParams.set('view',kind); history.replaceState(null,'',url); }
  document.title = `${kind === 'jerry' ? 'Jerry' : kind === 'enemies' ? 'Enemies' : 'Weapons'} · Data Swamp model room`;
  for (const button of document.querySelectorAll('[data-category]')) button.setAttribute('aria-pressed',String(button.dataset.category === kind));
  $('.viewer-list').replaceChildren(...catalog[kind].map((entry,i) => {
    const button=document.createElement('button');button.textContent=entry.name;button.addEventListener('click',()=>select(i));return button;
  }));
  select(0);
}
for (const button of document.querySelectorAll('[data-category]')) button.addEventListener('click',()=>showCategory(button.dataset.category));
for (const button of document.querySelectorAll('[data-angle]')) button.addEventListener('click',()=>{
  $('#turntable').checked=false; controls.autoRotate=false; setView(button.dataset.angle);
});
$('#wireframe').addEventListener('change',wireframe);
canvas.addEventListener('pointerdown',()=>{ $('#turntable').checked=false; });
canvas.addEventListener('keydown',event=>{
  if (['ArrowLeft','ArrowRight'].includes(event.key)) {
    event.preventDefault();select((selection+(event.key==='ArrowRight'?1:-1)+catalog[category].length)%catalog[category].length);
  }
  if(event.key.toLowerCase()==='r')setView();
});
let time=0;
const clock=new THREE.Clock();
renderer.setAnimationLoop(()=>{
  const dt=Math.min(clock.getDelta(),.05);time+=dt;
  controls.autoRotate=$('#turntable').checked;
  if(active?.legs){
    const moving=$('#animate').checked;
    active.legs.forEach((leg,i)=>{
      leg.rotation.copy(active.rest[i]);
      if(moving)leg.rotation[category==='enemies' && catalog[category][selection].id==='ptero'?'x':'z']+=Math.sin(time*5+i*Math.PI)*.35;
    });
    if(active.tail)active.tail.rotation.y=moving?Math.sin(time*3)*.18:0;
    if(active.propeller && moving)active.propeller.rotation.y+=dt*8;
    active.update?.();
  }
  controls.update(dt);renderer.render(scene,camera);
});
resize();showCategory(category,false);
