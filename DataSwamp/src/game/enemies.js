import * as THREE from 'three';

// M1 target practice. These are deliberately crude stand-ins — corrupted drive stacks — so
// that damage, stagger, death and the health readout can be proven before M2 replaces them
// with real dinosaur species built from blob().
const HIT_FLASH = .18;

const caseGeometry = new THREE.BoxGeometry(1.1, .34, .9);
const postGeometry = new THREE.CylinderGeometry(.16, .2, 1.5, 10);
const barGeometry = new THREE.PlaneGeometry(1.5, .16);

const postMaterial = new THREE.MeshStandardMaterial({ color: 0x3b3a33, roughness: .85 });
const barBack = new THREE.MeshBasicMaterial({ color: 0x14100c, transparent: true, opacity: .75, depthTest: false });
const barFill = new THREE.MeshBasicMaterial({ color: 0xc9634a, depthTest: false });

export function createEnemies(scene) {
  const list = [];

  function spawn(x, z, { hp = 120, radius = .95 } = {}) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    scene.add(group);

    const post = new THREE.Mesh(postGeometry, postMaterial);
    post.position.y = .75;
    post.castShadow = true;
    post.receiveShadow = true;
    group.add(post);

    // Each stacked drive case gets its own material so a hit can flash the whole stack
    // without tinting every other enemy sharing a cached material.
    const skin = new THREE.MeshStandardMaterial({ color: 0x6d6a5c, roughness: .6, metalness: .3 });
    const stack = new THREE.Group();
    stack.position.y = 1.5;
    group.add(stack);
    for (let i = 0; i < 3; i++) {
      const box = new THREE.Mesh(caseGeometry, skin);
      box.position.y = i * .38;
      box.rotation.y = (i - 1) * .16;
      box.castShadow = true;
      box.receiveShadow = true;
      stack.add(box);
    }

    const bar = new THREE.Group();
    bar.position.y = 3.05;
    group.add(bar);
    const back = new THREE.Mesh(barGeometry, barBack);
    back.renderOrder = 10;
    bar.add(back);
    const fill = new THREE.Mesh(barGeometry, barFill);
    fill.renderOrder = 11;
    fill.position.z = .01;
    bar.add(fill);

    const enemy = {
      x, z, radius, group, stack, skin, bar, fill,
      hp,
      maxHp: hp,
      alive: true,
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

    // Stagger away from the shot, and knock the stack back so the hit has weight.
    const dx = enemy.x - fromX;
    const dz = enemy.z - fromZ;
    const distance = Math.hypot(dx, dz) || 1;
    enemy.leanVelocity += 7 * (amount / 40 + .35);
    enemy.x += (dx / distance) * .12;
    enemy.z += (dz / distance) * .12;

    if (enemy.hp <= 0) {
      enemy.hp = 0;
      enemy.alive = false;
      enemy.dying = .0001;
    }
  }

  function update(dt, camera) {
    for (let i = list.length - 1; i >= 0; i--) {
      const enemy = list[i];
      enemy.group.position.x = enemy.x;
      enemy.group.position.z = enemy.z;

      if (enemy.flash > 0) {
        enemy.flash = Math.max(0, enemy.flash - dt);
        const strength = enemy.flash / HIT_FLASH;
        enemy.skin.emissive.setRGB(strength * .9, strength * .5, strength * .2);
      }

      // A spring the hit kicks, so repeated hits accumulate into a wobble.
      enemy.leanVelocity += -enemy.lean * 90 * dt - enemy.leanVelocity * 7 * dt;
      enemy.lean += enemy.leanVelocity * dt;
      enemy.stack.rotation.x = enemy.lean * .08;
      enemy.stack.rotation.z = enemy.lean * .05;

      const ratio = enemy.hp / enemy.maxHp;
      enemy.fill.scale.x = Math.max(ratio, .0001);
      enemy.fill.position.x = -(1 - ratio) * .75;
      enemy.bar.visible = enemy.alive && ratio < 1;
      if (camera) enemy.bar.quaternion.copy(camera.quaternion);

      if (!enemy.alive) {
        // Collapse into the mud, then clear out.
        enemy.dying += dt;
        const fall = Math.min(enemy.dying / .7, 1);
        enemy.group.position.y = -fall * 1.9;
        enemy.stack.rotation.z = enemy.lean * .05 + fall * 1.1;
        enemy.bar.visible = false;
        if (fall >= 1) {
          scene.remove(enemy.group);
          list.splice(i, 1);
        }
      }
    }
  }

  return { list, spawn, damage, update };
}
