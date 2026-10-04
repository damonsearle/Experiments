import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createRexRig } from '../src/rex.js';

async function asset() {
  const bytes = await readFile(new URL('../public/models/tyrannosaurus-rex.glb', import.meta.url));
  const length = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + length).toString());
  assert.equal(json.scenes.length, 1);
  assert.ok(json.skins.length > 0, 'actual Blender skinning survives export');
  assert.ok(json.materials.some(m => m.normalTexture), 'pebbled skin is embedded');
  for (const m of json.materials) delete m.normalTexture;
  delete json.images; delete json.textures; delete json.samplers;
  json.buffers[0].uri = `data:application/octet-stream;base64,${bytes.subarray(28 + length).toString('base64')}`;
  globalThis.ProgressEvent ??= class { constructor(type, props) { Object.assign(this, props); } };
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}

test('exported rex has independent skeletons, correct scale and bounded draw calls', async () => {
  const gltf = await asset();
  const a = createRexRig(gltf.scene), b = createRexRig(gltf.scene);
  const bounds = new THREE.Box3().setFromObject(a.group, true);
  assert.ok(Math.abs(bounds.max.y - bounds.min.y - 7.5) < .001, JSON.stringify({min:bounds.min,max:bounds.max,scale:a.group.scale}));
  const meshes = r => { const result = []; r.group.traverse(o => { if (o.isMesh) result.push(o); }); return result; };
  const ma = meshes(a), mb = meshes(b);
  assert.ok(ma.length <= 12);
  ma.forEach((m, i) => {
    assert.ok(m.isSkinnedMesh);
    assert.equal(m.geometry, mb[i].geometry);
    assert.notEqual(m.skeleton, mb[i].skeleton);
    assert.notEqual(m.skeleton.bones[0], mb[i].skeleton.bones[0]);
  });
  const rest = b.pivots.Jaw.quaternion.clone();
  a.update(.7, { roar: 1 });
  assert.ok(a.pivots.Jaw.quaternion.angleTo(rest) > .1);
  assert.ok(b.pivots.Jaw.quaternion.equals(rest));
});

test('rex animation remains grounded and rewind reproduces its pose', async () => {
  const { scene } = await asset();
  const rig = createRexRig(scene);
  rig.group.position.set(100, 2, -1.5);
  const contacts = ['ToeContact0', 'ToeContact1', 'HeelContact0', 'HeelContact1'];
  for (let i = 0; i < 90; i++) {
    rig.update(i / 30, { running: true, roar: .45 });
    const low = Math.min(...contacts.map(role => rig.pivots[role].getWorldPosition(new THREE.Vector3()).y));
    assert.ok(Math.abs(low - 2) < .00001);
    rig.group.traverse(o => assert.ok(o.matrixWorld.elements.every(Number.isFinite)));
  }
  rig.update(.7, { roar: .45 });
  const pose = rig.pivots.Head.matrixWorld.clone();
  rig.update(4, { roar: .45 }); rig.update(.7, { roar: .45 });
  assert.ok(pose.elements.every((v, i) => Math.abs(v - rig.pivots.Head.matrixWorld.elements[i]) < 1e-9));
});
