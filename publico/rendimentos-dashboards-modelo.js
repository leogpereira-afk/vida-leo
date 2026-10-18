/* Análises de leitura. A precedência das fontes continua em RendimentosModelo. */
const RendimentosDashboardsModelo=(()=>{
 const MESES=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
 const valor=v=>v===null||v===undefined?null:Math.round((Number(v)+Number.EPSILON)*100)/100;
 const soma=xs=>{const vs=xs.filter(v=>v!==null&&v!==undefined);return vs.length?valor(vs.reduce((a,b)=>a+b,0)):null};
 const diferenca=(a,b)=>({valor:a===null||b===null?null:valor(a-b),percentual:a===null||b===null||b<=0?null:(a-b)/b*100});
 const mesISO=(y,m)=>y+'-'+String(m).padStart(2,'0');
 const fimMes=(y,m)=>new Date(Date.UTC(y,m,0)).getUTCDate();
 const noAno=(iso,y)=>{if(!iso)return '';const m=+iso.slice(5,7),d=Math.min(+iso.slice(8,10),fimMes(y,m));return mesISO(y,m)+'-'+String(d).padStart(2,'0')};
 function criar(registros,historico,hoje,f={}){
  const natureza=!!(f.tipo||f.instituicao),originais=registros||[];
  const filtrados=originais.filter(x=>(!f.tipo||x.tipo===f.tipo)&&(!f.instituicao||x.instituicao===f.instituicao));
  const d=RendimentosModelo.construir(filtrados,natureza?{}:historico,hoje);
  const anos=[...new Set((f.anos||d.anos).map(Number))].sort((a,b)=>a-b),empresas=f.empresas?.length?[...f.empresas]:d.empresas.slice(),meses=f.meses||[];
  const contexto={anos,empresas:f.empresas||[],meses,de:f.de||'',ate:f.ate||''};
  const analise=d.analisar(contexto),cache=new Map();
  function corte(y,modo='recorte'){
   if(modo==='equivalente')return{de:mesISO(y,1)+'-01',ate:noAno(hoje,y)};
   if(modo==='completo')return{de:'',ate:''};
   return{de:contexto.de,ate:contexto.ate};
  }
  function celula(y,emp=empresas,ms=meses,modo='recorte'){
   const cut=corte(y,modo),baseEmp=emp===empresas&&!contexto.empresas.length?[]:emp,key=JSON.stringify([y,baseEmp,ms,cut]);if(cache.has(key))return cache.get(key);const c=d.celula(y,baseEmp,ms,cut.de,cut.ate);
   const resultado={...c,filtroOrigem:{anos:[y],empresas:baseEmp,meses:ms,de:cut.de,ate:cut.ate},valor:valor(c.valor),conhecido:c.valor!==null,cobertura:c.fonte==='Histórico anual'?'Histórico anual sem meses':c.meses.length+' mês(es) com registros',fechado:false};cache.set(key,resultado);return resultado;
  }
  function serieMensal(y,emp=empresas,modo='recorte'){
   return MESES.map((rotulo,i)=>{const c=celula(y,emp,[i+1],modo),permitido=!meses.length||meses.includes(i+1);return{ano:y,mes:i+1,iso:mesISO(y,i+1),rotulo,valor:permitido?c.valor:null,excluido:!permitido||(modo==='equivalente'&&i+1>+hoje.slice(5,7)),fonte:c.fonte,filtroOrigem:c.filtroOrigem,itens:permitido?c.itens:[],parcial:mesISO(y,i+1)===hoje.slice(0,7),futuro:mesISO(y,i+1)>hoje.slice(0,7)}});
  }
  function cronologia(emp=empresas,janela='recorte'){
   if(janela==='recorte'){const out=[];for(let y=anos[0];y<=Math.min(anos.at(-1),+hoje.slice(0,4));y++){const ps=serieMensal(y,emp);out.push(...(anos.includes(y)?ps:ps.map(p=>({...p,valor:null,itens:[],excluido:true}))));}return out.filter(p=>p.iso<=hoje.slice(0,7));}
   const n=janela==='12'?12:24,[y,m]=hoje.slice(0,7).split('-').map(Number),out=[];
   for(let i=n-1;i>=0;i--){const data=new Date(Date.UTC(y,m-1-i,1)),a=data.getUTCFullYear(),b=data.getUTCMonth()+1,c=d.celula(a,emp,[b]);out.push({ano:a,mes:b,iso:mesISO(a,b),rotulo:MESES[b-1]+'/'+String(a).slice(2),valor:valor(c.valor),fonte:c.fonte,filtroOrigem:{anos:[a],empresas:emp,meses:[b],de:'',ate:''},itens:c.itens,parcial:mesISO(a,b)===hoje.slice(0,7)})}return out;
  }
  function anual(emp=empresas,modo='recorte'){return anos.map(y=>({ano:y,rotulo:String(y),...celula(y,emp,meses,modo)}))}
  function comparar(yA,yB,emp=empresas,modo='equivalente'){
   const a=celula(yA,emp,meses,modo),b=celula(yB,emp,meses,modo),delta=diferenca(a.valor,b.valor);
   return{a,b,...delta,comparavel:false,nota:'Variação descritiva. Presença de registros não comprova fechamento dos períodos.',modo,corteA:corte(yA,modo),corteB:corte(yB,modo)};
  }
  function acumulada(pontos){let total=0,lacuna=false;return pontos.map(p=>{if(p.valor===null){if(!p.futuro&&!p.excluido)lacuna=true;return{...p,valor:null,incompleto:lacuna}}total=valor(total+p.valor);return{...p,valor:total,incompleto:lacuna}})}
  function mediaMovel(pontos,n=3){return pontos.map((p,i)=>{const janela=pontos.slice(i-n+1,i+1),mesConsecutivo=janela.every((x,j)=>j===0||Number(x.ano)*12+x.mes===Number(janela[j-1].ano)*12+janela[j-1].mes+1);return{...p,valor:i>=n-1&&janela.length===n&&janela.every(x=>x.valor!==null)&&mesConsecutivo?valor(janela.reduce((s,x)=>s+x.valor,0)/n):null,escopos:janela}})}
  function variacoes(pontos){return pontos.map((p,i)=>({...p,...(i?diferenca(p.valor,pontos[i-1].valor):{valor:null,percentual:null}),rotulo:p.rotulo,escopos:i?[p,pontos[i-1]]:[p]}))}
  function ranking(modo='recorte'){
   const rows=empresas.map(nome=>({nome,valor:soma(anos.map(y=>celula(y,[nome],meses,modo).valor))})).filter(x=>x.valor!==null).sort((a,b)=>b.valor-a.valor);
   const total=soma(anos.map(y=>celula(y,empresas,meses,modo).valor)),base=soma(rows.map(x=>x.valor)),residuo=total===null?null:valor(total-(base||0));
   if(residuo!==null&&Math.abs(residuo)>=.01)rows.push({nome:'Sem empresa no histórico',valor:residuo,semEmpresa:true});return rows.sort((a,b)=>b.valor-a.valor);
  }
  function concentracao(){const rank=ranking(),positivos=rank.filter(x=>x.valor>0),base=soma(positivos.map(x=>x.valor)),ajustes=soma(rank.filter(x=>x.valor<0).map(x=>x.valor));return{rank,base,ajustes,liquido:soma(rank.map(x=>x.valor)),top1:base?positivos[0].valor/base*100:null,top3:base?positivos.slice(0,3).reduce((s,x)=>s+x.valor,0)/base*100:null}}
  function composicao(modo='mes'){
   const pontos=modo==='ano'?anual():anos.flatMap(y=>serieMensal(y)).filter(p=>!meses.length||meses.includes(p.mes));
   return pontos.map(p=>{const partes=empresas.map(nome=>({nome,valor:modo==='ano'?celula(p.ano,[nome]).valor:celula(p.ano,[nome],[p.mes]).valor})).filter(x=>x.valor!==null),total=soma(partes.map(x=>x.valor));const geral=modo==='ano'?celula(p.ano,empresas).valor:celula(p.ano,empresas,[p.mes]).valor,residuo=geral===null?null:valor(geral-(total||0));if(residuo!==null&&Math.abs(residuo)>=.01)partes.push({nome:'Sem empresa no histórico',valor:residuo,semEmpresa:true});return{...p,rotulo:modo==='ano'?String(p.ano):p.iso,partes,total:soma(partes.map(x=>x.valor)),percentualValido:total>0&&partes.every(x=>x.valor>=0)}}).filter(p=>p.total!==null);
  }
  function normalizada(baseAno,modo='recorte'){
   const candidatos=anos.filter(y=>empresas.every(e=>celula(y,[e],meses,modo).valor>0));const base=baseAno?+baseAno:candidatos[0];
   const excluidas=[],series=[];for(const nome of empresas){const v=base?celula(base,[nome],meses,modo).valor:null;if(!(v>0)){excluidas.push(nome);continue}series.push({nome,base:v,pontos:anual([nome],modo).map(p=>({...p,valor:p.valor===null?null:p.valor/v*100,escopos:[p,celula(base,[nome],meses,modo)]}))})}return{base,series,excluidas,candidatos};
  }
  function contribuicao(yA,yB,modo='equivalente'){
   const total=comparar(yA,yB,empresas,modo),semBase=[],rows=[];
   for(const nome of empresas){const c=comparar(yA,yB,[nome],modo);if(c.valor===null){semBase.push({nome,a:c.a.valor,b:c.b.valor});continue}rows.push({nome,valor:c.valor,a:c.a.valor,b:c.b.valor,escopos:[c.a,c.b]})}
   const atribuida=soma(rows.map(r=>r.valor))||0,residual=total.valor===null?null:valor(total.valor-atribuida);
   return{...total,rows:rows.sort((a,b)=>Math.abs(b.valor)-Math.abs(a.valor)),semBase,atribuida,residual};
  }
  function grupos(campo){const grupos=new Map();for(const x of d.recorte(contexto).filter(x=>!d.previsto(x))){const nome=x[campo]||'Não classificado';grupos.set(nome,(grupos.get(nome)||0)+Number(x.valor))}return [...grupos].map(([nome,v])=>({nome,valor:valor(v)})).sort((a,b)=>b.valor-a.valor)}
  function cobertura(){return empresas.flatMap(nome=>anos.map(ano=>{const c=celula(ano,[nome]);return{nome,ano,...c,pontos:serieMensal(ano,[nome]),semEmpresa:nome==='Sem empresa identificada'}}))}
  function diarios(ano,mes,emp=empresas,diaCorte){const ultimo=Math.min(fimMes(ano,mes),diaCorte||fimMes(ano,mes)),rows=d.recorte({anos:[ano],empresas:emp,meses:[mes]}).filter(x=>!d.previsto(x)&&RendimentosModelo.mensal(x)),out=[];let total=0,n=0;for(let dia=1;dia<=ultimo;dia++){const xs=rows.filter(x=>+x.data.slice(8,10)===dia);total=valor(total+xs.reduce((s,x)=>s+Number(x.valor),0));n+=xs.length;out.push({ano,mes,dia,diario:true,acumulado:true,rotulo:String(dia),iso:mesISO(ano,mes)+'-'+String(dia).padStart(2,'0'),valor:n?total:null,itens:xs,semMovimentoConfirmado:false})}return out}
  function filtroGrafico(p){return{anos:p.anos|| (p.ano?[p.ano]:anos),empresas:p.empresa?[p.empresa]:contexto.empresas,meses:p.mes?[p.mes]:meses,de:p.dia?p.iso:contexto.de,ate:p.dia?p.iso:contexto.ate,tipo:f.tipo||'',instituicao:f.instituicao||''}}
  function registrosDo(p={}){const scope=p.filtroOrigem?{...p.filtroOrigem,empresas:p.empresa?[p.empresa]:p.filtroOrigem.empresas}:filtroGrafico(p);return d.recorte(scope).filter(x=>!d.previsto(x))}
  return{d,hoje,anos,empresas,meses,contexto,analise,natureza,originais,filtrados,celula,corte,serieMensal,cronologia,anual,comparar,acumulada,mediaMovel,variacoes,ranking,concentracao,composicao,normalizada,contribuicao,grupos,cobertura,diarios,registrosDo,tipos:[...new Set(originais.map(x=>x.tipo).filter(Boolean))].sort(),instituicoes:[...new Set(originais.map(x=>x.instituicao).filter(Boolean))].sort()};
 }
 return{criar,valor,soma,diferenca,noAno,MESES};
})();
