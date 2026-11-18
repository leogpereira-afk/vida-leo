/* Modelos geométricos educativos em coordenadas 3D. Não são captura de movimento. */
var SaudeEsportes3D=(function(){
'use strict';
const P=(x,y,z=0)=>[x,y,z], mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const bones=[['hip','chest'],['chest','neck'],['neck','head'],['chest','sl'],['chest','sr'],['sl','el'],['el','wl'],['sr','er'],['er','wr'],['hip','hl'],['hip','hr'],['hl','kl'],['kl','al'],['hr','kr'],['kr','ar']];
function stand(){return {hip:P(0,1),chest:P(0,1.55),neck:P(0,1.72),head:P(0,1.9),sl:P(-.24,1.6),sr:P(.24,1.6),el:P(-.3,1.27),er:P(.3,1.27),wl:P(-.3,.95),wr:P(.3,.95),hl:P(-.14,1),hr:P(.14,1),kl:P(-.16,.53),kr:P(.16,.53),al:P(-.18,.07),ar:P(.18,.07)};}
function arms(p,y,z=0){for(const [s,v] of [['l',-1],['r',1]]){p['e'+s]=P(v*.37,(1.6+y)/2,z/2+.15);p['w'+s]=P(v*.29,y,z)}return p;}
function squat(p,t){for(const k of ['hip','hl','hr','chest','neck','head','sl','sr'])p[k][1]-=.45*t;for(const k of ['hip','hl','hr'])p[k][2]-=.25*t;for(const s of ['l','r']){p['k'+s][2]=.24*t;p['k'+s][1]=.5-.08*t;}return p;}
function plank(){return {hip:P(0,.48,-.25),chest:P(0,.56,.35),neck:P(0,.56,.52),head:P(0,.56,.73),sl:P(-.23,.56,.37),sr:P(.23,.56,.37),el:P(-.25,.12,.38),er:P(.25,.12,.38),wl:P(-.25,.1,.7),wr:P(.25,.1,.7),hl:P(-.13,.48,-.25),hr:P(.13,.48,-.25),kl:P(-.14,.26,-.65),kr:P(.14,.26,-.65),al:P(-.15,.06,-1.05),ar:P(.15,.06,-1.05)};}
function pose(kind,t){let p=stand();const q=(1-Math.cos(t*Math.PI*2))/2;let equipment=[];
 const dumb=(s)=>equipment.push({type:'dumbbell',at:p['w'+s]});
 if(['run','carry','sled','pull'].includes(kind)){
  for(const [s,sign] of [['l',1],['r',-1]]){let a=Math.sin(t*Math.PI*2)*sign;p['k'+s][2]=a*.3;p['a'+s][2]=-a*.4;p['a'+s][1]=.07+Math.max(0,a)*.22;p['e'+s][2]=-a*.2;p['w'+s]=P(sign*-.28,1.35,-a*.3+.22)}
  if(kind==='carry'){for(const s of ['l','r']){p['w'+s][1]=.95;p['w'+s][2]=0;dumb(s)}}
  if(kind==='sled'){arms(p,1.25,.8);equipment.push({type:'sled',at:P(0,0,1)})}
  if(kind==='pull'){arms(p,1.25,.35+.35*q);equipment.push({type:'rope',from:p.wl,to:P(0,.1,1.6)},{type:'sled',at:P(0,0,1.7)})}
 }else if(kind==='squat'||kind==='wallball'){
  squat(p,q);for(const [s,sign]of [['l',-1],['r',1]]){p['e'+s]=P(sign*.28,p.chest[1]-.18,.2);p['w'+s]=P(sign*.1,p.chest[1]+.02,.23)}
  if(kind==='wallball'&&q<.3){arms(p,1.65+(.3-q)*2.4,.3);equipment.push({type:'ball',at:P(0,p.wl[1]+.2,.3)})}else equipment.push({type:kind==='wallball'?'ball':'dumbbell',at:P(0,p.chest[1]+.08,.25)});
 }else if(kind==='curl'){for(const s of ['l','r']){p['w'+s]=P(p['e'+s][0],.95+.56*q,.25*Math.sin(q*Math.PI));dumb(s)}}
 else if(kind==='press'){for(const [s,sign]of [['l',-1],['r',1]]){p['e'+s]=P(sign*(.48-.18*q),1.45+.45*q,.04);p['w'+s]=P(sign*(.48-.18*q),1.78+.42*q,.04);dumb(s)}equipment.push({type:'seat',at:P(0,.95,-.12)})}
 else if(kind==='triceps'){for(const s of ['l','r']){p['w'+s]=P(p['e'+s][0],1.28-.35*q,.32*(1-q));}equipment.push({type:'cable',from:P(0,2.3,.5),to:p.wl})}
 else if(kind==='hinge'||kind==='row'){
  const a=kind==='row'?.9:.85*q;for(const k of ['chest','neck','head','sl','sr']){const h=p[k][1]-1;p[k][1]=1+h*Math.cos(a);p[k][2]=h*Math.sin(a)}
  for(const s of ['l','r']){p['e'+s]=P(p['s'+s][0],p['s'+s][1]-.3,p['s'+s][2]);p['w'+s]=P(p['s'+s][0],p['s'+s][1]-.62,p['s'+s][2]);}
  if(kind==='row'){p.er=P(.25,1.15+.25*q,.35-.3*q);p.wr=P(.25,.8+.35*q,.35-.15*q);p.wl=P(-.25,.8,.5);equipment.push({type:'bench',at:P(-.25,.72,.25)});dumb('r')}else{dumb('l');dumb('r')}
 }else if(kind==='calf'){for(const k of Object.keys(p))p[k][1]+=.12*q; p.al[2]=-.08*q;p.ar[2]=-.08*q;}
 else if(kind==='plank'){p=plank()}
 else if(kind==='sideplank'||kind==='abduction'){
  p=plank();for(const k of Object.keys(p)){const [x,y,z]=p[k];p[k]=P(y-.3,.3+x,z)}
  if(kind==='sideplank'){for(const k of Object.keys(p))p[k][1]+=.25;p.wr=P(0,1.25,.4);p.er=P(0,1,.4);p.el=P(0,.1,.4);p.wl=P(.2,.1,.5)}
  else{p.kr[1]+=.3*q;p.ar[1]+=.6*q;}
 }else if(kind==='bench'||kind==='bridge'){
  p={hip:P(0,.6,-.2),chest:P(0,.65,.35),neck:P(0,.65,.5),head:P(0,.65,.69),sl:P(-.23,.65,.35),sr:P(.23,.65,.35),el:P(-.5,.65,.3),er:P(.5,.65,.3),wl:P(-.48,.95,.35),wr:P(.48,.95,.35),hl:P(-.14,.6,-.2),hr:P(.14,.6,-.2),kl:P(-.2,.55,-.65),kr:P(.2,.55,-.65),al:P(-.2,.06,-.65),ar:P(.2,.06,-.65)};
  equipment.push({type:'bench',at:P(0,.48,.2)});
  if(kind==='bench'){for(const [s,sign]of [['l',-1],['r',1]]){p['e'+s]=P(sign*(.48-.2*q),.7+.3*q,.35);p['w'+s]=P(sign*(.48-.2*q),1+.28*q,.35);dumb(s)}}
  else{for(const k of ['hip','hl','hr'])p[k][1]=.3+.3*q;p.wl=P(-.3,p.hip[1],-.2);p.wr=P(.3,p.hip[1],-.2);equipment.push({type:'bar',from:P(-.65,p.hip[1]+.1,-.2),to:P(.65,p.hip[1]+.1,-.2)})}
 }else if(kind==='lunge'||kind==='step'){
  squat(p,q*.5);p.kl=P(-.14,.55,.32);p.al=P(-.14,kind==='step'?.35:.07,.55);p.kr=P(.14,.55-.32*q,-.3);p.ar=P(.14,.08,-.65);if(kind==='step')equipment.push({type:'box',at:P(-.14,.2,.55)});else equipment.push({type:'bag',at:P(0,p.neck[1],-.1)});
 }else if(kind==='ski'){const a=.65*q;for(const k of ['chest','neck','head','sl','sr']){p[k][1]-=.22*q;p[k][2]+=a*.35}arms(p,2.15-1.2*q,.35);equipment.push({type:'cable',from:P(-.3,2.3,.9),to:p.wl},{type:'cable',from:P(.3,2.3,.9),to:p.wr})}
 else if(kind==='erg'){p=pose('row',t).joints;for(const k of Object.keys(p))p[k][1]-=.3;arms(p,1,.7-.5*q);p.al=P(-.16,.13,1);p.ar=P(.16,.13,1);p.kl=P(-.16,.5+.25*q,.6);p.kr=P(.16,.5+.25*q,.6);equipment=[{type:'rail',from:P(0,.2,-.6),to:P(0,.2,1.2)},{type:'cable',from:P(0,.4,1.2),to:p.wl}]}
 else if(kind==='burpee'){const a=stand(),b=plank(),low=squat(stand(),1);low.wl=P(-.25,.1,.65);low.wr=P(.25,.1,.65);low.el=P(-.3,.5,.5);low.er=P(.3,.5,.5);const frames=[a,low,b,low,a],f=Math.min(3,Math.floor(t*4)),u=(t*4-f);for(const k of Object.keys(p))p[k]=mix(frames[f][k],frames[f+1][k],(1-Math.cos(u*Math.PI))/2);equipment=[];}
 else if(kind==='bike'){for(const k of Object.keys(p)){p[k][1]*=.85;}p.hip=P(0,.98,-.25);p.chest=P(0,1.4,.2);p.neck=P(0,1.5,.3);p.head=P(0,1.65,.36);p.sl=P(-.23,1.4,.2);p.sr=P(.23,1.4,.2);p.wl=P(-.28,1.15,.72);p.wr=P(.28,1.15,.72);p.el=P(-.3,1.2,.4);p.er=P(.3,1.2,.4);for(const [s,sign]of [['l',1],['r',-1]]){const a=t*Math.PI*2+(sign===1?0:Math.PI);p['h'+s]=P(sign*.13,.98,-.25);p['a'+s]=P(sign*.17,.4+Math.cos(a)*.18,Math.sin(a)*.18);p['k'+s]=P(sign*.18,.7+Math.cos(a)*.1,.35)}equipment.push({type:'bike',at:P(0,0,0)})}
 return {joints:p,equipment,kind,phase:t};
}
const kinds={musculacao:['bench','row','press','curl','triceps','carry','squat','hinge','bridge','calf','plank','sideplank','abduction'],hyrox:['ski','sled','pull','burpee','erg','carry','lunge','wallball'],corrida:['run','run','run','run','run','run','run','step'],mtb:['bike','bike','bike','bike','bike','bike']};
const muscleMap={bench:[['peito'],['triceps','ombros']],row:[['costas'],['biceps','abdomen']],press:[['ombros'],['triceps']],curl:[['biceps'],['antebracos']],triceps:[['triceps'],[]],carry:[['antebracos'],['abdomen','ombros']],squat:[['quadriceps','gluteos'],['abdomen']],hinge:[['posteriores','gluteos'],['costas','abdomen']],bridge:[['gluteos'],['posteriores']],calf:[['panturrilhas'],[]],plank:[['abdomen'],['ombros','gluteos']],sideplank:[['abdomen'],['ombros','gluteos']],abduction:[['gluteos'],['abdomen']],run:[['quadriceps','gluteos','panturrilhas'],['posteriores','abdomen']],bike:[['quadriceps','gluteos'],['panturrilhas','abdomen']],step:[['quadriceps','gluteos'],['abdomen']],lunge:[['quadriceps','gluteos'],['posteriores','abdomen']],ski:[['costas','triceps'],['abdomen','ombros']],sled:[['quadriceps','gluteos'],['peito','triceps','abdomen']],pull:[['costas','biceps'],['quadriceps','abdomen']],erg:[['quadriceps','costas'],['gluteos','biceps']],burpee:[['peito','quadriceps','gluteos'],['triceps','abdomen']],wallball:[['quadriceps','gluteos','ombros'],['triceps','abdomen']]};
const names={peito:'Peitoral',costas:'Costas',ombros:'Deltoides',biceps:'Bíceps',triceps:'Tríceps',antebracos:'Antebraços e pegada',quadriceps:'Quadríceps',posteriores:'Posteriores da coxa',gluteos:'Glúteos',panturrilhas:'Panturrilhas',abdomen:'Abdômen e estabilizadores'};
function phaseText(kind,phase){
 if(['plank','sideplank','carry'].includes(kind))return 'Sustentação e estabilização muscular';
 if(['run','bike'].includes(kind))return 'Alternância entre as pernas';
 if(['step','sled','pull','burpee','erg','ski','wallball'].includes(kind))return 'Sequência coordenada do movimento';
 const returning=phase>=.5,descending=['squat','hinge','lunge'].includes(kind);
 return (returning!==descending)?'Retorno controlado · fase excêntrica':'Produção de força · fase concêntrica';
}
function create(mod,index,item){const kind=kinds[mod]?.[index];if(!kind)return null;
const box=document.createElement('section');box.className='esp-movimento';
const title=document.createElement('h4');title.textContent='Anatomia em movimento · 3D';box.append(title);
const note=document.createElement('p');note.textContent='Corpo humano com superfície muscular. Gire e aproxime para observar os músculos durante o movimento.';box.append(note);
let canvas=document.createElement('canvas');canvas.width=720;canvas.height=760;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Modelo tridimensional de '+item.title);box.append(canvas);
const controls=document.createElement('div');controls.className='esp-3d-controles';box.append(controls);
let playing=false,phase=0,angle=.6,zoom=1,speed=.5,frame=0,last=0,body=null,loading=false;
const groups=muscleMap[kind]||[[],[]];const legend=document.createElement('div');legend.className='esp-musculos-legenda';for(const [ids,cls,label]of [[groups[0],'principal','Principais'],[groups[1],'apoio','Auxiliares / estabilizadores']]){if(!ids.length)continue;const line=document.createElement('p');line.className=cls;line.textContent=label+': '+ids.map(x=>names[x]).join(', ');legend.append(line)}const explanation=document.createElement('small');explanation.textContent='Vermelho: principais músculos. Dourado: auxiliares. A mudança de brilho acompanha a fase ilustrada; não mede ativação ou intensidade.';legend.append(explanation);box.insertBefore(legend,canvas);
queueMicrotask(()=>{const details=box.closest('details');if(!details)return;details.addEventListener('toggle',async()=>{if(!details.open){releaseBody();return}if(loading||body)return;for(const other of document.querySelectorAll('.esp-item[open]')){if(other!==details&&other.querySelector('.esp-movimento')){other.open=false;other.querySelector('.esp-movimento').espDispose?.()}}loading=true;note.textContent='Carregando corpo anatômico…';canvas.setAttribute('aria-busy','true');try{const m=await import('./saude-esportes-corpo3d.js?v=b9ca3b1d3682');if(details.open&&box.isConnected){const next=await m.createBody(canvas,groups[0],groups[1],kind);if(details.open&&box.isConnected){body=next;note.textContent='Corpo humano com superfície muscular. Gire e aproxime para observar os músculos durante o movimento.';draw()}else{next.dispose();resetCanvas()}}}catch(e){note.textContent='Visualização 3D indisponível neste navegador. Use a fotografia e o passo a passo abaixo.'}finally{loading=false;canvas.setAttribute('aria-busy','false')}})});
function button(text,fn){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;controls.append(b);return b}
const play=button('▶ Reproduzir',()=>{cancelAnimationFrame(frame);playing=!playing;play.textContent=playing?'Ⅱ Pausar':'▶ Reproduzir';last=0;if(playing)frame=requestAnimationFrame(tick)});
button('Frente',()=>{angle=0;draw()});button('Lado',()=>{angle=Math.PI/2;draw()});button('Girar ↻',()=>{angle+=Math.PI/8;draw()});button('+ Aproximar',()=>{zoom=Math.min(1.7,zoom+.15);draw()});button('− Afastar',()=>{zoom=Math.max(.7,zoom-.15);draw()});
const label=document.createElement('label');label.textContent='Velocidade ';const select=document.createElement('select');for(const [v,t] of [[.25,'0,25×'],[.5,'0,5×'],[1,'1×']]){const o=document.createElement('option');o.value=v;o.textContent=t;o.selected=v===.5;select.append(o)}select.onchange=()=>speed=Number(select.value);label.append(select);controls.append(label);
const phaseLabel=document.createElement('label');phaseLabel.className='esp-3d-fase';phaseLabel.textContent='Estudar fase ';const slider=document.createElement('input');slider.type='range';slider.min=0;slider.max=100;slider.value=0;slider.setAttribute('aria-label','Fase do movimento');slider.oninput=()=>{playing=false;play.textContent='▶ Reproduzir';phase=Number(slider.value)/100;draw()};phaseLabel.append(slider);box.append(phaseLabel);
const cue=document.createElement('p');cue.className='esp-3d-legenda';box.append(cue);
const equipment=document.createElement('p');equipment.textContent=mod==='mtb'?'Visualização do ciclo de pedalada; frenagem e obstáculos exigem treino prático específico.':mod==='corrida'&&index<7?'A animação mostra o ciclo da corrida. O que muda entre os treinos é o esforço e sua organização, descritos nesta ficha.':kind==='plank'||kind==='sideplank'?'Exercício de sustentação: a posição permanece estável durante a visualização.':'Leia os passos abaixo para montar o exercício e conferir os apoios.';box.append(equipment);
function draw(){if(body)body.render(pose(kind,phase),angle,zoom);slider.value=Math.round(phase*100);cue.textContent=(playing?'Em movimento':'Pausado')+' · '+phaseText(kind,phase)+' · ciclo '+Math.round(phase*100)+'% · '+(item.cue||'Controle a trajetória e mantenha os apoios.');}
 function tick(now){if(!playing||!box.isConnected||!box.closest('details')?.open||document.hidden){playing=false;play.textContent='▶ Reproduzir';return}if(last)phase=(phase+(now-last)/4000*speed)%1;last=now;draw();frame=requestAnimationFrame(tick)}
 function resetCanvas(){const fresh=canvas.cloneNode(false);canvas.replaceWith(fresh);canvas=fresh;bindPointer()}
 function releaseBody(){playing=false;cancelAnimationFrame(frame);play.textContent='▶ Reproduzir';last=0;if(body){body.dispose();body=null;resetCanvas()}}
 function bindPointer(){let drag=null;canvas.style.touchAction='pan-y';canvas.onpointerdown=e=>{drag=e.clientX;canvas.setPointerCapture?.(e.pointerId)};canvas.onpointermove=e=>{if(drag===null)return;angle+=(e.clientX-drag)*.012;drag=e.clientX;draw()};canvas.onpointerup=canvas.onpointercancel=()=>drag=null;}bindPointer();
 box.espDispose=()=>{playing=false;cancelAnimationFrame(frame);releaseBody()};draw();return box;
}
return {create,pose,kinds,muscleMap,phaseText};
})();
