import * as T from './vendor/three/three.module.min.js';
// Corpo humano estilizado: destaques representam função muscular, não EMG.
export function createBody(canvas,primary,secondary){
 const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setSize(600,620,false);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
 const scene=new T.Scene();scene.background=new T.Color('#eef1ed');const camera=new T.PerspectiveCamera(35,600/620,.1,30);const target=new T.Vector3(0,1,0);
 scene.add(new T.HemisphereLight(0xffffff,0x83978c,2.4));const key=new T.DirectionalLight(0xffecd5,3.5);key.position.set(3,6,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);scene.add(key);const fill=new T.DirectionalLight(0xcce3ff,2);fill.position.set(-3,3,-3);scene.add(fill);
 const floor=new T.Mesh(new T.CircleGeometry(2.7,80),new T.MeshStandardMaterial({color:0xd8e0d9,roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.y=-.015;floor.receiveShadow=true;scene.add(floor);
 const stage=new T.Mesh(new T.CylinderGeometry(1.65,1.7,.06,80),new T.MeshStandardMaterial({color:0xe9eee8,roughness:.8}));stage.position.y=-.05;stage.receiveShadow=true;scene.add(stage);
 const materials={skin:new T.MeshStandardMaterial({color:0xd7bda0,roughness:.55}),shorts:new T.MeshStandardMaterial({color:0x243c42,roughness:.9}),main:new T.MeshStandardMaterial({color:0xe74f47,roughness:.45}),assist:new T.MeshStandardMaterial({color:0xe7ad48,roughness:.5}),equipment:new T.MeshStandardMaterial({color:0x37494f,metalness:.6,roughness:.32}),hair:new T.MeshStandardMaterial({color:0x353c3b,roughness:.9})};
 const sphere=new T.SphereGeometry(1,24,18),tube=new T.CylinderGeometry(1,1,1,20),pool=[];let used=0;
 const vec=a=>new T.Vector3(...a),mid=(a,b,t=.5)=>a.map((v,i)=>v+(b[i]-v)*t);
 function color(group){return primary.includes(group)?materials.main:secondary.includes(group)?materials.assist:materials.skin}
 function mesh(geom,mat){let o=pool[used++];if(!o){o=new T.Mesh(geom,mat);o.castShadow=true;o.receiveShadow=true;pool.push(o);scene.add(o)}o.geometry=geom;o.material=mat;o.visible=true;o.quaternion.identity();return o}
 function ell(at,scale,mat=materials.skin){const o=mesh(sphere,mat);o.position.copy(vec(at));o.scale.set(...scale);return o}
 function limb(a,b,r1,r2,mat=materials.skin){const o=mesh(sphere,mat),v=vec(b).sub(vec(a));o.position.copy(vec(mid(a,b)));o.scale.set(r1,v.length()/2+r1*.45,r2);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return o}
 function cylinder(a,b,r,mat=materials.equipment){const o=mesh(tube,mat),v=vec(b).sub(vec(a));o.position.copy(vec(mid(a,b)));o.scale.set(r,v.length(),r);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return o}
 function offset(a,x=0,y=0,z=0){return [a[0]+x,a[1]+y,a[2]+z]}
 function gear(e){const a=e.at;if(e.type==='dumbbell'){cylinder(offset(a,-.16),offset(a,.16),.025);for(const x of [-.13,.13])ell(offset(a,x),[.055,.09,.09],materials.equipment)}else if(e.type==='ball')ell(a,[.15,.15,.15],materials.assist);else if(['bench','seat','box','bag'].includes(e.type)){ell(a,e.type==='bench'?[.22,.075,.6]:e.type==='bag'?[.4,.1,.12]:[.3,.12,.3],e.type==='bag'?materials.assist:materials.equipment);if(e.type!=='bag')for(const z of [-.3,.3])cylinder(offset(a,0,-.05,z),[a[0],.02,a[2]+z],.04)}else if(e.type==='sled'){for(const x of [-.32,.32]){cylinder([x,.04,a[2]-.3],[x,.04,a[2]+.3],.04);cylinder([x,.05,a[2]],[x,1.25,a[2]],.03)}ell(a,[.35,.1,.35],materials.equipment)}else if(e.type==='bike'){for(const z of [-.7,.9])for(let i=0;i<32;i++){const a=i/32*2*Math.PI,b=(i+1)/32*2*Math.PI;cylinder([0,.37+Math.sin(a)*.36,z+Math.cos(a)*.36],[0,.37+Math.sin(b)*.36,z+Math.cos(b)*.36],.018)}for(const [a,b]of [[[0,.4,0],[0,.95,-.3]],[[0,.95,-.3],[0,.37,-.7]],[[0,.37,-.7],[0,.4,0]],[[0,.95,-.3],[0,1,.65]],[[0,1,.65],[0,.4,0]],[[0,1.15,.65],[0,.37,.9]]])cylinder(a,b,.028)}else cylinder(e.from,e.to,e.type==='bar'?.04:.012)}
 let low=null;function render(pose,angle,zoom=1){used=0;const p=pose.joints;if(low===null)low=Math.max(...Object.values(p).map(a=>a[1]))<1.4;const distance=(low?3.4:4.2)/zoom;target.y=low?.55:1.05;camera.position.set(Math.sin(angle)*distance,target.y+distance*.24,Math.cos(angle)*distance);camera.lookAt(target);
 // Tronco com cintura, tórax, pescoço e cintura escapular.
 const up=vec(p.chest).sub(vec(p.hip)).normalize(),front=new T.Vector3(0,0,1);if(Math.abs(up.z)>.5)front.set(0,1,0);const local=(base,x,y,z)=>vec(base).add(new T.Vector3(x,0,0)).add(up.clone().multiplyScalar(y)).add(front.clone().multiplyScalar(z)).toArray();
 limb(p.hip,p.chest,.225,.135);ell(p.hip,[.23,.14,.15],materials.shorts);limb(p.chest,p.neck,.095,.085);ell(p.head,[.125,.165,.12]);ell(offset(p.head,0,.07,-.03),[.128,.105,.106],materials.hair);ell(offset(p.head,0,0,.115),[.026,.04,.028]);for(const s of [-1,1]){ell(offset(p.head,s*.12,0,0),[.025,.047,.023]);ell(offset(p.head,s*.047,.035,.108),[.013,.007,.007],materials.hair)}
 for(const [s,sign]of [['l',-1],['r',1]]){
  ell(p['s'+s],[.105,.105,.11],color('ombros'));
  limb(p['s'+s],p['e'+s],.075,.072);limb(p['e'+s],p['w'+s],.055,.05,color('antebracos'));ell(p['e'+s],[.053,.053,.053]);ell(p['w'+s],[.045,.065,.04]);
  limb(offset(mid(p['s'+s],p['e'+s],.2),0,0,.035),offset(mid(p['s'+s],p['e'+s],.8),0,0,.035),.052,.05,color('biceps'));
  limb(offset(mid(p['s'+s],p['e'+s],.2),0,0,-.035),offset(mid(p['s'+s],p['e'+s],.8),0,0,-.035),.054,.05,color('triceps'));
  limb(p['h'+s],p['k'+s],.105,.115);limb(offset(mid(p['h'+s],p['k'+s],.15),0,0,.04),offset(mid(p['h'+s],p['k'+s],.85),0,0,.04),.08,.09,color('quadriceps'));
  limb(offset(mid(p['h'+s],p['k'+s],.15),0,0,-.05),offset(mid(p['h'+s],p['k'+s],.8),0,0,-.05),.075,.08,color('posteriores'));
  ell(offset(p['h'+s],sign*.015,0,-.065),[.125,.13,.115],color('gluteos'));
  ell(p['k'+s],[.075,.075,.07]);limb(p['k'+s],p['a'+s],.068,.075);limb(mid(p['k'+s],p['a'+s],.18),mid(p['k'+s],p['a'+s],.65),.075,.085,color('panturrilhas'));ell(offset(p['a'+s],0,-.015,.075),[.065,.045,.145]);
  const chest=ell(local(p.chest,sign*.105,-.055,.11),[.125,.105,.055],color('peito'));chest.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),up);
  limb(local(p.chest,sign*.14,-.08,-.065),local(p.hip,sign*.1,.15,-.07),.09,.075,color('costas'));
 }
 for(const y of [.15,.25,.35])for(const x of [-.05,.05]){const abs=ell(local(p.hip,x,y,.125),[.046,.05,.025],color('abdomen'));abs.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),up)}
 for(const e of pose.equipment)gear(e);for(let i=used;i<pool.length;i++)pool[i].visible=false;renderer.render(scene,camera);
 }
 return {render,dispose(){renderer.dispose();sphere.dispose();tube.dispose();for(const m of Object.values(materials))m.dispose()}};
}
