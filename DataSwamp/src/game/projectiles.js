import { projectileMesh } from './weapons.js';

// Flight height. Everything collides in 2D on the XZ plane at this height, so a projectile
// never needs a third axis test — the visual arc below is decoration, not simulation.
export const FLIGHT_Y = 1.25;

// The one exception to flat 2D collision, and the reason jumping is tactical rather than
// decorative: clear this much air and ground-fired shots pass underneath. It costs a single
// comparison. Shots fired from above (the Pteranodon, at M5) will opt out with `fromAbove`.
export const DODGE_LIFT = 1.05;

const RADIUS = .26;

// Meshes are pooled per spec id and reused. Allocating a mesh per shot is the fastest way
// to make a swarm wave stutter, so nothing here builds geometry after boot.
export function createProjectiles(scene, { capacity = 200 } = {}) {
  const live = [];
  const idle = new Map();

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

  return {
    live,

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
        spin: (Math.random() - .5) * 3,
      });
    },

    clear() {
      for (let i = live.length - 1; i >= 0; i--) retire(live[i], i);
    },

    // `hostiles` are anything with x, z, radius and alive. `player` is the same shape plus
    // `lift`. The two onHit callbacks decide what damage means for each side.
    update(dt, { hostiles, player, onHostileHit, onPlayerHit }) {
      for (let i = live.length - 1; i >= 0; i--) {
        const shot = live[i];
        const step = Math.hypot(shot.vx, shot.vz) * dt;
        shot.x += shot.vx * dt;
        shot.z += shot.vz * dt;
        shot.travelled += step;

        let done = shot.travelled >= shot.spec.range;

        if (!done && shot.faction === 'player') {
          for (const target of hostiles) {
            if (!target.alive) continue;
            const dx = shot.x - target.x;
            const dz = shot.z - target.z;
            const reach = target.radius + RADIUS;
            if (dx * dx + dz * dz > reach * reach) continue;
            onHostileHit(target, shot);
            done = true;
            break;
          }
        } else if (!done && player.alive) {
          const dx = shot.x - player.x;
          const dz = shot.z - player.z;
          const reach = player.radius + RADIUS;
          if (dx * dx + dz * dz <= reach * reach) {
            // Airborne and the shot slides underneath — it keeps flying rather than
            // vanishing, so a dodge is visibly a dodge and not a miss.
            if (player.lift <= DODGE_LIFT || shot.spec.fromAbove) {
              onPlayerHit(shot);
              done = true;
            }
          }
        }

        if (done) {
          retire(shot, i);
          continue;
        }

        // A rise and fall over the flight, purely so the throw reads as a throw. Lobbed
        // formats set a taller arc so they visibly clear the ground between thrower and
        // target rather than skimming it.
        const t = shot.travelled / shot.spec.range;
        shot.mesh.position.set(shot.x, FLIGHT_Y + Math.sin(t * Math.PI) * (shot.spec.arc ?? .45), shot.z);
        shot.mesh.rotation.y += shot.spin * dt * 6;
        shot.mesh.rotation.z += shot.spin * dt * 2.5;
      }
    },
  };
}
