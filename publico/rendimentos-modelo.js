/* Cálculos puros. Nenhum histórico é somado novamente aos lançamentos do mesmo ano. */
const RendimentosModelo=(()=>{
 const numero=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v))?Number(v):null;
 const data=v=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(v||''))return false;const d=new Date(v+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v};
 const mensal=x=>data(x.data)&&!/lançado em 31\/12/i.test(x.obs||'')&&x.granularidade!=='anual';
 const soma=xs=>xs.length?xs.reduce((s,x)=>s+x,0):null;
 const delta=(a,b)=>a==null||b==null?{valor:null,percentual:null}:{valor:a-b,percentual:b>0?(a-b)/b*100:null};
 function construir(registros,historico={},hoje=new Date().toISOString().slice(0,10)){
  const validos=(registros||[]).filter(x=>data(x.data)&&numero(x.valor)!==null);
  const invalidos=(registros||[]).filter(x=>!validos.includes(x));
  const anos=[...new Set([...(historico.anos||[]).map(Number),...validos.map(x=>+x.data.slice(0,4)),+hoje.slice(0,4)])].filter(a=>Number.isInteger(a)&&a>=1000&&a<=9999).sort((a,b)=>a-b);
  const nome=x=>x.empresa||'Sem empresa identificada';
  const empresas=[...new Set([...Object.keys(historico.empresas||{}),...validos.map(nome)])].sort((a,b)=>a.localeCompare(b));
  const porAno=new Map(anos.map(a=>[a,validos.filter(x=>+x.data.slice(0,4)===a)]));
  const previsto=x=>x.situacao==='Previsto'||(mensal(x)&&x.data>hoje);
  function recorte({anos:selAnos=anos,empresas:selEmp=[],meses=[],de='',ate='',busca='',tipo='',situacao='Todos'}={}){
   const q=String(busca).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
   return validos.filter(x=>selAnos.includes(+x.data.slice(0,4))&&(!selEmp.length||selEmp.includes(nome(x)))&&(!meses.length||(mensal(x)&&meses.includes(+x.data.slice(5,7))))&&(!de||(mensal(x)&&x.data>=de))&&(!ate||(mensal(x)&&x.data<=ate))&&(!tipo||x.tipo===tipo)&&(!q||[x.data,nome(x),x.instituicao,x.tipo,x.obs,x.valor].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q))&&(situacao==='Todos'||(situacao==='Previstos'?previsto(x):situacao==='Ajustes'?+x.valor<0:!previsto(x))));
  }
  function celula(ano,emp=[],meses=[],de='',ate=''){
   const registrosAno=porAno.get(ano)||[];
   const restrito=meses.length>0||de||ate;
   if(registrosAno.length){
    const itens=recorte({anos:[ano],empresas:emp,meses,de,ate}).filter(x=>!previsto(x));
    const reais=itens.filter(mensal);const valor=soma(itens.map(x=>+x.valor));
    return {ano,valor,itens,meses:[...new Set(reais.map(x=>+x.data.slice(5,7)))].sort((a,b)=>a-b),fonte:restrito?'Lançamentos datados':'Lançamentos',semMes:itens.filter(x=>!mensal(x)).length,parcial:ano>=+hoje.slice(0,4)||(historico.parciais||historico.incompletos||[]).map(Number).includes(ano)};
   }
   const i=(historico.anos||[]).map(Number).indexOf(ano);
   let valor=null;
   if(i>=0&&!restrito)valor=emp.length?soma(emp.map(e=>numero(historico.empresas?.[e]?.[i])).filter(x=>x!==null)):numero(historico.totalAno?.[i]);
   return {ano,valor,itens:[],meses:[],fonte:valor===null?'Sem informação':'Histórico anual',semMes:valor===null?0:1,parcial:(historico.parciais||historico.incompletos||[]).map(Number).includes(ano)||ano>=+hoje.slice(0,4)};
  }
  function analisar(f={}){
   const a=f.anos||anos,emp=f.empresas||[],meses=f.meses||[],cells=a.map(y=>celula(y,emp,meses,f.de,f.ate));
   const total=soma(cells.map(c=>c.valor).filter(v=>v!==null));
   const linhas=recorte(f),reais=recorte({anos:a,empresas:emp,meses,de:f.de,ate:f.ate}).filter(x=>!previsto(x)&&mensal(x));
   const mesesReais=new Set(reais.map(x=>x.data.slice(0,7)));
   const rank=(emp.length?emp:empresas).map(e=>({nome:e,valor:soma(a.map(y=>celula(y,[e],meses,f.de,f.ate).valor).filter(v=>v!==null))})).filter(x=>x.valor!==null).sort((a,b)=>b.valor-a.valor);
   const baseRank=soma(rank.map(x=>x.valor));
   const residual=total===null?null:total-(baseRank||0);if(residual!==null&&Math.abs(residual)>.005)rank.push({nome:'Sem empresa no histórico',valor:residual,semEmpresa:true});
   const conciliacao=a.map(ano=>{const i=(historico.anos||[]).map(Number).indexOf(ano),base=i<0?null:numero(historico.totalAno?.[i]);const list=(porAno.get(ano)||[]).filter(x=>!previsto(x));const atual=soma(list.map(x=>+x.valor));return{ano,base,atual,diferenca:base===null||atual===null?null:atual-base}});
   return {cells,total,linhas,rank,media:mesesReais.size?reais.reduce((s,x)=>s+(+x.valor),0)/mesesReais.size:null,nMeses:mesesReais.size,previstos:linhas.filter(previsto),conciliacao,invalidos,semMes:cells.reduce((s,c)=>s+c.semMes,0)};
  }
  function comparar(a,b){
   // Ano corrente é comparado até o mesmo mês; totais anuais sem datas não entram nesse corte.
   let meses=a.meses||[];const y=+hoje.slice(0,4);if(!meses.length&&(a.ano===y||b.ano===y))meses=Array.from({length:+hoje.slice(5,7)},(_,i)=>i+1);
   const A=celula(a.ano,a.empresas||[],meses,a.de,a.ate),B=celula(b.ano,b.empresas||[],meses,b.de,b.ate);
   const completo=meses.length?meses.every(m=>A.meses.includes(m)&&B.meses.includes(m)):!A.parcial&&!B.parcial&&[A,B].every(c=>c.fonte==='Histórico anual'||c.semMes>0||c.meses.length===12);
   return {a:A,b:B,meses,...delta(A.valor,B.valor),comparavel:completo&&A.valor!==null&&B.valor!==null,percentual:completo?delta(A.valor,B.valor).percentual:null};
  }
  return{anos,empresas,validos,invalidos,mensal,previsto,nome,recorte,celula,analisar,comparar};
 }
 return{construir,delta,data,mensal,numero};
})();
