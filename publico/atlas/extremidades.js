import {mountBench} from './supino.js';
import * as T from './vendor/three.module.min.js';
import {mountBackBar} from './barra-costas.js';
import {createHandRig} from './mao-articulada.js';

// Keep penetrating tendon ends beneath the optional surface. Compute the cut
// from bind coordinates so that wrist and toe boundaries rotate with the limb.
function hideUnderSkin(material, bind, kind, side, enabled) {
  const upstream = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey();
  const wrist = new T.Vector3(side*.25,.892,.036);
  const axis = new T.Vector3(side*.25,-.91,.33).normalize();
  const normal = kind === 'hand' ? axis : new T.Vector3(0,-1,0);
  const threshold = kind === 'hand' ? wrist.dot(axis)+.002 : -.080;
  material.onBeforeCompile = function(shader,renderer) {
    upstream.call(this,shader,renderer);
    Object.assign(shader.uniforms,{
      atlasSurfaceEnabled:enabled,atlasBindMatrix:{value:bind},
      atlasPlane:{value:new T.Vector4(normal.x,normal.y,normal.z,threshold)}
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 atlasBindMatrix; uniform vec4 atlasPlane; varying float vSurfaceCut;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurfaceCut=dot((atlasBindMatrix*vec4(position,1.)).xyz,atlasPlane.xyz)-atlasPlane.w;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float atlasSurfaceEnabled; varying float vSurfaceCut;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif(atlasSurfaceEnabled>0.5 && vSurfaceCut>0.) discard;');
  };
  material.customProgramCacheKey=()=>previousKey+'|limb-cover';
  material.needsUpdate=true;
}

// Mount after binding the body. The elbow study and squat use different bones.
export function addExtremities(body, asset, landmarks) {
  const parts = new Map();
  const covered = [];
  const handTargets = {L:[],R:[]};
  const hands = new Map();
  const enabledUniform = {value:1};
  body.updateMatrixWorld(true);
  const inverse = body.matrixWorld.clone().invert();
  body.traverse(mesh => {
    if (!mesh.isMesh || mesh.userData.portrait) return;
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox.clone()
      .applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));
    const hand = Math.abs(box.getCenter(new T.Vector3()).x) > .19 &&
      box.max.y < .887 && box.min.y > .68;
    const center=box.getCenter(new T.Vector3());
    const atWrist=Math.abs(center.x)>.16 && box.min.y<.92 && box.max.y>.68 && box.min.y>.65;
    const atAnkle=box.min.y<.12 && box.max.y<.65;
    if (atWrist && mesh.isSkinnedMesh)handTargets[center.x>=0?'L':'R'].push(mesh);
    if(atWrist || atAnkle) {
      const bind=inverse.clone().multiply(mesh.matrixWorld);
      for(const mat of [mesh.material].flat())hideUnderSkin(mat,bind,atWrist?'hand':'foot',Math.sign(center.x),enabledUniform);
    }
    if (hand || box.max.y < .080) covered.push([mesh, mesh.visible]);
  });

  for (let part of [...asset.children]) {
    const [kind, side] = part.name.split('_');
    const name = kind === 'hand' ? 'Mão' : 'Pé';
    const suffix = side === 'L' ? 'esquerdo' : 'direito';
    part.userData.surfaceLabel = name + ' ' + (kind === 'hand' ? suffix.slice(0,-1)+'a' : suffix);
    part.castShadow = part.receiveShadow = true;
    Object.assign(part.material, {
      color:new T.Color('#f5e7de'), transparent:true, vertexColors:true,
      alphaTest:.02, roughness:.69, metalness:0, side:T.FrontSide
    });
    body.add(part);
    const bone = body.getObjectByName('FullRig_'+kind+'_'+side) ||
      (kind === 'hand' && body.getObjectByName('Study_'+(side === 'L'?'left':'right')+'_Forearm'));
    if (kind === 'foot' && bone) {
      const shin=body.getObjectByName('FullRig_shin_'+side);
      const mesh=new T.SkinnedMesh(part.geometry,part.material);
      mesh.name=part.name; mesh.userData=part.userData;
      mesh.castShadow=mesh.receiveShadow=true;
      const pos=mesh.geometry.attributes.position;
      const weights=new Float32Array(pos.count*4);
      const indices=new Uint16Array(pos.count*4);
      for(let i=0;i<pos.count;i++){
        const shinWeight=T.MathUtils.smoothstep(pos.getY(i),.052,.103);
        weights[i*4]=1-shinWeight;
        weights[i*4+1]=shinWeight;
        indices[i*4+1]=1;
      }
      mesh.geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
      mesh.geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));
      part.removeFromParent(); body.add(mesh); body.updateMatrixWorld(true);
      mesh.bind(new T.Skeleton([bone,shin]),mesh.matrixWorld.clone());
      mesh.frustumCulled=false; part=mesh;
    } else if (kind==='hand' && bone && landmarks) {
      const rig=createHandRig(body,bone,side,landmarks);
      hands.set(side,rig);
      for(const mesh of handTargets[side])rig.bind(mesh);
      const skin=new T.SkinnedMesh(part.geometry,part.material);
      skin.name=part.name;skin.userData=part.userData;
      skin.receiveShadow=skin.castShadow=true;
      part.removeFromParent();body.add(skin);body.updateMatrixWorld(true);
      rig.bind(skin,true);
      part=skin;
    } else if (bone) bone.attach(part);
    const center = part.geometry.boundingBox.getCenter(new T.Vector3());
    parts.set(part.name, {part,center});
  }
  const chest=body.getObjectByName('FullRig_chest');
  let bench=null;
  const bar=chest ? mountBackBar(chest) : null;
  return {
    show(enabled) {
      enabledUniform.value=Number(enabled);
      for (const {part} of parts.values()) part.visible = enabled;
      for (const [mesh,original] of covered) mesh.visible = original && !enabled;
    },
    pose(kind,phase) {
      if(bar)bar.visible=kind==='squat';
      if(kind==='bench' && !bench)bench=mountBench(body);
      if(bench){bench.group.visible=kind==='bench';if(bench.group.visible)bench.pose(phase)}
      for(const hand of hands.values())hand.pose(kind,phase);
    },
    center(kind,target) {
      if(kind==='hand' && hands.has('L'))return hands.get('L').center(target);
      const item=parts.get(kind+'_L');
      if(item) item.part.localToWorld(target.copy(item.center));
    },
    dispose(disposeModel) {
      if(bar){bar.removeFromParent();disposeModel(bar)}
      if(bench){bench.group.removeFromParent();disposeModel(bench.group)}
      for(const hand of hands.values())hand.dispose();
      for (const {part} of parts.values()) {
        part.removeFromParent();
        if(part.isSkinnedMesh && part.name.startsWith('foot'))part.skeleton.dispose();
        disposeModel(part);
      }
    }
  };
}
