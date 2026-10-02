import * as THREE from 'three';
import { mesh, link } from '../scene/geometry.js';

const ball = new THREE.SphereGeometry(1, 12, 8);
const claw = new THREE.ConeGeometry(1, 1, 8);
const plateShape = new THREE.Shape();
plateShape.moveTo(-.75, 0);
plateShape.lineTo(-.9, .7);
plateShape.lineTo(-.25, 1.9);
plateShape.lineTo(.45, 1.5);
plateShape.lineTo(.8, .35);
plateShape.lineTo(.65, 0);
plateShape.closePath();
export const plateGeometry = new THREE.ExtrudeGeometry(plateShape, { depth: .15, bevelEnabled: true, bevelSize: .06, bevelThickness: .04, bevelSegments: 1, steps: 1 });
plateGeometry.translate(0, 0, -.075);

const wingShape = new THREE.Shape();
wingShape.moveTo(.24, 0);
wingShape.lineTo(.32, .48);
wingShape.lineTo(.12, 1.05);
wingShape.lineTo(-.24, 1.65);
wingShape.quadraticCurveTo(-.28, 1.12, -.5, .95);
wingShape.quadraticCurveTo(-.32, .57, -.55, .32);
wingShape.lineTo(-.3, 0);
wingShape.closePath();
const wingGeometry = new THREE.ShapeGeometry(wingShape, 8);
wingGeometry.rotateX(Math.PI / 2);

const faces = {
  compy: [.05, .04, .071, .026, .18, -.045, .05],
  dilo: [.10, .04, .137, .04, .29, -.08, .102],
  stego: [.08, .04, .118, .031, .22, -.055, .09],
  ptero: [.06, .04, .115, .03, .34, -.05, .045],
  trike: [.16, .02, .21, .037, .34, -.085, .125],
  anky: [.14, .04, .163, .032, .26, -.04, .14],
  rex: [.16, .10, .206, .047, .43, -.135, .175],
};

export function detailDino(id, rig, material) {
  const [ex, ey, ez, size, nose, jawY, jawWidth] = faces[id];
  // Amber irises, vertical pupils, raised brows and a recessed mouth line make
  // the head readable without increasing the collision or telegraph envelope.
  for (const side of [-1, 1]) {
    mesh(rig.head, ball, material.iris, [ex, ey, side * ez], [size, size, size * .55]);
    mesh(rig.head, ball, material.eye, [ex + .003, ey, side * (ez + size * .47)], [size * .24, size * .77, size * .14]);
    mesh(rig.head, ball, material.tooth, [ex + size * .2, ey + size * .33, side * (ez + size * .56)], [size * .18, size * .18, size * .12]);
    mesh(rig.head, ball, material.crest, [ex - .008, ey + size, side * (ez - .008)], [size * 1.55, size * .42, size * .8], [0, 0, -.16]);
    mesh(rig.head, ball, material.eye, [nose, jawY + size * .9, side * jawWidth], [size * .38, size * .25, size * .15]);
    mesh(rig.head, ball, material.mouth, [nose * .64, jawY - size, side * jawWidth * .97], [nose * .64, size * .18, size * .3]);
  }
  if (['compy', 'dilo', 'rex'].includes(id)) {
    const scale = id === 'rex' ? 1 : id === 'dilo' ? .65 : .28;
    for (const side of [-1, 1]) {
      const z = side * (id === 'rex' ? .38 : id === 'dilo' ? .24 : .145);
      const elbow = [.38 * scale, -.2 * scale, z * 1.35];
      const hand = [.57 * scale, -.34 * scale, z * 1.4];
      link(rig.body, material.limbDetail, [.2 * scale, .04, z], elbow, .065 * scale);
      link(rig.body, material.limbDetail, elbow, hand, .043 * scale);
      for (let finger = 0; finger < (id === 'rex' ? 2 : 3); finger++) {
        mesh(rig.body, claw, material.tooth, [hand[0] + .05 * scale, hand[1] - .035 * scale, hand[2] + (finger - 1) * .047 * scale], [.018 * scale, .13 * scale, .018 * scale], [0, 0, -2.2]);
      }
    }
  }
  if (id !== 'ptero') {
    const feet = { compy: [.08, -.36, .035], dilo: [.16, -.76, .06], stego: [.05, -.57, .064], trike: [.05, -.57, .065], anky: [.04, -.43, .07], rex: [.24, -1.08, .085] };
    const [x, y, spread] = feet[id];
    for (const leg of rig.legs) for (let toe = -1; toe <= 1; toe++) {
      mesh(leg, ball, material.limbDetail, [x + spread * .7, y, toe * spread], [spread * 1.6, spread * .48, spread * .46]);
      mesh(leg, claw, material.tooth, [x + spread * 2, y, toe * spread], [spread * .32, spread * 1.25, spread * .32], [0, 0, -Math.PI / 2]);
    }
  }
  if (id === 'ptero') {
    for (let i = 0; i < rig.legs.length; i++) {
      const wing = rig.legs[i];
      wing.clear();
      const side = i === 0 ? -1 : 1;
      mesh(wing, wingGeometry, material.membrane, [0, 0, 0], [1, 1, side]);
      const elbow = [.32, .008, side * .48];
      const wrist = [.12, .008, side * 1.05];
      link(wing, material.crest, [.22, 0, 0], elbow, .038);
      link(wing, material.crest, elbow, wrist, .027);
      link(wing, material.crest, wrist, [-.24, 0, side * 1.65], .016);
      link(wing, material.crest, elbow, [-.5, 0, side * .95], .012);
      link(wing, material.crest, elbow, [-.55, 0, side * .32], .012);
    }
  }
  if (id === 'trike') {
    // Radial rim around the frill, rather than a diagonal line of scallops.
    for (let i = 0; i < 11; i++) {
      const a = i / 10 * Math.PI;
      mesh(rig.head, claw, material.tooth, [-.20, .12 + Math.sin(a) * .43, Math.cos(a) * .45], [.04, .13, .04], [Math.PI / 2 - a, 0, .25]);
    }
  }
  if (id === 'anky') {
    for (let row = 0; row < 5; row++) for (let col = -1; col <= 1; col++) {
      mesh(rig.body, ball, material.crest, [.43 - row * .25, .36 - Math.abs(col) * .065, col * .28], [.12, .075, .115]);
    }
    for (const side of [-1, 1]) mesh(rig.tail, ball, material.crest, [-.76, .06, side * .13], [.22, .17, .18]);
  }
}
