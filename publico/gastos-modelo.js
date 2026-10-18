/* Leitura de Gastos. Competência = campo mes; recorrentes atuais não viram histórico. */
const GastosModelo=(()=>{
 const MESES=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
 const moeda=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
 const soma=rows=>rows.length?rows.reduce((s,r)=>s+Math.round(Number(r.valor)*100),0)/100:null;
 const mesValido=s=>/^\d{4}-(0[1-9]|1[0-2])$/.test(String(s||''));
 function criar(lancamentos=[],cadastros=[],hoje,f={}){
  const mapa=new Map(cadastros.filter(e=>e.id).map(e=>[String(e.id),e])),entidades=new Map();
  for(const e of mapa.values())entidades.set(String(e.id),{id:String(e.id),nome:e.nome||'Empresa sem nome',pendente:false});
  function empresa(g){
   const nome=String(g.empresa||g.empresaNome||'').trim(),id=String(g.empresaId||'');
   if(id){if(mapa.has(id))return entidades.get(id);const key='ausente:'+id;return{id:key,nome:(nome||'Empresa não localizada')+' · vínculo a conferir',pendente:true}}
   if(nome){const candidatos=[...mapa.values()].filter(e=>e.nome===nome);if(candidatos.length===1)return entidades.get(String(candidatos[0].id));return{id:'legado:'+nome,nome:nome+(candidatos.length?' · vínculo ambíguo':' · legado'),pendente:true}}
   return{id:'sem-vinculo',nome:'Sem empresa / pessoal',pendente:true};
  }
  const validos=[],invalidos=[];
  for(const registro of lancamentos){if(!registro||!mesValido(registro.mes)||registro.valor===null||registro.valor===undefined||String(registro.valor).trim()===''||!['number','string'].includes(typeof registro.valor)||!Number.isFinite(Number(registro.valor))){invalidos.push(registro);continue}
   const e=empresa(registro);entidades.set(e.id,e);validos.push({registro,id:registro.id,ano:+registro.mes.slice(0,4),mes:+registro.mes.slice(5,7),iso:registro.mes,valor:moeda(registro.valor),empresa:e.id,empresaNome:e.nome,vinculoPendente:e.pendente,categoria:registro.classe||registro.categoria||'Sem categoria',situacao:registro.situacao||'Não informado',futuro:registro.mes>hoje.slice(0,7)});
  }
  const anosDisponiveis=[...new Set([+hoje.slice(0,4),...validos.map(r=>r.ano)])].sort((a,b)=>a-b),anos=[...new Set((f.anos||[+hoje.slice(0,4)]).map(Number))].sort((a,b)=>a-b);
  const contexto={anos,empresas:f.empresas||[],meses:f.meses||[],categoria:f.categoria||'',situacao:f.situacao||''};
  function filtrar(escopo={},incluirFuturos=false){const s={...contexto,...escopo};return validos.filter(r=>(incluirFuturos||!r.futuro)&&(!Array.isArray(s.anos)||s.anos.includes(r.ano))&&(!s.empresas?.length||s.empresas.includes(r.empresa))&&(!s.meses?.length||s.meses.includes(r.mes))&&(!s.categoria||r.categoria===s.categoria)&&(!s.situacao||r.situacao===s.situacao)&&(!s.ateMes||r.mes<=s.ateMes));}
  function celula(ano,empresaId,meses=contexto.meses,modo='filtros'){
   const escopo={...contexto,anos:[ano],empresas:empresaId?[empresaId]:contexto.empresas,meses,...(modo==='equivalente'?{ateMes:+hoje.slice(5,7)}:{})},rows=filtrar(escopo);
   return{ano,valor:soma(rows),escopo,n:rows.length,parcial:ano>=+hoje.slice(0,4),cobertura:new Set(rows.map(r=>r.iso)).size};
  }
  function serie(ano,empresaId,modo='filtros'){return MESES.map((rotulo,i)=>{const mes=i+1,c=celula(ano,empresaId,[mes],modo),excluido=(contexto.meses.length&&!contexto.meses.includes(mes))||(modo==='equivalente'&&mes>+hoje.slice(5,7));return{...c,mes,rotulo,iso:ano+'-'+String(mes).padStart(2,'0'),valor:excluido?null:c.valor,excluido:!!excluido,futuro:ano+'-'+String(mes).padStart(2,'0')>hoje.slice(0,7)}})}
  function cronologia(empresaId){if(!anos.length)return[];const out=[];for(let y=anos[0];y<=Math.min(anos.at(-1),+hoje.slice(0,4));y++)out.push(...serie(y,empresaId).map(p=>anos.includes(y)?p:{...p,valor:null,excluido:true}));return out.filter(p=>!p.futuro)}
  function anual(empresaId,modo='filtros'){return anos.map(y=>({...celula(y,empresaId,contexto.meses,modo),rotulo:String(y)}))}
  function comparar(a,b,empresaId,modo='equivalente'){const x=celula(a,empresaId,contexto.meses,modo),y=celula(b,empresaId,contexto.meses,modo);return{a:x,b:y,valor:x.valor===null||y.valor===null?null:moeda(x.valor-y.valor),percentual:x.valor===null||y.valor===null||y.valor<=0?null:(x.valor-y.valor)/y.valor*100,escopos:[x.escopo,y.escopo]}}
  function ranking(campo='empresa'){const grupos=new Map();for(const r of filtrar()){const key=r[campo],grupo=grupos.get(key)||{id:key,nome:campo==='empresa'?r.empresaNome:key,rows:[]};grupo.rows.push(r);grupos.set(key,grupo)}return[...grupos.values()].map(g=>({id:g.id,nome:g.nome,valor:soma(g.rows),escopo:{...contexto,...(campo==='empresa'?{empresas:[g.id]}:{categoria:g.id})}})).sort((a,b)=>b.valor-a.valor)}
  function resumo(){const rows=filtrar(),nMeses=new Set(rows.map(r=>r.iso)).size,total=soma(rows);return{total,n:rows.length,nMeses,media:nMeses?moeda(total/nMeses):null,estornos:soma(rows.filter(r=>r.valor<0))??0,pagos:soma(rows.filter(r=>r.situacao==='Pago'))??0,pendentes:soma(rows.filter(r=>r.situacao==='Pendente'))??0,semSituacao:rows.filter(r=>r.situacao==='Não informado').length,semVinculo:rows.filter(r=>r.vinculoPendente).length}}
  function acumulada(ps){let v=0,incompleto=false;const escopos=[];return ps.map(p=>{if(p.valor===null){if(!p.excluido&&!p.futuro)incompleto=true;return{...p,incompleto}}v=moeda(v+p.valor);escopos.push(p.escopo);return{...p,valor:v,incompleto,escopos:escopos.slice()}})}
  function variacoes(ps){return ps.map((p,i)=>({...p,valor:i&&p.valor!==null&&ps[i-1].valor!==null?moeda(p.valor-ps[i-1].valor):null,escopos:i?[p.escopo,ps[i-1].escopo]:[p.escopo]}))}
  function registros(escopo=contexto){return filtrar(escopo).map(r=>r.registro)}
  const futuros=filtrar({},true).filter(r=>r.futuro),pendenciasVinculo=filtrar().filter(r=>r.vinculoPendente);
  return{MESES,hoje,contexto,anos,anosDisponiveis,empresas:[...entidades.values()].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')),categorias:[...new Set(validos.map(r=>r.categoria))].sort(),validos,invalidos,futuros,pendenciasVinculo,filtrar,celula,serie,cronologia,anual,comparar,ranking,resumo,acumulada,variacoes,registros};
 }
 return{criar,MESES,moeda,mesValido};
})();
