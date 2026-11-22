import * as T from './vendor/three.module.min.js';

// All dimensions are in metres. Geometry is built along local Y. The root is
// mounted in the palm frame together with the finger pivots.
export function createDumbbell(side, center, axis, radius) {
  const group = new T.Group();
  group.name = 'Halter_' + side;
  group.position.copy(center);
  group.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),axis.clone().normalize());
  const rubber = new T.MeshStandardMaterial({color:0x293239,roughness:.76,metalness:.10});
  const chrome = new T.MeshStandardMaterial({color:0xafb7ba,roughness:.36,metalness:.52});
  const graphite = new T.MeshStandardMaterial({color:0x485055,roughness:.48,metalness:.3});
  const rim = new T.MeshStandardMaterial({color:0x959e9e,roughness:.46,metalness:.46});
  const gripLength=.121, thickness=.042, headRadius=.049;
  function add(name,geometry,material,y) {
    const part=new T.Mesh(geometry,material);
    part.name=name; part.userData.equipment='halter';
    part.position.y=y; part.castShadow=true;part.receiveShadow=true;
    group.add(part);
    return part;
  }
  // A low-relief metal grip. The crosshatching is shallow enough to preserve
  // the fitted radius and readable from both sides of the anatomical hand.
  chrome.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 gripP;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\ngripP=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 gripP;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        float angle=atan(gripP.z,gripP.x);
        float a=gripP.y*2100.0+angle*18.0;
        float b=gripP.y*2100.0-angle*18.0;
        float grid=.5*(cos(a)*(1.-smoothstep(.65,2.6,fwidth(a))) + cos(b)*(1.-smoothstep(.65,2.6,fwidth(b))));
        diffuseColor.rgb*=1.+.12*grid;`);
  };
  const bar=add('Cabo',new T.CylinderGeometry(radius,radius,gripLength,48),chrome,0);
  bar.userData.radius=radius;bar.userData.halfLength=gripLength/2;
  const corners=Array.from({length:6},(_,i)=>new T.Vector2(
    headRadius*Math.cos(Math.PI/6+i*Math.PI/3),headRadius*Math.sin(Math.PI/6+i*Math.PI/3)));
  const outline=new T.Shape();
  corners.forEach((c,i)=>{
    const before=c.clone().lerp(corners[(i+5)%6],.085),after=c.clone().lerp(corners[(i+1)%6],.085);
    if(i===0)outline.moveTo(before.x,before.y);else outline.lineTo(before.x,before.y);
    outline.quadraticCurveTo(c.x,c.y,after.x,after.y);
  });
  outline.closePath();
  const head=new T.ExtrudeGeometry(outline,{depth:thickness-.006,bevelEnabled:true,bevelThickness:.003,bevelSize:.0022,bevelSegments:3,curveSegments:3});
  head.translate(0,0,-(thickness-.006)/2);head.rotateX(-Math.PI/2);
  for(const sign of [-1,1]){
    const headCenter=sign*(gripLength/2+thickness/2);
    add('Peso hexagonal',head,rubber,headCenter);
    add('Bucha',new T.CylinderGeometry(.019,.019,.006,40),rim,sign*(gripLength/2-.002));
    add('Face do peso',new T.CylinderGeometry(.024,.024,.0018,40),graphite,sign*(gripLength/2+thickness-.0002));
    add('Eixo',new T.CylinderGeometry(.006,.006,.0023,32),rim,sign*(gripLength/2+thickness+.0004));
  }
  return group;
}
