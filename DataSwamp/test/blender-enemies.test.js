import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { ENEMY_IDS, instantiateEnemy, createBlenderDinoKit } from '../src/creature/blender-dinos.js';
import { createEnemies } from '../src/game/enemies.js';

// Node has no image decoder. Keep the actual meshes/pivots/materials, and omit
// only normal textures from this geometry/behavior test; the browser checks them.
async function asset(id) {
  const bytes = await readFile(new URL(`../public/models/enemies/${id}.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + length).toString());
  assert.equal(json.scenes.length, 1, 'export must contain only the enemy scene');
  assert.ok(json.materials.some(m => m.normalTexture), 'hide normal texture is embedded');
  for (const m of json.materials) delete m.normalTexture;
  delete json.images; delete json.textures; delete json.samplers;
  const bin = bytes.subarray(28 + length);
  json.buffers[0].uri = `data:application/octet-stream;base64,${bin.toString('base64')}`;
  globalThis.ProgressEvent ??= class { constructor(type, props) { Object.assign(this, props); } };
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}

for (const id of ENEMY_IDS) test(`${id}: exported rig animates and shares geometry, but not hit materials`, async () => {
  const gltf = await asset(id);
  const a = instantiateEnemy(gltf.scene, id), b = instantiateEnemy(gltf.scene, id);
  assert.notEqual(a.head, b.head);
  assert.equal(a.legs.length, ['stego','trike','anky'].includes(id) ? 4 : 2);
  const meshes = rig => { const list=[]; rig.group.traverse(o => { if (o.isMesh) list.push(o); }); return list; };
  const ma = meshes(a), mb = meshes(b);
  assert.ok(ma.length < 25, 'draw calls stay bounded');
  ma.forEach((m,i) => {
    assert.equal(m.geometry, mb[i].geometry);
    assert.notEqual(m.material, mb[i].material);
    assert.ok([...m.geometry.attributes.position.array].every(Number.isFinite));
  });
  const bounds = new THREE.Box3().setFromObject(a.group);
  assert.ok(bounds.min.y > -.05, 'feet must not start underground');
  assert.ok(bounds.max.y < 4, 'model fits gameplay scale');
  const muzzle = a.head.localToWorld(new THREE.Vector3(...a.muzzle));
  assert.ok(muzzle.x > .3 && muzzle.y > .1, 'muzzle sits forward and above ground');
  a.head.rotation.y = .3; a.tail.rotation.y = .4; a.legs[0].rotation.z = .25;
  a.skins[0].emissive.setRGB(1,.5,.2);
  assert.equal(b.head.rotation.y, 0);
  assert.equal(b.skins[0].emissive.r, 0);
  a.dispose(); b.dispose();
});

test('loaded Blender enemies complete spawn, animation, damage, death, and cleanup', async () => {
  const loader={ loadAsync: url => asset(url.split('/').pop().replace('.glb','')) };
  const kit=createBlenderDinoKit({base:'/',loader}); await kit.ready;
  assert.equal(kit.loaded,true);assert.equal(kit.failed.size,0);
  const scene=new THREE.Scene(); const enemies=createEnemies(scene,kit);
  ENEMY_IDS.forEach((id,i)=>enemies.spawn(id,i*3,0));
  const frame={target:{x:10,z:10,radius:.5},arena:{radius:50,obstacles:[]},projectiles:{drag:()=>1,spawn(){}},hurt(){}};
  enemies.update(.016,frame);
  for (const e of enemies.list) assert.ok(Number.isFinite(e.rig.body.position.y));
  const first=enemies.list[0];enemies.damage(first,1000,0,0);
  for(let i=0;i<65;i++)enemies.update(.016,frame);
  assert.equal(enemies.list.includes(first),false);
  enemies.clear();assert.equal(scene.children.length,0);
});
