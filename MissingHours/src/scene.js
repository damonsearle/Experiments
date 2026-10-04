import * as THREE from 'three';
import { createJerry } from '../../shared/jerry/jerry.js';

export function createScene(container, places, onInspect, onReady, onError) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0d1b23');
  scene.fog = new THREE.FogExp2('#0d1b23', .027);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  container.prepend(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', 'Jerry investigating the midnight greenhouse. Use the numbered scene buttons to inspect evidence.');
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 100);
  const target = new THREE.Vector3(0, 1, 0);
  let orbit = 0;
  function resize() {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.position.set(15 * Math.cos(orbit), 15, 19 * Math.cos(orbit) + 12 * Math.sin(orbit));
    if (camera.aspect < 1) camera.position.multiplyScalar(1.25);
    camera.lookAt(target); camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  scene.add(new THREE.HemisphereLight(0x99cee0, 0x203b35, 2.1));
  const moon = new THREE.DirectionalLight(0x97c9f0, 3);
  moon.position.set(-8, 18, -8); moon.castShadow = true;
  Object.assign(moon.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16 });
  moon.shadow.mapSize.set(2048, 2048); moon.shadow.bias = -.0005; scene.add(moon);
  const materials = {};
  function mat(color, metalness = 0, roughness = .7) {
    const key = `${color}-${metalness}`;
    return materials[key] ??= new THREE.MeshStandardMaterial({ color, metalness, roughness });
  }
  function box(x, y, z, w, h, d, color, metalness = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, metalness));
    mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh); return mesh;
  }
  function cylinder(x, y, z, r1, r2, height, color) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, height, 16), mat(color));
    mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh); return mesh;
  }
  box(0, -.35, 0, 15, .6, 15, '#253d40');
  for (let x = -7; x < 7; x += 1) for (let z = -7; z < 7; z += 1) {
    if (Math.abs(x) < 2 || z > 3) box(x+.5, -.025, z+.5, .96, .08, .96, (x+z)%3 ? '#3b4c4d' : '#45575a');
  }
  // An open-front, cutaway greenhouse keeps Jerry and evidence locations visible.
  box(0, .15, -2, 11, .3, 8, '#384f4a');
  const glass = new THREE.MeshPhysicalMaterial({ color: '#74b1a4', transparent: true, opacity: .14, side: THREE.DoubleSide, roughness: .2, depthWrite: false });
  for (const x of [-5.5, 5.5]) {
    for (const z of [-6, -4, -2, 0, 2]) box(x, 2.1, z, .09, 4.2, .09, '#568478', .6);
    box(x, 4.2, -2, .12, .12, 8, '#568478', .6);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(8, 4.1), glass); pane.rotation.y = Math.PI/2; pane.position.set(x, 2.1, -2); scene.add(pane);
  }
  for (const x of [-5.5, -2.75, 0, 2.75, 5.5]) {
    box(x, 2.1, -6, .1, 4.2, .1, '#568478', .6);
    const beam = box(x/2, 5.1, -6, 6, .1, .1, '#568478', .6);
    if (Math.abs(x) === 5.5) beam.rotation.z = x < 0 ? .32 : -.32;
    else scene.remove(beam);
  }
  box(0, 4.2, -6, 11, .1, .1, '#568478', .6);
  const rear = new THREE.Mesh(new THREE.PlaneGeometry(11, 4.2), glass); rear.position.set(0, 2.1, -6); scene.add(rear);
  cylinder(0, .6, -2, 1, 1.15, 1, '#74877e');
  cylinder(0, 1.15, -2, 1.13, 1.13, .15, '#acb2a0');
  cylinder(0, 1.24, -2, .7, .7, .025, '#514834');
  for (const x of [-4, 3.8]) for (const z of [-4.7, -2.6, -.5]) {
    cylinder(x, .55, z, .47, .32, .7, '#705749');
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(.32, 1.7, 5), mat(i%2 ? '#315a45' : '#427451'));
      leaf.position.set(x+Math.sin(i*2)*.25, 1.45, z+Math.cos(i*2)*.25); leaf.rotation.z = Math.sin(i*2)*.4; scene.add(leaf);
    }
  }
  // Cart, clock cabinet and physical trace markers are inspectable game objects.
  box(4, .65, 1.8, 1.25, .18, 2, '#8d714b');
  box(4, 1, 2.7, 1.3, .7, .1, '#6d593c');
  for (const x of [3.35,4.65]) for (const z of [1.1,2.5]) {
    const wheel = cylinder(x,.35,z,.32,.32,.15,'#172428'); wheel.rotation.z = Math.PI/2;
  }
  box(4, 1.02, 1.45, .9, .55, .85, '#b29968');
  box(-4.8, 1.5, -3.1, .8, 2.5, .6, '#344849', .5);
  const clockFace = new THREE.Mesh(new THREE.CircleGeometry(.31, 32), mat('#e1d2a4'));
  clockFace.position.set(-4.8,2.35,-2.78); scene.add(clockFace);
  box(-4.8,2.43,-2.76,.025,.2,.02,'#12272b'); box(-4.69,2.35,-2.75,.23,.025,.02,'#12272b');
  for (let i=0;i<4;i++) {
    const track = new THREE.Mesh(new THREE.CircleGeometry(.26, 12), mat('#1d2b2b'));
    track.rotation.x = -Math.PI/2; track.scale.y = 1.6; track.position.set(-3.6+(i%2)*.33,.33,2-i*.38); scene.add(track);
  }
  box(-1,.8,5.8,2,1.6,.7,'#354441'); box(-1,1.7,5.8,2.4,.15,1,'#6c725d');
  box(4.8,.8,-4.2,.7,1.4,.7,'#334943');
  for (const x of [-6.5,6.5]) {
    cylinder(x,2.7,3,.075,.075,5.5,'#233737');
    const lamp = box(x,5.2,3,.5,.65,.5,'#e8bf73');
    lamp.material = new THREE.MeshStandardMaterial({ color: '#ffd996', emissive: '#ffb952', emissiveIntensity: 2 });
    const light = new THREE.PointLight('#ffc16d',38,15,2); light.position.set(x,4.9,3); scene.add(light);
  }
  for (const x of [-9,9]) box(x,4,-9,1,8,1,'#1b3039');
  box(0,7.8,-9,23,.7,2,'#273e48');
  for(let i=0;i<12;i++) box(-12+i*2,8.3,-9,.2,.25,2.4,'#47565b');
  for(let i=0;i<18;i++) box(-23+i*2.8,3,-18-Math.sin(i)*4,2,4+(i%5)*2,3,'#192d36');

  const rainPositions = new Float32Array(450*6);
  for(let i=0;i<450;i++) { const k=i*6; const x=Math.random()*32-16,y=Math.random()*17,z=Math.random()*28-12; rainPositions.set([x,y,z,x-.09,y-.48,z],k); }
  const rainGeometry = new THREE.BufferGeometry(); rainGeometry.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
  scene.add(new THREE.LineSegments(rainGeometry,new THREE.LineBasicMaterial({color:'#9bc1cc',transparent:true,opacity:.2})));
  const jerry = createJerry({ height: 2.6 }); scene.add(jerry.group); jerry.group.position.set(1.6,.31,3.8); jerry.group.rotation.y=.8;
  let destination = jerry.group.position.clone(), pendingPlace = null;
  jerry.ready.then(onReady).catch(onError);
  const pins = places.map((place,index) => {
    const button=document.createElement('button'); button.className='scene-pin'; button.textContent=String(index+1).padStart(2,'0');
    button.setAttribute('aria-label',`Inspect ${place.label}`); button.title=place.label;
    button.addEventListener('click',()=>visit(place.id)); container.append(button);
    return { place, button, point:new THREE.Vector3(place.x,2,place.z) };
  });
  function visit(id) {
    if(!jerry.loaded) return;
    const place=places.find(item=>item.id===id);
    destination.set(place.x,.31,place.z+1.3); pendingPlace=place;
  }
  let previous=performance.now(), stride=0;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function animate(now) {
    const dt=Math.min((now-previous)/1000,.05); previous=now;
    const delta=destination.clone().sub(jerry.group.position), moving=delta.length()>.09;
    if(moving) {
      jerry.group.rotation.y=Math.atan2(-delta.z,delta.x);
      jerry.group.position.addScaledVector(delta.normalize(),Math.min(5*dt,jerry.group.position.distanceTo(destination)));
      stride+=dt*10; jerry.legs[0].rotation.z=Math.sin(stride)*.28; jerry.legs[1].rotation.z=-Math.sin(stride)*.28;
    } else {
      jerry.legs.forEach(leg=>leg.rotation.z=0);
      if(pendingPlace) { onInspect(pendingPlace); pendingPlace=null; }
    }
    if(jerry.loaded) { jerry.tail.rotation.y=Math.sin(now*.0018)*.06; jerry.update(); }
    if(!reducedMotion) {
      for(let i=0;i<450;i++) { const k=i*6; rainPositions[k+1]-=dt*9; rainPositions[k+4]-=dt*9; if(rainPositions[k+1]<0) {rainPositions[k+1]+=17;rainPositions[k+4]+=17;} }
      rainGeometry.attributes.position.needsUpdate=true;
    }
    for(const pin of pins) {
      const projected=pin.point.clone().project(camera);
      pin.button.style.left=`${(projected.x*.5+.5)*container.clientWidth}px`;
      pin.button.style.top=`${(-projected.y*.5+.5)*container.clientHeight}px`;
      pin.button.disabled=!jerry.loaded;
    }
    if (container.clientWidth && container.clientHeight) renderer.render(scene,camera);
  }
  resize(); renderer.setAnimationLoop(animate);
  return { visit, markCollected(id) { pins.find(pin=>pin.place.id===id)?.button.classList.add('collected'); }, rotate() {orbit=orbit===0?-.5:0;resize();} };
}
