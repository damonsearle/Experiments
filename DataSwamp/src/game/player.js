import * as THREE from 'three';
import { createJerry } from '../creature/jerry.js';
import { ARSENAL } from './weapons.js';

const SPEED = 8.2;
const ACCEL = 58;
const FRICTION = 42;
const GRAVITY = 26;
const JUMP = 9.4;
const RADIUS = .85;

const MAX_HP = 100;
// Long enough to get out of a Compsognathus swarm's crossfire, short enough
// that standing in it is still fatal.
const MERCY = .7;
const BLINK = 14;   // blinks per second while the mercy window is open

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
    x: 0,             // mirrors group.position, so projectiles can treat Jerry
    z: 0,             // as just another circle on the XZ plane
    lift: 0,          // height above the ground
    liftVelocity: 0,
    grounded: true,
    stride: 0,        // drives the run cycle
    speed: 0,
    weapon: ARSENAL[0],
    // Rounds held per tier. The floppy is deliberately absent from the ledger:
    // it is the floor Jerry can never be disarmed below.
    ammo: {},
    cooldown: 0,
    recoil: 0,
    hp: MAX_HP,
    maxHp: MAX_HP,
    alive: true,
    mercy: 0,         // invulnerability left over from the last hit
    hurtFlash: 0,     // drives the screen flash; main.js reads and clears it
    dying: 0,
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
  /* ------------------------------------------------------------- the arsenal */

  const rounds = weapon => (weapon.magazine === Infinity ? Infinity : player.ammo[weapon.id] ?? 0);
  player.rounds = rounds;

  // Selecting a tier Jerry has no rounds for is refused rather than silently
  // redirected — a selector that lies about what is loaded is worse than one
  // that says no.
  player.select = weapon => {
    if (!weapon || rounds(weapon) <= 0) return false;
    if (player.weapon !== weapon) player.cooldown = Math.max(player.cooldown, .12);
    player.weapon = weapon;
    return true;
  };

  // Scroll steps over what is actually usable, skipping empty tiers, so a flick
  // of the wheel never lands on a dead slot.
  player.cycle = direction => {
    const usable = ARSENAL.filter(weapon => rounds(weapon) > 0);
    if (usable.length < 2) return;
    const at = usable.indexOf(player.weapon);
    const next = (at + direction + usable.length * 2) % usable.length;
    player.select(usable[next]);
  };

  player.give = (weapon, amount) => {
    if (weapon.magazine === Infinity) return false;
    const held = player.ammo[weapon.id] ?? 0;
    if (held >= weapon.magazine * 2) return false;   // pouches are full
    player.ammo[weapon.id] = Math.min(held + amount, weapon.magazine * 2);
    // Auto-equip anything better than what is in hand, which is what makes
    // running to a cache feel like an upgrade rather than an errand.
    if (weapon.tier > player.weapon.tier) player.select(weapon);
    return true;
  };

  player.heal = amount => {
    if (player.hp >= player.maxHp) return false;
    player.hp = Math.min(player.maxHp, player.hp + amount);
    return true;
  };

  // Ignored while the mercy window is open, so a Compsognathus pack cannot chain
  // three .TXT hits into an unreactable death.
  player.hurt = amount => {
    if (!player.alive || player.mercy > 0) return false;
    player.hp = Math.max(0, player.hp - amount);
    player.mercy = MERCY;
    player.hurtFlash = 1;
    if (player.hp === 0) {
      player.alive = false;
      player.dying = .0001;
    }
    return true;
  };

  player.reset = () => {
    group.position.set(0, 0, 0);
    group.rotation.set(0, 0, 0);
    group.visible = true;
    velocity.set(0, 0, 0);
    facing.set(1, 0, 0);
    player.ammo = {};
    player.weapon = ARSENAL[0];
    Object.assign(player, {
      x: 0, z: 0, lift: 0, liftVelocity: 0, grounded: true, speed: 0,
      cooldown: 0, recoil: 0, hp: MAX_HP, alive: true, mercy: 0, hurtFlash: 0, dying: 0,
    });
  };

  player.shoot = (dt, input, projectiles) => {
    player.cooldown = Math.max(0, player.cooldown - dt);
    player.recoil = Math.max(0, player.recoil - dt * 6);

    const wanted = input.takeTier();
    if (wanted) player.select(ARSENAL[wanted - 1]);
    const step = input.takeCycle();
    if (step) player.cycle(step);

    if (!player.alive || !input.firing || player.cooldown > 0) return false;

    const weapon = player.weapon;
    if (rounds(weapon) <= 0) {
      // Dry mid-burst: drop to the floppy rather than stopping dead, so running
      // out changes what Jerry is throwing and never that he is throwing.
      player.weapon = ARSENAL[0];
      return false;
    }
    if (weapon.magazine !== Infinity) player.ammo[weapon.id] -= 1;

    player.cooldown = weapon.cooldown;
    player.recoil = 1;
    projectiles.spawn(
      weapon,
      group.position.x + facing.x * .95,
      group.position.z + facing.z * .95,
      facing.x,
      facing.z,
    );
    return true;
  };

  // Circle-vs-circle push-out on the XZ plane. Obstacles only block him while he is below
  // their top, which is what makes jumping worth doing.
  function collide(arena) {
    for (const obstacle of arena.obstacles) {
      // Clear of the top and he is standing on it, not walking into it. The
      // margin matters: at exactly the top height this would push him off the
      // platform he is stood on, every frame.
      if (player.lift >= obstacle.height - .02) continue;
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
    if (!player.alive) {
      // Topple backwards into the mud. The propeller keeps turning, because of
      // course it does.
      player.dying += dt;
      const fall = Math.min(player.dying / 1.1, 1);
      group.visible = true;
      group.rotation.z = fall * 1.5;
      group.position.y = -fall * fall * .5;
      rig.propeller.rotation.y += dt * 2;
      return;
    }

    if (player.mercy > 0) {
      player.mercy = Math.max(0, player.mercy - dt);
      // Blink rather than tint: Jerry's hide materials are shared across his
      // whole body, and flashing them would mean reaching into the model. A
      // sawtooth rather than a sine, so the off phase is a stated fraction of
      // the cycle — a sine crossing zero leaves him invisible nearly half the
      // time, which reads as him vanishing rather than as mercy frames.
      group.visible = player.mercy === 0 || (player.mercy * BLINK) % 1 > .3;
    } else {
      group.visible = true;
    }

    turnRate = 1 - Math.pow(.0004, dt);

    // Already resolved against the camera by main.js, so this is a plain world
    // direction however the view happens to be pointing.
    wanted.set(input.worldMove.x, 0, input.worldMove.y).multiplyScalar(SPEED);

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

    // The floor is whatever platform he is over, so a boardwalk is something to
    // stand on rather than only something to jump across.
    const floor = arena.groundHeight(group.position.x, group.position.z);
    if (player.lift <= floor) {
      player.lift = floor;
      player.liftVelocity = 0;
      player.grounded = true;
    } else {
      player.grounded = false;
    }
    group.position.y = player.lift;

    collide(arena);
    face(aimPoint);
    animate(dt);

    player.x = group.position.x;
    player.z = group.position.z;
  };

  return player;
}
