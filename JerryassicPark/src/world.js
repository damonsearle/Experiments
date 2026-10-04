import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { platforms, corePositions, bitPositions } from './game.js';

export function buildWorld(scene) {
  const fixed = new THREE.Group(); scene.add(fixed);
  const animated = [];
  let seed = 9281;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .9, ...extra });
  const metal = mat('#203e43', { metalness: .55, roughness: .56 });
  const edge = mat('#56625b', { metalness: .35 });
  const rock = mat('#243c3c');
  const dirt = mat('#182a2b');
  const moss = mat('#658852');
  const bark = mat('#243e36');
  const leafMats = ['#264f42', '#32684a', '#427d51', '#5c945b'].map(c => mat(c, { side: THREE.DoubleSide }));
  const cyan = mat('#67ffdf', { emissive: '#35e6cc', emissiveIntensity: 2.2 });
  const amber = mat('#ffb953', { emissive: '#ff952f', emissiveIntensity: 1.8 });
  const pink = mat('#fb37a4', { emissive: '#df128b', emissiveIntensity: 2 });
  const dark = mat('#071820');
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const ballGeo = new THREE.IcosahedronGeometry(1, 1);
  function mesh(geometry, material, p, scale = [1, 1, 1], parent = fixed) {
    const m = new THREE.Mesh(geometry, material); m.position.set(...p); m.scale.set(...scale); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  const box = (material, p, s, parent = fixed) => mesh(boxGeo, material, p, s, parent);
  function link(a, b, radius, material, parent = fixed) {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), delta = vb.clone().sub(va);
    const m = mesh(new THREE.CylinderGeometry(radius, radius * 1.25, delta.length(), 5), material, va.add(vb).multiplyScalar(.5).toArray(), [1, 1, 1], parent);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return m;
  }
  function textBoard(x, y, z, w, h, title, subtitle, accent = '#67e8d7') {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#10282c'; ctx.fillRect(0, 0, 1024, 512);
    ctx.strokeStyle = '#748576'; ctx.lineWidth = 12; ctx.strokeRect(16, 16, 992, 480);
    ctx.fillStyle = accent; ctx.font = 'bold 88px monospace'; ctx.textAlign = 'center'; ctx.fillText(title, 512, 235, 940);
    ctx.fillStyle = '#aac0aa'; ctx.font = '32px monospace'; ctx.fillText(subtitle, 512, 340, 920);
    for (const px of [38, 986]) for (const py of [38, 474]) { ctx.fillStyle = '#8a9683'; ctx.beginPath(); ctx.arc(px, py, 8, 0, 7); ctx.fill(); }
    const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
    return mesh(new THREE.PlaneGeometry(w, h), mat('#ffffff', { map: texture, roughness: .75, emissive: '#38665d', emissiveMap: texture, emissiveIntensity: .3 }), [x, y, z]);
  }
  const fernVertices = [];
  for (let f = 0; f < 7; f++) {
    const angle = (f - 3) * .4;
    for (let j = 1; j <= 8; j++) {
      const t = j / 9;
      const x = Math.sin(angle) * t * 1.45, y = Math.cos(angle * .75) * Math.sin(t * 1.65) * 1.35;
      const z = Math.sin(f * 2.4) * t * .32;
      const width = Math.sin(t * Math.PI) * .26;
      for (const side of [-1, 1]) {
        const dx = Math.cos(angle) * width * side, dy = -Math.sin(angle) * width * side;
        fernVertices.push(x, y, z, x + dx * .6, y + dy + .10, z + .015, x + dx, y + dy + .045, z + .06,
          x, y, z, x + dx, y + dy + .045, z + .06, x + dx * .5, y + dy - .03, z);
      }
    }
  }
  const fernGeo = new THREE.BufferGeometry(); fernGeo.setAttribute('position', new THREE.Float32BufferAttribute(fernVertices, 3));
  fernGeo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(fernVertices.length / 3 * 2), 2)); fernGeo.computeVertexNormals();
  function fern(x, y, z, size = 1) {
    const m = mesh(fernGeo, leafMats[Math.floor(random() * 4)], [x, y, z], [size, size, size]);
    m.rotation.y = (random() - .5) * 1.1;
  }
  // Layered ridges, trees and facility buildings supply real side-scrolling parallax.
  for (let layer = 0; layer < 3; layer++) {
    const z = -55 + layer * 15;
    const ridgeMat = mat(['#345464', '#294b52', '#234943'][layer]);
    for (let i = -2; i < 28; i++) {
      const height = 12 + random() * 13;
      mesh(new THREE.ConeGeometry(9 + random() * 7, height, 5), ridgeMat, [i * 12, height / 2 - 2, z], [1, 1, .7]);
    }
  }
  for (let x = -12; x < 215; x += 7) {
    const z = -12 - random() * 16, h = 12 + random() * 9;
    link([x, -3, z], [x + 1, h, z], .45 + random() * .4, bark);
    for (let j = 0; j < 4; j++) {
      const offset = (j - 1.5) * 2.5;
      link([x, h - 4, z], [x + offset, h - 1 + random() * 3, z], .15, bark);
      mesh(ballGeo, leafMats[j], [x + offset, h + random() * 2, z], [3.5, 2.4, 2.8]);
    }
    fern(x, -1, -6, 3 + random() * 2);
  }
  for (const x of [24, 63, 107, 151, 188]) {
    box(metal, [x, 4, -15], [7, 12, 6]);
    for (let y = 1; y < 11; y += 2) for (let k = -2; k <= 2; k++) box(cyan, [x + k * 1.2, y, -11.94], [.12, .7, .05]);
    const domeMat = mat('#568b8d', { metalness: .7, roughness: .22, transparent: true, opacity: .45 });
    mesh(new THREE.SphereGeometry(7, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), domeMat, [x + 9, 3, -21]);
    const wire = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(7.05, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2)), new THREE.LineBasicMaterial({ color: '#488d93', transparent: true, opacity: .35 }));
    wire.position.set(x + 9, 3, -21); scene.add(wire);
  }
  // Waterfall ribbons behind the gaps, with subtle moving highlights.
  for (const x of [17.5, 35.5, 61, 85, 117, 136, 161, 179]) {
    const water = new THREE.Group(); water.position.set(x, 0, -9); scene.add(water);
    box(mat('#7bbac4', { transparent: true, opacity: .22, emissive: '#408694', emissiveIntensity: .5 }), [0, 0, 0], [2.4, 22, .15], water);
    for (let i = 0; i < 9; i++) {
      const stripe = box(mat('#a5e7e6', { transparent: true, opacity: .28 }), [(random() - .5) * 2, random() * 18 - 9, .1], [.035 + random() * .07, 1 + random() * 3, .02], water);
      animated.push({ mesh: stripe, type: 'water', origin: stripe.position.y, rate: 4 + random() * 3 });
    }
  }
  for (const [index, p] of platforms.entries()) {
    const upper = p.y > 0;
    box(upper ? metal : dirt, [p.x + p.w / 2, p.y - (upper ? .4 : 2.7), 0], [p.w, upper ? .8 : 5.4, 3.3]);
    box(edge, [p.x + p.w / 2, p.y - .15, 0], [p.w + .1, .3, 3.55]);
    box(moss, [p.x + p.w / 2, p.y + .025, 0], [p.w, .09, 3.3]);
    box(metal, [p.x + p.w / 2, p.y - .48, 1.79], [p.w, .17, .14]);
    for (let x = p.x + .6; x < p.x + p.w; x += 2) {
      box(amber, [x, p.y - .15, 1.82], [.45, .055, .04]);
      if (random() > .28) fern(x, p.y + .04, -1.35, .65 + random() * .65);
      // Hanging roots break up the clean manufactured platform edges.
      link([x, p.y, 1.75], [x + .2, p.y - 1 - random() * 2, 1.76], .035, bark);
      if (!upper) box(rock, [x, -2.5, 1.6], [1.5, 2 + random() * 2, .5]);
    }
    if (upper) {
      for (const x of [p.x + .6, p.x + p.w - .6]) {
        box(metal, [x, p.y / 2 - 2, -.65], [.23, p.y + 4, .3]);
        link([x, p.y - .6, -.7], [x + 1.5, p.y - 2, -.7], .075, edge);
      }
    }
  }
  for (let x = 5; x < 203; x += 11) {
    const p = platforms.filter(p => p.y === 0).find(p => x > p.x && x < p.x + p.w - 1);
    if (!p) continue;
    const z = -2.7;
    box(metal, [x, 2.1, z], [1.55, 4.2, 1.2]);
    box(dark, [x, 2.1, z + .62], [1.3, 3.8, .06]);
    for (let y = .45; y < 4; y += .45) {
      box(edge, [x, y, z + .67], [1.15, .04, .04]);
      box(random() > .2 ? cyan : amber, [x - .42, y + .12, z + .7], [.08, .055, .03]);
      box(metal, [x + .16, y + .12, z + .7], [.45, .1, .03]);
    }
    fern(x + .4, 4.2, z, 1.3);
  }
  for (const x of [-1, 30, 57, 90, 114, 155, 173, 194]) {
    box(metal, [x, 3.7, -2], [.18, 7.4, .18]);
    link([x, 7.3, -2], [x + 1.7, 7.3, -1], .07, edge);
    box(amber, [x + 1.7, 7.1, -1], [.45, .15, .4]);
  }
  // Overhead network cable, sagging in each section.
  for (let x = -8; x < 212; x += 15) {
    const pts = Array.from({ length: 10 }, (_, i) => new THREE.Vector3(x + i * 15 / 9, 11 - Math.sin(i / 9 * Math.PI) * 1.6, -3));
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, .05, 4, false), dark, [0, 0, 0]);
    for (let i = 0; i < 6; i++) fern(x + random() * 15, 10.8, -3, .5);
  }
  textBoard(6, 7, -3.5, 10, 4, 'JERRYASSIC PARK', 'DATA BREACH · RECOVERY SECTOR 01', '#efc17a');
  textBoard(42, 7, -4, 6, 2.6, 'BACK IT UP.', 'EXTINCTION IS NOT A STRATEGY');
  textBoard(92, 6, -4, 6, 2.6, 'NATURE REBOOTS.', 'YOUR DATA DOES NOT.');
  textBoard(155, 7, -3, 7, 3, 'KEEP RUNNING →', 'UNSCHEDULED EXTINCTION EVENT', '#ffba72');
  textBoard(191, 7, -3, 7, 3, 'RECOVERY UPLINK', '5 CORES REQUIRED · KEEP RUNNING');
  const corruption = new THREE.Group(); scene.add(corruption);
  box(pink, [102, -4.6, 0], [218, .07, 6], corruption);
  for (let i = 0; i < 170; i++) {
    const cube = box(pink, [random() * 212 - 5, -4.4 + random() * .7, (random() - .5) * 5], [.03 + random() * .18, .02 + random() * .13, .05], corruption);
    animated.push({ mesh: cube, type: 'glitch', origin: cube.position.y, rate: random() * 5 });
  }
  const bitMat = mat('#ffda86', { emissive: '#ffb52c', emissiveIntensity: 1.2, metalness: .45, roughness: .3 });
  const bits = bitPositions.map(p => {
    const group = new THREE.Group(); group.position.set(p.x, p.y, 0); scene.add(group);
    mesh(boxGeo, bitMat, [0, 0, 0], [.3, .3, .3], group);
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(.42, .42, .42)), new THREE.LineBasicMaterial({ color: '#ffe3a3' })); group.add(outline);
    return group;
  });
  const cores = corePositions.map((p, i) => {
    const group = new THREE.Group(); group.position.set(p.x, p.y, 0); scene.add(group);
    mesh(new THREE.OctahedronGeometry(.43), cyan, [0, 0, 0], [1, 1, 1], group);
    const cage = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(.95, .95, .95)), new THREE.LineBasicMaterial({ color: '#a4ffe4' })); group.add(cage);
    const ring = mesh(new THREE.TorusGeometry(.76, .025, 5, 28), cyan, [0, 0, 0], [1, 1, 1], group); ring.rotation.x = Math.PI / 2;
    box(metal, [p.x, p.y - 1.04, 0], [1.5, .14, 1.5]);
    textBoard(p.x, p.y - .5, -1.5, 1.1, .48, `0${i + 1}`, 'DATA CORE');
    return group;
  });
  const beacons = [56, 111].map((x, i) => {
    box(metal, [x, 1.15, -1.3], [.55, 2.3, .5]);
    const orb = mesh(ballGeo, amber.clone(), [x, 2.5, -1.3], [.3, .3, .3], scene);
    textBoard(x, 3.6, -1.6, 2.4, .85, 'BACKUP', `CHECKPOINT 0${i + 1}`); return orb;
  });
  const exit = new THREE.Group(); exit.position.set(197, 0, -.2); scene.add(exit);
  box(metal, [-1.3, 2.5, 0], [.35, 5, 1], exit); box(metal, [1.3, 2.5, 0], [.35, 5, 1], exit); box(metal, [0, 5, 0], [3, .4, 1], exit);
  const gate = box(mat('#40dfc2', { emissive: '#21c6b0', emissiveIntensity: .6, transparent: true, opacity: .25 }), [0, 2.5, 0], [2.3, 4.5, .1], exit);
  // Static scenery is merged by material to keep draw calls modest.
  fixed.updateMatrixWorld(true);
  const batches = new Map();
  fixed.traverse(o => {
    if (!o.isMesh) return;
    const key = o.material.uuid;
    if (!batches.has(key)) batches.set(key, { material: o.material, geometries: [] });
    const geometry = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    batches.get(key).geometries.push(geometry.applyMatrix4(o.matrixWorld));
  });
  scene.remove(fixed);
  for (const { material, geometries } of batches.values()) {
    const geometry = mergeGeometries(geometries);
    geometries.forEach(g => g.dispose());
    if (!geometry) throw new Error('Could not batch park scenery');
    const m = new THREE.Mesh(geometry, material); m.castShadow = !material.transparent; m.receiveShadow = true; scene.add(m);
  }
  return {
    update(s, time) {
      bits.forEach((b, i) => { b.visible = !s.bits.includes(i); b.rotation.set(time * .8, time * 1.1, .4); b.position.y = bitPositions[i].y + Math.sin(time * 2 + i) * .13; });
      cores.forEach((c, i) => { c.visible = !s.cores.includes(i); c.rotation.y = time * .75; c.position.y = corePositions[i].y + Math.sin(time * 2 + i) * .18; });
      beacons.forEach((b, i) => { const on = s.checkpoint > i; b.material.color.set(on ? '#65ffdc' : '#ffb953'); b.material.emissive.set(on ? '#35e6cc' : '#ff952f'); });
      gate.material.opacity = s.cores.length === 5 ? .5 : .12;
      for (const a of animated) {
        if (a.type === 'water') a.mesh.position.y = 10 - ((time * a.rate + a.origin + 30) % 20);
        else { a.mesh.position.y = a.origin + Math.sin(time * 2 + a.rate) * .18; a.mesh.visible = Math.sin(time * 3 + a.rate * 7) > -.75; }
      }
    },
  };
}
