import * as T from './vendor/three.module.min.js';

import {createDumbbell} from './halter.js';

// Calibrated against the skinned palm and phalanges. Angles are ordered
// thumb to little finger, proximal to distal. Both hands use mirrored frames.
import {gripRadius as handleRadius, palmCenter as handleCenter, palmAxis as handleAxis} from './barra-costas.js';
const closedGrip = [[50.742, 48.341, 13.2], [35.376, 57.795, 46.584], [47.191, 76.1, 46.77], [53.343, 65.183, 41.734], [52.732, 66.31, 31.064]];
const digits = ['thumb','index finger','middle finger','ring finger','little finger'];
const vector = (point,sign) => new T.Vector3(sign*point[0],point[1],point[2]);
const smooth = T.MathUtils.smoothstep;
const radians = T.MathUtils.degToRad;

function rigidSegment(name) {
  const digit=digits.findIndex(label=>name.endsWith(label));
  if (/first metacarpal bone$/.test(name)) return 0;
  if (digit<0 || !name.includes('phalanx')) return -1;
  const joint=name.startsWith('distal')?2:name.startsWith('middle')||digit===0?1:0;
  return 3*digit+joint;
}

// All pivots are measured on the GLB in rest space. The same transforms drive
// the skin, the phalanges and the distal soft tissues on both sides of the atlas.
export function createHandRig(body, anchor, side, landmarks) {
  const sign=side==='L'?1:-1;
  const wrist=vector(landmarks.wrist,sign);
  const chains=landmarks.chains.map(chain=>chain.map(p=>vector(p,sign)));
  const across=chains[1][0].clone().sub(chains[4][0]).normalize();
  const palm=chains[2][0].clone().sub(wrist).cross(across).multiplyScalar(sign).normalize();
  const oppositionTarget=chains[2][0].clone().lerp(chains[1][0],.35).addScaledVector(palm,.045);
  const base=new T.Bone();
  body.add(base);
  body.updateMatrixWorld(true);
  anchor.attach(base);
  const joints=[];
  const fingers=chains.map((chain,digit)=>chain.slice(0,3).map((start,i)=>{
    const bone=new T.Bone();
    bone.name='Dedo_'+side+'_'+digit+'_'+i;
    const parent=i===0?base:joints[joints.length-1].bone;
    bone.position.copy(start);
    if(i>0)bone.position.sub(chain[i-1]);
    parent.add(bone);
    const direction=chain[i+1].clone().sub(start).normalize();
    const toward=digit===0
      ? palm.clone().multiplyScalar(.70).sub(across).normalize()
          .lerp(oppositionTarget.clone().sub(start).normalize(),.47).normalize()
      : palm;
    const axis=direction.clone().cross(toward).normalize();
    const entry={bone,axis,start,end:chain[i+1],digit,i};
    joints.push(entry);
    return entry;
  }));
  body.updateMatrixWorld(true);
  const bones=joints.map(j=>j.bone);
  const newInverses=bones.map(b=>b.matrixWorld.clone().invert());
  const baseInverse=base.matrixWorld.clone().invert();
  const shared=new Map();
  const restBindings=[];
  const v=new T.Vector3(),offset=new T.Vector3(),line=new T.Vector3();
  function sharedSkeleton(original) {
    if(!shared.has(original)){
      const oldBones=original?.bones||[base], oldInverses=original?.boneInverses||[baseInverse];
      shared.set(original,new T.Skeleton([...oldBones,...bones],[...oldInverses,...newInverses]));
    }
    return shared.get(original);
  }
  function fingerInfluence(p, forced) {
    if(forced>=0)return [[forced,1]];
    let closest=Infinity,best=null,coordinate=0;
    for(const finger of fingers){
      for(const j of finger){
        line.copy(j.end).sub(j.start);
        const t=offset.copy(p).sub(j.start).dot(line)/line.lengthSq();
        const distance=offset.addScaledVector(line,-T.MathUtils.clamp(t,0,1)).lengthSq();
        if(distance<closest){closest=distance;best=j;coordinate=t;}
      }
    }
    if(closest>.030**2)return [];
    const {digit,i}=best;
    const first=chains[digit][0],dir=line.copy(chains[digit][1]).sub(first).normalize();
    const extension=offset.copy(p).sub(first).dot(dir);
    const amount=smooth(extension,-.014,.009)*(1-smooth(Math.sqrt(closest),.015,.030));
    if(amount<=0)return [];
    const center=i+T.MathUtils.clamp(coordinate,0,1);
    const next=Math.min(2,Math.floor(center+.5));
    const prev=Math.max(0,next-1);
    const w=prev===next?1:smooth(center,next-.30,next+.30);
    return [[3*digit+prev,amount*(1-w)],[3*digit+next,amount*w]];
  }
  function bind(mesh, surface=false) {
    const original=surface?null:mesh.skeleton;
    const combined=sharedSkeleton(original);
    const startIndex=combined.bones.length-15;
    const matrix=body.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
    const p=mesh.geometry.attributes.position;
    const oldI=mesh.geometry.attributes.skinIndex,oldW=mesh.geometry.attributes.skinWeight;
    const weights=new Float32Array(p.count*4),indices=new Uint16Array(p.count*4);
    const name=(mesh.userData.name||mesh.name).replaceAll('_',' ').toLowerCase();
    const forced=mesh.userData.layer==='skeleton'?rigidSegment(name):-1;
    const keepRigid=mesh.userData.layer==='skeleton'&&forced===-1;
    if(keepRigid)return;
    for(let i=0;i<p.count;i++){
      v.fromBufferAttribute(p,i).applyMatrix4(matrix);
      const digital=fingerInfluence(v,forced), sum=digital.reduce((a,e)=>a+e[1],0);
      const influences=digital.filter(e=>e[1]>0).map(([id,w])=>[startIndex+id,w]);
      if(sum<1-1e-7){
        if(surface)influences.push([0,1-sum]);
        else for(let c=0;c<4;c++)if(oldW.getComponent(i,c)>0)influences.push([oldI.getComponent(i,c),(1-sum)*oldW.getComponent(i,c)]);
      }
      const four=influences.sort((a,b)=>b[1]-a[1]).slice(0,4);
      const total=four.reduce((a,b)=>a+b[1],0);
      for(let c=0;c<four.length;c++){indices[i*4+c]=four[c][0];weights[i*4+c]=four[c][1]/total;}
    }
    if(!surface)restBindings.push({mesh,original,oldI,oldW,matrix:mesh.bindMatrix.clone()});
    mesh.geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));
    mesh.geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
    mesh.bind(combined,surface?mesh.matrixWorld.clone():mesh.bindMatrix.clone());
    mesh.frustumCulled=false;
  }
  let weight=null;
  const thumbOpposition=new T.Quaternion().setFromAxisAngle(palm,radians(sign*31.603));
  const rackThumb=[52.153,60.461,45.888];
  function pose(kind) {
    const curl=kind==='curl';
    if(curl && !weight){
      weight=createDumbbell(side,vector(handleCenter,sign),vector(handleAxis,sign),handleRadius);
      base.add(weight);
    }
    if(weight)weight.visible=curl;
    for(const {bone,axis,digit,i} of joints) {
      const angles=!curl&&digit===0?rackThumb:closedGrip[digit];
      bone.quaternion.setFromAxisAngle(axis,radians(angles[i]));
      if(!curl&&digit===0&&i===0)bone.quaternion.premultiply(thumbOpposition);
    }
    base.updateWorldMatrix(true,true);
  }
  return {bind,pose,center(target) {
    const middle=fingers[2];
    return middle[0].bone.getWorldPosition(target).lerp(middle[2].bone.getWorldPosition(v),.22);
  },dispose() {
    for(const {mesh,original,oldI,oldW,matrix} of restBindings){
      mesh.geometry.setAttribute('skinIndex',oldI);mesh.geometry.setAttribute('skinWeight',oldW);mesh.bind(original,matrix);
    }
    for(const skeleton of shared.values())skeleton.dispose();
    if(weight){
      const materials=new Set(),geometries=new Set();
      weight.traverse(part=>{if(part.isMesh){materials.add(part.material);geometries.add(part.geometry)}});
      for(const mat of materials)mat.dispose();
      for(const geo of geometries)geo.dispose();
      weight.removeFromParent();
    }
    base.removeFromParent();
  }};
}
