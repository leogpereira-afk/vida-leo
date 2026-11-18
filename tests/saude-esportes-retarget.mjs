import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const context=vm.createContext({Math});
vm.runInContext(readFileSync(new URL('../publico/saude-esportes-3d.js',import.meta.url),'utf8'),context);
const source=readFileSync(new URL('../publico/saude-esportes-retarget.js',import.meta.url),'utf8');
const {boneTargets,retargetPose,REST_BONES}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const pose=context.SaudeEsportes3D.pose;
const kinds=[...new Set(Object.values(context.SaudeEsportes3D.kinds).flat())];
const subtract=(a,b)=>a.map((v,i)=>v-b[i]);
const distance=(a,b)=>Math.hypot(...subtract(a,b));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const rotate=(q,p)=>{
  const t=cross(q.slice(0,3),p).map(v=>v*2),u=cross(q.slice(0,3),t);
  return p.map((v,i)=>v+q[3]*t[i]+u[i]);
};
const sample=(kind,phase)=>boneTargets(pose(kind,phase),{kind,phase});

test('retarget: comprimentos constantes e rotações finitas nas 401 fases de cada movimento',()=>{
  for(const kind of kinds)for(let i=0;i<=400;i++){
    const targets=sample(kind,i/400);
    assert.equal(targets.length,22,kind);
    for(let j=0;j<22;j++){
      const target=targets[j],rest=REST_BONES[j];
      assert.equal(target.name,rest.name);
      assert.ok([...target.head,...target.tail,...target.rotation].every(Number.isFinite),`${kind}/${i}/${rest.name}`);
      assert.ok(Math.abs(distance(target.head,target.tail)-distance(rest.start,rest.end))<1e-7,`${kind}: osso ${rest.name} esticou`);
      assert.ok(Math.abs(Math.hypot(...target.rotation)-1)<1e-7,`${kind}: quaternion unitário`);
      assert.ok(distance(rotate(target.rotation,subtract(rest.end,rest.start)),subtract(target.tail,target.head))<1e-7,`${kind}: orientação incoerente em ${rest.name}`);
    }
  }
});

test('retarget: supino olha para cima; prancha olha para o piso; lateral usa rotação sem espelhamento',()=>{
  const bench=rotate(sample('bench',.5)[3].rotation,[0,0,1]);
  const plank=rotate(sample('plank',.5)[3].rotation,[0,0,1]);
  const side=rotate(sample('sideplank',.5)[3].rotation,[0,0,1]);
  assert.ok(bench[1]>.99,'rosto do supino deve estar voltado para cima');
  assert.ok(plank[1]<-.9,'rosto da prancha deve estar voltado para o piso');
  assert.ok(side[0]>.99,'rosto da prancha lateral deve estar voltado para o lado');
  for(const kind of ['bench','plank','sideplank','burpee']){
    const q=sample(kind,.5)[0].rotation;
    assert.ok(distance(cross(rotate(q,[1,0,0]),rotate(q,[0,1,0])),rotate(q,[0,0,1]))<1e-8,kind+' deve preservar orientação');
  }
});

test('retarget: apoio inferior da prancha lateral e pés do supino permanecem junto ao piso',()=>{
  for(let i=0;i<=40;i++){
    const bench=sample('bench',i/40).anatomical;
    for(const side of ['Left','Right'])assert.ok(Math.abs(bench[side].ankle[1]-REST_BONES[12].start[1])<1e-7);
    const side=sample('sideplank',i/40).anatomical;
    assert.ok(Math.abs(side.Right.ankle[1]-REST_BONES[12].start[1])<1e-7,'tornozelo inferior deve respeitar o apoio');
    assert.ok(side.Right.toe[1]>=0&&side.Right.toe[1]<.025,'pé inferior não deve flutuar');
    assert.ok(side.Right.wrist[1]>=.05&&side.Right.wrist[1]<.13,'apoio inferior junto ao piso');
    assert.ok(side.Right.elbow[1]>=.05&&side.Right.elbow[1]<.085,'cotovelo inferior não deve flutuar');
    assert.ok(Math.abs(side.Right.elbow[1]-side.Right.wrist[1])<.02,'antebraço de apoio deve ficar quase horizontal');
    assert.ok(side.Right.palm[1]>=.025&&side.Right.palm[1]<.09,'palma inferior deve acompanhar o apoio');
  }
});

test('retarget: transição de burpee conserva apoio das mãos e não atravessa o piso',()=>{
  for(let i=100;i<=300;i++){
    const target=sample('burpee',i/400);
    for(const side of ['Left','Right']){
      assert.ok(target.anatomical[side].toe[1]>=0,'pé abaixo do piso');
      assert.ok(Math.abs(target.anatomical[side].wrist[1]-.078)<.025,'mão fora do apoio');
    }
  }
  const first=sample('burpee',0),last=sample('burpee',1);
  for(let i=0;i<22;i++){
    assert.ok(distance(first[i].head,last[i].head)<1e-8);
    assert.ok(distance(first[i].tail,last[i].tail)<1e-8);
  }
});

test('retarget: bicicleta não cruza os lados anatômicos',()=>{
  for(let i=0;i<=40;i++){
    const {Left,Right}=sample('bike',i/40).anatomical;
    assert.ok(Left.hip[0]>0&&Left.ankle[0]>0);
    assert.ok(Right.hip[0]<0&&Right.ankle[0]<0);
  }
});

test('retarget: rosca mantém cotovelos junto ao tronco e antebraços no plano sagital',()=>{
  const initial=sample('curl',0).anatomical;
  for(let i=0;i<=400;i++){
    const current=sample('curl',i/400).anatomical;
    for(const side of ['Left','Right']){
      const arm=current[side];
      assert.ok(distance(arm.elbow,initial[side].elbow)<.015,'cotovelo não deve sair da posição durante a rosca');
      assert.ok(Math.abs(Math.abs(arm.elbow[0])-.23)<.025,'cotovelo deve permanecer ao lado do tronco');
      assert.ok(Math.abs(arm.elbow[1]-1.18)<.025,'cotovelo não deve elevar junto ao ombro');
      assert.ok(Math.abs(arm.wrist[0]-arm.elbow[0])<.015,'antebraço não deve abrir transversalmente');
      assert.ok(arm.wrist[2]>arm.elbow[2],'antebraço deve dobrar à frente do corpo');
    }
  }
});

test('retarget: desenvolvimento permanece sentado com pés apoiados e assento abaixo da pelve',()=>{
  for(let i=0;i<=400;i++){
    const targets=sample('press',i/400),seat=targets.equipment.find(e=>e.type==='seat');
    assert.ok(Math.abs(targets.joints.hip[1]-.6)<1e-7,'pelve deve permanecer na altura sentada');
    assert.ok(seat&&Math.abs(seat.at[1]-.45)<1e-7,'assento deve ficar abaixo da pelve');
    for(const side of ['Left','Right']){
      const limb=targets.anatomical[side];
      assert.ok(Math.abs(limb.ankle[1]-REST_BONES[12].start[1])<1e-7,'pés no piso');
      assert.ok(limb.knee[2]>.28&&limb.knee[2]<.48,'joelhos à frente da pelve');
      assert.ok(limb.knee[1]>.43&&limb.knee[1]<.6,'joelhos em altura de postura sentada');
      assert.ok(limb.wrist[1]>limb.elbow[1],'halter acima do cotovelo');
    }
  }
});

test('retarget: equipamentos acompanham palmas resolvidas, sem mutação da entrada',()=>{
  const input=pose('curl',.33),before=JSON.stringify(input);
  const output=retargetPose(input,{kind:'curl',phase:.33});
  assert.equal(JSON.stringify(input),before);
  assert.equal(output.equipment.length,2);
  for(const [i,key]of [[0,'pl'],[1,'pr']])assert.ok(distance(output.equipment[i].at,output.joints[key])<1e-8);
  const squat=retargetPose(pose('squat',.5),{kind:'squat',phase:.5});
  const center=squat.joints.pl.map((v,i)=>(v+squat.joints.pr[i])/2);
  assert.ok(distance(squat.equipment[0].at,center)<1e-8,'goblet deve acompanhar as duas palmas, não a antiga altura do tórax');
});

test('retarget: rejeita articulações inválidas antes de atingir a GPU',()=>{
  const input=pose('squat',0);input.joints.kl=[0,NaN,0];
  assert.throws(()=>boneTargets(input),/Invalid anatomical pose joint: kl/);
});
