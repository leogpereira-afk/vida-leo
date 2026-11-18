import * as T from './vendor/three/three.module.min.js';
import { boneTargets } from './saude-esportes-retarget.js?v=698f2ed998dc';
import { applyGrip } from './saude-esportes-maos.js?v=f5640e7f9452';

// CC0 human mesh; independent renderer. Colors are an educational map, not EMG.
let modelPromise;
const groups={chest:'peito',core:'abdomen',back:'costas',traps:'costas',lowerBack:'costas',shoulders:'ombros',biceps:'biceps',triceps:'triceps',quads:'quadriceps',hamstrings:'posteriores',glutes:'gluteos',calves:'panturrilhas'};
function decode(value,Type){const raw=atob(value),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return new Type(bytes.buffer)}
async function loadModel(){
 if(!modelPromise)modelPromise=Promise.all(['humano-atletico.json','panturrilhas-posteriores.json'].map(name=>fetch(new URL('./assets/esportes/modelos/'+name,import.meta.url)).then(r=>{if(!r.ok)throw Error('Corpo humano indisponível');return r.json()}))).then(([model,patch])=>({...model,arrays:{...model.arrays,indicesU16:{...model.arrays.indicesU16,calves:patch.indicesU16}},indexCounts:{...model.indexCounts,calves:patch.indexCount}})).catch(e=>{modelPromise=null;throw e});
 return modelPromise;
}
export async function createBody(canvas,primary,secondary,kind){
 const data=await loadModel();
 const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setSize(720,760,false);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;
 const scene=new T.Scene();scene.background=new T.Color('#f6f7f5');const camera=new T.PerspectiveCamera(33,720/760,.05,30),target=new T.Vector3(0,.95,0);
 scene.add(new T.HemisphereLight(0xffffff,0x687d89,1.8));const key=new T.DirectionalLight(0xfff4e7,3.4);key.position.set(-2.5,4,3);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.bias=-.0003;scene.add(key);const fill=new T.DirectionalLight(0xddeaff,1.8);fill.position.set(3,2,-3);scene.add(fill);
 const floor=new T.Mesh(new T.CircleGeometry(2.7,80),new T.MeshStandardMaterial({color:0xe4e7e3,roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.y=-.026;floor.receiveShadow=true;scene.add(floor);
 const phaseUniform={value:0},materialsUsed=[],geometries=[];
 function standard(options){const m=new T.MeshStandardMaterial(options);materialsUsed.push(m);return m}
 function tissue(group,role=0){
  const material=standard({color:role===1?0xd53230:role===2?0xe5a14a:group?0xad7160:0xc7a590,roughness:.64,metalness:0});material.polygonOffset=!!group;material.polygonOffsetFactor=-1;material.polygonOffsetUnits=-1;
  material.onBeforeCompile=shader=>{
   shader.uniforms.studyPhase=phaseUniform;shader.vertexShader='varying vec3 anatomyRest;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nanatomyRest=position;');
   shader.fragmentShader='varying vec3 anatomyRest;\nuniform float studyPhase;\n'+shader.fragmentShader;
   const direction=group==='chest'?'anatomyRest.y + .65*pow(abs(anatomyRest.x),1.4)':['back','traps'].includes(group)?'anatomyRest.y + .55*abs(anatomyRest.x)':'anatomyRest.x + .32*anatomyRest.z + .018*sin(anatomyRest.y*18.0)';
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float fiberCoordinate=${direction};
    float fineFiber=sin(fiberCoordinate*2100.0 + sin(anatomyRest.y*47.0)*.9);
    float bundle=sin(fiberCoordinate*430.0);
    diffuseColor.rgb*=${group?".91+.065*fineFiber+.055*bundle":".98+.02*bundle"};
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*1.3,pow(max(fineFiber,0.0),8.0)*.19);
    ${role===1?'diffuseColor.rgb*=1.0+.1*studyPhase;':''}
    ${!group?`float tendon=(1.0-smoothstep(.08,.20,anatomyRest.y))*.55;
     tendon=max(tendon,(1.0-smoothstep(.025,.065,abs(anatomyRest.y-.515)))*.36);
     diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.82,.76,.67),tendon);`:''}
   `);
  };material.customProgramCacheKey=()=>`anatomy-${group}-${role}`;return material;
 }
 const arrays=data.arrays,rest=decode(arrays.positionF32,Float32Array);
 const gripping=['bench','row','press','curl','triceps','carry','squat','hinge','bridge','ski','sled','pull','erg','lunge','wallball','bike'].includes(kind);
 const shaped=gripping?applyGrip(rest,data,1):rest;
 const position=new T.BufferAttribute(shaped,3),normal=new T.BufferAttribute(Float32Array.from(decode(arrays.normalI8,Int8Array),v=>v/127),3),skinIndex=new T.BufferAttribute(decode(arrays.jointsU8,Uint8Array),4),skinWeight=new T.BufferAttribute(decode(arrays.weightsU8,Uint8Array),4,true);
 if(gripping){const scratch=new T.BufferGeometry();scratch.setAttribute('position',position);scratch.setIndex(new T.BufferAttribute(decode(arrays.indicesU16.body,Uint16Array),1));scratch.computeVertexNormals();const next=scratch.getAttribute('normal');for(let i=0;i<position.count;i++)if(shaped[i*3]!==rest[i*3]||shaped[i*3+1]!==rest[i*3+1]||shaped[i*3+2]!==rest[i*3+2])normal.setXYZ(i,next.getX(i),next.getY(i),next.getZ(i));scratch.dispose();}
 const bones=data.bones.map(b=>{const bone=new T.Bone();bone.position.fromArray(b.start);scene.add(bone);return bone}),skeleton=new T.Skeleton(bones,data.bones.map(b=>new T.Matrix4().makeTranslation(-b.start[0],-b.start[1],-b.start[2])));
 function surface(name,material){const geo=new T.BufferGeometry();geo.setAttribute('position',position);geo.setAttribute('normal',normal);geo.setAttribute('skinIndex',skinIndex);geo.setAttribute('skinWeight',skinWeight);geo.setIndex(new T.BufferAttribute(decode(arrays.indicesU16[name],Uint16Array),1));geometries.push(geo);const mesh=new T.SkinnedMesh(geo,material);mesh.bind(skeleton,new T.Matrix4());mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh}
 surface('body',tissue('',0));
 for(const [group,id]of Object.entries(groups))surface(group,tissue(group,primary.includes(id)?1:secondary.includes(id)?2:0));
 if(primary.includes('antebracos')||secondary.includes('antebracos')){
  const ids=decode(arrays.indicesU16.body,Uint16Array),p=position.array,arm=[];
  for(let i=0;i<ids.length;i+=3){const center=[0,0,0];for(let j=0;j<3;j++)for(let c=0;c<3;c++)center[c]+=p[ids[i+j]*3+c]/3;if(Math.abs(center[0])>.385&&center[1]>1.09&&center[1]<1.28)arm.push(ids[i],ids[i+1],ids[i+2]);}
  const geo=new T.BufferGeometry();for(const [n,a]of Object.entries({position,normal,skinIndex,skinWeight}))geo.setAttribute(n,a);geo.setIndex(arm);geometries.push(geo);const mesh=new T.SkinnedMesh(geo,tissue('forearms',primary.includes('antebracos')?1:2));mesh.bind(skeleton,new T.Matrix4());mesh.frustumCulled=false;scene.add(mesh);
 }
 const eyes=standard({color:0xe7e1d7,roughness:.4});eyes.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 eyeRest;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\neyeRest=position;');
  shader.fragmentShader='varying vec3 eyeRest;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float iris=1.0-smoothstep(.005,.008,length(vec2(abs(eyeRest.x)-.0305,(eyeRest.y-1.688)*1.1)));
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.10,.12,.11),iris);`);
 };surface('eyes',eyes);
 // Keep footwear: the licensed mesh omits the covered foot surface.
 for(const [name,color]of [['trainerUpper',0xcbd0cc],['trainerSole',0x6d7778],['trainerTrim',0x253d42]])surface(name,standard({color,roughness:.85}));
 const materials={equipment:standard({color:0x354750,metalness:.65,roughness:.32}),assist:standard({color:0x9c7760,roughness:.75})};
 const sphere=new T.SphereGeometry(1,24,18),tube=new T.CylinderGeometry(1,1,1,24),boxGeometry=new T.BoxGeometry(1,1,1),pool=[];let used=0;
 const vec=a=>new T.Vector3(...a),mid=(a,b,t=.5)=>a.map((v,i)=>v+(b[i]-v)*t);
 function mesh(geom,mat){let o=pool[used++];if(!o){o=new T.Mesh(geom,mat);o.castShadow=true;o.receiveShadow=true;pool.push(o);scene.add(o)}o.geometry=geom;o.material=mat;o.visible=true;o.quaternion.identity();return o}
 function ell(at,scale,mat=materials.skin){const o=mesh(sphere,mat);o.position.copy(vec(at));o.scale.set(...scale);return o}
 function limb(a,b,r1,r2,mat=materials.skin){const o=mesh(sphere,mat),v=vec(b).sub(vec(a));o.position.copy(vec(mid(a,b)));o.scale.set(r1,v.length()/2+r1*.45,r2);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return o}
 function cylinder(a,b,r,mat=materials.equipment){const o=mesh(tube,mat),v=vec(b).sub(vec(a));o.position.copy(vec(mid(a,b)));o.scale.set(r,v.length(),r);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return o}
 function offset(a,x=0,y=0,z=0){return [a[0]+x,a[1]+y,a[2]+z]}
 function gear(e){const a=e.at;if(e.type==='dumbbell'){cylinder(offset(a,-.16),offset(a,.16),.025);for(const x of [-.13,.13])cylinder(offset(a,x-.038),offset(a,x+.038),.085)}else if(e.type==='ball')ell(a,[.15,.15,.15],materials.assist);else if(['bench','seat','box','bag'].includes(e.type)){if(e.type==='bag')ell(a,[.4,.1,.12],materials.assist);else{const o=mesh(boxGeometry,materials.equipment);o.position.copy(vec(a));o.scale.set(...(e.type==='bench'?[.42,.09,1.2]:[.5,.12,.5]));}if(e.type!=='bag')for(const z of [-.2,.2])cylinder(offset(a,0,-.05,z),[a[0],.02,a[2]+z],.035);if(e.type==='seat'){const back=mesh(boxGeometry,materials.equipment);back.position.copy(vec(offset(a,0,.30,-.22)));back.scale.set(.4,.65,.08)}}else if(e.type==='sled'){for(const x of [-.32,.32]){cylinder([x,.04,a[2]-.3],[x,.04,a[2]+.3],.04);cylinder([x,.05,a[2]],[x,1.25,a[2]],.03)}ell(a,[.35,.1,.35],materials.equipment)}else if(e.type==='bike'){for(const z of [-.7,.9])for(let i=0;i<32;i++){const a=i/32*2*Math.PI,b=(i+1)/32*2*Math.PI;cylinder([0,.37+Math.sin(a)*.36,z+Math.cos(a)*.36],[0,.37+Math.sin(b)*.36,z+Math.cos(b)*.36],.018)}for(const [a,b]of [[[0,.4,0],[0,.95,-.3]],[[0,.95,-.3],[0,.37,-.7]],[[0,.37,-.7],[0,.4,0]],[[0,.95,-.3],[0,1,.65]],[[0,1,.65],[0,.4,0]],[[0,1.15,.65],[0,.37,.9]]])cylinder(a,b,.028)}else cylinder(e.from,e.to,e.type==='bar'?.04:.012)}

 let low=null,disposed=false;
 function render(pose,angle,zoom=1){
  if(disposed)return;used=0;const targets=boneTargets(pose,{kind:pose.kind,phase:pose.phase});
  for(let i=0;i<bones.length;i++){bones[i].position.fromArray(targets[i].head);if(targets[i].rotation)bones[i].quaternion.fromArray(targets[i].rotation);else bones[i].quaternion.setFromUnitVectors(vec(data.bones[i].end).sub(vec(data.bones[i].start)).normalize(),vec(targets[i].tail).sub(vec(targets[i].head)).normalize());}
  phaseUniform.value=(1-Math.cos((pose.phase||0)*Math.PI*2))/2;
  if(low===null)low=['bench','bridge','plank','sideplank','abduction','erg'].includes(pose.kind);
  const distance=(low?4.5:3.9)/zoom;target.set(0,low?.55:.95,low?-.10:0);camera.position.set(target.x+Math.sin(angle)*distance,target.y+distance*.17,target.z+Math.cos(angle)*distance);camera.lookAt(target);
  for(const e of targets.equipment||pose.equipment)gear(e);for(let i=used;i<pool.length;i++)pool[i].visible=false;renderer.render(scene,camera);
 }
 return {render,dispose(){if(disposed)return;disposed=true;skeleton.dispose();key.shadow.dispose();renderer.dispose();renderer.forceContextLoss();sphere.dispose();tube.dispose();boxGeometry.dispose();floor.geometry.dispose();floor.material.dispose();for(const g of geometries)g.dispose();for(const m of materialsUsed)m.dispose();scene.clear()}};
}
