import * as THREE from 'three';
import { createJerry } from '../creature/jerry.js';
import { WEAPONS } from './weapons.js';

const SPEED = 8.2;
const ACCEL = 58;
const FRICTION = 42;
const GRAVITY = 26;
const JUMP = 9.4;
const RADIUS = .85;

export function createPlayer(scene) {
  const rig = createJerry();
  const group = rig.group;
  scene.add(group);

  const velocity = new THREE.Vector3();   // xz only; y is tracked separately
  const wanted = new THREE.Vector3();
  const facing = new THREE.Vector3(1, 0, 0);
  let turnRate = .35;                     // recomputed each frame to stay tick-independent

  const player = {
    rig,
    group,
    radius: RADIUS,
    lift: 0,          // height above the ground
    liftVelocity: 0,
    grounded: true,
    stride: 0,        // drives the run cycle
    speed: 0,
    weapon: WEAPONS[0],
    cooldown: 0,
    recoil: 0,
  };

  // Jerry's model faces +x, so a heading of 0 already points down the positive x axis.
  function face(aimPoint) {
    const dx = aimPoint.x - group.position.x;
    const dz = aimPoint.z - group.position.z;
    if (dx * dx + dz * dz < .04) return;
    facing.set(dx, 0, dz).normalize();
    const wantedYaw = Math.atan2(-dz, dx);
    // Shortest-path turn, so crossing the ±π seam doesn't spin him the long way round.
    let delta = wantedYaw - group.rotation.y;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    group.rotation.y += delta * turnRate;
  }

  // Shots leave along the true aim rather than the lagged body rotation, so firing lands
  // where the cursor is even mid-turn.
  player.shoot = (dt, input, projectiles) => {
    player.cooldown = Math.max(0, player.cooldown - dt);
    player.recoil = Math.max(0, player.recoil - dt * 6);
    if (!input.firing || player.cooldown > 0) return;
    player.cooldown = player.weapon.cooldown;
    player.recoil = 1;
    projectiles.spawn(
      player.weapon,
      group.position.x + facing.x * .95,
      group.position.z + facing.z * .95,
      facing.x,
      facing.z,
    );
  };

  // Circle-vs-circle push-out on the XZ plane. Obstacles only block him while he is below
  // their top, which is what makes jumping worth doing.
  function collide(arena) {
    for (const obstacle of arena.obstacles) {
      if (player.lift > obstacle.height) continue;
      const dx = group.position.x - obstacle.x;
      const dz = group.position.z - obstacle.z;
      const reach = obstacle.radius + RADIUS;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq >= reach * reach || distanceSq === 0) continue;
      const distance = Math.sqrt(distanceSq);
      const push = (reach - distance) / distance;
      group.position.x += dx * push;
      group.position.z += dz * push;
      // Kill the velocity component heading into the obstacle, so he slides along it
      // instead of juddering against it.
      const nx = dx / distance;
      const nz = dz / distance;
      const into = velocity.x * nx + velocity.z * nz;
      if (into < 0) {
        velocity.x -= nx * into;
        velocity.z -= nz * into;
      }
    }

    const limit = arena.radius - RADIUS;
    const fromCentre = Math.hypot(group.position.x, group.position.z);
    if (fromCentre > limit) {
      const scale = limit / fromCentre;
      group.position.x *= scale;
      group.position.z *= scale;
    }
  }

  function animate(dt) {
    const { legs, arms, tail, jaw, head, propeller } = rig;
    player.stride += player.speed * dt * 1.5;

    // Blend the run cycle in with speed, so standing still settles rather than snapping.
    const gait = Math.min(player.speed / SPEED, 1);
    const swing = Math.sin(player.stride) * .62 * gait;
    legs[0].rotation.z = swing;
    legs[1].rotation.z = -swing;
    // The throwing arm kicks back on each shot, the other keeps swinging with the run.
    arms[0].rotation.z = -.5 + Math.sin(player.stride) * .16 * gait - player.recoil * .55;
    arms[1].rotation.z = -.5 - Math.sin(player.stride) * .16 * gait;
    tail.rotation.y = Math.sin(player.stride * .7) * .14;
    jaw.rotation.z = -.32 - Math.abs(Math.sin(player.stride)) * .08 * gait;
    head.rotation.z = Math.sin(player.stride * 2) * .03 * gait;
    propeller.rotation.y += dt * (3 + player.speed * .9);

    // Lean into the run and tip back over a jump.
    group.rotation.z = THREE.MathUtils.lerp(group.rotation.z, -gait * .07 - player.liftVelocity * .012, .12);
  }

  player.update = (dt, input, aimPoint, arena) => {
    turnRate = 1 - Math.pow(.0004, dt);

    // Camera-relative, but the camera holds a fixed yaw, so screen up is world -z.
    wanted.set(input.move.x, 0, -input.move.y).multiplyScalar(SPEED);

    const rate = wanted.lengthSq() > 0 ? ACCEL : FRICTION;
    velocity.x = THREE.MathUtils.damp(velocity.x, wanted.x, rate / SPEED, dt);
    velocity.z = THREE.MathUtils.damp(velocity.z, wanted.z, rate / SPEED, dt);

    group.position.x += velocity.x * dt;
    group.position.z += velocity.z * dt;
    player.speed = Math.hypot(velocity.x, velocity.z);

    if (input.takeJump() && player.grounded) {
      player.liftVelocity = JUMP;
      player.grounded = false;
    }

    player.liftVelocity -= GRAVITY * dt;
    player.lift += player.liftVelocity * dt;
    if (player.lift <= 0) {
      player.lift = 0;
      player.liftVelocity = 0;
      player.grounded = true;
    }
    group.position.y = player.lift;

    collide(arena);
    face(aimPoint);
    animate(dt);
  };

  return player;
}
