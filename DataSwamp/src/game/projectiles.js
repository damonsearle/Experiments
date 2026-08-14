import * as THREE from 'three';

import { projectileMesh } from './weapons.js';

// Flight height. Everything collides in 2D on the XZ plane at this height, so a projectile
// never needs a third axis test — the visual arc below is decoration, not simulation.
export const FLIGHT_Y = 1.25;

// The one exception to flat 2D collision, and the reason jumping is tactical rather than
// decorative: clear this much air and ground-fired shots pass underneath. It costs a single
// comparison. Shots fired from above (the Pteranodon, at M5) will opt out with `fromAbove`.
export const DODGE_LIFT = 1.05;

const RADIUS = .26;

// Spilt tape lying on the mud. Shared geometry, pooled meshes, and a material per patch
// because each one fades on its own clock.
const trailGeometry = new THREE.CircleGeometry(1, 20);

export function createProjectiles(scene, { capacity = 200 } = {}) {
  const live = [];
  const trails = [];
  const idle = new Map();
  const idleTrails = [];

  function take(spec) {
    const spare = idle.get(spec.id);
    if (spare && spare.length) return spare.pop();
    const mesh = projectileMesh(spec);
    scene.add(mesh);
    return mesh;
  }

  function retire(shot, index) {
    shot.mesh.visible = false;
    if (!idle.has(shot.spec.id)) idle.set(shot.spec.id, []);
    idle.get(shot.spec.id).push(shot.mesh);
    live.splice(index, 1);
  }

  function dropTrail(shot) {
    const { radius, life } = shot.spec.trail;
    let mesh = idleTrails.pop();
    if (!mesh) {
      mesh = new THREE.Mesh(trailGeometry, new THREE.MeshBasicMaterial({
        color: 0x2a2118,
        transparent: true,
        depthWrite: false,
      }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = 1;
      scene.add(mesh);
    }
    mesh.visible = true;
    mesh.position.set(shot.x, .035, shot.z);
    mesh.scale.setScalar(radius);
    trails.push({ x: shot.x, z: shot.z, radius, life, maxLife: life, slow: shot.spec.trail.slow, mesh });
  }

  // Splash from a hard drive coming apart. The direct target is excluded — it has already
  // taken the full hit, and double-dipping made the drive quietly the best single-target
  // weapon as well as the best crowd one.
  function shrapnel(shot, hostiles, hit, direct) {
    const { radius, damage } = shot.spec.blast;
    for (const target of hostiles) {
      if (!target.alive || target === direct) continue;
      const dx = target.x - shot.x;
      const dz = target.z - shot.z;
      if (dx * dx + dz * dz > radius * radius) continue;
      hit(target, damage, shot.x, shot.z);
    }
  }

  function deflect(shot, hostiles) {
    const reach = shot.spec.ricochetReach;
    let best = null;
    let bestDistance = reach * reach;
    for (const target of hostiles) {
      if (!target.alive || shot.struck.includes(target)) continue;
      const dx = target.x - shot.x;
      const dz = target.z - shot.z;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq >= bestDistance) continue;
      best = target;
      bestDistance = distanceSq;
    }
    if (!best) return false;
    const distance = Math.sqrt(bestDistance) || 1;
    const speed = Math.hypot(shot.vx, shot.vz);
    shot.vx = ((best.x - shot.x) / distance) * speed;
    shot.vz = ((best.z - shot.z) / distance) * speed;
    shot.bounces++;
    // Give it the range to actually arrive, or the skip dies in mid-air.
    shot.travelled = Math.max(0, shot.travelled - distance - 1);
    return true;
  }

  return {
    live,
    trails,

    // `faction` decides what the shot is allowed to hit: 'player' shots look for hostiles,
    // 'enemy' shots look for Jerry. Nothing collides with its own side.
    spawn(spec, x, z, dirX, dirZ, faction = 'player') {
      if (live.length >= capacity) return;
      const mesh = take(spec);
      mesh.visible = true;
      mesh.position.set(x, FLIGHT_Y, z);
      live.push({
        spec,
        faction,
        mesh,
        x,
        z,
        vx: dirX * spec.speed,
        vz: dirZ * spec.speed,
        travelled: 0,
        sinceTrail: 0,
        bounces: 0,
        struck: [],
        spin: (Math.random() - .5) * 3,
      });
    },

    clear() {
      for (let i = live.length - 1; i >= 0; i--) retire(live[i], i);
      for (let i = trails.length - 1; i >= 0; i--) {
        trails[i].mesh.visible = false;
        idleTrails.push(trails[i].mesh);
        trails.splice(i, 1);
      }
    },

    // `hostiles` are anything with x, z, radius and alive. `player` is the same shape plus
    // `lift`. `hit` and `hurtPlayer` decide what damage means; everything about how a given
    // tier behaves on impact is resolved here, next to the table that declares it.
    update(dt, { hostiles, player, hit, hurtPlayer }) {
      for (let i = trails.length - 1; i >= 0; i--) {
        const patch = trails[i];
        patch.life -= dt;
        if (patch.life <= 0) {
          patch.mesh.visible = false;
          idleTrails.push(patch.mesh);
          trails.splice(i, 1);
          continue;
        }
        patch.mesh.material.opacity = Math.min(patch.life / patch.maxLife, .7) * .8;
      }

      for (let i = live.length - 1; i >= 0; i--) {
        const shot = live[i];
        const spec = shot.spec;
        const step = Math.hypot(shot.vx, shot.vz) * dt;
        shot.x += shot.vx * dt;
        shot.z += shot.vz * dt;
        shot.travelled += step;

        let done = shot.travelled >= spec.range;
        let struckSomething = false;

        if (shot.faction === 'player') {
          for (const target of hostiles) {
            if (!target.alive || shot.struck.includes(target)) continue;
            const dx = shot.x - target.x;
            const dz = shot.z - target.z;
            const reach = target.radius + RADIUS;
            if (dx * dx + dz * dz > reach * reach) continue;

            hit(target, spec.damage, shot.x, shot.z);
            shot.struck.push(target);
            struckSomething = true;
            if (spec.blast) shrapnel(shot, hostiles, hit, target);

            // Skip onward, punch through, or stop — in that order of preference.
            if (spec.ricochet && shot.bounces < spec.ricochet && deflect(shot, hostiles)) done = false;
            else if (spec.pierce && shot.struck.length < spec.pierce) done = false;
            else done = true;
            break;
          }
        } else if (player.alive) {
          const dx = shot.x - player.x;
          const dz = shot.z - player.z;
          const reach = player.radius + RADIUS;
          if (dx * dx + dz * dz <= reach * reach) {
            // Airborne and the shot slides underneath — it keeps flying rather than
            // vanishing, so a dodge is visibly a dodge and not a miss.
            if (player.lift <= DODGE_LIFT || spec.fromAbove) {
              hurtPlayer(spec.damage);
              done = true;
            }
          }
        }

        if (spec.trail && !done) {
          shot.sinceTrail += step;
          if (shot.sinceTrail >= spec.trail.every) {
            shot.sinceTrail = 0;
            dropTrail(shot);
          }
        }

        if (done) {
          // A drive that lands on nothing still comes apart.
          if (spec.blast && !struckSomething) shrapnel(shot, hostiles, hit, null);
          retire(shot, i);
          continue;
        }

        // A rise and fall over the flight, purely so the throw reads as a throw. Lobbed
        // tiers set a taller arc so they visibly clear the ground between thrower and
        // target rather than skimming it.
        const t = shot.travelled / spec.range;
        shot.mesh.position.set(shot.x, FLIGHT_Y + Math.sin(t * Math.PI) * (spec.arc ?? .45), shot.z);
        shot.mesh.rotation.y += shot.spin * dt * 6;
        shot.mesh.rotation.z += shot.spin * dt * 2.5;
      }
    },

    // Multiplier for anything standing in spilt tape. 1 means clear ground.
    drag(x, z) {
      let slowest = 1;
      for (const patch of trails) {
        const dx = x - patch.x;
        const dz = z - patch.z;
        if (dx * dx + dz * dz > patch.radius * patch.radius) continue;
        slowest = Math.min(slowest, 1 - patch.slow);
      }
      return slowest;
    },
  };
}
