import * as THREE from 'three';

import { FORMAT_BY_ID } from './weapons.js';

/* --------------------------------------------------------------------------
   The wildlife's behaviour. One small state machine per individual and no
   pathfinding — the arena is open with sparse cover, so steering is enough:

     approach → strafe → telegraph → recover → (back to approach/strafe)

   with `stagger` layered on top as a spring rather than a state, so being shot
   never interrupts what a dinosaur was doing, it just shoves it.

   Per-species variation is data, not code. Everything below the table is
   shared, which is what keeps adding the remaining four species at M5 cheap.
   -------------------------------------------------------------------------- */

const SPECIES = {
  // Trivial alone, lethal in numbers: closes fast, sits close, fires often.
  compy: {
    hp: 20, radius: .5, speed: 5.4, range: 7, band: 2.6,
    cooldown: 1.5, telegraph: .35, burst: 1, spread: 0,
    format: 'txt', gait: 9, rear: .1, bar: 1.2, glow: .07,
  },
  // Holds the middle distance and spits three comma-separated values at once.
  dilo: {
    hp: 45, radius: .8, speed: 3.3, range: 10, band: 3,
    cooldown: 2.3, telegraph: .6, burst: 3, spread: .26,
    format: 'csv', gait: 5.5, rear: .16, bar: 2.2, glow: .13,
  },
  // Slow, armoured, and content to stand off and lob spreadsheets over cover.
  stego: {
    hp: 90, radius: 1.15, speed: 1.8, range: 13, band: 4,
    cooldown: 3.2, telegraph: .95, burst: 1, spread: 0,
    format: 'xls', gait: 3.4, rear: .12, bar: 2.1, glow: .14,
  },
  // Flies. `fly` holds it at a cruising height, and flying means it ignores the
  // platforms entirely and drops shots a jump cannot clear.
  ptero: {
    hp: 70, radius: .85, speed: 4.6, range: 11, band: 3.5,
    cooldown: 2.6, telegraph: .55, burst: 1, spread: 0,
    format: 'pdf', gait: 7, rear: .1, bar: 3.6, glow: .11, fly: true,
  },
  // Charges. Swaps strafing for a windup and a run, so the answer to it is
  // movement rather than more damage.
  trike: {
    hp: 160, radius: 1.1, speed: 2.6, range: 9, band: 3,
    cooldown: 3.4, telegraph: .8, burst: 1, spread: 0,
    format: 'zip', gait: 3.6, rear: .14, bar: 2.3, glow: .15,
    charge: { windup: .9, speed: 13, time: 1.1, damage: 22, cooldown: 4.5, from: 11 },
  },
  anky: {
    hp: 240, radius: 1.2, speed: 2, range: 11, band: 3.5,
    cooldown: 4, telegraph: 1, burst: 1, spread: 0,
    format: 'iso', gait: 3.2, rear: .08, bar: 2, glow: .16,
    charge: { windup: 1.1, speed: 11, time: 1.3, damage: 28, cooldown: 5.5, from: 12 },
  },
  // The boss. Slow, enormous, and its telegraph is long enough to be a warning
  // rather than a formality.
  rex: {
    hp: 800, radius: 1.9, speed: 2.9, range: 14, band: 4,
    cooldown: 2.6, telegraph: 1.1, burst: 3, spread: .34,
    // `bar` is a child of the rig, which the model scales by 1.35, so this is
    // pre-division rather than a world height.
    format: 'sql', gait: 2.6, rear: .16, bar: 3.6, glow: .2,
    charge: { windup: 1.2, speed: 15, time: 1.2, damage: 36, cooldown: 7, from: 13 },
  },
};

export const SPECIES_IDS = Object.keys(SPECIES);

const HIT_FLASH = .18;
const SEPARATION = 1.3;   // how hard they push each other apart when they bunch up

// A unit sphere, scaled per species at spawn. A fixed radius would be bigger
// than a Compsognathus's entire head and lost inside a Stegosaurus's.
const glowGeometry = new THREE.SphereGeometry(1, 12, 10);
const barGeometry = new THREE.PlaneGeometry(1.5, .16);
const barBack = new THREE.MeshBasicMaterial({ color: 0x14100c, transparent: true, opacity: .75, depthTest: false });
const barFill = new THREE.MeshBasicMaterial({ color: 0xc9634a, depthTest: false });

const muzzlePoint = new THREE.Vector3();

export function createEnemies(scene, kit) {
  const list = [];

  function spawn(speciesId, x, z) {
    const traits = SPECIES[speciesId];
    const format = FORMAT_BY_ID.get(traits.format);
    const rig = kit[speciesId].spawn();

    rig.group.position.set(x, 0, z);
    rig.group.rotation.y = Math.random() * Math.PI * 2;
    scene.add(rig.group);

    // The telegraph light. It lives at the mouth and spends almost all of its
    // life at zero scale; every shot is announced by it swelling.
    const glow = new THREE.Mesh(
      glowGeometry,
      new THREE.MeshBasicMaterial({ color: format.tint, transparent: true, opacity: .85 }),
    );
    glow.position.set(...rig.muzzle);
    glow.scale.setScalar(.0001);
    rig.head.add(glow);

    const bar = new THREE.Group();
    bar.position.y = traits.bar;
    rig.group.add(bar);
    const back = new THREE.Mesh(barGeometry, barBack);
    back.renderOrder = 10;
    bar.add(back);
    const fill = new THREE.Mesh(barGeometry, barFill);
    fill.renderOrder = 11;
    fill.position.z = .01;
    bar.add(fill);
    bar.scale.setScalar(traits.bar / 2.4);

    const enemy = {
      species: speciesId,
      traits,
      format,
      rig,
      glow,
      bar,
      fill,
      x,
      z,
      radius: traits.radius,
      hp: traits.hp,
      maxHp: traits.hp,
      alive: true,
      state: 'approach',
      timer: traits.cooldown * (.4 + Math.random() * .8), // stagger the first volley
      chargeTimer: traits.charge ? traits.charge.cooldown * (.5 + Math.random()) : Infinity,
      chargeX: 0,
      chargeZ: 0,
      hitPlayer: false,
      orbit: Math.random() < .5 ? -1 : 1,
      stride: Math.random() * 6,
      speed: 0,
      flash: 0,
      lean: 0,
      leanVelocity: 0,
      dying: 0,
    };
    list.push(enemy);
    return enemy;
  }

  function damage(enemy, amount, fromX, fromZ) {
    if (!enemy.alive) return;
    enemy.hp -= amount;
    enemy.flash = HIT_FLASH;

    // Stagger away from the shot, and shove the body back so the hit has weight.
    const dx = enemy.x - fromX;
    const dz = enemy.z - fromZ;
    const distance = Math.hypot(dx, dz) || 1;
    enemy.leanVelocity += 6 * (amount / 40 + .3);
    const shove = .14 * (20 / enemy.maxHp + .2);
    enemy.x += (dx / distance) * shove;
    enemy.z += (dz / distance) * shove;

    if (enemy.hp <= 0) {
      enemy.hp = 0;
      enemy.alive = false;
      enemy.dying = .0001;
      enemy.glow.scale.setScalar(.001);
    }
  }

  // Circle push-out against the arena's logs and stones, plus the outer ring.
  // Enemies ignore obstacle height: unlike Jerry they never jump.
  function collide(enemy, arena) {
    // Flyers cross the platforms rather than walking round them; the arena rim
    // still holds them, or they would drift off over the reeds.
    if (!enemy.traits.fly) for (const obstacle of arena.obstacles) {
      const dx = enemy.x - obstacle.x;
      const dz = enemy.z - obstacle.z;
      const reach = obstacle.radius + enemy.radius;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq >= reach * reach || distanceSq === 0) continue;
      const distance = Math.sqrt(distanceSq);
      const push = (reach - distance) / distance;
      enemy.x += dx * push;
      enemy.z += dz * push;
    }

    const limit = arena.radius - enemy.radius;
    const fromCentre = Math.hypot(enemy.x, enemy.z);
    if (fromCentre > limit) {
      const scale = limit / fromCentre;
      enemy.x *= scale;
      enemy.z *= scale;
    }
  }

  // Keeps a swarm from collapsing into one dinosaur-shaped pile.
  function separate(dt) {
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (!b.alive) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const reach = a.radius + b.radius;
        const distanceSq = dx * dx + dz * dz;
        if (distanceSq >= reach * reach || distanceSq === 0) continue;
        const distance = Math.sqrt(distanceSq);
        const push = (reach - distance) / distance * SEPARATION * dt;
        a.x -= dx * push;
        a.z -= dz * push;
        b.x += dx * push;
        b.z += dz * push;
      }
    }
  }

  function fire(enemy, projectiles, target) {
    const { traits, format, rig } = enemy;
    // The shot leaves the mouth, not the pivot, so a Stego's spreadsheet starts
    // out at the end of its neck where the telegraph just lit up.
    rig.head.localToWorld(muzzlePoint.set(...rig.muzzle));

    const dx = target.x - muzzlePoint.x;
    const dz = target.z - muzzlePoint.z;
    const distance = Math.hypot(dx, dz) || 1;
    const aim = Math.atan2(dz / distance, dx / distance);

    for (let i = 0; i < traits.burst; i++) {
      const offset = traits.burst > 1 ? (i / (traits.burst - 1) - .5) * traits.spread * 2 : 0;
      const angle = aim + offset;
      projectiles.spawn(format, muzzlePoint.x, muzzlePoint.z, Math.cos(angle), Math.sin(angle), 'enemy');
    }
  }

  function animate(enemy, dt) {
    const { rig, traits } = enemy;
    enemy.stride += enemy.speed * dt * traits.gait;

    const gait = Math.min(enemy.speed / traits.speed, 1);
    const swing = Math.sin(enemy.stride) * .5 * gait;
    for (let i = 0; i < rig.legs.length; i++) {
      // Quadrupeds trot diagonally, bipeds just alternate; both fall out of
      // flipping the sign on alternate legs.
      rig.legs[i].rotation.z = i % 2 ? -swing : swing;
    }
    rig.tail.rotation.y = Math.sin(enemy.stride * .6) * .22;
    rig.head.rotation.y = Math.sin(enemy.stride * .5) * .1;

    // Flyers bob rather than walk, and hold their cruising height.
    if (traits.fly) rig.body.position.y = 2.6 + Math.sin(enemy.stride * .35) * .22;

    // Rearing up during a telegraph or a charge wind-up, easing back down after.
    // This and the glow are the whole promise that a hit was earned rather than
    // arbitrary — a charge you cannot see coming is just damage.
    const winding = enemy.state === 'telegraph'
      ? 1 - enemy.timer / traits.telegraph
      : enemy.state === 'windup'
        ? 1 - enemy.timer / traits.charge.windup
        : 0;
    rig.body.rotation.z = THREE.MathUtils.lerp(rig.body.rotation.z, winding * traits.rear, .2) + enemy.lean * .04;
    enemy.glow.scale.setScalar(Math.max(winding * winding * traits.glow, .0001));
    enemy.glow.material.opacity = .3 + winding * .6;
  }

  function update(dt, { camera, target, arena, projectiles, hurt }) {
    separate(dt);

    for (let i = list.length - 1; i >= 0; i--) {
      const enemy = list[i];
      const { traits, rig } = enemy;

      if (enemy.flash > 0) {
        enemy.flash = Math.max(0, enemy.flash - dt);
        const strength = enemy.flash / HIT_FLASH;
        for (const skin of rig.skins) skin.emissive.setRGB(strength * .9, strength * .5, strength * .2);
      }

      // A spring the hit kicks, so repeated hits accumulate into a wobble.
      enemy.leanVelocity += -enemy.lean * 90 * dt - enemy.leanVelocity * 7 * dt;
      enemy.lean += enemy.leanVelocity * dt;

      if (!enemy.alive) {
        // Pitch over and sink into the mud, then clear out.
        enemy.dying += dt;
        const fall = Math.min(enemy.dying / .9, 1);
        rig.group.position.y = -fall * fall * (traits.bar * .9);
        rig.body.rotation.z = fall * 1.4;
        rig.body.rotation.x = fall * .5;
        enemy.bar.visible = false;
        if (fall >= 1) {
          scene.remove(rig.group);
          list.splice(i, 1);
        }
        continue;
      }

      const dx = target.x - enemy.x;
      const dz = target.z - enemy.z;
      const distance = Math.hypot(dx, dz) || 1;
      const toward = { x: dx / distance, z: dz / distance };

      // Face Jerry. Damped so a swarm circling him doesn't snap round in one frame.
      const wantedYaw = Math.atan2(-toward.z, toward.x);
      let delta = wantedYaw - rig.group.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      rig.group.rotation.y += delta * (1 - Math.pow(.02, dt));

      enemy.timer -= dt;
      enemy.chargeTimer -= dt;

      if (enemy.state === 'telegraph') {
        enemy.speed = 0;
        if (enemy.timer <= 0) {
          fire(enemy, projectiles, target);
          enemy.state = 'recover';
          enemy.timer = traits.cooldown;
          // Half of them reverse their orbit after firing, so a strafing pack
          // does not settle into one predictable carousel.
          if (Math.random() < .5) enemy.orbit *= -1;
        }
      } else if (enemy.state === 'windup') {
        // Planted, leaning back, and very obviously about to go. The whole point
        // of a charge is that it is survivable if you read the wind-up.
        enemy.speed = 0;
        if (enemy.timer <= 0) {
          // The line is locked in *now*, not tracked during the run, so a charge
          // can be side-stepped. A homing charge is just unavoidable damage.
          enemy.chargeX = toward.x;
          enemy.chargeZ = toward.z;
          enemy.hitPlayer = false;
          enemy.state = 'charge';
          enemy.timer = traits.charge.time;
        }
      } else if (enemy.state === 'charge') {
        const charge = traits.charge;
        enemy.speed = charge.speed;
        enemy.x += enemy.chargeX * charge.speed * dt;
        enemy.z += enemy.chargeZ * charge.speed * dt;

        // One hit per charge, however long it stays in contact.
        if (!enemy.hitPlayer && distance < enemy.radius + target.radius + .2) {
          enemy.hitPlayer = true;
          hurt(charge.damage);
        }
        if (enemy.timer <= 0) {
          enemy.state = 'recover';
          enemy.timer = traits.cooldown * .6;
          enemy.chargeTimer = charge.cooldown;
        }
      } else {
        // Hold a ring around Jerry: close in when outside it, back off when
        // inside it, and circle when in the band between.
        let moveX = 0;
        let moveZ = 0;
        if (distance > traits.range) {
          moveX = toward.x;
          moveZ = toward.z;
          enemy.state = 'approach';
        } else if (distance < traits.range - traits.band) {
          moveX = -toward.x;
          moveZ = -toward.z;
          enemy.state = 'strafe';
        } else {
          moveX = -toward.z * enemy.orbit;
          moveZ = toward.x * enemy.orbit;
          enemy.state = 'strafe';
        }

        // Spilt tape drags. This is the whole reason the Tape Drive stays worth
        // carrying after its damage has been beaten twice over.
        const drag = projectiles.drag(enemy.x, enemy.z);
        enemy.speed = traits.speed * drag;
        enemy.x += moveX * enemy.speed * dt;
        enemy.z += moveZ * enemy.speed * dt;

        // A charge outranks a shot: it is the more dangerous option and the one
        // that most wants to open at distance, so it gets first refusal.
        if (traits.charge && enemy.chargeTimer <= 0 && distance <= traits.charge.from) {
          enemy.state = 'windup';
          enemy.timer = traits.charge.windup;
        } else if (enemy.timer <= 0 && distance <= traits.range * 1.1) {
          // Only wind up once actually in range, or the shot lands where Jerry
          // was two seconds ago and the telegraph teaches nothing.
          enemy.state = 'telegraph';
          enemy.timer = traits.telegraph;
        }
      }

      collide(enemy, arena);
      rig.group.position.x = enemy.x;
      rig.group.position.z = enemy.z;
      animate(enemy, dt);

      const ratio = enemy.hp / enemy.maxHp;
      enemy.fill.scale.x = Math.max(ratio, .0001);
      enemy.fill.position.x = -(1 - ratio) * .75;
      enemy.bar.visible = ratio < 1;
      if (camera) enemy.bar.quaternion.copy(camera.quaternion);
    }
  }

  function clear() {
    for (const enemy of list) scene.remove(enemy.rig.group);
    list.length = 0;
  }

  return { list, spawn, damage, update, clear };
}
