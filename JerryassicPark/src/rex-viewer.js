import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createRexRig, REX_MODEL_URL } from './rex.js';

const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#viewer'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#192b31'); scene.fog = new THREE.Fog('#192b31', 35, 100);
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, .1, 120);
const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(-1, 2.3, 0); controls.enableDamping = true; controls.maxPolarAngle = Math.PI * .49; controls.minDistance = 8; controls.maxDistance = 40;
scene.add(new THREE.HemisphereLight('#e4e8d6', '#344654', 2));
for (const [color, intensity, position] of [['#ffdfa5', 3.4, [5, 10, 9]], ['#86c4ec', 3, [-6, 8, -8]], ['#e4f3df', 1.2, [8, 4, -2]]]) {
  const light = new THREE.DirectionalLight(color, intensity); light.position.set(...position); scene.add(light);
  if (position[2] === 9) { light.castShadow = true; light.shadow.mapSize.set(2048, 2048); Object.assign(light.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, far: 40 }); light.shadow.bias = -.001; light.shadow.normalBias = .025; }
}
const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#233b40', roughness: .85 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.015; floor.receiveShadow = true; scene.add(floor);
let rig, time = 0, running = false, roar = false;
function view(side = false) {
  const distance = innerWidth < innerHeight ? 29 : 20;
  camera.position.set(side ? -1 : 7, side ? 5.3 : 7, distance); controls.target.set(-1, 2.3, 0); controls.update();
}
document.querySelector('#three-quarter').onclick = () => view(); document.querySelector('#side').onclick = () => view(true);
document.querySelector('#walk').onclick = e => { running = !running; e.currentTarget.setAttribute('aria-pressed', running); };
document.querySelector('#roar').onclick = e => { roar = !roar; e.currentTarget.setAttribute('aria-pressed', roar); };
new GLTFLoader().loadAsync(REX_MODEL_URL).then(gltf => {
  rig = createRexRig(gltf.scene, { height: 4.7 }); scene.add(rig.group);
  document.querySelector('#status').textContent = 'BLENDER MODEL · REVISION 02';
}).catch(error => { console.error(error); document.querySelector('#status').textContent = 'MODEL COULD NOT LOAD · RELOAD TO RETRY'; });
function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize); resize(); view();
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => { time += Math.min(clock.getDelta(), .05); if (rig) rig.update(time, { running, roar: roar ? 1 : 0 }); controls.update(); renderer.render(scene, camera); });
