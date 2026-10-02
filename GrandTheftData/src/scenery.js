import * as THREE from 'three';
import { mesh, link, leaf, batchParts } from '../../DataSwamp/src/scene/geometry.js';
import { buildPlatform, surfaceMap } from '../../DataSwamp/src/scene/terrain.js';

// A continuous causeway through the same prehistoric wetland as Data Swamp.
// All raised scenery stays outside the file/jump lane (|z| < 2).
const LENGTH = 72;
function seeded(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

function bake(group, shadows = true) {
  group.updateMatrixWorld(true);
  const flat = new THREE.Group();
  group.traverse(o => {
    if (o.isMesh) mesh(flat, o.geometry.clone().applyMatrix4(o.matrixWorld), o.material);
  });
  batchParts(flat);
  for (const o of flat.children) o.castShadow = shadows;
  return flat;
}

export function createScenery(scene, { lean = false } = {}) {
  const root = new THREE.Group(); root.name = 'Prehistoric data wetlands'; scene.add(root);
  const woodTexture = surfaceMap('wood', 31);
  const stoneTexture = surfaceMap('stone', 71);
  const groundTexture = stoneTexture.clone();
  groundTexture.repeat.set(42, 3);
  const mat = {
    bark: new THREE.MeshStandardMaterial({ color: 0x4c4532, map: woodTexture, roughness: .95 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x4b7044, roughness: .93, side: THREE.DoubleSide }),
    fern: new THREE.MeshStandardMaterial({ color: 0x668b45, roughness: .85, side: THREE.DoubleSide }),
    moss: new THREE.MeshStandardMaterial({ color: 0x3e5935, roughness: 1 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x65766b, map: stoneTexture, roughness: .9 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x172b28, roughness: .72, metalness: .2 }),
    light: new THREE.MeshStandardMaterial({ color: 0xa1ce62, emissive: 0x80c345, emissiveIntensity: .7, roughness: .35 }),
    fungus: new THREE.MeshStandardMaterial({ color: 0xc18b53, roughness: .85 }),
    amber: new THREE.MeshStandardMaterial({ color: 0xedaa5e, emissive: 0xff8844, emissiveIntensity: .7 }),
    far: new THREE.MeshStandardMaterial({ color: 0x26483d, roughness: 1 }),
    mud: new THREE.MeshStandardMaterial({ color: 0x354632, map: groundTexture, bumpMap: groundTexture, bumpScale: .045, roughness: 1, vertexColors: true }),
    track: new THREE.MeshStandardMaterial({ color: 0x253429, map: groundTexture, roughness: .94 }),
  };
  const box = new THREE.BoxGeometry(1,1,1);
  const rock = new THREE.DodecahedronGeometry(1,1);
  const palmLeaf = leaf(2.5,.29,.6);
  const fernLeaf = leaf(.95,.13,.24);
  const reedLeaf = leaf(1.2,.038,.12);
  const padGeometry=new THREE.CircleGeometry(1,14,0,Math.PI*1.85);padGeometry.rotateX(-Math.PI/2);
  const mushroomCap = new THREE.SphereGeometry(1,8,5,0,Math.PI*2,0,Math.PI/2);

  function fern(parent,x,z,size=1) {
    for (let i=0;i<7;i++) mesh(parent,fernLeaf,mat.fern,[x,.03,z],[size,size,size],[-.25,i*Math.PI*2/7,.12]);
  }
  function tree(parent,x,z,h,angle, distant=false) {
    const bark=distant?mat.far:mat.bark, foliage=distant?mat.far:mat.leaf;
    const top=[x-.28,h,z+.1];
    link(parent,bark,[x,-.45,z],[x-.13,h*.57,z],.24);
    link(parent,bark,[x-.13,h*.57,z],top,.15);
    for(let i=0;i<5;i++) {
      const a=i*Math.PI*2/5+angle;
      link(parent,bark,[x,.8,z],[x+Math.cos(a)*1.1,-.35,z+Math.sin(a)*1.1],.09);
    }
    const crown=h/5;
    for(let i=0;i<9;i++) mesh(parent,palmLeaf,foliage,top,[crown,crown,crown],[.15,i*Math.PI*2/9+angle,-.04]);
    if(!distant) {
      // Hanging creepers add depth beneath the crown without another texture.
      for(let i=0;i<3;i++) {
        const a=angle+i*2.1;
        const from=[top[0]+Math.cos(a)*.8,h-.15,top[2]+Math.sin(a)*.8];
        link(parent,mat.moss,from,[from[0]+.15,h-1.8,from[2]],.018);
      }
    }
  }
  function ruin(parent,x,z) {
    const ruin=new THREE.Group(); ruin.position.set(x,-.18,z); ruin.rotation.y=-.13;parent.add(ruin);
    // A moss-covered gateway built from old server cabinets and stone lintels.
    for(const side of [-1,1]) {
      mesh(ruin,box,mat.stone,[side*1.25,1.3,0],[.8,2.8,.8],[0,0,side*.035]);
      mesh(ruin,box,mat.dark,[side*1.25,1.35,.43],[.47,1.7,.06]);
      for(let i=0;i<7;i++) {
        mesh(ruin,box,mat.bark,[side*1.25,.68+i*.2,.48],[.4,.055,.035]);
        mesh(ruin,box,i%3===0?mat.amber:mat.light,[side*1.38,.7+i*.2,.51],[.035,.035,.025]);
      }
      mesh(ruin,rock,mat.moss,[side*1.25,2.66,0],[.54,.15,.58]);
      link(ruin,mat.moss,[side*1.5,2.6,.5],[side*1.4,.25,.56],.035);
    }
    mesh(ruin,box,mat.stone,[0,2.97,0],[3.5,.48,.92],[0,0,-.025]);
    mesh(ruin,box,mat.dark,[0,2.95,.49],[1.25,.28,.05]);
    for(let i=0;i<5;i++)mesh(ruin,box,mat.light,[-.38+i*.19,2.95,.53],[.08,.13,.015]);
    for(let i=0;i<6;i++)mesh(ruin,rock,mat.moss,[-1.5+i*.56,3.21,.03],[.46,.14,.45]);
    fern(ruin,-1.9,.7,1.2);fern(ruin,1.65,.7,1.1);
    const platform=buildPlatform({kind:'board',x:0,z:1.2,radius:1.6,height:.08},mat.track);
    ruin.add(platform);
  }

  function bank() {
    const g=new THREE.PlaneGeometry(LENGTH,12,72,14);g.rotateX(-Math.PI/2);
    const p=g.attributes.position,colors=[],color=new THREE.Color();
    for(let i=0;i<p.count;i++) {
      const x=p.getX(i),z=p.getZ(i),edge=Math.abs(z)/6;
      const wave=Math.sin(x*Math.PI*2/LENGTH*5+z*.7)*.22+Math.cos(x*Math.PI*2/LENGTH*9-z*.4)*.10;
      p.setZ(i,z+Math.sin(x*Math.PI*2/LENGTH*3)*.35*edge);
      p.setY(i,-.20+(1-edge)*.45+wave*(1-edge));
      color.setRGB(.78+wave*.6,.88+wave*.5,.66+wave*.4);colors.push(color.r,color.g,color.b);
    }
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
  }
  const bankGeometry=bank();
  const layers=[];
  function repeat(make,rate) {
    for(let i=-1;i<=1;i++) {
      const tile=make(i+2);tile.position.x=i*LENGTH;root.add(tile);layers.push({tile,rate});
    }
  }
  repeat(seed=>{
    const r=seeded(seed*441),group=new THREE.Group();
    mesh(group,bankGeometry,mat.mud,[0,-.05,-8.6]);
    for(let i=0;i<12;i++) {
      const x=-LENGTH/2+(i+.5)*LENGTH/12;
      if(i%2===0)tree(group,x,-11-r()*4,3.6+r()*3.6,r()*6.28);
      const platform=buildPlatform({kind:'stone',x:x+1,z:-4.8-r()*3,radius:.5+r()*.8,height:.25+r()*.5},mat.track);
      group.add(platform);
    }
    for(let i=0;i<(lean?35:64);i++)fern(group,r()*LENGTH-LENGTH/2,-3.8-r()*7,.45+r()*.8);
    for(let i=0;i<(lean?40:75);i++) {
      const x=r()*LENGTH-LENGTH/2,z=-4-r()*1.1;
      for(let j=0;j<3;j++)mesh(group,reedLeaf,mat.leaf,[x,-.05,z],[1,1,.65+r()*.45],[-1.0,j*2.1,0]);
    }
    // Timber, shore rocks, and small foreground clumps frame the empty lane.
    for(let i=0;i<9;i++) {
      const x=-32+i*8,z=-5.3-r()*1.7;
      link(group,mat.bark,[x,-.03,z],[x+1.7,.26,z-.45],.19);
      link(group,mat.bark,[x+.9,.12,z-.2],[x+.75,.7,z-.5],.05);
      mesh(group,rock,mat.moss,[x+.5,.18,z],[.5,.12,.28]);
      fern(group,x+2,3.6+r()*1.8,.22+r()*.2);
      mesh(group,rock,mat.moss,[x+3,-.10,4.3],[.7,.2,.5]);
    }
    ruin(group,seed===2 ? 4 : -18,-8.5);
    for(let i=0;i<12;i++) {
      const x=r()*LENGTH-LENGTH/2,z=-4.6-r()*3;
      for(let j=0;j<3;j++) {
        const h=.15+r()*.18, px=x+j*.18;
        link(group,mat.bark,[px,0,z],[px,h,z],.026);
        mesh(group,mushroomCap,mat.fungus,[px,h,z],[.12,h*.3,.12]);
      }
    }
    // Bare snags break up the repeated fern crowns with branching silhouettes.
    for(const x of [-26,25]) {
      const z=-14.5,h=4+r()*2;
      link(group,mat.bark,[x,-.4,z],[x-.3,h,z],.19);
      for(let j=0;j<4;j++) {
        const side=j%2?1:-1,y=h*(.45+j*.12);
        link(group,mat.bark,[x-.2,y,z],[x+side*(.8+j*.15),y+.5,z-.2],.075);
        link(group,mat.bark,[x+side*(.8+j*.15),y+.5,z-.2],[x+side*(1+j*.2),y+1.1,z-.3],.035);
      }
    }
    for(let i=0;i<20;i++)mesh(group,padGeometry,mat.moss,[r()*72-36,-.435,-16-r()*5],[.18+r()*.4,1,.18+r()*.3],[0,r()*6,0]);
    // Subtle lane studs move at exactly the same speed as the files.
    for(let x=-35;x<36;x+=3)for(const z of [-1.8,1.8])mesh(group,box,mat.light,[x,.004,z],[.24,.014,.045]);
    return bake(group);
  },1);
  repeat(seed=>{
    const r=seeded(seed*126),group=new THREE.Group();
    for(let i=0;i<(lean?10:16);i++)tree(group,-36+(i+.5)*72/(lean?10:16),-24-r()*8,6+r()*5,r()*6.28,true);
    for(let i=0;i<9;i++)mesh(group,rock,mat.far,[-32+i*8,-.15,-26-r()*4],[4+r()*4,1.5+r()*2,4+r()*3]);
    return bake(group,false);
  },.36);
  repeat(seed=>{
    const r=seeded(seed*55),group=new THREE.Group();
    for(let i=0;i<9;i++)mesh(group,rock,mat.far,[-36+i*9,1,-48],[7,5+r()*9,5],[0,r()*4,0]);
    return bake(group,false);
  },.13);

  // The playing surface remains perfectly flat at the existing collision height.
  mesh(root,new THREE.PlaneGeometry(230,5.1),mat.track,[0,-.025,0],[1,1,1],[-Math.PI/2,0,0]);
  mesh(root,new THREE.PlaneGeometry(230,9),mat.mud,[0,-.18,4.5],[1,1,1],[-Math.PI/2,0,0]);
  const waterMaterial=new THREE.MeshStandardMaterial({color:0x244f48,metalness:.42,roughness:.24,transparent:true,opacity:.88});
  const water=mesh(root,new THREE.PlaneGeometry(230,65),waterMaterial,[0,-.46,-15],[1,1,1],[-Math.PI/2,0,0]);water.castShadow=false;
  const rippleMaterial=new THREE.MeshBasicMaterial({color:0x81b8a2,transparent:true,opacity:.13,depthWrite:false});
  const rings=new THREE.Group();
  const ringGeometry=new THREE.RingGeometry(.97,1,40);ringGeometry.rotateX(-Math.PI/2);
  const r=seeded(937);
  for(let i=0;i<(lean?18:32);i++)mesh(rings,ringGeometry,rippleMaterial,[r()*100-40,-.445,-16-r()*12],[1+r()*2,1,.35+r()*.6]);
  root.add(rings);


  // Fireflies use a single points draw rather than dozens of tiny shadow meshes.
  const points=new Float32Array((lean?45:90)*3),phases=[];
  for(let i=0;i<points.length;i+=3){points[i]=r()*80-30;points[i+1]=.5+r()*4;points[i+2]=-3-r()*13;phases.push(r()*Math.PI*2);}
  const pointGeometry=new THREE.BufferGeometry();pointGeometry.setAttribute('position',new THREE.BufferAttribute(points,3));
  const sprite=document.createElement('canvas');sprite.width=sprite.height=32;
  const ctx=sprite.getContext('2d'),glow=ctx.createRadialGradient(16,16,0,16,16,16);
  glow.addColorStop(0,'#fffbd2');glow.addColorStop(.15,'#dfff91');glow.addColorStop(1,'rgba(140,220,85,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,32,32);
  const fireflies=new THREE.Points(pointGeometry,new THREE.PointsMaterial({color:0xd9f7aa,size:.14,map:new THREE.CanvasTexture(sprite),transparent:true,opacity:.65,depthWrite:false,blending:THREE.AdditiveBlending}));
  fireflies.frustumCulled=false;root.add(fireflies);

  let time=0;
  return {
    root,
    update(dt,speed=0) {
      time+=dt;
      for(const {tile,rate} of layers) {
        tile.position.x-=speed*dt*rate;
        if(tile.position.x < -LENGTH*1.5)tile.position.x+=LENGTH*3;
      }
      for(let i=0;i<points.length;i+=3){
        points[i]-=speed*dt*.48;if(points[i]<-40)points[i]+=100;
        points[i+1]+=Math.sin(time*1.2+phases[i/3])*dt*.055;
      }
      pointGeometry.attributes.position.needsUpdate=true;
      rippleMaterial.opacity=.10+Math.sin(time*.75)*.025;
    },
  };
}
