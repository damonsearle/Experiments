import * as THREE from 'three';
import { createJerry as createSharedJerry, showJerryLoading } from '../../shared/jerry/jerry.js';

export function createJerry(scene) {
  const jerry = createSharedJerry();
  jerry.group.position.set(-2.9, 0, 0);
  // Preserve Data Dash's warm character fill under its lime stage lighting.
  const fill = new THREE.PointLight(0xffd2a0, 30, 9, 2);
  fill.position.set(2.8, 2.6, 3);
  const wrap = new THREE.PointLight(0xffb070, 12, 7, 2);
  wrap.position.set(-1.2, 1.8, -2.4);
  jerry.group.add(fill, wrap);
  scene.add(jerry.group);
  showJerryLoading(jerry);
  return jerry;
}
