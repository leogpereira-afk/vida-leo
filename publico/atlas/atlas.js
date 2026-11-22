import * as T from './vendor/three.module.min.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import * as anatomyMaterial from './anatomy-material.js';
import { addPortrait } from './portrait.js';
import { addExtremities } from './extremidades.js';
const options = new URLSearchParams(location.search);
const entryView = {mao:'hand',quadril:'hip',supino:'benchView','pegada-supino':'benchHand',rosca:'curlView',agachamento:'squatView','pegada-barra':'rackHand'}[options.get('vista')] || 'torso';
let entryPending = true;
let extremities=null;
let face = null, focusMode = 'full';
const $=s=>document.querySelector(s),canvas=$('#view');
const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
const scene=new T.Scene();scene.background=new T.Color('#edf0ec');
const camera=new T.PerspectiveCamera(32,1,.01,100),target=new T.Vector3();
scene.add(new T.HemisphereLight(0xffffff,0x8c8274,2));
const key=new T.DirectionalLight(0xfff7e9,3.2);key.position.set(-1.5,5,2.5);key.castShadow=true;
key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-1.25,right:1.25,top:1.9,bottom:-1.1,near:.5,far:9});key.shadow.camera.updateProjectionMatrix();key.shadow.bias=-.00008;scene.add(key);
const rim=new T.DirectionalLight(0xdbedf4,1.4);rim.position.set(2,3,-3);scene.add(rim);
const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.ShadowMaterial({color:0x353d39,opacity:.10}));floor.rotation.x=-Math.PI/2;floor.position.y=-.0002;floor.receiveShadow=true;scene.add(floor);
const raycaster=new T.Raycaster(),pointer=new T.Vector2();
let model=null,motion=null,angle=.10,distance=3.4,height=1.75,request=0,motionTicket=0,playing=false,raf=0,lastTime=0,phase=0;
function draw(){if(!model)return;const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();if(focusMode==='face' && face) face.center(target);
if(focusMode==='hip'){
  const hip = model.getObjectByName('FullRig_pelvis');
  if(hip)hip.getWorldPosition(target);else model.localToWorld(target.set(0,.930,0));
}
if(extremities && ['hand','foot','rackHand','benchHand'].includes(focusMode))extremities.center(['rackHand','benchHand'].includes(focusMode)?'hand':focusMode,target);
const elevation=$('#exercise').value==='bench'?(focusMode==='benchHand'?.40:.63):.025;
camera.position.set(target.x+Math.sin(angle)*distance*Math.cos(elevation),target.y+distance*Math.sin(elevation),target.z+Math.cos(angle)*distance*Math.cos(elevation));camera.lookAt(target);renderer.render(scene,camera)}
function stop(){playing=false;cancelAnimationFrame(raf);raf=0;lastTime=0;$('#play').textContent='Reproduzir movimento';$('#play').setAttribute('aria-pressed','false')}
function disposeModel(root){if(!root)return;const geometries=new Set(),materials=new Set(),textures=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of [o.material,o.customDepthMaterial,o.customDistanceMaterial,...(o.userData.anatomyOriginalMaterials||[])].flat().filter(Boolean)){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v)}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose())}
function focus(view='full'){if(!model)return;focusMode=view;$('.stage-label').style.display=view==='full'?'block':'none';const narrow=canvas.clientWidth<600;target.set(0,height*(narrow?.46:.5),0);distance=height*(narrow?2.12:1.92);if($('#exercise').value==='bench' && ['full','benchView','torso','arm','legs'].includes(view)){
  target.set(0,.52,-.01);distance=Math.max(2.58,2.34/(.555*canvas.clientWidth/canvas.clientHeight));
  if(view==='torso'){target.set(0,.64,-.23);distance=1.45}
  if(view==='arm'){target.set(.26,.79,-.24);distance=1.04}
  if(view==='legs'){target.set(0,.29,.46);distance=1.53}
}else if(view==='benchHand'){distance=.72;}else if(['hand','foot'].includes(view) && extremities){extremities.center(view,target);distance=height*(view==='hand'?.445:.44)}else if(view==='squatView'){target.set(0,.837,0);distance=Math.max(height*1.95,1.62/(.55*canvas.clientWidth/canvas.clientHeight));}else if(view==='rackHand'){distance=.78;}else if(view==='curlView'){target.set(0,1.205,.025);distance=narrow?2.30:1.94;}else if(view==='hip'){distance=height*.65;}else if(view==='legs'){target.set(0,height*.26,.01);distance=height*1.10}else if(view==='face' && face){face.center(target);distance=height*.40}else if(view==='torso'){target.set(0,height*.69,0);distance=height*1.08}else if(view==='arm'){target.set(height*.125,height*.65,0);distance=height*.65}draw()}
function nameOf(o){return o.userData?.name||o.name.replaceAll('_',' ')}
const names=[[/biceps brachii/i,'Bíceps braquial'],[/brachialis/i,'Braquial'],[/brachioradialis/i,'Braquiorradial'],[/triceps brachii/i,'Tríceps braquial'],[/pectoralis major/i,'Peitoral maior'],[/pectoralis minor/i,'Peitoral menor'],[/deltoid/i,'Deltoide'],[/rectus abdominis/i,'Reto abdominal'],[/external oblique/i,'Oblíquo externo'],[/internal oblique/i,'Oblíquo interno'],[/rectus femoris/i,'Reto femoral'],[/vastus lateralis/i,'Vasto lateral'],[/vastus medialis/i,'Vasto medial'],[/sartorius/i,'Sartório'],[/biceps femoris/i,'Bíceps femoral'],[/gastrocnemius/i,'Gastrocnêmio'],[/soleus/i,'Sóleo'],[/tibialis anterior/i,'Tibial anterior'],[/latissimus dorsi/i,'Latíssimo do dorso'],[/trapezius/i,'Trapézio'],[/gluteus maximus/i,'Glúteo máximo'],[/gluteus medius/i,'Glúteo médio']];
function labelMesh(o){if(o.userData.equipment==='banco'){$('#selectedName').textContent='Banco reto';$('#selectedDescription').textContent='Apoio fixo para a cabeça, o tronco e a pelve.';return;}if(o.userData.equipment==='barra' && $('#exercise').value==='bench'){$('#selectedName').textContent='Barra do supino';$('#selectedDescription').textContent='As duas mãos acompanham a barra até o peito e na volta ao alto.';return;}if(o.userData.equipment==='barra'){$('#selectedName').textContent='Barra nas costas';$('#selectedDescription').textContent='A barra acompanha o tronco. As mãos seguram a haste dos dois lados.';return;}if(o.userData.equipment==='halter'){$('#selectedName').textContent='Halter';$('#selectedDescription').textContent='A mão mantém a pegada durante a subida e a descida.';return;}if(o.userData.surfaceLabel){$('#selectedName').textContent=o.userData.surfaceLabel;$('#selectedDescription').textContent='Desative a pele das extremidades para examinar as estruturas do atlas.';return;}if(o.userData.portrait){$('#selectedName').textContent='Rosto';$('#selectedDescription').textContent='Desmarque “Pele do rosto e pescoço” para explorar os músculos da face.';return;}const name=nameOf(o),translated=names.find(([re])=>re.test(name));$('#selectedName').textContent=translated?translated[1]+(/left/i.test(name)?' · esquerdo':/right/i.test(name)?' · direito':''):name;$('#selectedDescription').textContent='Identificação no atlas: '+name+'.'}
const exercises={
  curl:{title:'Rosca com halteres',bottom:'Flexão',muscles:'Flexores do cotovelo',main:/biceps brachii/i,
    support:/brachialis|brachioradialis/i,legend:['Bíceps','Outros flexores'],description:'Bíceps em coral. Braquial e braquiorradial em dourado.',
    phases:['Posição inicial · cotovelos estendidos.','Flexão · aproximação do antebraço ao braço.','Flexão máxima desta demonstração · 112°.','Extensão · retorno controlado à posição inicial.']},
  squat:{title:'Agachamento com barra',bottom:'Fundo',muscles:'Músculos do agachamento',main:/gluteus maximus|rectus femoris|vastus/i,
    support:/soleus|gastrocnemius|biceps femoris|semitendinosus|semimembranosus/i,legend:['Quadríceps / glúteos','Apoio'],description:'Quadríceps e glúteo máximo em coral. Grupos auxiliares em dourado.',
    phases:['Posição inicial · em pé.','Descida · flexão de quadris e joelhos.','Parte mais baixa desta demonstração.','Subida · extensão de quadris e joelhos.']},
  bench:{title:'Supino reto com barra',bottom:'No peito',muscles:'Peitoral maior',main:/pectoralis major/i,
    support:null,legend:['Peitoral maior'],description:'As porções do peitoral maior estão destacadas dos dois lados do peito.',
    phases:['Barra no alto · início da repetição.','Descida · barra em direção ao peito.','Barra junto ao peito.','Subida · extensão dos cotovelos.']}
};
function highlight(){
  if(!model)return;
  const on=$('#biceps').checked,kind=$('#exercise').value,info=exercises[kind];
  const primary=kind==='bench'?'#ff4733':'#d54b32';
  model.traverse(o=>{
    if(!o.isMesh)return;
    const name=nameOf(o),role=info.main.test(name)?1:info.support?.test(name)?2:0;
    for(const m of [o.material].flat()){
      if(!m?.color)continue;
      const pigment=m.userData.anatomyTissue?.uniforms?.uAnatomyCoral?.value||m.color;
      if(!m.userData.atlasRestPigment)m.userData.atlasRestPigment=pigment.clone();
      pigment.copy(m.userData.atlasRestPigment);
      if(on&&role)pigment.set(role===1?primary:'#c89d44');
      if(on&&kind==='bench'&&!role&&m.userData.anatomyTissue)pigment.lerp(new T.Color('#a48c80'),.42);
    }
  });
  $('#tissueLegend').classList.toggle('hidden',on);$('#flexorLegend').classList.toggle('hidden',!on);
  if(on){
    $('#selectedName').textContent=info.muscles;$('#selectedDescription').textContent=info.description;
    $('#flexorLegend').innerHTML=info.legend.map((label,i)=>'<span><i class="dot" style="background:'+(i?'#bd8b30':primary)+'"></i>'+label+'</span>').join('');
  }else{$('#selectedName').textContent='Explore a anatomia';$('#selectedDescription').textContent='Selecione um músculo no modelo.'}
  draw();
}
function setPhase(value){
  phase=value;
  if(motion){
    const kind=$('#exercise').value;motion.setPhase(phase);extremities?.pose(kind,phase);
    $('#phase').value=String(phase);
    const index=phase===0||phase===1?0:Math.abs(phase-.5)<.003?2:phase<.5?1:3;
    $('#phaseText').textContent=exercises[kind].phases[index];
  }
  draw();
}
function frame(now){if(!playing)return;if(lastTime)phase=(phase+(now-lastTime)/6500)%1;lastTime=now;setPhase(phase);raf=requestAnimationFrame(frame)}
async function installMotion(){if(!model||!$('#source').value.startsWith('ecorche'))return;const ticket=++motionTicket,selectedRoot=model;stop();if(motion){motion.dispose();motion=null}try{const kind=$('#exercise').value;if(kind!=='curl'){const module=await import('./anatomy-full-rig.js');if(ticket!==motionTicket||selectedRoot!==model)return;const rig=module.createFullRig(selectedRoot,T);motion={setPhase:t=>rig.setPose({kind,phase:t}),dispose:()=>rig.dispose(),report:rig.report};}else{const module=await import('./anatomy-motion.js');if(ticket!==motionTicket||selectedRoot!==model)return;motion=module.createAnatomyMotion(selectedRoot,T);}const info=exercises[kind];$('#movementTitle').textContent=info.title;$('#stageTitle').textContent=info.title;document.querySelector('[data-phase=".5"]').textContent=info.bottom;$('#motionSection').classList.remove('hidden');$('#status').textContent='Use o controle de fase para examinar cada posição.';anatomyMaterial.configureAbdominalWindow?.(model,T,$('#abdominal').checked);highlight();phase=0}catch(e){$('#motionSection').classList.add('hidden');$('#status').textContent='A articulação deste movimento ainda está sendo preparada.';console.error(e)}}

async function load(){const previousFocus = model ? focusMode : entryView;const serial=++request;++motionTicket;stop();$('#loading').classList.remove('hidden');$('#loading').textContent='Carregando o atlas…';$('#status').textContent='Preparando músculos e iluminação.';$('#motionSection').classList.add('hidden');const file=$('#source').value;try{const loader = new GLTFLoader();
const [gltf, head, ends, fingers] = await Promise.all([loader.loadAsync(file), loader.loadAsync('rosto-cervical.glb'), loader.loadAsync('extremidades.glb'), fetch('./dedos.json').then(r=>{if(!r.ok)throw Error('Falha ao carregar as articulações da mão.');return r.json()})]);
if(serial!==request){disposeModel(gltf.scene);disposeModel(head.scene);disposeModel(ends.scene);return}
if(extremities){extremities.dispose(disposeModel);extremities=null}
if(face){face.root.removeFromParent();disposeModel(face.root);face=null}if(motion){motion.dispose();motion=null}if(model){scene.remove(model);disposeModel(model)}model=gltf.scene;let bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3());if(size.z>size.y*2){model.rotation.x=-Math.PI/2;bounds=new T.Box3().setFromObject(model);size=bounds.getSize(new T.Vector3())}model.position.y-=bounds.min.y;model.updateMatrixWorld(true);height=size.y;model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.material=o.material.clone();o.material.roughness=.68;o.material.metalness=0;}});if(file.startsWith('ecorche')){anatomyMaterial.enhanceAnatomy(model,T);anatomyMaterial.enhanceEyes?.(model,T);}scene.add(model);$('#abdominal').disabled=!file.startsWith('ecorche')||!anatomyMaterial.configureAbdominalWindow;$('#abdominal').checked=file.startsWith('ecorche');$('#biceps').checked=file.startsWith('ecorche');$('#tissueLegend').classList.remove('hidden');$('#flexorLegend').classList.add('hidden');$('#selectedName').textContent='Explore a anatomia';$('#selectedDescription').textContent='Selecione um músculo no corpo para ver seu nome de origem no atlas.';$('#credit').innerHTML=file.startsWith('ecorche')?'Écorché, derivado de <a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/" target="_blank" rel="noreferrer">BodyParts3D</a> e <a href="https://www.z-anatomy.com/" target="_blank" rel="noreferrer">Z-Anatomy</a>. Modelo sob CC BY-SA 4.0.':'Innerscene · modelo original sob CC0.';$('#status').textContent='Observe volumes, tendões e a continuidade dos músculos nos três ângulos.';await installMotion();
if(serial!==request){disposeModel(head.scene);disposeModel(ends.scene);return}
face = { root:head.scene, ...addPortrait(model, head.scene) };
face.show($('#faceSkin').checked);
extremities = addExtremities(model, ends.scene, fingers);
setPhase(0);
extremities.show($('#endsSkin').checked);
if(entryPending && ['hand','hip','curlView','squatView','rackHand','benchView','benchHand'].includes(entryView)){
  angle=entryView==='benchView'?2.02:entryView==='benchHand'?.50:entryView==='squatView'?2.14:entryView==='rackHand'?.12:entryView==='hand'?.37:entryView==='hip'?Math.PI+.60:.19;
  for(const id of ['front','side','back'])$('#'+id).setAttribute('aria-pressed','false');
}
focus(previousFocus);
if(entryPending){
  entryPending=false;
  if(['hand','hip','curlView','squatView','rackHand','benchView','benchHand'].includes(entryView)){
    setPhase(['benchView','benchHand','squatView','rackHand'].includes(entryView)?0:.25);
    if(options.get('animar')==='1' && !matchMedia('(prefers-reduced-motion: reduce)').matches)$('#play').click();
  }
}
$('#loading').classList.add('hidden')}catch(e){$('#loading').textContent='Não foi possível carregar esta base.';$('#status').textContent=e.message;console.error(e)}}
for(const[id,a]of[['front',0],['side',Math.PI/2],['back',Math.PI]])$('#'+id).onclick=()=>{angle=a;for(const x of ['front','side','back'])$('#'+x).setAttribute('aria-pressed',String(x===id));draw()};
if($('#zoomIn'))$('#zoomIn').onclick=()=>{distance=Math.max(height*.35,distance*.85);draw()};if($('#zoomOut'))$('#zoomOut').onclick=()=>{distance=Math.min(height*3.5,distance/ .85);draw()};$('#zoom').onclick=()=>focus('torso');$('#arm').onclick=()=>focus('arm');$('#reset').onclick=()=>focus();$('#biceps').onchange=highlight;$('#source').onchange=load;$('#exercise').onchange=()=>{
  const kind=$('#exercise').value;
  focusMode={bench:'benchView',squat:'squatView',curl:'curlView'}[kind];
  angle={bench:2.02,squat:2.14,curl:.19}[kind];
  for(const id of ['front','side','back'])$('#'+id).setAttribute('aria-pressed','false');
  load();
};
$('#abdominal').onchange=()=>{anatomyMaterial.configureAbdominalWindow?.(model,T,$('#abdominal').checked);draw()};
for(const view of ['hand','hip','legs','foot']) $('#'+view).onclick=()=>focus(view);
$('#endsSkin').onchange=()=>{if(extremities){extremities.show($('#endsSkin').checked);draw()}};
$('#face').onclick = () => focus('face');
$('#faceSkin').onchange = () => { if(face){face.show($('#faceSkin').checked);draw()} };
$('#play').onclick=()=>{if(playing)stop();else if(motion){playing=true;$('#play').textContent='Pausar movimento';$('#play').setAttribute('aria-pressed','true');raf=requestAnimationFrame(frame)}};$('#phase').oninput=e=>{stop();setPhase(Number(e.target.value))};
let drag=null;canvas.onpointerdown=e=>{drag={x:e.clientX,start:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId)};canvas.onpointermove=e=>{if(drag){angle+=(e.clientX-drag.x)*.009;drag.x=e.clientX;for(const x of ['front','side','back'])$('#'+x).setAttribute('aria-pressed','false');draw()}};canvas.onpointerup=e=>{if(drag&&Math.abs(e.clientX-drag.start)<5&&Math.abs(e.clientY-drag.y)<5){const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);model.traverse(o=>{if(o.isSkinnedMesh){o.computeBoundingSphere();if(o.boundingBox)o.computeBoundingBox()}});raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObject(model,true).find(({object})=>{
  if(!object.isMesh)return false;
  for(let part=object;part;part=part.parent)if(!part.visible)return false;
  return true;
});if(hit)labelMesh(hit.object)}drag=null};canvas.onpointercancel=()=>drag=null;
if(['hip','squatView','rackHand'].includes(entryView))$('#exercise').value='squat';
if(['benchView','benchHand'].includes(entryView))$('#exercise').value='bench';
window.onresize=draw;document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});load();

document.querySelectorAll('[data-phase]').forEach(b=>b.onclick=()=>{stop();setPhase(Number(b.dataset.phase))});
