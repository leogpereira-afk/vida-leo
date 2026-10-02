/* Cálculos puros. Previsão usa o Dashboard A5:C19 do modelo Fortemais.
   TIR usa datas informadas, base de 365 dias, como XIRR do Excel. */
(function(root){
  const data=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
  const numero=v=>v!==''&&v!=null&&Number.isFinite(Number(v))?Number(v):null;
  function previsao(p={}){
    const campos=['venda','terreno','construcao','documentacaoPct','comissaoPct','impostoPct'];
    const faltam=campos.filter(k=>numero(p[k])===null||numero(p[k])<0||(/Pct$/.test(k)&&numero(p[k])>100));
    if(!(numero(p.venda)>0)&&!faltam.includes('venda'))faltam.push('venda');
    if(p.outras!=null&&p.outras!==''&&(numero(p.outras)===null||numero(p.outras)<0))faltam.push('outras');
    if(faltam.length)return{ok:false,faltam};
    const venda=+p.venda,terreno=+p.terreno,construcao=+p.construcao,outras=+p.outras||0;
    const documentacao=venda*p.documentacaoPct/100,comissao=venda*p.comissaoPct/100,imposto=venda*p.impostoPct/100;
    const custo=terreno+construcao+documentacao+comissao+imposto+outras,lucro=venda-custo;
    return{ok:true,venda,terreno,construcao,documentacao,comissao,imposto,outras,custo,lucro,roi:custo>0?lucro/custo*100:null,margem:lucro/venda*100};
  }
  function tir(fluxos){
    if(fluxos.some(f=>!data(f.data)||numero(f.valor)===null))return{taxa:null,motivo:'Confira datas e valores dos lançamentos.'};
    const dias=new Map();fluxos.forEach(f=>dias.set(f.data,(dias.get(f.data)||0)+Number(f.valor)));
    const fs=[...dias].sort((a,b)=>a[0].localeCompare(b[0])).filter(x=>Math.abs(x[1])>1e-8);
    if(fs.length<2||!fs.some(x=>x[1]<0)||!fs.some(x=>x[1]>0))return{taxa:null,motivo:'É preciso aporte e recebimento em datas diferentes.'};
    const mudancas=fs.slice(1).filter((x,i)=>Math.sign(x[1])!==Math.sign(fs[i][1])).length;
    // Não escolher silenciosamente uma das possíveis raízes de fluxo não convencional.
    if(mudancas>1||fs[0][1]>0)return{taxa:null,motivo:'Fluxo alternado: a TIR pode ter mais de uma solução. Confira aportes após recebimentos.'};
    const t0=Date.parse(fs[0][0]+'T00:00:00Z'),escala=Math.max(...fs.map(x=>Math.abs(x[1])));
    const series=fs.map(([d,v])=>({t:(Date.parse(d+'T00:00:00Z')-t0)/86400000/365,v:v/escala}));
    // log(1+r) evita o teto arbitrário de 100 e reduz perda de precisão perto de -100%.
    const vp=y=>series.reduce((s,f)=>s+f.v*Math.exp(-y*f.t),0);
    let lo=-20,hi=20;
    if(!(vp(lo)>0&&vp(hi)<0))return{taxa:null,motivo:'Não foi possível encontrar uma TIR finita para estas datas.'};
    for(let i=0;i<200;i++){const meio=(lo+hi)/2;if(vp(meio)>0)lo=meio;else hi=meio;}
    const taxa=Math.expm1((lo+hi)/2)*100;
    return Number.isFinite(taxa)?{taxa,motivo:''}:{taxa:null,motivo:'TIR fora do intervalo calculável.'};
  }
  function retorno(fluxos,ate){
    const problemas=fluxos.filter(f=>!data(f.data)||numero(f.valor)===null||+f.valor===0);
    const fs=fluxos.filter(f=>data(f.data)&&numero(f.valor)!==null&&(!ate||f.data<=ate));
    const futuros=fluxos.filter(f=>data(f.data)&&ate&&f.data>ate).length;
    const aportado=-fs.filter(f=>f.valor<0).reduce((s,f)=>s+Number(f.valor),0),recebido=fs.filter(f=>f.valor>0).reduce((s,f)=>s+Number(f.valor),0);
    if(problemas.length)return{aportado,recebido,saldo:null,roi:null,tir:null,futuros,motivo:'Há lançamento sem data ou valor válido. Corrija antes de calcular.'};
    const t=tir(fs);
    return{aportado,recebido,saldo:recebido-aportado,roi:aportado>0&&recebido>0?(recebido-aportado)/aportado*100:null,tir:t.taxa,motivo:t.motivo,futuros};
  }
  root.FortemaisFinance={previsao,tir,retorno,data};
})(typeof globalThis!=='undefined'?globalThis:window);
