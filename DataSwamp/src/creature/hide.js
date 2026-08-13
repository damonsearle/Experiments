import * as THREE from 'three';

/* ------------------------------------------------------------------ helpers */

function noise(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function rgba(hex, alpha) {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
}

// Repeats a stamp across the texture edges it overlaps so the hide tiles seamlessly.
function tiled(size, x, y, radius, draw) {
  const ox = x < radius ? size : x > size - radius ? -size : 0;
  const oy = y < radius ? size : y > size - radius ? -size : 0;
  draw(x, y);
  if (ox) draw(x + ox, y);
  if (oy) draw(x, y + oy);
  if (ox && oy) draw(x + ox, y + oy);
}

/* -------------------------------------------------------------- pebbled hide */

const HIDE_SIZE = 512;

// Jerry's skin in the reference art is a warty, pebbled hide: hundreds of little raised
// bumps over a blotchy tan. One pass paints them, the same pass embosses a bump map.
function hideMaps({ base, spot, glow, seed, pebbles = 760, wart = 1 }) {
  const colorCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  colorCanvas.width = colorCanvas.height = bumpCanvas.width = bumpCanvas.height = HIDE_SIZE;
  const color = colorCanvas.getContext('2d');
  const bump = bumpCanvas.getContext('2d');
  const random = noise(seed);

  color.fillStyle = base;
  color.fillRect(0, 0, HIDE_SIZE, HIDE_SIZE);
  bump.fillStyle = '#6b6b6b';
  bump.fillRect(0, 0, HIDE_SIZE, HIDE_SIZE);

  // Broad blotches keep the hide from reading as flat paint.
  for (let i = 0; i < 90; i++) {
    const radius = 28 + random() * 118;
    const tint = random() < .5 ? spot : glow;
    const alpha = .05 + random() * .1;
    tiled(HIDE_SIZE, random() * HIDE_SIZE, random() * HIDE_SIZE, radius, (x, y) => {
      const wash = color.createRadialGradient(x, y, 0, x, y, radius);
      wash.addColorStop(0, rgba(tint, alpha));
      wash.addColorStop(1, rgba(tint, 0));
      color.fillStyle = wash;
      color.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    });
  }

  // The warts themselves: a lit crown with a darker rim, embossed to match.
  for (let i = 0; i < pebbles; i++) {
    const radius = (1.5 + random() * random() * 6.6) * wart;
    const strength = .24 + random() * .46;
    tiled(HIDE_SIZE, random() * HIDE_SIZE, random() * HIDE_SIZE, radius + 2, (x, y) => {
      const shell = color.createRadialGradient(x - radius * .32, y - radius * .32, 0, x, y, radius * 1.05);
      shell.addColorStop(0, rgba(glow, strength * .55));
      shell.addColorStop(.48, rgba(glow, 0));
      shell.addColorStop(.78, rgba(spot, strength * .5));
      shell.addColorStop(1, rgba(spot, strength));
      color.fillStyle = shell;
      color.beginPath();
      color.arc(x, y, radius * 1.05, 0, Math.PI * 2);
      color.fill();

      const dome = bump.createRadialGradient(x, y, 0, x, y, radius);
      dome.addColorStop(0, `rgba(255,255,255,${strength})`);
      dome.addColorStop(.68, `rgba(255,255,255,${strength * .28})`);
      dome.addColorStop(1, 'rgba(255,255,255,0)');
      bump.fillStyle = dome;
      bump.beginPath();
      bump.arc(x, y, radius, 0, Math.PI * 2);
      bump.fill();
    });
  }

  // Dark freckles scattered between the warts, then fine grain on the bump map alone.
  for (let i = 0; i < 900; i++) {
    const radius = .8 + random() * 1.9;
    color.fillStyle = rgba(spot, .1 + random() * .28);
    color.beginPath();
    color.arc(random() * HIDE_SIZE, random() * HIDE_SIZE, radius, 0, Math.PI * 2);
    color.fill();
  }
  for (let i = 0; i < 6000; i++) {
    bump.fillStyle = random() < .5 ? 'rgba(0,0,0,.1)' : 'rgba(255,255,255,.1)';
    bump.fillRect(random() * HIDE_SIZE, random() * HIDE_SIZE, 1.7, 1.7);
  }

  const upload = (canvas, srgb) => {
    const texture = new THREE.CanvasTexture(canvas);
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    return texture;
  };
  return { map: upload(colorCanvas, true), bumpMap: upload(bumpCanvas, false) };
}

function hideMaterial(maps, repeat, options = {}) {
  const map = maps.map.clone();
  const bumpMap = maps.bumpMap.clone();
  map.needsUpdate = bumpMap.needsUpdate = true;
  map.repeat.set(...repeat);
  bumpMap.repeat.set(...repeat);
  return new THREE.MeshStandardMaterial({
    map,
    bumpMap,
    bumpScale: 1,
    roughness: .84,
    metalness: 0,
    vertexColors: true,
    ...options,
  });
}

export { noise, rgba, tiled, hideMaps, hideMaterial };
