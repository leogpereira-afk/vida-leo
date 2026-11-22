// SPDX-License-Identifier: MIT
// Original local prototype. Geometric elbow flexion, not a physiological simulation.
// Source geometry, vertex colours and rest-space material coordinates are preserved.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (v) => { v = clamp(v, 0, 1); return v*v*(3-2*v); };
const label = (o) => String(o.userData?.name || o.name || '').replaceAll('_', ' ').toLowerCase();

export function createAnatomyMotion(root, T) {
  if (!root?.traverse || !T?.SkinnedMesh) throw new Error('A loaded anatomical scene and THREE are required.');
  root.updateMatrixWorld(true);
  const rootInverse = root.matrixWorld.clone().invert();
  const records = [];
  root.traverse(mesh => {
    if (!mesh.isMesh || mesh.isSkinnedMesh || !mesh.geometry?.getAttribute('position')) return;
    const matrix = rootInverse.clone().multiply(mesh.matrixWorld);
    const points = [], box = new T.Box3(), attr = mesh.geometry.getAttribute('position');
    for (let i=0;i<attr.count;i++) {
      const p = new T.Vector3(attr.getX(i),attr.getY(i),attr.getZ(i)).applyMatrix4(matrix);
      points.push(p); box.expandByPoint(p);
    }
    records.push({mesh,points,box,name:label(mesh),center:box.getCenter(new T.Vector3())});
  });
  function endCenter(rec, upper, fraction=.12) {
    const y = upper ? rec.box.max.y : rec.box.min.y;
    const range = (rec.box.max.y-rec.box.min.y)*fraction;
    const result = new T.Vector3(); let n=0;
    for (const p of rec.points) if (upper ? p.y>=y-range : p.y<=y+range) {result.add(p);n++;}
    return result.multiplyScalar(1/Math.max(n,1));
  }
  const fixed = new T.Bone(); fixed.name='Study_Stationary'; root.add(fixed);
  const bones=[fixed], arms=[], replacements=[];
  for (const [side,sign] of [['left',1],['right',-1]]) {
    const humerus=records.find(r=>r.name===`${side} humerus`);
    const radius=records.find(r=>r.name===`${side} radius`);
    const ulna=records.find(r=>r.name===`${side} ulna`);
    if (!humerus||!radius||!ulna) throw new Error(`Missing ${side} elbow bones in the anatomical source.`);
    // Humeral condyles + radial head locate the hinge; olecranon is deliberately
    // excluded from the proximal average because it projects behind the hinge.
    const elbow=endCenter(humerus,false,.10).lerp(endCenter(radius,true,.07),.40);
    const wrist=endCenter(radius,false,.08).lerp(endCenter(ulna,false,.08),.5);
    const shoulder=endCenter(humerus,true,.10);
    const length=shoulder.distanceTo(elbow);
    const bone=new T.Bone();bone.name=`Study_${side}_Forearm`;bone.position.copy(elbow);root.add(bone);
    const index=bones.push(bone)-1;
    const longBiceps=records.find(r=>r.name===`long head of ${side} biceps brachii`);
    const intermediate=[];
    for (const fraction of [.25,.5,.75]) {
      const pivot=new T.Bone();
      pivot.name='Study_'+side+'_wrap_'+fraction;
      pivot.position.copy(elbow);
      root.add(pivot);
      intermediate.push({pivot,index:bones.push(pivot)-1,fraction});
    }
    const wrap=[0,...intermediate.map(entry=>entry.index),index];
    arms.push({wrap,intermediate,side,sign,elbow,wrist,shoulder,length,bone,index,chains:[],
      bicepsInsertion:longBiceps ? endCenter(longBiceps,false,.07) : elbow.clone().lerp(wrist,.18)});
  }
  function chainFor(record,arm) {
    const origin=endCenter(record,true,.05);
    // Both biceps heads merge into the distal tendon seen in the long-head mesh.
    const insertion=/biceps brachii/.test(record.name) ? arm.bicepsInsertion.clone() : endCenter(record,false,.06);
    const direction=insertion.clone().sub(origin), length=direction.length();
    if(length<1e-5)return null;
    const axis=direction.clone().normalize(), chain={origin,insertion,axis,length,bones:[],indices:[]};
    const count=7;
    for(let k=0;k<count;k++) {
      const bone=new T.Bone();bone.name=`Study_${record.mesh.name}_${k}`;
      bone.position.copy(origin).lerp(insertion,k/(count-1));root.add(bone);
      chain.bones.push(bone);chain.indices.push(bones.push(bone)-1);
    }
    arm.chains.push(chain);return chain;
  }
  for(const record of records) {
    const {mesh,box,center,name}=record;
    const arm=arms[center.x>=0?0:1];
    const isBone=mesh.userData?.tissue==='bone' || mesh.userData?.layer==='skeleton';
    const upperBridge=/biceps brachii|triceps brachii|(?:left|right) brachialis$/.test(name);
    // These forearm muscles originate above the elbow on the humerus. Their
    // anatomy name takes priority over a bounding-box cutoff at the joint.
    const forearmAnatomy=/brachioradialis|(?:extensor|flexor) carpi|(?:extensor|flexor) digitorum|(?:extensor|flexor) pollicis|palmaris longus|pronator|supinator|anconeus|abductor pollicis longus/.test(name)
      && box.min.y>arm.elbow.y-arm.length*1.7;
    const innerX=arm.sign>0?box.min.x:-box.max.x;
    const inForearm=innerX>Math.abs(arm.elbow.x)*.65 &&
      box.max.y<arm.elbow.y+arm.length*.22 && box.min.y>arm.elbow.y-arm.length*1.65;
    if(!upperBridge&&!inForearm&&!forearmAnatomy)continue;
    // Forearm bellies follow the radius/ulna rather than the straight chord
    // between humeral origin and wrist. Their short proximal transition wraps
    // around the elbow through the fixed/forearm skin weights below.
    const chain=upperBridge?chainFor(record,arm):null;
    const flexorWrap=/flexor carpi radialis|flexor digitorum superficialis/.test(name);
    const geometry=mesh.geometry.clone(), n=record.points.length;
    const indices=new Uint16Array(n*4),weights=new Float32Array(n*4);
    let minWeight=1,maxWeight=0;
    for(let i=0;i<n;i++) {
      const p=record.points[i],off=i*4;
      if(chain) {
        const t=clamp(p.clone().sub(chain.origin).dot(chain.axis)/chain.length,0,1)*(chain.indices.length-1);
        const a=Math.min(chain.indices.length-2,Math.floor(t)),f=t-a;
        indices[off]=chain.indices[a];indices[off+1]=chain.indices[a+1];weights[off]=1-f;weights[off+1]=f;
      } else {
        // Bone and hand vertices are rigid. Only soft tissue spanning the elbow
        // blends across its proximal attachment over a short, continuous region.
        const w=isBone||box.max.y<arm.elbow.y-arm.length*.055 ? 1 :
          1-smooth((p.y-(arm.elbow.y-arm.length*.15))/(arm.length*.25));
        const wrap=flexorWrap?arm.wrap:[0,arm.index];
        const last=wrap.length-1;
        const step=Math.min(last-1,Math.floor(w*last));
        const fraction=w*last-step;
        indices[off]=wrap[step]; indices[off+1]=wrap[step+1];
        weights[off]=1-fraction; weights[off+1]=fraction;
        minWeight=Math.min(minWeight,w);maxWeight=Math.max(maxWeight,w);
      }
    }
    geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));
    geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
    const skinned=new T.SkinnedMesh(geometry,mesh.material);
    skinned.name=mesh.name;skinned.userData={...mesh.userData,anatomyMotion:'elbow-study-v3'};
    skinned.position.copy(mesh.position);skinned.quaternion.copy(mesh.quaternion);skinned.scale.copy(mesh.scale);
    skinned.matrix.copy(mesh.matrix);skinned.matrixAutoUpdate=mesh.matrixAutoUpdate;
    skinned.visible=mesh.visible;skinned.castShadow=mesh.castShadow;skinned.receiveShadow=mesh.receiveShadow;
    skinned.renderOrder=mesh.renderOrder;skinned.layers.mask=mesh.layers.mask;skinned.frustumCulled=false;
    skinned.customDepthMaterial=mesh.customDepthMaterial;skinned.customDistanceMaterial=mesh.customDistanceMaterial;
    skinned.onBeforeRender=mesh.onBeforeRender;skinned.onAfterRender=mesh.onAfterRender;
    const parent=mesh.parent;parent.remove(mesh);parent.add(skinned);
    replacements.push({original:mesh,skinned,parent,mode:chain?'continuous muscle cage':isBone?'rigid bone':'forearm tissue',minWeight,maxWeight});
  }
  root.updateMatrixWorld(true);
  const skeleton=new T.Skeleton(bones);skeleton.calculateInverses();
  for(const {skinned} of replacements)skinned.bind(skeleton,skinned.matrixWorld.clone());
  const axis=new T.Vector3(1,0,0),rotation=new T.Quaternion();let disposed=false;
  const report={version:'elbow-study-v3',source:'Joint locations derived from source humerus/radius/ulna geometry.',
    coordinates:'Root-local metres, Y up, +Z anterior; quantized source geometry kept unchanged.',
    limits:['Illustrative flexion only; no physiological activation or measured force.',
      'Origin/insertion positions estimated from mesh endpoints; not clinical validation.',
      'Approximate linear-blend skinning and muscle cages; volume conservation and soft-tissue collision are not simulated.',
      'Finger motion is mounted separately by the hand rig; this elbow layer has no equipment or independent wrist pronation.'],
    maximumFlexionDegrees:112,meshCount:replacements.length,boneCount:bones.length,
    musclesWithContinuousCages:replacements.filter(r=>r.mode==='continuous muscle cage').map(r=>r.original.userData.name||r.original.name),
    arms:arms.map(a=>({side:a.side,elbow:a.elbow.toArray(),wrist:a.wrist.toArray(),shoulder:a.shoulder.toArray()}))};
  function setFlexion(degrees) {
    if(disposed)return;
    rotation.setFromAxisAngle(axis,-clamp(degrees,0,112)*Math.PI/180);
    for(const arm of arms) {
      arm.bone.quaternion.copy(rotation);
      for (const {pivot,fraction} of arm.intermediate) {
        pivot.quaternion.identity().slerp(rotation,fraction);
      }
      for(const chain of arm.chains) {
        const movingInsertion=chain.insertion.clone().sub(arm.elbow).applyQuaternion(rotation).add(arm.elbow);
        const direction=movingInsertion.clone().sub(chain.origin).normalize();
        const q=new T.Quaternion().setFromUnitVectors(chain.axis,direction);
        for(let k=0;k<chain.bones.length;k++) {
          const b=chain.bones[k];b.position.copy(chain.origin).lerp(movingInsertion,k/(chain.bones.length-1));b.quaternion.copy(q);
        }
      }
    }
    root.updateMatrixWorld(true);skeleton.update();
  }
  function setPhase(t) {
    const phase=Number.isFinite(t)?clamp(t,0,1):0;
    setFlexion((1-Math.cos(phase*2*Math.PI))*.5*112);
  }
  function reset(){setFlexion(0);}
  function dispose(){
    if(disposed)return;reset();disposed=true;
    for(const {original,skinned,parent} of replacements){parent.remove(skinned);parent.add(original);skinned.geometry.dispose();}
    for(const bone of bones)root.remove(bone);skeleton.dispose();root.updateMatrixWorld(true);
  }
  reset();return {setPhase,setFlexion,reset,dispose,report};
}
