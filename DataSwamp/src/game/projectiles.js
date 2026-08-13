import * as THREE from 'three';
import { projectileMesh } from './weapons.js';

// Flight height. Everything collides in 2D on the XZ plane at this height, so a projectile
// never needs a third axis test — the visual arc below is decoration, not simulation.
export const FLIGHT_Y = 1.25;
const RADIUS = .26;

// Meshes are pooled per weapon id and reused. Allocating a mesh per shot is the fastest way
// to make a swarm wave stutter, so nothing here builds geometry after boot.
export function createProjectiles(scene, { capacity = 120 } = {}) {
  const live = [];
  const idle = new Map();

  function take(weapon) {
    const spare = idle.get(weapon.id);
    if (spare && spare.length) return spare.pop();
    const mesh = projectileMesh(weapon);
    scene.add(mesh);
    return mesh;
  }

  function give(shot) {
    shot.mesh.visible = false;
    if (!idle.has(shot.weapon.id)) idle.set(shot.weapon.id, []);
    idle.get(shot.weapon.id).push(shot.mesh);
  }

  return {
    live,

    spawn(weapon, x, z, dirX, dirZ) {
      if (live.length >= capacity) return;
      const mesh = take(weapon);
      mesh.visible = true;
      mesh.position.set(x, FLIGHT_Y, z);
      live.push({
        weapon,
        mesh,
        x,
        z,
        vx: dirX * weapon.speed,
        vz: dirZ * weapon.speed,
        travelled: 0,
        spin: (Math.random() - .5) * 3,
      });
    },

    // `targets` are anything with x, z, radius and alive; onHit decides what damage means.
    update(dt, targets, onHit) {
      for (let i = live.length - 1; i >= 0; i--) {
        const shot = live[i];
        const step = Math.hypot(shot.vx, shot.vz) * dt;
        shot.x += shot.vx * dt;
        shot.z += shot.vz * dt;
        shot.travelled += step;

        let done = shot.travelled >= shot.weapon.range;

        if (!done) {
          for (const target of targets) {
            if (!target.alive) continue;
            const dx = shot.x - target.x;
            const dz = shot.z - target.z;
            const reach = target.radius + RADIUS;
            if (dx * dx + dz * dz > reach * reach) continue;
            onHit(target, shot);
            done = true;
            break;
          }
        }

        if (done) {
          give(shot);
          live.splice(i, 1);
          continue;
        }

        // A shallow rise and fall over the flight, purely so the throw reads as a throw.
        const t = shot.travelled / shot.weapon.range;
        shot.mesh.position.set(shot.x, FLIGHT_Y + Math.sin(t * Math.PI) * .45, shot.z);
        shot.mesh.rotation.y += shot.spin * dt * 6;
        shot.mesh.rotation.z += shot.spin * dt * 2.5;
      }
    },
  };
}
