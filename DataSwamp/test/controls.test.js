import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createInput } from '../src/game/input.js';
import { createShoulderCamera } from '../src/game/camera.js';

function inputHarness(t) {
  const window = new EventTarget(), canvas = new EventTarget();
  const previous = globalThis.addEventListener;
  globalThis.addEventListener = window.addEventListener.bind(window);
  t.after(() => { if (previous) globalThis.addEventListener = previous; else delete globalThis.addEventListener; });
  let locked = false;
  let enabled = true;
  canvas.requestPointerLock = () => { locked = true; return Promise.resolve(); };
  const input = createInput(canvas, { enabled: () => enabled, locked: () => locked });
  const send = (type, properties = {}, target = window) => target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), properties));
  return { input, canvas, send, disable: () => { enabled = false; } };
}

test('capturing the mouse does not fire; subsequent clicks fire and relative mouse motion looks', t => {
  const { input, canvas, send } = inputHarness(t);
  send('pointerdown', { pointerType: 'mouse', button: 0 }, canvas);
  assert.equal(input.sample().firing, false);
  send('mousemove', { movementX: 20, movementY: -10 });
  assert.ok(input.lookDelta.x > 0 && input.lookDelta.y > 0);
  send('pointerdown', { pointerType: 'mouse', button: 0 }, canvas);
  assert.equal(input.sample().firing, true);
  send('pointerup', { pointerType: 'mouse', button: 0 });
  assert.equal(input.sample().firing, false);
});

test('movement, look, and fire stay independent, including touch fire while stationary', t => {
  const { input, send } = inputHarness(t);
  send('keydown', { code: 'KeyA' }); send('keydown', { code: 'KeyS' });
  send('keydown', { code: 'KeyL' }); input.sample();
  assert.ok(Math.abs(input.move.length() - 1) < 1e-8);
  assert.deepEqual(input.lookRate.toArray(), [1, 0]);
  assert.equal(input.firing, false);
  input.stick.firing = true;
  send('keyup', { code: 'KeyL' }); input.sample();
  assert.equal(input.lookRate.lengthSq(), 0);
  assert.equal(input.firing, true);
});

test('focus loss clears held and queued controls, and paused input is ignored', t => {
  const { input, send, disable } = inputHarness(t);
  send('keydown', { code: 'KeyW' }); send('keydown', { code: 'KeyF' });
  send('keydown', { code: 'Space' }); send('keydown', { code: 'Digit2' });
  input.stick.firing = true; input.lookDelta.set(1, 1);
  send('blur'); input.sample();
  assert.equal(input.move.lengthSq(), 0); assert.equal(input.lookDelta.lengthSq(), 0);
  assert.equal(input.firing, false); assert.equal(input.takeJump(), false); assert.equal(input.takeTier(), 0);
  disable(); send('keydown', { code: 'KeyW' });
  assert.equal(input.sample().move.lengthSq(), 0);
});

test('jump key repeat does not queue another jump', t => {
  const { input, send } = inputHarness(t);
  send('keydown', { code: 'Space', repeat: false }); assert.equal(input.takeJump(), true);
  send('keydown', { code: 'Space', repeat: true }); assert.equal(input.takeJump(), false);
});

test('camera yaw defines strafing without movement feedback, and pitch never changes movement speed', () => {
  const camera = new THREE.PerspectiveCamera(), rig = createShoulderCamera(camera);
  rig.reset(new THREE.Vector3());
  const direction = rig.moveToWorld(0, 1, new THREE.Vector2());
  assert.ok(direction.distanceTo(new THREE.Vector2(1, 0)) < 1e-8);
  rig.look(Math.PI / 2, 100);
  rig.moveToWorld(.3, .4, direction);
  assert.ok(Math.abs(direction.length() - .5) < 1e-8);
  rig.update(.1, new THREE.Vector3()); const rotation = camera.quaternion.clone();
  for (let i = 0; i < 30; i++) rig.update(1 / 60, new THREE.Vector3(i, i % 3, i));
  assert.ok(camera.quaternion.angleTo(rotation) < 1e-6);
});

test('camera retracts before cover and widens portrait framing', () => {
  const camera = new THREE.PerspectiveCamera(), rig = createShoulderCamera(camera);
  rig.resize(1440, 1000); rig.reset(new THREE.Vector3());
  const anchor = new THREE.Vector3(0, 2.8, 0);
  rig.update(.016, new THREE.Vector3(), { obstacles: [{ x: -3, z: .7, radius: .8, height: 5 }] });
  assert.ok(camera.position.distanceTo(anchor) < 2.5);
  const landscape = camera.fov;
  rig.resize(390, 844); assert.ok(camera.fov > landscape);
});
