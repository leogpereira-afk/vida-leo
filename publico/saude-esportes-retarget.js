/* Anatomical retargeting. Original vector/quaternion/IK implementation; no runtime dependencies. */
export const REST_BONES = [
  {
    "name": "spineLower",
    "start": [
      -2.6792935222994746e-19,
      0.9666403528341714,
      0.006950284017779
    ],
    "end": [
      3.572391363065966e-19,
      1.1297454994765836,
      -0.01634088997957818
    ]
  },
  {
    "name": "spineMid",
    "start": [
      3.572391363065966e-19,
      1.1297454994765836,
      -0.01634088997957818
    ],
    "end": [
      0,
      1.3344596797720996,
      -0.04767380000343226
    ]
  },
  {
    "name": "spineUpper",
    "start": [
      0,
      1.3344596797720996,
      -0.04767380000343226
    ],
    "end": [
      -1.3877787807814457e-17,
      1.441133668548678,
      0.02205299377048618
    ]
  },
  {
    "name": "head",
    "start": [
      0,
      1.5490895985996467,
      0.015475965746254572
    ],
    "end": [
      -8.930978407664914e-20,
      1.6483705445247212,
      0.048394570197868594
    ]
  },
  {
    "name": "upperArmLeft",
    "start": [
      0.19375847334008345,
      1.441133668548678,
      0.022052993770486185
    ],
    "end": [
      0.3658281992757976,
      1.2438369858076919,
      0.01979672564397385
    ]
  },
  {
    "name": "lowerArmLeft",
    "start": [
      0.3658281992757976,
      1.2438369858076919,
      0.01979672564397385
    ],
    "end": [
      0.5027346364400819,
      1.1136349985412985,
      0.21296699902181196
    ]
  },
  {
    "name": "upperArmRight",
    "start": [
      -0.19375847334008348,
      1.441133668548678,
      0.02205299377048618
    ],
    "end": [
      -0.3658281992757977,
      1.2438369858076919,
      0.01979672564397385
    ]
  },
  {
    "name": "lowerArmRight",
    "start": [
      -0.3658281992757977,
      1.2438369858076919,
      0.01979672564397385
    ],
    "end": [
      -0.5027346364400819,
      1.1136349985412983,
      0.21296699902181196
    ]
  },
  {
    "name": "upperLegLeft",
    "start": [
      0.11302191484614993,
      0.9610080486005047,
      -0.003943642635273121
    ],
    "end": [
      0.1570532511884128,
      0.5222675087093066,
      0.0316624049698821
    ]
  },
  {
    "name": "lowerLegLeft",
    "start": [
      0.1570532511884128,
      0.5222675087093066,
      0.0316624049698821
    ],
    "end": [
      0.2021837620771911,
      0.07447358034013492,
      0.019476240325376263
    ]
  },
  {
    "name": "upperLegRight",
    "start": [
      -0.11302191484614993,
      0.9610080486005047,
      -0.003943642635273121
    ],
    "end": [
      -0.1570532511884128,
      0.5222675087093066,
      0.0316624049698821
    ]
  },
  {
    "name": "lowerLegRight",
    "start": [
      -0.1570532511884128,
      0.5222675087093066,
      0.0316624049698821
    ],
    "end": [
      -0.2021837620771911,
      0.07447358034013492,
      0.019476240325376263
    ]
  },
  {
    "name": "footLeft",
    "start": [
      0.2021837620771911,
      0.07447358034013492,
      0.019476240325376263
    ],
    "end": [
      0.20456745207736268,
      0.013504144428618,
      0.23688369858076924
    ]
  },
  {
    "name": "footRight",
    "start": [
      -0.2021837620771911,
      0.07447358034013492,
      0.019476240325376263
    ],
    "end": [
      -0.20456745207736274,
      0.013504144428618,
      0.23688369858076924
    ]
  },
  {
    "name": "clavicleLeft",
    "start": [
      0.02377769387860171,
      1.4716557121037912,
      0.027543718144531597
    ],
    "end": [
      0.19375847334008345,
      1.441133668548678,
      0.022052993770486185
    ]
  },
  {
    "name": "elbowLeft",
    "start": [
      0.3658281992757976,
      1.2438369858076919,
      0.01979672564397385
    ],
    "end": [
      0.5027346364400818,
      1.1136349985412985,
      0.2129669990218119
    ]
  },
  {
    "name": "forearmTwistLeft",
    "start": [
      0.3658281992757976,
      1.2438369858076919,
      0.01979672564397385
    ],
    "end": [
      0.5027346364400818,
      1.1136349985412985,
      0.2129669990218119
    ]
  },
  {
    "name": "clavicleRight",
    "start": [
      -0.02377769387860171,
      1.471655712103791,
      0.0275437181445316
    ],
    "end": [
      -0.19375847334008348,
      1.441133668548678,
      0.02205299377048618
    ]
  },
  {
    "name": "elbowRight",
    "start": [
      -0.3658281992757977,
      1.2438369858076919,
      0.01979672564397385
    ],
    "end": [
      -0.5027346364400818,
      1.1136349985412983,
      0.21296699902181188
    ]
  },
  {
    "name": "forearmTwistRight",
    "start": [
      -0.3658281992757977,
      1.2438369858076919,
      0.01979672564397385
    ],
    "end": [
      -0.5027346364400818,
      1.1136349985412983,
      0.21296699902181188
    ]
  },
  {
    "name": "shoulderCapLeft",
    "start": [
      0.19375847334008345,
      1.441133668548678,
      0.022052993770486185
    ],
    "end": [
      0.3658281992757976,
      1.2438369858076919,
      0.01979672564397385
    ]
  },
  {
    "name": "shoulderCapRight",
    "start": [
      -0.19375847334008348,
      1.441133668548678,
      0.02205299377048618
    ],
    "end": [
      -0.3658281992757977,
      1.2438369858076919,
      0.01979672564397385
    ]
  }
];

const EPS = 1e-8;
const add = (a,b) => a.map((x,i)=>x+b[i]);
const sub = (a,b) => a.map((x,i)=>x-b[i]);
const mul = (a,s) => a.map(x=>x*s);
const dot = (a,b) => a.reduce((s,x,i)=>s+x*b[i],0);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length = a => Math.hypot(...a);
const unit = (a,fallback=[0,1,0]) => length(a)>EPS ? mul(a,1/length(a)) : [...fallback];
const mix = (a,b,t) => a.map((x,i)=>x+(b[i]-x)*t);
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const identity = () => [0,0,0,1];
const conjugate = q => [-q[0],-q[1],-q[2],q[3]];
const qmul = (a,b) => [
  a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],
  a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],
  a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],
  a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]
];
const qnorm = q => mul(q,1/Math.hypot(...q));
function rotate(q,v) {
  const t=mul(cross(q.slice(0,3),v),2);
  return add(v,add(mul(t,q[3]),cross(q.slice(0,3),t)));
}
function between(a,b) {
  a=unit(a); b=unit(b);
  const d=clamp(dot(a,b),-1,1);
  if(d>1-EPS)return identity();
  if(d<-1+EPS){const axis=unit(cross(a,Math.abs(a[0])<.8?[1,0,0]:[0,0,1]));return [...axis,0];}
  return qnorm([...cross(a,b),1+d]);
}
const qaxis = (axis,angle) => [...mul(unit(axis),Math.sin(angle/2)),Math.cos(angle/2)];
function qslerp(a,b,t) {
  let d=dot(a,b); if(d<0){b=mul(b,-1);d=-d;}
  if(d>.9995)return qnorm(mix(a,b,t));
  const angle=Math.acos(clamp(d,-1,1)),s=Math.sin(angle);
  return add(mul(a,Math.sin((1-t)*angle)/s),mul(b,Math.sin(t*angle)/s));
}
// The forward hint removes the 180-degree ambiguity of a torso lying down.
function frameRotation(up,forwardHint) {
  const q=between([0,1,0],up),axis=unit(up);
  const from=unit(sub(rotate(q,[0,0,1]),mul(axis,dot(rotate(q,[0,0,1]),axis))),[0,0,1]);
  const to=unit(sub(forwardHint,mul(axis,dot(forwardHint,axis))),from);
  const angle=Math.atan2(dot(axis,cross(from,to)),clamp(dot(from,to),-1,1));
  return qnorm(qmul(qaxis(axis,angle),q));
}

const pelvis=REST_BONES[0].start;
const boneLength=i=>length(sub(REST_BONES[i].end,REST_BONES[i].start));
const shoulderCenter=REST_BONES[2].end;
const ANKLE_HEIGHT=REST_BONES[12].start[1];
const FOOT_PITCH=qaxis([1,0,0],Math.PI/4);
// MakeHuman hand-2 landmark relative to the wrist, not the forearm endpoint.
const PALM_OFFSET=[.02646384994251,-.0339379794408882,.0199087024420381];
const isFinitePoint=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);

function solveTwoBone(start,target,l1,l2,pole) {
  const axis=unit(sub(target,start),[0,-1,0]);
  const distance=clamp(length(sub(target,start)),Math.abs(l1-l2)+1e-5,l1+l2-1e-5);
  const along=(l1*l1-l2*l2+distance*distance)/(2*distance);
  let bend=sub(pole,mul(axis,dot(axis,pole)));
  if(length(bend)<EPS)bend=cross(axis,Math.abs(axis[0])<.8?[1,0,0]:[0,0,1]);
  bend=unit(bend);
  const height=Math.sqrt(Math.max(0,l1*l1-along*along));
  return {middle:add(start,add(mul(axis,along),mul(bend,height))),end:add(start,mul(axis,distance))};
}

function defaultState(p,kind) {
  const torso=between([0,1,0],sub(p.chest,p.hip));
  return {
    root:add(p.hip,[0,pelvis[1]-1,pelvis[2]]),torso,pelvisRotation:identity(),
    hands:{},armsPole:{},feet:{},legsPole:{},footRotation:{Left:identity(),Right:identity()},
    sourceSides:{Left:kind==='bike'?'l':'r',Right:kind==='bike'?'r':'l'},
    armSourceSides:{Left:'r',Right:'l'}
  };
}

function floorState(state,kind,q,phase) {
  const mirrored={Left:'l',Right:'r'};
  if(kind==='press') {
    state.root=[0,.60,-.05];
    state.torso=identity();state.pelvisRotation=identity();
    for(const [side,sign]of [['Left',1],['Right',-1]]){
      state.feet[side]=[sign*.20,ANKLE_HEIGHT,.45];
      state.legsPole[side]=[0,0,1];
    }
  } else if(kind==='bench'||kind==='bridge') {
    state.root=[0,.55,-.20];
    state.torso=frameRotation([0,0,1],[0,1,0]);
    if(kind==='bridge') {
      const y=.30+.24*q,dy=.57-y;
      const dz=Math.sqrt(Math.max(.01,length(sub(shoulderCenter,pelvis))**2-dy*dy));
      state.root=[0,y,.28-dz];
      state.torso=frameRotation([0,dy,dz],[0,1,0]);
    }
    state.pelvisRotation=state.torso;
    state.sourceSides=mirrored; state.armSourceSides=mirrored;
    for(const [side,sign]of [['Left',-1],['Right',1]]) {
      state.feet[side]=[sign*.23,ANKLE_HEIGHT,-.65];
      state.legsPole[side]=[0,1,0];
      state.footRotation[side]=qaxis([0,1,0],Math.PI);
      if(kind==='bench') {
        state.hands[side]=[sign*(.36-.14*q),.83+.25*q,.30];
        state.armsPole[side]=[sign,-.25,-.25];
      } else {
        state.hands[side]=[sign*.28,state.root[1]+.08,state.root[2]];
        state.armsPole[side]=[sign,-.1,-.2];
      }
    }
  } else if(kind==='plank') {
    state.root=[0,.30,-.22];
    state.torso=between([0,1,0],[0,.035,.475]);
    state.pelvisRotation=state.torso;
    for(const [side,sign]of [['Left',1],['Right',-1]]) {
      state.hands[side]=[sign*.22,.077,.52];
      state.armsPole[side]=[0,-1,-.1];
      state.feet[side]=[sign*.15,.211,-1.09];
      state.legsPole[side]=[0,1,0];
      state.footRotation[side]=FOOT_PITCH;
    }
  } else if(kind==='sideplank'||kind==='abduction') {
    state.root=[0,.31,-.20];
    state.torso=frameRotation([0,.22,.474],[1,0,0]);
    state.pelvisRotation=state.torso;
    state.feet.Right=[0,ANKLE_HEIGHT,-1.035];
    state.feet.Left=[0,.17+(kind==='abduction'?.48*q:0),-1.04];
    state.hands.Right=[.23,.078,.49];
    state.armsPole.Right=[-.4,-1,-.25];
    state.hands.Left=kind==='abduction'?[.12,.49,-.15]:[0,1.20,.30];
    state.armsPole.Left=[0,1,.1];
    state.legsPole.Left=[.25,.4,0];state.legsPole.Right=[.25,.4,0];
  } else if(kind==='burpee') {
    const upright={root:[0,pelvis[1],pelvis[2]],torso:identity(),hands:{Left:[.22,.93,.03],Right:[-.22,.93,.03]},feet:{Left:[.19,ANKLE_HEIGHT,0],Right:[-.19,ANKLE_HEIGHT,0]},foot:identity()};
    const crouch={root:[0,.47,-.13],torso:qaxis([1,0,0],1.45),hands:{Left:[.22,.078,.49],Right:[-.22,.078,.49]},feet:{Left:[.19,ANKLE_HEIGHT,0],Right:[-.19,ANKLE_HEIGHT,0]},foot:identity()};
    const high={root:[0,.51,0],torso:qaxis([1,0,0],Math.PI/2),hands:crouch.hands,feet:{Left:[.15,.211,-.84],Right:[-.15,.211,-.84]},foot:FOOT_PITCH};
    const frames=[upright,crouch,high,crouch,upright],f=Math.min(3,Math.floor(clamp(phase,0,1)*4));
    const t=(1-Math.cos((phase*4-f)*Math.PI))/2,a=frames[f],b=frames[f+1];
    state.root=mix(a.root,b.root,t); state.torso=qslerp(a.torso,b.torso,t);
    state.pelvisRotation=qslerp(identity(),state.torso,f===1?t:f===2?1-t:0);
    for(const side of ['Left','Right']) {
      state.hands[side]=mix(a.hands[side],b.hands[side],t);
      state.feet[side]=mix(a.feet[side],b.feet[side],t);
      state.armsPole[side]=[side==='Left'?1:-1,0,-.45];
      state.legsPole[side]=[0,0,1];
      state.footRotation[side]=qslerp(a.foot,b.foot,t);
    }
  }
  return state;
}

/** Rigid bone targets in athlete-model.json order. No per-bone scale is used. */
export function boneTargets(pose,options={}) {
  const p=pose?.joints||pose;
  for(const key of ['hip','chest','neck','head','sl','sr','el','er','wl','wr','hl','hr','kl','kr','al','ar']) {
    if(!isFinitePoint(p?.[key]))throw new TypeError('Invalid anatomical pose joint: '+key);
  }
  const kind=options.kind||pose.kind||'stand';
  const phase=clamp(options.phase??pose.phase??0,0,1),q=(1-Math.cos(phase*Math.PI*2))/2;
  const state=floorState(defaultState(p,kind),kind,q,phase);
  const point=(v,rotation=state.torso)=>add(state.root,rotate(rotation,sub(v,pelvis)));
  const targets=REST_BONES.map(b=>({name:b.name,head:point(b.start),tail:point(b.end),rotation:[...state.torso]}));
  const joints={hip:[...state.root],chest:point(REST_BONES[2].start),neck:point(REST_BONES[3].start),head:point(REST_BONES[3].end)};
  const anatomical={};
  const setBone=(index,head,tail,baseRotation)=>{
    const bone=REST_BONES[index],localTarget=rotate(conjugate(baseRotation),sub(tail,head));
    const rotation=qnorm(qmul(baseRotation,between(sub(bone.end,bone.start),localTarget)));
    targets[index]={name:bone.name,head:[...head],tail:[...tail],rotation};
  };
  for(const [side,arm,leg,foot,clav,elbow,twist,cap]of [
    ['Left',4,8,12,14,15,16,20],['Right',6,10,13,17,18,19,21]
  ]) {
    const armSide=state.armSourceSides[side],legSide=state.sourceSides[side];
    const shoulder=point(REST_BONES[arm].start);
    // The old schematic is taller; preserve the gesture relative to its shoulder.
    const armScale=(boneLength(arm)+boneLength(arm+1))/(.3354101966+.32);
    const hand=state.hands[side]||add(shoulder,mul(sub(p['w'+armSide],p['s'+armSide]),armScale));
    const armPole=state.armsPole[side]||sub(p['e'+armSide],p['s'+armSide]);
    let armIK=solveTwoBone(shoulder,hand,boneLength(arm),boneLength(arm+1),armPole);
    if(kind==='curl') {
      // A curl is an elbow hinge: the old wrist target reached the torso plane
      // at the top, making two-bone IK choose an arbitrary sideways bend.
      const upper=boneLength(arm),lower=boneLength(arm+1),sign=side==='Left'?1:-1;
      const elbowOffset=[sign*.036,-Math.sqrt(upper*upper-.036**2-.01**2),.01];
      const elbow=add(shoulder,rotate(state.torso,elbowOffset));
      const theta=(10+130*q)*Math.PI/180;
      const wrist=add(elbow,rotate(state.torso,[0,-lower*Math.cos(theta),lower*Math.sin(theta)]));
      armIK={middle:elbow,end:wrist};
    } else if(kind==='press') {
      const upper=boneLength(arm),lower=boneLength(arm+1),sign=side==='Left'?1:-1;
      const alpha=(105-97*q)*Math.PI/180;
      const elbow=add(shoulder,[sign*upper*Math.sin(alpha),upper*Math.cos(alpha),0]);
      const forward=.035-.023*q;
      const wrist=add(elbow,[0,Math.sqrt(lower*lower-forward*forward),forward]);
      armIK={middle:elbow,end:wrist};
    }
    setBone(arm,shoulder,armIK.middle,state.torso);
    setBone(arm+1,armIK.middle,armIK.end,state.torso);
    // Extra weights share exact pivots so elbow/shoulder surfaces never detach.
    setBone(elbow,armIK.middle,armIK.end,state.torso);
    setBone(twist,armIK.middle,armIK.end,state.torso);
    setBone(cap,shoulder,armIK.middle,state.torso);
    const hip=point(REST_BONES[leg].start,state.pelvisRotation);
    const sourceFoot=p['a'+legSide];
    const ankle=state.feet[side]||[sourceFoot[0],Math.max(ANKLE_HEIGHT,sourceFoot[1]+ANKLE_HEIGHT-.07),sourceFoot[2]];
    const legPole=state.legsPole[side]||[side==='Left'?.06:-.06,0,1];
    const legIK=solveTwoBone(hip,ankle,boneLength(leg),boneLength(leg+1),legPole);
    setBone(leg,hip,legIK.middle,state.pelvisRotation);
    setBone(leg+1,legIK.middle,legIK.end,state.pelvisRotation);
    const footQ=state.footRotation[side],footTail=add(legIK.end,rotate(footQ,sub(REST_BONES[foot].end,REST_BONES[foot].start)));
    targets[foot]={name:REST_BONES[foot].name,head:legIK.end,tail:footTail,rotation:[...footQ]};
    const palmOffset=[PALM_OFFSET[0]*(side==='Left'?1:-1),PALM_OFFSET[1],PALM_OFFSET[2]];
    const palm=add(armIK.end,rotate(targets[arm+1].rotation,palmOffset));
    anatomical[side]={shoulder,elbow:armIK.middle,wrist:armIK.end,palm,hip,knee:legIK.middle,ankle:legIK.end,toe:footTail};
    // Public shorthand keeps the historical world-side naming for equipment.
    for(const [prefix,value]of [['s',shoulder],['e',armIK.middle],['w',armIK.end]])joints[prefix+armSide]=value;
    joints['p'+armSide]=palm;
    for(const [prefix,value]of [['h',hip],['k',legIK.middle],['a',legIK.end]])joints[prefix+legSide]=value;
  }
  targets.joints=joints;
  targets.anatomical=anatomical;
  targets.kind=kind;
  targets.phase=phase;
  targets.equipment=retargetEquipment(pose.equipment||[],p,joints,kind);
  return targets;
}

function retargetEquipment(equipment,before,after,kind) {
  const attachment=value=>{
    if(!isFinitePoint(value))return value;
    for(const key of ['wl','wr'])if(length(sub(value,before[key]))<1e-5)return [...after['p'+key.slice(1)]];
    return [...value];
  };
  return equipment.map(item=>{
    const next={...item};
    for(const field of ['at','from','to'])if(item[field])next[field]=attachment(item[field]);
    const gripCenter=mix(after.pl,after.pr,.5);
    if((kind==='squat'||kind==='wallball')&&(item.type==='dumbbell'||item.type==='ball'))next.at=gripCenter;
    if(kind==='bridge'&&item.type==='bar'){
      const half=mul(sub(item.to,item.from),.5);
      next.from=sub(gripCenter,half);next.to=add(gripCenter,half);
    }
    if(item.type==='bag')next.at=add(after.neck,[0,-.025,-.04]);
    if(kind==='press'&&item.type==='seat')next.at=[0,.45,-.05];
    return next;
  });
}

export function retargetPose(pose,options={}) {
  const targets=boneTargets(pose,options);
  return {targets,joints:targets.joints,anatomical:targets.anatomical,equipment:targets.equipment,kind:targets.kind,phase:targets.phase};
}
