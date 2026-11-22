import {createBenchPose} from './supino.js';
import {squatArm} from './barra-costas.js';
// Experimental full-body geometric rig, isolated from anatomy-motion.js.
// Rule tables and sphere/PCA math adapted from Charleeh/ecorche tools (MIT).
// Source commit 320805e06aee51e2e6f6b22533eb2a59d43f2d4d.
// Changes: current-GLB landmarks, live THREE skinning, elbow correction, poses.
/*
MIT License
Copyright (c) 2026 Charleeh

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

const sideB = (n, s) => (['clavicle', 'upperarm', 'forearm', 'hand', 'thigh', 'shin', 'foot'].includes(n) ? n + '_' + (s === 'R' ? 'R' : 'L') : n);
const MB = [
  [/sternocleidomastoid/, ['head', 'neck', 'chest']],
  [/descending part of trapezius/, ['head', 'neck', 'chest', 'clavicle']],
  [/transverse part of trapezius/, ['neck', 'chest', 'clavicle']],
  [/ascending part of trapezius/, ['spineT', 'chest', 'clavicle']],
  [/levator scapulae/, ['neck', 'clavicle']],
  [/splenius capitis|longissimus capitis|semispinalis capitis/, ['head', 'neck', 'chest']],
  [/splenius cervicis|longissimus cervicis|iliocostalis cervicis|semispinalis cervicis/, ['neck', 'chest']],
  [/sternohyoid|omohyoid|sternothyroid|thyrohyoid/, ['head', 'neck', 'chest']],
  [/deltoid/, ['clavicle', 'upperarm']],
  [/infraspinatus|supraspinatus|teres major|teres minor/, ['clavicle', 'upperarm']],
  [/pectoralis major/, ['chest', 'clavicle', 'upperarm']],
  [/pectoralis minor|subclavius/, ['chest', 'clavicle']],
  [/serratus anterior/, ['chest', 'spineT', 'clavicle']],
  [/external oblique|internal oblique|transversus abdominis|linea alba|rectus abdominis/, ['chest', 'spineT', 'spineL', 'pelvis']],
  [/quadratus lumborum|thoracolumbar fascia|multifidus lumborum/, ['pelvis', 'spineL', 'spineT']],
  [/multifidus cervicis/, ['head', 'neck', 'chest']],
  [/multifidus thoracis/, ['neck', 'chest', 'spineT', 'spineL']],
  [/rotatores/, ['neck', 'chest', 'spineT', 'spineL', 'pelvis']],
  [/subscapularis/, ['clavicle', 'upperarm']],
  [/latissimus/, ['pelvis', 'spineL', 'spineT', 'chest', 'clavicle', 'upperarm']],
  [/biceps brachii|long head of triceps/, ['clavicle', 'upperarm', 'forearm']],
  [/triceps|brachialis|anconeus/, ['upperarm', 'forearm']],
  [/coracobrachialis/, ['clavicle', 'upperarm']],
  [/brachioradialis|pronator teres|flexor carpi|palmaris|flexor digitorum superficialis|extensor carpi|^extensor digitorum$|extensor digiti minimi|supinator/, ['upperarm', 'forearm', 'hand']],
  [/abductor pollicis longus|extensor pollicis|flexor digitorum profundus|flexor pollicis longus|pronator quadratus|extensor indicis/, ['forearm', 'hand']],
  [/gluteus|piriformis|gemellus|obturator|quadratus femoris|pectineus|adductor brevis|adductor longus|adductor minimus/, ['pelvis', 'thigh']],
  [/adductor magnus/, ['pelvis', 'thigh', 'shin']],
  [/tensor fasciae latae|iliotibial tract|sartorius|rectus femoris|gracilis|long head of biceps femoris|semitendinosus|semimembranosus/, ['pelvis', 'thigh', 'shin']],
  [/vastus|short head of biceps femoris|popliteus/, ['thigh', 'shin']],
  [/gastrocnemius|plantaris/, ['thigh', 'shin', 'foot']],
  [/soleus|calcaneal tendon|tibialis|extensor digitorum longus|extensor hallucis longus|fibularis|flexor digitorum longus|flexor hallucis longus/, ['shin', 'foot']],
  [/rhomboid/, ['chest', 'clavicle']],
  [/serratus posterior superior/, ['neck', 'chest']],
  [/serratus posterior inferior/, ['spineT', 'spineL']],
  [/iliocostalis lumborum|longissimus thoracis/, ['pelvis', 'spineL', 'spineT', 'chest']],
  [/iliocostalis thoracis|spinalis thoracis|semispinalis thoracis/, ['spineL', 'spineT', 'chest']],
  [/scalenus/, ['neck', 'chest']],
  [/rectus capitis|obliquus capitis/, ['head', 'neck']],
  [/external intercostal/, ['chest', 'spineT', 'spineL']],
  [/psoas major/, ['spineT', 'spineL', 'pelvis', 'thigh']],
  [/iliacus/, ['pelvis', 'thigh']],
  [/temporalis|masseter|pterygoid|frontalis|orbicularis|zygomaticus|levator labii|depressor|risorius|mentalis|procerus|nasalis|corrugator/, ['head']],
  [/flexor retinaculum/, ['forearm', 'hand']],
  [/of hand$|pollicis brevis|opponens pollicis|adductor pollicis/, ['hand']],
  [/of foot$|hallucis brevis|abductor hallucis|adductor hallucis|digitorum brevis/, ['foot']]
];

const vertebraIndex = (name) => { const n = name.toLowerCase(); if (n === 'atlas') return 1; if (n === 'axis') return 2; const ord = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth']; const m = n.match(/^(\w+) (cervical|thoracic|lumbar) vertebra$/); if (!m) return 0; const k = ord.indexOf(m[1]) + 1; return m[2] === 'cervical' ? k : m[2] === 'thoracic' ? 7 + k : 19 + k; };
const discIndex = (name) => { const m = name.toLowerCase().match(/intervertebral disk of (.*)$/); if (!m) return 0; return vertebraIndex(m[1]); };
// spine weights per vertebra level (1..24)
// levels: 1-7 cervical (C1..C7), 8-19 thoracic (T1..T12), 20-24 lumbar (L1..L5), 25 = sacrum
const SPW = (lvl) => {
  if (lvl <= 6) return { neck: 1 };
  if (lvl === 7) return { neck: 0.6, chest: 0.4 };
  if (lvl <= 13) return { chest: 1 };
  if (lvl === 14) return { chest: 0.7, spineT: 0.3 };
  if (lvl === 15) return { spineT: 0.7, chest: 0.3 };
  if (lvl <= 18) return { spineT: 1 };
  if (lvl === 19) return { spineT: 0.6, spineL: 0.4 };
  if (lvl === 20) return { spineL: 0.7, spineT: 0.3 };
  if (lvl <= 23) return { spineL: 1 };
  if (lvl === 24) return { spineL: 0.6, pelvis: 0.4 };
  return { pelvis: 1 };
};
function boneRule(p) {
  const n = p.base, s = p.side;
  if (/tooth/.test(n)) return { w: { head: 1 }, cls: 3 };
  if (/^(sclera|cornea)$/.test(n)) return { w: { head: 1 }, cls: 2 };
  if (/nasal cartilage|alar cartilage|external ear/.test(n)) return { w: { head: 1 }, cls: 1 };
  if (/frontal bone|parietal|occipital|temporal bone|sphenoid|ethmoid|maxilla|zygomatic|nasal bone|mandible|lacrimal|palatine|vomer|nasal concha/.test(n)) return { w: { head: 1 }, cls: 0 };
  const lv = vertebraIndex(p.name); if (lv) return { w: SPW(lv), cls: 0, vert: lv };
  const dl = discIndex(p.name); if (dl) { const a = SPW(dl), b = SPW(dl + 1); const w = {}; for (const [k, v] of Object.entries(a)) w[k] = (w[k] || 0) + v / 2; for (const [k, v] of Object.entries(b)) w[k] = (w[k] || 0) + v / 2; return { w, cls: 1, vert: dl }; }
  const rib = n.match(/^(\w+) rib$/); if (rib) { const k = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'].indexOf(rib[1]) + 1; return { w: k <= 10 ? { chest: 1 } : { spineT: 1 }, cls: 0 }; }
  if (/costal cartilage/.test(n)) return { w: { chest: 1 }, cls: 1 };
  if (/manubrium|body of sternum|xiphoid/.test(n)) return { w: { chest: 1 }, cls: 0 };
  if (/clavicle|scapula/.test(n)) return { w: { [sideB('clavicle', s)]: 1 }, cls: 0 };
  if (/humerus/.test(n)) return { w: { [sideB('upperarm', s)]: 1 }, cls: 0 };
  if (/radius|ulna/.test(n)) return { w: { [sideB('forearm', s)]: 1 }, cls: 0 };
  if (/scaphoid|lunate|triquetrum|pisiform|trapezium|trapezoid|capitate|hamate|metacarpal|thumb|finger/.test(n)) return { w: { [sideB('hand', s)]: 1 }, cls: 0 };
  if (/hip bone|sacrum|coccyx/.test(n)) return { w: { pelvis: 1 }, cls: 0 };
  if (/femur/.test(n)) return { w: { [sideB('thigh', s)]: 1 }, cls: 0 };
  if (/patella|tibia|fibula/.test(n)) return { w: { [sideB('shin', s)]: 1 }, cls: 0 };
  if (/talus|calcaneus|navicular|cuboid|cuneiform|metatarsal|toe/.test(n)) return { w: { [sideB('foot', s)]: 1 }, cls: 0 };
  throw new Error('no bone rule ' + p.name);
}

function sphereFit(pts) {
  const A = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], B = [0, 0, 0, 0];
  for (const [x, y, z] of pts) {
    const row = [2 * x, 2 * y, 2 * z, 1], rhs = x * x + y * y + z * z;
    for (let i = 0; i < 4; i++) { B[i] += row[i] * rhs; for (let j = 0; j < 4; j++) A[i][j] += row[i] * row[j]; }
  }
  const s = solve4(A, B);
  return { c: [s[0], s[1], s[2]], r: Math.sqrt(s[3] + s[0] * s[0] + s[1] * s[1] + s[2] * s[2]) };
}
function solve4(A, B) {
  const M = A.map((r, i) => [...r, B[i]]);
  for (let i = 0; i < 4; i++) {
    let p = i; for (let k = i + 1; k < 4; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
    [M[i], M[p]] = [M[p], M[i]];
    for (let k = i + 1; k < 4; k++) { const f = M[k][i] / M[i][i]; for (let j = i; j < 5; j++) M[k][j] -= f * M[i][j]; }
  }
  const x = [0, 0, 0, 0];
  for (let i = 3; i >= 0; i--) { let s = M[i][4]; for (let j = i + 1; j < 4; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
  return x;
}

function pca(pos) {
  const n = pos.length / 3; let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < pos.length; i += 3) { cx += pos[i]; cy += pos[i + 1]; cz += pos[i + 2]; }
  cx /= n; cy /= n; cz /= n;
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < pos.length; i += 3) {
    const d = [pos[i] - cx, pos[i + 1] - cy, pos[i + 2] - cz];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a][b] += d[a] * d[b];
  }
  const { vecs, vals } = jacobi3(C);
  return { c: [cx, cy, cz], e: vecs, vals };
}
function jacobi3(A0) {
  const A = A0.map((r) => r.slice()); const V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 50; sweep++) {
    let off = Math.abs(A[0][1]) + Math.abs(A[0][2]) + Math.abs(A[1][2]); if (off < 1e-15) break;
    for (let p = 0; p < 2; p++) for (let q = p + 1; q < 3; q++) {
      if (Math.abs(A[p][q]) < 1e-18) continue;
      const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
      for (let k = 0; k < 3; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
      for (let k = 0; k < 3; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
    }
  }
  const vals = [A[0][0], A[1][1], A[2][2]];
  const order = [0, 1, 2].sort((a, b) => vals[b] - vals[a]);
  return { vals: order.map((i) => vals[i]), vecs: order.map((i) => [V[0][i], V[1][i], V[2][i]]) };
}

const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
const smoother = x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
const nameOf=o=>String(o.userData?.name||o.name||'').replaceAll('_',' ').toLowerCase();

export function createFullRig(root,T) {
  root.updateMatrixWorld(true);
  const inv=root.matrixWorld.clone().invert(),records=[];
  root.traverse(mesh=>{
    if(!mesh.isMesh||mesh.isSkinnedMesh||!mesh.geometry?.getAttribute('position'))return;
    const attr=mesh.geometry.getAttribute('position'),mat=inv.clone().multiply(mesh.matrixWorld),points=[],flat=new Float32Array(attr.count*3),box=new T.Box3();
    for(let i=0;i<attr.count;i++){const v=new T.Vector3(attr.getX(i),attr.getY(i),attr.getZ(i)).applyMatrix4(mat);points.push(v);flat.set(v.toArray(),i*3);box.expandByPoint(v);}
    const name=nameOf(mesh),center=box.getCenter(new T.Vector3());
    records.push({mesh,points,flat,box,center,name,base:name.replace(/\b(left|right)\s+/g,'').replace(/\s*\(\d+\)$/,''),side:Math.abs(center.x)<.008?'C':center.x>0?'L':'R'});
  });
  const get=n=>{const r=records.find(r=>r.name===n.toLowerCase());if(!r)throw Error('Missing rig landmark '+n);return r;};
  const centroid=(r,fn)=>{const c=new T.Vector3();let n=0;for(const p of r.points)if(fn(p)){c.add(p);n++;}if(!n)throw Error('Empty landmark '+r.name);return c.multiplyScalar(1/n);};
  const mid=(a,b)=>a.clone().add(b).multiplyScalar(.5),cx=p=>new T.Vector3(0,p.y,p.z),mx=p=>new T.Vector3(-p.x,p.y,p.z);
  const sphere=(r,fn)=>new T.Vector3(...sphereFit(r.points.filter(fn).map(p=>p.toArray())).c);
  const femur=get('Left femur'),tibia=get('Left tibia'),fibula=get('Left fibula'),talus=get('Left talus'),hum=get('Left humerus'),rad=get('Left radius'),uln=get('Left ulna');
  const J={};
  J.hip=sphere(femur,p=>p.y>femur.box.max.y-.048&&p.x<femur.box.min.x+.042);
  J.knee=mid(centroid(femur,p=>p.y<femur.box.min.y+.022),centroid(tibia,p=>p.y>tibia.box.max.y-.016));
  const mal=mid(centroid(tibia,p=>p.y<tibia.box.min.y+.009),centroid(fibula,p=>p.y<fibula.box.min.y+.009));
  const tal=centroid(talus,p=>p.y>talus.box.max.y-.010);tal.y-=.006;J.ankle=mid(mal,tal);
  const mt=get('Left second metatarsal bone');J.toe=centroid(mt,p=>p.z>mt.box.max.z-.012);
  J.shoulder=sphere(hum,p=>p.y>hum.box.max.y-.044&&p.x<hum.box.min.x+.044);
  J.elbow=centroid(hum,p=>p.y<hum.box.min.y+.018);
  J.wrist=mid(centroid(rad,p=>p.y<rad.box.min.y+.010),centroid(uln,p=>p.y<uln.box.min.y+.010));
  J.finger=centroid(get('Distal phalanx of left middle finger'),()=>true);
  const mc=get('Left third metacarpal bone');J.hand=centroid(mc,p=>p.y<mc.box.min.y+.008);
  const clav=get('Left clavicle');J.clav=centroid(clav,p=>p.x<clav.box.min.x+.012);
  const VNAMES=['Atlas','Axis','Third cervical vertebra','Fourth cervical vertebra','Fifth cervical vertebra','Sixth cervical vertebra','Seventh cervical vertebra','First thoracic vertebra','Second thoracic vertebra','Third thoracic vertebra','Fourth thoracic vertebra','Fifth thoracic vertebra','Sixth thoracic vertebra','Seventh thoracic vertebra','Eighth thoracic vertebra','Ninth thoracic vertebra','Tenth thoracic vertebra','Eleventh thoracic vertebra','Twelfth thoracic vertebra','First lumbar vertebra','Second lumbar vertebra','Third lumbar vertebra','Fourth lumbar vertebra','Fifth lumbar vertebra'];
  J.vb=VNAMES.map(n=>{const r=get(n);return centroid(r,p=>n==='Atlas'||p.z>r.box.max.z-.42*(r.box.max.z-r.box.min.z));});
  const sac=get('Sacrum');J.sacTop=centroid(sac,p=>p.y>sac.box.max.y-.014&&p.z>(sac.box.min.z+sac.box.max.z)/2);
  J.skullTop=Math.max(get('Frontal bone').box.max.y,get('Left parietal bone').box.max.y);
  const V=J.vb,L5S1=cx(mid(J.sacTop,V[23])),T12L1=cx(mid(V[18],V[19])),T7T8=cx(mid(V[13],V[14])),C7T1=cx(mid(V[6],V[7]));
  const atlasTop=cx(V[0].clone().add(new T.Vector3(0,.008,0))),hipMid=cx(J.hip);
  const B=[
    ['pelvis',-1,hipMid.clone().add(new T.Vector3(0,.07,-.01)),L5S1],['spineL',0,L5S1,T12L1],['spineT',1,T12L1,T7T8],['chest',2,T7T8,C7T1],['neck',3,C7T1,atlasTop],['head',4,atlasTop,new T.Vector3(0,J.skullTop,atlasTop.z+.012)],
    ['clavicle_L',3,J.clav,J.shoulder],['upperarm_L',6,J.shoulder,J.elbow],['forearm_L',7,J.elbow,J.wrist],['hand_L',8,J.wrist,J.finger],
    ['clavicle_R',3],['upperarm_R',10],['forearm_R',11],['hand_R',12],['thigh_L',0,J.hip,J.knee],['shin_L',14,J.knee,J.ankle],['foot_L',15,J.ankle,J.toe],['thigh_R',0],['shin_R',17],['foot_R',18]
  ];
  for(const b of B)if(!b[2]){const src=B.find(x=>x[0]===b[0].replace('_R','_L'));b[2]=mx(src[2]);b[3]=mx(src[3]);}
  const BI=Object.fromEntries(B.map((b,i)=>[b[0],i])),prox={};
  const seg=n=>[B[BI[n]][2],B[BI[n]][3]];for(const b of B)prox[b[0]]=[[b[2],b[3]]];
  const hb=get('Left hip bone'),crest=hb.points.reduce((a,p)=>p.y>a.y?p:a,hb.points[0]).clone();
  const pubis=centroid(hb,p=>p.x<hb.box.min.x+.012&&p.z>hb.box.max.z-.03);
  const scap=get('Left scapula'),inferior=scap.points.reduce((a,p)=>p.y<a.y?p:a,scap.points[0]).clone();
  const manu=get('Manubrium'),xiph=get('Xiphoid process'),sternTop=new T.Vector3(0,manu.box.max.y,manu.box.max.z-.01),xiphBot=new T.Vector3(0,xiph.box.min.y,xiph.box.max.z-.005);
  const v=(x,y,z)=>new T.Vector3(x,y,z),rib=v(.125,1.3,-.005),ribLow=v(.13,1.17,0);
  prox.pelvis=[[J.hip,mx(J.hip)],[L5S1,J.hip],[L5S1,mx(J.hip)],[crest,J.hip],[mx(crest),mx(J.hip)],[crest,L5S1],[mx(crest),L5S1],[pubis,J.hip],[mx(pubis),mx(J.hip)]];
  prox.chest=[seg('chest'),[sternTop,xiphBot],[rib,ribLow],[mx(rib),mx(ribLow)],[sternTop,rib],[sternTop,mx(rib)]];
  prox.spineT=[seg('spineT'),[ribLow,v(.12,1.1,0)],[mx(ribLow),v(-.12,1.1,0)],[xiphBot,ribLow],[xiphBot,mx(ribLow)]];
  prox.spineL=[seg('spineL'),[v(.06,1.15,.04),v(.07,1.04,.03)],[v(-.06,1.15,.04),v(-.07,1.04,.03)]];
  prox.clavicle_L=[seg('clavicle_L'),[J.shoulder,inferior],[v(.07,1.36,-.08),inferior]];prox.clavicle_R=prox.clavicle_L.map(([a,b])=>[mx(a),mx(b)]);
  const calc=get('Left calcaneus'),heel=calc.points.reduce((a,p)=>p.z<a.z?p:a,calc.points[0]).clone();
  prox.foot_L=[seg('foot_L'),[J.ankle,heel],[heel,J.toe]];prox.foot_R=prox.foot_L.map(([a,b])=>[mx(a),mx(b)]);
  prox.head=[seg('head'),[v(0,1.6,.06),v(0,1.56,.08)],[v(0,1.63,-.06),v(0,1.64,.05)]];
  function distance(p,a,b){const ab=b.clone().sub(a),t=clamp(p.clone().sub(a).dot(ab)/Math.max(ab.lengthSq(),1e-12),0,1);return p.distanceTo(a.clone().addScaledVector(ab,t));}
  function weights(p,names){const ds=names.map(n=>Math.min(...prox[n].map(([a,b])=>distance(p,a,b)))),d0=Math.min(...ds);let w=ds.map((d,i)=>[BI[names[i]],Math.exp(-(d-d0)/.03)]).sort((a,b)=>b[1]-a[1]).slice(0,4);const sum=w.reduce((s,a)=>s+a[1],0);w=w.map(([i,w])=>[i,w/sum]).filter(x=>x[1]>=1/48);const total=w.reduce((s,a)=>s+a[1],0);return w.map(([i,w])=>[i,w/total]);}
  const bones=B.map(([n,,h])=>{const b=new T.Bone();b.name='FullRig_'+n;b.position.copy(h);root.add(b);return b;}),replaced=[],unmapped=[],fiberFrames=[];
  const report={version:'full-rig-experimental-2',source:'20-bone schema and anatomical muscle rules adapted from Charleeh/ecorche MIT pipeline; pivots re-derived from current GLB.',meshCount:records.length,boneCount:20,unmapped,limits:['Approximate distance-based linear-blend skinning; not measured attachment or activation data.','No soft-tissue collision or volume conservation.','Scapula/clavicle and radius/ulna are grouped; no separate scapular sliding, pronation or finger joints.','GLB landmarks are re-estimated from simplified bones, not byte-identical to the source OBJ build.'],joints:Object.fromEntries(Object.entries(J).map(([k,p])=>[k,k==='vb'?p.map(x=>x.toArray()):p.toArray?p.toArray():p])),bones:B.map(([name,parent,h,t])=>({name,parent,head:h.toArray(),tail:t.toArray()})),parts:[],fiberFrames};
  for(const r of records){
    const isBone=r.mesh.userData.layer==='skeleton';let rigid=null,candidates=null;
    if(isBone){try{rigid=Object.entries(boneRule(r).w).map(([n,w])=>[BI[n],w]);}catch(e){unmapped.push({name:r.name,error:e.message});rigid=[[0,1]];}}
    else{const rule=MB.find(([rx])=>rx.test(r.base));if(!rule){unmapped.push({name:r.name,error:'No muscle rule'});candidates=['pelvis'];}else candidates=rule[1].map(n=>sideB(n,r.side==='C'?'L':r.side));const frame=pca(r.flat);fiberFrames.push({name:r.name,center:frame.c,axes:frame.e,units:'metres; PCA illustration, not measured fascicles'});}
    const n=r.points.length,idx=new Uint16Array(n*4),wgt=new Float32Array(n*4),geometry=r.mesh.geometry.clone();
    const elbowFix=/brachioradialis|extensor carpi radialis longus/.test(r.base);
    for(let i=0;i<n;i++){let w=rigid;
      if(!w){const names=r.side==='C'&&r.points[i].x<0?candidates.map(n=>n.replace('_L','_R')):candidates;w=weights(r.points[i],names);
        if (r.base.includes('latissimus')) {
          // The broad lumbar origin stays with the trunk. Only the axillary end
          // follows the upper arm, across a continuous transition.
          const point=r.points[i];
          const arm=smoother((point.y-1.10)/.235) * smoother((Math.abs(point.x)-.066)/.11);
          const hip=(1-arm)*(1-smoother((point.y-.98)/.21));
          w=[[BI.chest,1-arm-hip],[BI.pelvis,hip],[BI[sideB('upperarm',r.side)],arm]];
        }
        if (/gluteus maximus|gluteus medius/.test(r.base)) {
          // Gradual transfer from the iliac crest to the insertion on the femur.
          const point=r.points[i];
          const maximus=r.base.includes('maximus');
          const y=point.y-(maximus?.30:.22)*(Math.abs(point.x)-.08);
          const wThigh=1-smoother((y-(maximus?.774:.858))/(maximus?.215:.135));
          w=[[BI.pelvis,1-wThigh],[BI[sideB('thigh',r.side)],wThigh]];
        }
        if(elbowFix){const side=r.side==='R'?'R':'L',e=B[BI['forearm_'+side]][2],len=B[BI['upperarm_'+side]][2].distanceTo(e);const f=1-smoother((r.points[i].y-(e.y-len*.15))/(len*.25));w=[[BI['upperarm_'+side],1-f],[BI['forearm_'+side],f]];}
      }
      for(let k=0;k<w.length;k++){idx[i*4+k]=w[k][0];wgt[i*4+k]=w[k][1];}
    }
    geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(idx,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(wgt,4));
    const o=r.mesh,s=new T.SkinnedMesh(geometry,o.material);s.name=o.name;s.userData={...o.userData,fullRigVersion:report.version};s.position.copy(o.position);s.quaternion.copy(o.quaternion);s.scale.copy(o.scale);s.matrix.copy(o.matrix);s.matrixAutoUpdate=o.matrixAutoUpdate;s.visible=o.visible;s.castShadow=o.castShadow;s.receiveShadow=o.receiveShadow;s.layers.mask=o.layers.mask;s.renderOrder=o.renderOrder;s.frustumCulled=false;s.customDepthMaterial=o.customDepthMaterial;s.customDistanceMaterial=o.customDistanceMaterial;s.onBeforeRender=o.onBeforeRender;s.onAfterRender=o.onAfterRender;
    const parent=o.parent;parent.remove(o);parent.add(s);replaced.push({original:o,skinned:s,parent});report.parts.push({name:r.name,vertices:n,bones:rigid?rigid.map(([i])=>B[i][0]):candidates,elbowCorrection:elbowFix});
  }
  root.updateMatrixWorld(true);const skeleton=new T.Skeleton(bones);skeleton.calculateInverses();for(const r of replaced)r.skinned.bind(skeleton,r.skinned.matrixWorld.clone());
  const X=new T.Vector3(1,0,0),restDir=B.map(b=>b[3].clone().sub(b[2]).normalize());let disposed=false;
  function applyTargets(targets){for(let i=0;i<B.length;i++){const [h,t,q]=targets[i];bones[i].position.copy(h);if(q)bones[i].quaternion.copy(q);else bones[i].quaternion.setFromUnitVectors(restDir[i],t.clone().sub(h).normalize());}root.updateMatrixWorld(true);skeleton.update();}
  function solveKnee(hip,ankle,restKnee,L1,L2){
    // Intersect the two limb-length spheres in the knee's forward plane.
    // Its measured lateral offset is preserved even near full extension.
    const x=restKnee.x;
    const thigh2=L1*L1-(hip.x-x)**2,shin2=L2*L2-(ankle.x-x)**2;
    const dy=ankle.y-hip.y,dz=ankle.z-hip.z,d=Math.hypot(dy,dz);
    const along=(thigh2-shin2+d*d)/(2*d);
    const offset=Math.sqrt(Math.max(0,thigh2-along*along));
    return v(x,hip.y+(dy*along+dz*offset)/d,hip.z+(dz*along-dy*offset)/d);
  }
  const rack = {};
  for(const side of ['L','R']){
    const u=BI['upperarm_'+side], f=BI['forearm_'+side], h=BI['hand_'+side];
    const poses=squatArm(side==='L'?1:-1,B[u][2],B[f][2],B[h][2],B[h][3]);
    rack[side]=[u,f,h].map((index,i)=>[index,...poses[i]]);
  }
  const benchPose=createBenchPose(B,BI);
  function setPose({kind='curl',phase=0}={}){
    if(disposed)return;const a=(1-Math.cos(clamp(Number(phase)||0,0,1)*2*Math.PI))*.5;
    const targets=kind==='bench'?benchPose(a):B.map(b=>[b[2].clone(),b[3].clone(),new T.Quaternion()]);
    if(kind==='curl'){
      const q=new T.Quaternion().setFromAxisAngle(X,-a*112*Math.PI/180);
      for(const side of ['L','R']){const f=BI['forearm_'+side],h=BI['hand_'+side],e=B[f][2];for(const i of [f,h])targets[i]=[B[i][2].clone().sub(e).applyQuaternion(q).add(e),B[i][3].clone().sub(e).applyQuaternion(q).add(e),q.clone()];}
    }else if(kind==='squat'){
      const drop=v(0,-.468*a,-.259*a),qp=new T.Quaternion().setFromAxisAngle(X,a*10*Math.PI/180),qt=new T.Quaternion().setFromAxisAngle(X,a*38*Math.PI/180);
      const pelvisPoint=p=>p.clone().sub(hipMid).applyQuaternion(qp).add(hipMid).add(drop),spineAnchor=pelvisPoint(L5S1),torsoPoint=p=>p.clone().sub(L5S1).applyQuaternion(qt).add(spineAnchor);
      targets[0]=[...B[0].slice(2).map(pelvisPoint),qp.clone()];for(let i=1;i<14;i++)targets[i]=[...B[i].slice(2).map(torsoPoint),qt.clone()];
      for(const side of ['L','R']){
        const th=BI['thigh_'+side],sh=BI['shin_'+side],ft=BI['foot_'+side],hip=pelvisPoint(B[th][2]),ankle=B[sh][3].clone(),L1=B[th][2].distanceTo(B[th][3]),L2=B[sh][2].distanceTo(B[sh][3]);
        const knee=solveKnee(hip,ankle,B[th][3],L1,L2);targets[th]=[hip,knee];targets[sh]=[knee,ankle];targets[ft]=B[ft].slice(2).map(p=>p.clone());
        for(const [index,head,tail,rotation] of rack[side]){
          targets[index]=[torsoPoint(head),torsoPoint(tail),qt.clone().multiply(rotation)];
        }
      }
    }else if(kind!=='bench')throw Error('Unsupported experimental pose '+kind);
    applyTargets(targets);report.lastPose={kind,phase,targets:targets.map(([h,t],i)=>({head:h.toArray(),tail:t.toArray(),rotation:bones[i].quaternion.toArray()}))};
  }
  function dispose(){if(disposed)return;setPose({phase:0});disposed=true;for(const r of replaced){r.parent.remove(r.skinned);r.parent.add(r.original);r.skinned.geometry.dispose();}for(const b of bones)root.remove(b);skeleton.dispose();root.updateMatrixWorld(true);}
  setPose({phase:0});return {setPose,reset:()=>setPose({phase:0}),dispose,report};
}
