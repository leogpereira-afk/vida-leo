/* Geometria de apresentação. Não participa do motor de quantitativos. */
(function(g){'use strict';
const LIMIT=3800, n=(v,d=0)=>{const x=Number(String(v??'').replace(',','.'));return Number.isFinite(x)&&x>=0&&v!==''&&v!=null?x:d;};
function criar(source,options={}){
 if(!source?.product)return {...source,detailAvailable:false};
 const {tool:t,inputs:a}=source.product, out={elements:[],caption:source.caption,detailAvailable:false}, original=source.elements||[], detail=!!options.detail, mortar=options.mortar!==false;
 let capped=false;
 const add=e=>{if(out.elements.length<LIMIT)out.elements.push({...e,id:'v'+out.elements.length});else capped=true;};
 const box=(x,y,z,w,h,d,label,color,texture,layer)=>{if(w>0&&h>0&&d>0)add({kind:'box',x,y,z,w,h,d,label,color,texture,layer});};
 const line=(points,label,color='#64717b',width=1)=>add({kind:'line',points,label,color,width});
 const plane=(points,label,color,texture)=>add({kind:'plane',points,label,color,texture});
 const copy=(e,color,texture)=>add({...e,color,texture});
 const note=s=>out.caption=s;
 // Cylinders along X, with open bores for pipes. Wall thickness is illustrative.
 function tube(x,y,z,length,r,color,label,hollow=false){
  if(!(r>0&&length>0))return;const count=12,ring=(xx,rr)=>Array.from({length:count},(_,i)=>[xx,y+Math.cos(i*Math.PI*2/count)*rr,z+Math.sin(i*Math.PI*2/count)*rr]);
  const p=ring(x,r),q=ring(x+length,r),pi=ring(x,r*.76),qi=ring(x+length,r*.76);
  for(let i=0;i<count;i++){let j=(i+1)%count;plane([p[i],p[j],q[j],q[i]],label,color);if(hollow){plane([pi[j],pi[i],qi[i],qi[j]],label+' · interior','#4b555b');plane([p[j],p[i],pi[i],pi[j]],label+' · borda',color);plane([q[i],q[j],qi[j],qi[i]],label+' · borda',color);}}
  if(!hollow){plane(p,label,color);plane(q,label,color);}
 }
 function groove(x,y,z,w,h,d){const relief=Math.min(.0015,d*.02),pitch=w/14;for(let i=0;i<14;i++){box(x+i*pitch,y,z,pitch*.65,h,relief,'Friso lateral ilustrativo','#c87850','clay');box(x+i*pitch,y,z+d-relief,pitch*.65,h,relief,'Friso lateral ilustrativo','#c87850','clay');}}

 if(t==='alvenaria'){
  out.detailAvailable=true;out.mortarAvailable=true;
  const w=n(a.blocoComprimento)/100,h=n(a.blocoAltura)/100,d=n(a.blocoEspessura,14)/100,j=n(a.juntaCm)/100,profile=a.perfilBloco||'generico',color=profile==='concreto'?'#9da29f':'#c87850';
  if(!(w>0&&h>0&&d>0))return {...source,detailAvailable:false};
  if(detail){
   const web=Math.min(w,h,d)*.09;
   if(profile==='ceramico-frisado'){
    // Two columns by four rows, through the length of the block.
    const relief=Math.min(.0015,d*.02);for(let k=0;k<=4;k++)box(0,(h-web)*k/4,relief,w,web,d-2*relief,'Parede horizontal do tijolo',color,'clay');
    for(let k=0;k<=2;k++){const relief=Math.min(.0015,d*.02);box(0,0,(d-web)*k/2+(k===0?relief:0),w,h,web-(k===1?0:relief),'Parede vertical do tijolo',color,'clay');}
    groove(0,0,0,w,h,d);
   }else if(profile==='ceramico-liso'||profile==='concreto'){
    const cells=profile==='concreto'?2:3;
    box(0,0,0,w,h,web,'Parede externa',color,'clay');box(0,0,d-web,w,h,web,'Parede externa',color,'clay');
    for(let k=0;k<=cells;k++)box((w-web)*k/cells,0,0,web,h,d,'Divisória interna ilustrativa',color,'clay');
   }else box(0,0,0,w,h,d,'Bloco · perfil não informado',color,'clay');
   if(mortar&&j>0){box(0,-j,0,w,j,web,'Argamassa de assentamento', '#b7b5ac','mortar','mortar');box(0,-j,d-web,w,j,web,'Argamassa de assentamento','#b7b5ac','mortar','mortar');box(w,0,0,j,h,d,'Junta vertical de argamassa','#b7b5ac','mortar','mortar');}
   note((a.produto||'Bloco personalizado')+' · peça '+(w*100).toFixed(1)+' × '+(h*100).toFixed(1)+' × '+(d*100).toFixed(1)+' cm; junta '+n(a.juntaCm)+' cm. Vazados, frisos e aplicação de massa ilustrativos; conferir ficha e assentamento do produto.');
  }else{
   let count=0,visits=0;
   outer:for(const s of original){
    
    for(let row=0;row<Math.min(1000,Math.ceil(n(a.altura)/(h+j)));row++){
     let y=row*(h+j),bottom=Math.max(y,s.y),top=Math.min(y+h,s.y+s.h);if(top<=bottom)continue;
     for(let col=-1;col<Math.min(1500,Math.ceil(n(a.largura)/(w+j)));col++){
      if(++visits>20000){capped=true;break outer;}let x=col*(w+j)+(row%2?(w+j)/2:0),left=Math.max(x,s.x),right=Math.min(x+w,s.x+s.w);if(right<=left)continue;
      if(++count>1100){capped=true;break outer;}
      box(left,bottom,s.z,right-left,top-bottom,s.d,'Bloco · fiada '+(row+1),color,profile==='ceramico-frisado'?'grooves':'clay');
      if(mortar&&j>0){
       const vx=Math.max(x+w,s.x),ve=Math.min(x+w+j,s.x+s.w);box(vx,bottom,s.z,ve-vx,top-bottom,s.d,'Junta vertical de argamassa','#b7b5ac','mortar','mortar');
       const hx=Math.max(x,s.x),he=Math.min(x+w+j,s.x+s.w),hy=Math.max(y+h,s.y),ht=Math.min(y+h+j,s.y+s.h);box(hx,hy,s.z,he-hx,ht-hy,s.d,'Junta horizontal de argamassa','#b7b5ac','mortar','mortar');
      }
     }
    }
   }
   const openings=a.temAberturas==='nao'?[]:(a.aberturas||[]);const openingLabel=openings.length?'Com aberturas: '+openings.map(e=>(e.tipo==='janela'?'janela':e.tipo==='porta'?'porta':'vão anterior')+' '+n(e.largura)+' × '+n(e.altura)+' m · '+n(e.quantidade,1)+' un').join('; ')+'. ':'Sem portas ou janelas. ';note(openingLabel+'Fiadas e juntas de '+n(a.juntaCm)+' cm · '+(a.produto||'perfil '+profile)+'. Amarração esquemática. '+(openings.length?'Aberturas posicionadas lado a lado a partir da esquerda. ':'')+'Quantidade de compra permanece no cálculo; use “Detalhe do produto” para ver vazados e massa.'+(a.blocoEspessura?'':' Espessura visual provisória de 14 cm.'));
  }
 }else if(t==='malhas'){
  out.detailAvailable=true;const space=n(a.espacamento)/1000,dia=n(a.diametro)/1000;
  if(!(space>0&&dia>0)){original.forEach(e=>copy(e,'#9ea9b1'));note('Informe espaçamento e diâmetro da tela para visualizar seus fios. Painéis ainda esquemáticos.');}
  else{const panels=detail?original.slice(0,1):original;for(const [i,e]of panels.entries()){
   const color=['#5d737d','#a46744','#61795a'][i%3];
   for(let z=0;z<=e.d+1e-8&&out.elements.length<LIMIT;z+=space){if(detail)tube(e.x,e.y,e.z+z,e.w,dia/2,color,'Fio Ø '+a.diametro+' mm');else line([[e.x,e.y,e.z+z],[e.x+e.w,e.y,e.z+z]],'Fio Ø '+a.diametro+' mm',color,.8);}
   for(let x=0;x<=e.w+1e-8&&out.elements.length<LIMIT;x+=space){if(detail){const before=out.elements.length;tube(0,0,0,e.d,dia/2,color,'Fio transversal Ø '+a.diametro+' mm');for(const el of out.elements.slice(before))el.points=el.points.map(p=>[e.x+x+p[2],e.y+dia+p[1],e.z+p[0]]);}else line([[e.x+x,e.y+dia,e.z],[e.x+x,e.y+dia,e.z+e.d]],'Fio transversal Ø '+a.diametro+' mm',color,.8);}
  }note('Tela com espaçamento '+a.espacamento+' mm e fios Ø '+a.diametro+' mm. '+(detail?'Um painel comercial. ':'Cores distinguem painéis e transpasses. ')+'Separação entre camadas esquemática; não representa cobrimento.');}
 }else if(['hidraulica','esgoto','eletrica','dados','barras'].includes(t)){
  out.detailAvailable=true;let row=0;
  if(t==='barras'){
   for(const item of (a.pecas||[])){const dia=n(item.diametro)/1000,len=detail?Math.min(n(a.barra),Math.max(.3,dia*24)):n(a.barra);tube(0,row*.08,0,len,dia/2,'#737d83','Barra Ø '+item.diametro+' mm');row++;if(detail)break;}
   note('Seções de aço pelos diâmetros informados · uma amostra por diâmetro/linha. '+(detail?'Trecho ampliado, comprimento abreviado. ':'Comprimento comercial. ')+'Nervuras e dobras não definidas; consulte plano de corte para quantidades.');
  }else for(const e of (a.trechos||[])){
   const hydraulic=t==='hidraulica'||t==='esgoto',diam=hydraulic?n(e.diametro)/1000:0;
   if(hydraulic&&!diam){line([[0,row*.2,0],[n(e.comprimento),row*.2,0]],'Diâmetro não informado');row++;continue;}
   const radius=hydraulic?diam/2:.009,len=detail?Math.min(n(e.comprimento),Math.max(.25,radius*12)):n(e.comprimento)+n(e.subida)+n(e.extra),cnt=hydraulic?n(e.quantidade,1):t==='eletrica'&&e.modo==='individual'?n(e.condutores,1):1;
   for(let i=0;i<Math.min(cnt,30)&&out.elements.length<LIMIT;i++){tube(0,row*Math.max(radius*3,.05),0,len,radius,hydraulic?(t==='esgoto'?'#e0e4df':'#a97853'):'#3e667c',(hydraulic?'Tubo '+e.diametro+' mm':e.papel||'Cabo')+' · '+(e.id||''),hydraulic);row++;}
   if(cnt>30)capped=true;if(detail)break;
  }
  if(t!=='barras')note((detail?'Amostra em trecho abreviado. ':'Trechos retilíneos, separados para conferência. ')+(t==='hidraulica'||t==='esgoto'?'Diâmetro informado/nominal; espessura da parede ilustrativa. Conexões contadas, sem topologia inferida.':'Quantidade de cabos informada; diâmetro externo ilustrativo, não deduzido da seção do cobre. Cores não indicam função elétrica.'));
 }else if(t==='pisos'){
  out.mortarAvailable=true;original.forEach((e,i)=>{copy(e,i%3===0?'#e3dbcd':'#d4ccbe','stone');const j=n(a.juntaMm)/1000;if(mortar&&j>0){box(e.x+e.w,0,e.z,Math.max(0,Math.min(j,n(a.largura)-e.x-e.w)),.018,e.d,'Junta de rejunte','#a09b90','mortar','mortar');box(e.x,0,e.z+e.d,Math.min(e.w+j,n(a.largura)-e.x),.018,Math.max(0,Math.min(j,n(a.comprimento)-e.z-e.d)),'Junta de rejunte','#a09b90','mortar','mortar');}});note(source.caption+' · peças e juntas de '+a.juntaMm+' mm; espessura visual de 2 cm, não especificação do produto. Vãos sem posição não recortados.');
 }else if(t==='reboco'||t==='gesso'){
  out.mortarAvailable=true;original.forEach(e=>{box(e.x,e.y,.002,e.w,e.h,.08,'Base ilustrativa','#bd815c','clay');if(mortar)box(e.x,e.y,-e.d,e.w*.72,e.h,e.d,'Camada de '+t+' · '+a.espessuraCm+' cm',t==='gesso'?'#f0eee5':'#aaa79d',t==='gesso'?'plaster':'mortar','mortar');});note('Corte demonstrativo: base com parte exposta e '+t+' de '+a.espessuraCm+' cm. Cobertura parcial apenas para leitura das camadas; consumo usa toda a área calculada.');
 }else if(t==='terra'){
  (a.setores||[]).forEach((e,i)=>{const w=Math.sqrt(n(e.area)),cut=n(e.corteCm)/100,fill=n(e.profundidadeCm)/100;box(i*5,-cut,0,w,cut,w,'Corte natural','#9a7455','earth');box(i*5,0,0,w,fill,w,'Aterro compactado','#b99a68','earth');});note('Corte natural abaixo e aterro compactado acima do nível zero. Setores quadrados de área equivalente; formato real não informado.');
 }else if(t==='contrapiso'||t==='pavimentacao'){
  original.forEach((e,i)=>copy(e,['#b0aea5','#b99d74','#737f88','#d2c8b9'][i%4],'aggregate'));note('Camadas com espessuras informadas. Clique para identificar o material. Cores de diferenciação, sem composição presumida.');
 }else if(t==='pintura'||t==='drywall'){
  const w=Math.sqrt(n(a.area));box(0,0,0,w,w,.03,'Base / corte ilustrativo','#d0c8b7','plaster');box(0,0,-.004,w*.76,w,.004,t==='pintura'?'Acabamento de pintura':'Face de chapa',t==='pintura'?'#8eaaa9':'#eeeae1','plaster');note((t==='pintura'?'Acabamento sobre base; quantidade de demãos conforme cálculo.':'Chapa em corte demonstrativo; estrutura e paginação não informadas.')+' Área quadrada equivalente; espessuras e cobertura parcial ilustrativas.');
 }else if(t==='rodape'){
  const e=original[0],piece=n(a.peca);if(e&&piece>0){for(let x=0;x<e.w&&out.elements.length<LIMIT;x+=piece)box(x,0,0,Math.min(piece,e.w-x),e.h,e.d,'Rodapé · peça comercial','#d9d1c1','stone');}else original.forEach(e=>copy(e,'#d9d1c1','stone'));note('Rodapé linear, dividido pelo comprimento comercial quando informado. Espessura ilustrativa; portas descontadas apenas do total.');
 }else if(t==='paisagismo'){
  original.forEach(e=>copy(e,'#708b50','grass'));const sx=n(a.espacamentoX),sz=n(a.espacamentoY);if(sx&&sz)for(let x=0;x<n(a.largura)&&out.elements.length<LIMIT;x+=sx)for(let z=0;z<n(a.comprimento)&&out.elements.length<LIMIT;z+=sz)box(x,.05,z,Math.min(.12,sx),.1,Math.min(.12,sz),'Posição de muda','#3d6b46','grass');note('Malha de plantio pelos espaçamentos informados. Marcadores ilustram posições; espécie e porte não definidos.');
 }else if(t==='impermeabilizacao'){
  const w=Math.sqrt(n(a.area));box(0,-.05,0,w,.05,w,'Substrato','#b5b2a9','aggregate');box(0,0,0,w*.8,.005,w,a.modo==='rolo'?'Manta':'Impermeabilizante',a.modo==='rolo'?'#3e4549':'#809195','mortar');note('Sistema sobre substrato com parte exposta. Área quadrada equivalente; espessura ilustrativa. Subidas, emendas e recortes precisam de posição de projeto.');
 }else if(t==='consumo'||t==='produtividade'){
  note('Este cálculo não fornece dimensões físicas para um modelo 3D. Consulte os quantitativos e a memória de cálculo.');out.noGeometry=true;
 }else{
  const styles={concreto:['#a4aaa6','aggregate'],formas:['#bd995e','wood'],residuos:['#978a75','aggregate'],cobertura:['#87929a','metal'],pecas:['#c1c9c9','stone']},[color,texture]=styles[t]||['#b3b7b5','stone'];original.forEach(e=>copy(e,color,texture));
  if(t==='formas')note('Área equivalente de formas; textura ilustrativa. Dimensões das chapas, espessura e travamento não definidos.');
  if(t==='residuos')note('Volume solto em bloco equivalente; não representa forma nem dimensões da caçamba.');
  if(t==='cobertura')note('Plano com inclinação e beirais informados. Perfil de telha e estrutura não definidos; não se presume paginação.');
  if(t==='pecas')note('Peças pelas dimensões informadas; acabamento neutro e espessura ilustrativa. Material a especificar.');
 }
 if(capped||out.elements.length>=LIMIT)out.caption+=' · Detalhamento visual limitado para desempenho; consulte os totais completos na lista de materiais.';
 return out;
}
g.FortemaisProdutos3D={criar,VERSION:'1.0.0'};
})(globalThis);
