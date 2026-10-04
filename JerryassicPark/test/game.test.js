import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, tick, checkpointRespawn, STEP, LEVEL_END, corePositions, ENCOUNTER, createEncounterPreview } from '../src/game.js';

test('jump lands on an elevated one-way platform', () => {
  const g = createSession(); g.state.x = 10; let landed = false;
  tick(g, { axis: 1, jumpPressed: true });
  for (let i = 0; i < 70; i++) { tick(g, { axis: g.state.x < 13 ? 1 : 0 }); if (g.state.grounded && g.state.y === 1.8) landed = true; }
  assert.equal(landed, true);
});
test('rewind restores position, health, enemies, and collectibles atomically', () => {
  const g = createSession(); g.state.x = 21; g.state.y = 3.4; g.state.enemies[0].x = 22; g.state.enemies[0].y = 0;
  const before = structuredClone(g.state);
  tick(g, { axis: 1 }); assert.equal(g.state.cores.length, 1);
  g.state.health = 1; g.state.enemies[0].alive = false;
  tick(g, { rewind: true }); assert.deepEqual(g.state, before); assert.ok(g.charge < 3);
  tick(g); assert.equal(g.state.cores.length, 1, 'recollecting cannot duplicate a core');
});
test('rewind is capped at three seconds and cannot rewind indefinitely', () => {
  const g = createSession(); for (let i = 0; i < 400; i++) tick(g);
  assert.equal(g.history.length, 180);
  for (let i = 0; i < 180; i++) tick(g, { rewind: true });
  assert.ok(g.charge < STEP + .001); assert.ok(g.history.length <= 1);
});
test('a fall has a rewind rescue window and respawns safely at checkpoint', () => {
  const g = createSession(); g.state.x = 35; g.state.y = -3.7; g.state.vy = -10;
  tick(g); assert.ok(g.state.grace > 0); assert.equal(g.state.health, 2);
  tick(g, { rewind: true }); assert.equal(g.state.health, 3); assert.equal(g.state.grace, 0);
  tick(g); for (let i = 0; i < 80; i++) tick(g);
  assert.equal(g.state.health, 2); assert.equal(g.state.x, 3); assert.equal(g.state.y, 0);
});
test('checkpoint retry preserves data but resets danger and rewind history', () => {
  const g = createSession(); g.state.checkpoint = 2; g.state.cores = [0, 1, 2, 3]; g.state.bits = [1, 2]; g.state.health = 0; g.state.rex.active = true; g.mode = 'over';
  checkpointRespawn(g); assert.equal(g.state.x, 111); assert.equal(g.state.health, 3); assert.deepEqual(g.state.cores, [0, 1, 2, 3]); assert.equal(g.state.rex.active, false); assert.equal(g.mode, 'playing'); assert.equal(g.history.length, 0);
});
test('stomping defeats a raptor and bounces Jerry', () => {
  const g = createSession(); g.state.x = 28; g.state.y = 1.45; g.state.vy = -8; g.state.grounded = false;
  tick(g); assert.equal(g.state.enemies[0].alive, false); assert.ok(g.state.vy > 0); assert.equal(g.state.health, 3);
});
test('the chase waits for all cores and exit requires every core', () => {
  const g = createSession(); g.state.x = LEVEL_END; tick(g); assert.equal(g.mode, 'playing'); assert.equal(g.state.rex.active, false);
  g.state.x = corePositions[4].x; g.state.y = 3.3; g.state.cores = [0, 1, 2, 3]; tick(g);
  assert.equal(g.state.rex.active, false); assert.equal(g.state.rex.encounter, null); assert.equal(g.state.cores.length, 5);
  g.state.x = ENCOUNTER.trigger; g.state.y = 0; tick(g);
  assert.ok(g.state.rex.encounter); assert.equal(g.state.rex.active, false);
  for (let i = 0; i < 310; i++) tick(g);
  assert.equal(g.state.rex.active, true);
  g.state.x = LEVEL_END; g.state.y = 0; tick(g); assert.equal(g.mode, 'won');
});
test('invulnerability prevents a single contact from consuming all hearts', () => {
  const g = createSession(); g.state.x = 28; tick(g); assert.equal(g.state.health, 2);
  tick(g); assert.equal(g.state.health, 2);
});

test('all five cores and the escape are reachable using only normal movement and jumps', () => {
  const g = createSession();
  // Walk/jump targets describe a legal route; no state is teleported or made invulnerable.
  const route = [
    [9.8, 0, false], [13.5, 1.8, true], [14.8, 1.8, false], [20, 3.4, true], [22, 3.4, false], [29, 0, true], [32.7, 0, false],
    [38.5, 1.7, true], [41.8, 1.7, false], [47, 3.4, true], [50, 3.4, false], [56, 0, true], [58, 0, false],
    [64, 0, true], [67, 1.7, true], [69, 1.7, false], [74.5, 3.3, true], [77, 3.3, false], [81.8, 0, true],
    [88, 0, true], [95, 1.7, true], [97.8, 1.7, false], [103, 3.4, true], [106, 3.4, false], [112.8, 0, true],
    [119.5, 0, true], [122.5, 1.6, true], [125.8, 1.6, false], [131.5, 3, true], [134, 3, false], [139, 3.3, true], [141, 3.3, false],
    [157.8, 0, false], [164.5, 0, true], [175.8, 0, false], [182.5, 0, true], [197, 0, false],
  ];
  for (const [x, y, jump] of route) {
    let reached = false;
    for (let i = 0; i < 600; i++) {
      tick(g, { axis: Math.max(-1, Math.min(1, (x - g.state.x) * 2)), jumpPressed: jump && i === 0 });
      assert.notEqual(g.mode, 'over', `Jerry died before target ${x}`);
      if (g.mode === 'won' || (!g.state.rex.encounter && Math.abs(g.state.x - x) < .15 && Math.abs(g.state.y - y) < .1 && g.state.grounded)) { reached = true; break; }
    }
    assert.ok(reached, `Unreachable route target ${x}, ${y}`);
  }
  assert.equal(g.mode, 'won'); assert.equal(g.state.cores.length, 5); assert.equal(g.state.checkpoint, 2); assert.equal(g.state.rex.active, true);
});

test('rewinding the fifth core restores the unexplored encounter', () => {
  const g = createSession(); g.state.cores = [0, 1, 2, 3]; g.state.x = 141; g.state.y = 3.3;
  tick(g); assert.equal(g.state.cores.length, 5); assert.equal(g.state.rex.active, false);
  tick(g, { rewind: true }); assert.equal(g.state.cores.length, 4); assert.equal(g.state.rex.active, false);
});

test('encounter is continuous, safe, and hands movement back after the turn', () => {
  const g = createEncounterPreview(); tick(g);
  assert.ok(g.state.rex.encounter);
  const health = g.state.health, rexX = g.state.rex.x;
  let lastX = g.state.x, crossedRex = false, chaseEvents = 0;
  for (let i = 0; i < 310; i++) {
    tick(g, { axis: -1, jumpPressed: true });
    chaseEvents += g.events.filter(e => e === 'chase').length;
    if (g.state.rex.active) break;
    assert.equal(g.state.rex.x, rexX, 'rex does not teleport');
    assert.ok(g.state.x >= lastX && g.state.x - lastX < .2);
    assert.equal(g.state.y, 0); assert.equal(g.state.health, health);
    crossedRex ||= g.state.x > rexX; lastX = g.state.x;
  }
  assert.ok(crossedRex); assert.equal(chaseEvents, 1);
  assert.equal(g.state.x, ENCOUNTER.exitX); assert.equal(g.state.rex.x, rexX);
  tick(g, { axis: 1, jumpPressed: true });
  assert.ok(g.state.x > ENCOUNTER.exitX); assert.ok(g.state.y > 0, 'jump works immediately after the cut');
});

test('rewind crosses encounter entry and chase handoff without rerunning or skipping beats', () => {
  const g = createEncounterPreview();
  const before = structuredClone(g.state); tick(g); tick(g, { rewind: true });
  assert.deepEqual(g.state, before);
  tick(g);
  while (g.state.rex.encounter.elapsed < 4.9) tick(g);
  const turnPose = structuredClone(g.state); let count = 0;
  while (!g.state.rex.active) { tick(g); count++; }
  const handoff = structuredClone(g.state);
  for (let i = 0; i < count; i++) tick(g, { rewind: true });
  assert.deepEqual(g.state, turnPose);
  for (let i = 0; i < count; i++) tick(g);
  assert.deepEqual(g.state, handoff);
  checkpointRespawn(g); assert.equal(g.state.rex.active, false); assert.equal(g.state.rex.encounter, null);
  assert.equal(g.state.cores.length, 5, 'retry can replay the encounter with recovered cores');
});

test('paused encounters freeze and missing cores never trigger them', () => {
  const g = createEncounterPreview(); g.state.cores.pop(); tick(g); assert.equal(g.state.rex.encounter, null);
  g.state.cores.push(4); tick(g); const frozen = structuredClone(g.state);
  g.mode = 'paused'; tick(g, { axis: 1 }); assert.deepEqual(g.state, frozen);
});
