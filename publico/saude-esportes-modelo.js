/* Biblioteca pública: consultas bibliográficas genéricas, sem ler os dados de Saúde. */
var SaudeEsportesModelo=(function(){
  'use strict';
  const CHAVE='vidaLeo.esportes.estudos.v1';
  const ENDPOINT='https://www.ebi.ac.uk/europepmc/webservices/rest/search';
  const TERMOS={
    corrida:'(TITLE:running OR TITLE:runners OR TITLE:marathon) AND (TITLE:injury OR TITLE:training OR TITLE:shoe OR TITLE:cadence)',
    hyrox:'TITLE:hyrox',
    mtb:'(TITLE:"mountain biking" OR TITLE:"mountain bike")',
    musculacao:'(TITLE:"resistance training" OR TITLE:"strength training") AND (TITLE:hypertrophy OR TITLE:"muscular strength" OR TITLE:volume OR TITLE:"training load" OR TITLE:"healthy adults" OR TITLE:failure)'
  };
  const estados={},pendentes={};
  const texto=v=>String(v??'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
  function valido(id){if(!Object.prototype.hasOwnProperty.call(TERMOS,id))throw Error('Modalidade desconhecida.');return id}
  function dataValida(v){return typeof v==='string'&&Number.isFinite(Date.parse(v))}
  function dataPublicacao(v){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(v)))return'';
    const d=new Date(v+'T00:00:00Z');
    return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v?v:'';
  }
  function item(x){
    if(x?.source!=='MED'||!/^\d{1,12}$/.test(String(x.id||''))||!texto(x.title))return null;
    return{id:String(x.id),title:texto(x.title).slice(0,600),authors:texto(x.authorString).slice(0,400),journal:texto(x.journalTitle).slice(0,180),year:/^\d{4}$/.test(String(x.pubYear))?String(x.pubYear):'',date:dataPublicacao(x.firstPublicationDate),url:'https://pubmed.ncbi.nlm.nih.gov/'+x.id+'/'};
  }
  function normalizar(resposta){
    if(!Array.isArray(resposta?.resultList?.result))throw Error('Resposta bibliográfica inválida.');
    const vistos=new Set();
    return resposta.resultList.result.map(item).filter(x=>x&&!vistos.has(x.id)&&vistos.add(x.id)).slice(0,8);
  }
  function lerCache(id){
    try{const d=JSON.parse(localStorage.getItem(CHAVE+'.'+id)||'null');return d?.version===1?d:{}}catch(_){return{}}
  }
  for(const id of Object.keys(TERMOS)){
    const anterior=lerCache(id);let items=[];
    if(Array.isArray(anterior?.items))items=normalizar({resultList:{result:anterior.items.map(x=>({source:'MED',id:x?.id,title:x?.title,authorString:x?.authors,journalTitle:x?.journal,pubYear:x?.year,firstPublicationDate:x?.date}))}});
    estados[id]={items,checkedAt:dataValida(anterior?.checkedAt)?anterior.checkedAt:'',error:'',loading:false,cacheWarning:''};
  }
  function get(id){return estados[valido(id)]}
  function query(id,agora=new Date()){
    valido(id);const d=new Date(agora);if(!Number.isFinite(d.getTime()))throw Error('Data inválida.');
    const ate=d.toISOString().slice(0,10),de=(d.getUTCFullYear()-3)+'-01-01';
    return TERMOS[id]+' AND SRC:MED AND FIRST_PDATE:['+de+' TO '+ate+'] NOT (TITLE:mice OR TITLE:rats OR TITLE:rat OR TITLE:mouse) sort_date:y';
  }
  function salvar(id){
    // Uma chave por modalidade evita que abas distintas sobrescrevam outras consultas.
    const s=estados[id];
    try{localStorage.setItem(CHAVE+'.'+id,JSON.stringify({version:1,items:s.items,checkedAt:s.checkedAt}));return''}catch(_){return'Consulta concluída; não foi possível guardar a lista neste dispositivo.'}
  }
  function atualizar(id){
    valido(id);if(pendentes[id])return pendentes[id];
    const s=estados[id];s.loading=true;s.error='';s.cacheWarning='';
    pendentes[id]=(async()=>{
      const controlador=typeof AbortController!=='undefined'?new AbortController():null;
      let temporizador;
      try{
        const parametros=new URLSearchParams({query:query(id),format:'json',resultType:'lite',pageSize:'8'});
        const requisicao=(async()=>{const r=await fetch(ENDPOINT+'?'+parametros,{credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',...(controlador?{signal:controlador.signal}:{})});if(!r.ok)throw Error('Serviço bibliográfico indisponível.');return r.json()})();
        const limite=new Promise((_,reject)=>{temporizador=setTimeout(()=>{controlador?.abort();reject(Error('A consulta demorou além do esperado.'))},15000)});
        const dados=await Promise.race([requisicao,limite]);
        const items=normalizar(dados);
        if(dados.resultList.result.length&&!items.length)throw Error('Resposta bibliográfica incompatível.');
        s.items=items;s.checkedAt=new Date().toISOString();s.cacheWarning=salvar(id);
      }catch(_){s.error='Não foi possível atualizar os estudos. A última consulta foi mantida. Confira a conexão e tente novamente.'}
      finally{clearTimeout(temporizador);s.loading=false;delete pendentes[id]}
      return s;
    })();
    return pendentes[id];
  }
  async function atualizarTodas(){
    // Duas requisições por vez, sem duplicar consultas já em andamento.
    await Promise.all([atualizar('corrida'),atualizar('hyrox')]);
    await Promise.all([atualizar('mtb'),atualizar('musculacao')]);
    return Object.fromEntries(Object.keys(TERMOS).map(id=>[id,get(id)]));
  }
  return{get,query,normalizar,atualizar,atualizarTodas};
})();
