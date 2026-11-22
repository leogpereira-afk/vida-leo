import * as T from './vendor/three.module.min.js';
import {armForGrip,createBar} from './barra-costas.js';

const across=new T.Vector3(1,0,0);
const lying=new T.Quaternion().setFromAxisAngle(across,-Math.PI/2);
const raised=new T.Vector3(0,.537,1.08);
const onBench=p=>p.clone().applyQuaternion(lying).add(raised);
const gripWidth=.315;
const top=new T.Vector3(0,1.388,.550);
const bottom=new T.Vector3(0,1.258,.154);
const barInBody=amount=>top.clone().lerp(bottom,amount);

function plantedLeg(thigh,shin,foot,sign) {
  const hip=onBench(thigh[2]),ankle=new T.Vector3(sign*.191,shin[3].y,.65);
  const length1=thigh[2].distanceTo(thigh[3]),length2=shin[2].distanceTo(shin[3]);
  const line=ankle.clone().sub(hip),d=line.length();line.divideScalar(d);
  const along=(length1**2-length2**2+d*d)/(2*d);
  const pole=new T.Vector3(sign*.16,1,.30);pole.addScaledVector(line,-pole.dot(line)).normalize();
  const knee=hip.clone().addScaledVector(line,along).addScaledVector(pole,Math.sqrt(length1**2-along**2));
  const toe=foot[3].clone().sub(foot[2]).add(ankle);
  return [[hip,knee],[knee,ankle],[ankle,toe,new T.Quaternion()]];
}

// The trunk, head and leg supports are fixed while the single bar drives both arms.
export function createBenchPose(bones,indices) {
  const fixed=bones.map(([, ,head,tail])=>[onBench(head),onBench(tail),lying.clone()]);
  const arms=[];
  for(const [side,sign] of [['L',1],['R',-1]]){
    const idx=name=>indices[name+'_'+side];
    const legs=[idx('thigh'),idx('shin'),idx('foot')];
    plantedLeg(...legs.map(i=>bones[i]),sign).forEach((pose,i)=>fixed[legs[i]]=pose);
    arms.push({sign,indices:[idx('upperarm'),idx('forearm'),idx('hand')]});
  }
  return amount=>{
    const targets=fixed.slice();
    for(const arm of arms){
      const [u,f,h]=arm.indices.map(i=>bones[i]);
      const purchase=barInBody(amount);purchase.x=arm.sign*gripWidth;
      const poses=armForGrip(arm.sign,u[2],f[2],h[2],h[3],purchase,
        new T.Vector3(0,-.10,-.995),new T.Vector3(arm.sign*.68,-.76,-.83));
      for(let i=0;i<3;i++){
        const [a,b,q]=poses[i];
        targets[arm.indices[i]]=[onBench(a),onBench(b),lying.clone().multiply(q)];
      }
    }
    return targets;
  };
}

export function mountBench(body){
  const group=new T.Group();group.name='Supino_reto';body.add(group);
  const pad=new T.MeshStandardMaterial({color:0x374443,roughness:.87});
  const frame=new T.MeshStandardMaterial({color:0x424d51,metalness:.36,roughness:.53});
  const rubber=new T.MeshStandardMaterial({color:0x262f30,roughness:.85});
  function block(name,width,height,length,x,y,z,material){
    const part=new T.Mesh(new T.BoxGeometry(width,height,length),material);
    part.name=name;part.userData.equipment='banco';part.position.set(x,y,z);
    part.castShadow=part.receiveShadow=true;group.add(part);
  }
  // Rounded cushion, including its stitched lower lip, follows the flat bench.
  function cushion(width,length,depth,bevel,height,material){
    const x=width/2,y=length/2,r=.034;
    const shape=new T.Shape();
    shape.moveTo(-x+r,-y);shape.lineTo(x-r,-y);shape.quadraticCurveTo(x,-y,x,-y+r);
    shape.lineTo(x,y-r);shape.quadraticCurveTo(x,y,x-r,y);shape.lineTo(-x+r,y);
    shape.quadraticCurveTo(-x,y,-x,y-r);shape.lineTo(-x,-y+r);shape.quadraticCurveTo(-x,-y,-x+r,-y);
    const geometry=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:4,curveSegments:12});
    geometry.rotateX(-Math.PI/2);
    const mesh=new T.Mesh(geometry,material);mesh.name='Banco estofado';mesh.userData.equipment='banco';
    mesh.position.set(0,height,-.162);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
  }
  cushion(.274,1.224,.043,.009,.3885,pad);
  cushion(.282,1.232,.006,.003,.379,frame);
  block('Longarina',.058,.056,1.12,0,.345,-.162,frame);
  for(const z of [-.65,.34]){
    block('Apoio',.055,.286,.07,0,.178,z,frame);
    block('Travessa',.46,.042,.068,0,.028,z,frame);
    for(const x of [-.224,.224])block('Sapata',.034,.054,.079,x,.027,z,rubber);
  }
  const bar=createBar('Barra_supino');group.add(bar);
  return {group,pose(phase){
    const amount=(1-Math.cos(2*Math.PI*phase))*.5;
    bar.position.copy(onBench(barInBody(amount)));
  }};
}
