import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { traceWorld } from '../src/game/collision.js';
import { createProjectiles } from '../src/game/projectiles.js';
import { ARSENAL } from '../src/game/weapons.js';
const empty = { obstacles: [] };
const target = (x, z) => ({ x, z, radius: .5, alive: true, traits: { bar: 1.2 } });

test('aiming high misses ground creatures; flyers can be hit at their actual height', () => {
  const ray = new THREE.Ray(new THREE.Vector3(0, 3, 0), new THREE.Vector3(1, 0, 0));
  const point = new THREE.Vector3(), enemy = target(5, 0);
  assert.equal(traceWorld(ray, empty, [enemy], 10, point), null);
  enemy.traits.fly = true;
  enemy.rig = { group: { position: { y: 0 } }, body: { position: { y: 2.6 } } };
  assert.equal(traceWorld(ray, empty, [enemy], 10, point), enemy);
});

test('nearest target wins regardless of list order, and cover stops the aim ray', () => {
  const ray = new THREE.Ray(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0));
  const point = new THREE.Vector3(), near = target(5, 0), far = target(8, 0);
  assert.equal(traceWorld(ray, empty, [far, near], 20, point), near);
  const cover = { obstacles: [{ x: 3, z: 0, radius: 1, height: 2 }] };
  assert.equal(traceWorld(ray, cover, [near], 20, point), 'world');
  assert.ok(Math.abs(point.x - 2) < 1e-8);
});

test('swept player shots hit small creatures between frames and cannot shoot through cover', () => {
  const shots = createProjectiles(new THREE.Scene());
  const enemy = target(3, 0), hits = [];
  const spec = { ...ARSENAL[0], speed: 200 };
  const state = { hostiles: [enemy], player: { alive: false }, hit: e => hits.push(e), hurtPlayer() {} };
  shots.spawn(spec, 0, 0, 1, 0, 'player', .7);
  shots.update(.05, state);
  assert.equal(hits.length, 1); assert.equal(shots.live.length, 0);
  hits.length = 0;
  shots.spawn(spec, 0, 0, 1, 0, 'player', .7);
  shots.update(.05, { ...state, arena: { obstacles: [{ x: 1.5, z: 0, radius: .3, height: 2 }] } });
  assert.equal(hits.length, 0); assert.equal(shots.live.length, 0);
});

test('shot pitch controls flight height and ground impact, including upward misses', () => {
  const shots = createProjectiles(new THREE.Scene());
  const hits = [];
  const state = { hostiles: [target(3, 0)], player: { alive: false }, hit: e => hits.push(e), hurtPlayer() {} };
  shots.spawn(ARSENAL[0], 0, 0, Math.SQRT1_2, 0, 'player', 2, Math.SQRT1_2);
  shots.update(.1, state);
  assert.ok(shots.live[0].y > 2); assert.equal(hits.length, 0);
  shots.clear();
  shots.spawn(ARSENAL[0], 0, 0, 0, 0, 'player', 1, -1);
  shots.update(.1, state);
  assert.equal(shots.live.length, 0);
});

test('homing and ricochets steer vertically without changing projectile speed', () => {
  const shots = createProjectiles(new THREE.Scene());
  const flyer = target(8, 0);
  flyer.traits.fly = true;
  flyer.rig = { group: { position: { y: 0 } }, body: { position: { y: 2.6 } } };
  const state = { hostiles: [flyer], player: { alive: false }, hit() {}, hurtPlayer() {} };
  const homing = { ...ARSENAL[0], homing: 3, homingReach: 20 };
  shots.spawn(homing, 0, 0, 1, 0, 'player', 1);
  shots.update(.05, state);
  let shot = shots.live[0];
  assert.ok(shot.vy > 0);
  assert.ok(Math.abs(Math.hypot(shot.vx, shot.vy, shot.vz) - homing.speed) < 1e-8);
  shots.clear();
  const first = target(1, 0);
  const bouncing = { ...ARSENAL[0], ricochet: 1, ricochetReach: 20 };
  shots.spawn(bouncing, 0, 0, 1, 0, 'player', .5);
  shots.update(.05, { ...state, hostiles: [first, flyer] });
  shot = shots.live[0];
  assert.equal(shot.bounces, 1); assert.ok(shot.vy > 0);
});

test('jumping still dodges ground volleys but not shots marked from above', () => {
  const shots = createProjectiles(new THREE.Scene());
  let damage = 0;
  const state = { hostiles: [], player: { alive: true, x: 0, z: 0, radius: .85, lift: 2 }, hit() {}, hurtPlayer: () => damage++ };
  shots.spawn(ARSENAL[0], -1, 0, 1, 0, 'enemy');
  shots.update(.05, state); assert.equal(damage, 0);
  shots.clear();
  shots.spawn({ ...ARSENAL[0], fromAbove: true }, -1, 0, 1, 0, 'enemy');
  shots.update(.05, state); assert.equal(damage, 1);
});
