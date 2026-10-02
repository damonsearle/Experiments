import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createInput } from '../src/game/input.js';
import { createArenaCamera, screenToWorld } from '../src/game/camera.js';

function inputHarness(t) {
  const window = new EventTarget();
  const canvas = new EventTarget();
  canvas.getBoundingClientRect = () => ({ left: 10, top: 20, width: 800, height: 600 });
  const previous = globalThis.addEventListener;
  globalThis.addEventListener = window.addEventListener.bind(window);
  t.after(() => {
    if (previous) globalThis.addEventListener = previous;
    else delete globalThis.addEventListener;
  });
  const input = createInput(canvas);
  const send = (type, properties, target = window) => target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), properties));
  return { input, canvas, send };
}

test('retreating never changes aim, and releasing aim stops firing without turning', t => {
  const { input } = inputHarness(t);
  input.stick.move.set(-1, 0);
  input.stick.aim.set(1, 0);
  input.stick.firing = true;
  input.sample();
  assert.deepEqual(input.move.toArray(), [-1, 0]);
  assert.deepEqual(input.aim.toArray(), [1, 0]);
  assert.equal(input.firing, true);
  input.stick.aim.set(0, 0);
  input.stick.firing = false;
  input.stick.move.set(0, -1);
  input.sample();
  assert.equal(input.firing, false);
  assert.equal(input.aimActive, false);
  assert.deepEqual(input.aim.toArray(), [1, 0]);
  input.stick.move.set(0, 0);
  input.sample();
  assert.equal(input.move.lengthSq(), 0);
  assert.deepEqual(input.aim.toArray(), [1, 0]);
});

test('keyboard movement and keyboard aiming are independent, with bounded diagonal speed', t => {
  const { input, send } = inputHarness(t);
  send('keydown', { code: 'KeyA' });
  send('keydown', { code: 'KeyS' });
  send('keydown', { code: 'KeyI' });
  input.sample();
  assert.ok(Math.abs(input.move.length() - 1) < 1e-8);
  assert.deepEqual(input.aim.toArray(), [0, 1]);
  assert.equal(input.firing, true);
  send('keyup', { code: 'KeyI' });
  input.sample();
  assert.equal(input.firing, false);
  assert.deepEqual(input.aim.toArray(), [0, 1]);
});

test('mouse clicks acquire their own aim point and only the primary button fires', t => {
  const { input, canvas, send } = inputHarness(t);
  send('pointerdown', { pointerType: 'mouse', button: 2, clientX: 210, clientY: 170 }, canvas);
  assert.equal(input.sample().firing, false);
  send('pointerdown', { pointerType: 'mouse', button: 0, clientX: 210, clientY: 170 }, canvas);
  assert.equal(input.sample().firing, true);
  assert.equal(input.aimMode, 'pointer');
  assert.deepEqual(input.pointer.toArray(), [-.5, .5]);
  send('pointercancel', { pointerType: 'mouse' });
  assert.equal(input.sample().firing, false);
});

test('focus loss clears held movement, fire, and queued actions', t => {
  const { input, send } = inputHarness(t);
  send('keydown', { code: 'KeyW' });
  send('keydown', { code: 'KeyL' });
  send('keydown', { code: 'Space' });
  send('keydown', { code: 'Digit2' });
  input.stick.move.set(0, 1);
  input.stick.aim.set(-1, 0);
  input.stick.firing = true;
  input.sample();
  send('blur', {});
  input.sample();
  assert.equal(input.move.lengthSq(), 0);
  assert.equal(input.stick.aim.lengthSq(), 0);
  assert.equal(input.firing, false);
  assert.equal(input.takeJump(), false);
  assert.equal(input.takeTier(), 0);
});

test('jump key repeat does not queue another jump while held', t => {
  const { input, send } = inputHarness(t);
  send('keydown', { code: 'Space', repeat: false });
  assert.equal(input.takeJump(), true);
  send('keydown', { code: 'Space', repeat: true });
  assert.equal(input.takeJump(), false);
});

test('camera bearing and height stay fixed through strafing, facing changes, and jumps', () => {
  const camera = new THREE.PerspectiveCamera();
  const rig = createArenaCamera(camera);
  rig.resize(1440, 1000);
  rig.reset({ x: 0, y: 0, z: 0 });
  const facing = camera.quaternion.clone();
  const height = camera.position.y;
  for (let i = 0; i < 600; i++) {
    rig.update(1 / 60, { x: i / 60, y: Math.abs(Math.sin(i / 20)) * 3, z: -i / 120, rotation: { y: i } });
    assert.ok(1 - Math.abs(camera.quaternion.dot(facing)) < 1e-10);
    assert.equal(camera.position.y, height);
  }
  assert.ok(camera.position.x > 9);
});

test('portrait framing preserves combat width, and diagonals retain analog strength', () => {
  const camera = new THREE.PerspectiveCamera();
  const rig = createArenaCamera(camera);
  for (const [width, height] of [[1440, 1000], [390, 844], [844, 390], [320, 900]]) {
    rig.resize(width, height);
    rig.reset({ x: 0, y: 5, z: 0 });
    const edge = new THREE.Vector3(8.5, 1, 0).project(camera);
    assert.ok(edge.x <= 1.000001 && edge.x > 0);
    assert.ok(camera.fov <= 75);
  }
  const world = screenToWorld(.3, .4, new THREE.Vector2());
  assert.ok(Math.abs(world.length() - .5) < 1e-8);
  assert.ok(world.x > 0 && world.y < 0);
  assert.equal(screenToWorld(0, 0, world).lengthSq(), 0);
});
