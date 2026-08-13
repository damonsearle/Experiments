import * as THREE from 'three';

/* -------------------------------------------------------------- blob shaping */

function deform(geometry, transform) {
  const position = geometry.attributes.position;
  const vertex = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    transform(vertex);
    position.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

// Jerry is built from soft blended masses rather than stuck-together primitives. Each part
// is a unit sphere whose vertices are pushed out along their own direction until they land
// on the smooth union of a handful of ellipsoids — one continuous, organic surface.
function blob(masses, { segments = 72, rings, smooth = .13 } = {}) {
  const geometry = new THREE.SphereGeometry(1, segments, rings ?? Math.round(segments * .62));
  const distances = new Float64Array(masses.length);
  let reach = 0;
  for (const mass of masses) {
    reach = Math.max(reach, Math.hypot(...mass.at) + Math.max(...mass.size) * 1.6);
  }

  // Smooth minimum of the normalised ellipsoid distances; 1 is the surface.
  const field = (x, y, z) => {
    let closest = Infinity;
    for (let i = 0; i < masses.length; i++) {
      const { at, size } = masses[i];
      const dx = (x - at[0]) / size[0];
      const dy = (y - at[1]) / size[1];
      const dz = (z - at[2]) / size[2];
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      distances[i] = distance;
      if (distance < closest) closest = distance;
    }
    let total = 0;
    for (let i = 0; i < masses.length; i++) total += Math.exp((closest - distances[i]) / smooth);
    return closest - smooth * Math.log(total);
  };

  return deform(geometry, direction => {
    let low = 0;
    let high = reach;
    for (let i = 0; i < 26; i++) {
      const mid = (low + high) * .5;
      if (field(direction.x * mid, direction.y * mid, direction.z * mid) < 1) low = mid;
      else high = mid;
    }
    direction.multiplyScalar((low + high) * .5);
  });
}

// Bakes the belly-to-back gradient of the reference art straight into the mesh.
function paint(geometry, tone) {
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const colors = new Float32Array(position.count * 3);
  const point = new THREE.Vector3();
  const facing = new THREE.Vector3();
  const shade = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i);
    facing.fromBufferAttribute(normal, i);
    shade.setRGB(1, 1, 1);
    tone(shade, point, facing);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

const BACK = new THREE.Color(.68, .61, .50);
const BELLY = new THREE.Color(1.2, 1.13, .96);

// Lighter towards the belly (+x, low), darker over the spine.
function bellyTone(spread, lift = 0) {
  return (shade, point) => {
    const t = THREE.MathUtils.smoothstep(point.x / spread - point.y * .25 + lift, -.85, .85);
    shade.copy(BACK).lerp(BELLY, t);
  };
}

export { deform, blob, paint, bellyTone, BACK, BELLY };
