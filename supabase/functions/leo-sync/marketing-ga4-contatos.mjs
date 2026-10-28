// Separação opt-in por propriedade; somente parâmetros categóricos já enviados pelo site.
const DIMENSAO='customEvent:contact_method';
const canais=['whatsapp','telefone','email'];
const parametros={whatsapp:'whatsapp',telephone:'telefone',email:'email'};
const vazio=()=>Object.fromEntries(canais.map(k=>[k,null]));
const dia=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const numero=v=>v!==undefined&&v!==null&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
const hojeSP=agora=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(agora));

export async function coletarContatosGA4(api,ativo,marca,janela,agora,qualidade){
 const cfg=ativo.medicaoContatos;
 if(!cfg)return null;
 const hoje=hojeSP(agora),registrado=Date.parse(cfg.registradoEm);
 const inicioMedicao=dia(cfg.inicio)&&cfg.inicio<=hoje&&Number.isFinite(registrado)&&cfg.inicio>=hojeSP(registrado)?cfg.inicio:null;
 const inicio=inicioMedicao&&inicioMedicao>janela.inicio?inicioMedicao:janela.inicio;
 const contatos={inicioMedicao,coletadoEm:new Date(agora).toISOString(),estado:'aguardando_configuracao',periodo:{inicio,fim:hoje,metricas:vazio()}};
 if(!inicioMedicao||cfg.parametro!=='contact_method'||!Number.isFinite(registrado)||registrado>agora)return {contatos,consolidado:null};
 const host={filter:{fieldName:'hostName',inListFilter:{values:[marca.host,'www.'+marca.host],caseSensitive:false}}};
 const evento={filter:{fieldName:'eventName',stringFilter:{matchType:'EXACT',value:'contact_click',caseSensitive:true}}};
 async function consultar(de,ate){
  const r=await api('https://analyticsdata.googleapis.com/v1beta/'+ativo.id+':runReport',{
   dateRanges:[{startDate:de,endDate:ate}],dimensions:[{name:DIMENSAO}],metrics:[{name:'eventCount'}],
   dimensionFilter:{andGroup:{expressions:[host,evento,{filter:{fieldName:DIMENSAO,inListFilter:{values:Object.keys(parametros),caseSensitive:true}}}]}},limit:'100',keepEmptyRows:true
  });
  if(r.metadata?.subjectToThresholding)qualidade.limiar_privacidade=true;
  if(r.metadata?.samplingMetadatas?.length)qualidade.amostragem=true;
  if((r.rowCount||0)>100)qualidade.limitado=true;
  const valores=vazio();
  for(const row of r.rows||[]){const canal=parametros[row.dimensionValues?.[0]?.value],n=numero(row.metricValues?.[0]?.value);if(canal&&n!==null)valores[canal]=(valores[canal]??0)+n;}
  return valores;
 }
 try{
  const meta=await api('https://analyticsdata.googleapis.com/v1beta/'+ativo.id+'/metadata');
  if(!meta.dimensions?.some(d=>d.apiName===DIMENSAO)){if(agora-registrado<48*3600000)contatos.estado='aguardando_dados';return {contatos,consolidado:null};}
  contatos.estado='aguardando_dados';
  // O cadastro da dimensão não torna o histórico anterior separável por canal.
  contatos.periodo.metricas=await consultar(inicio,hoje);
  if(Object.values(contatos.periodo.metricas).some(n=>n!==null))contatos.estado='ok';
 }catch{contatos.estado='erro';}
 let consolidado=null;
 if(contatos.estado!=='erro'&&contatos.estado!=='aguardando_configuracao'&&inicioMedicao<=janela.inicio){
  try{consolidado=(await consultar(janela.inicio,janela.fim)).whatsapp}catch{qualidade.contatos_indisponiveis=true;}
 }
 return {contatos,consolidado};
}

// Falhas de uma coleta opcional não apagam a última leitura confirmada.
export function preservarHistoricoGA4(novo,anterior){
 if(!anterior||novo.empresa!==anterior.empresa||novo.identidade?.site!==anterior.identidade?.site)return novo;
 const periodos=new Map((anterior.periodos||[]).map(p=>[p.inicio+'_'+p.fim,p]));
 for(const p of novo.periodos||[]){
  const chave=p.inicio+'_'+p.fim,ant=periodos.get(chave);
  if(novo.qualidade?.contatos_indisponiveis&&ant?.metricas?.cliques_whatsapp!==undefined)p.metricas.cliques_whatsapp=ant.metricas.cliques_whatsapp;
  if(['aguardando_dados','aguardando_configuracao'].includes(novo.contatos?.estado)&&p.metricas?.cliques_whatsapp===null&&ant?.metricas?.cliques_whatsapp!=null){p.metricas.cliques_whatsapp=ant.metricas.cliques_whatsapp;novo.qualidade={...novo.qualidade,contatos_desatualizados:true};}
  periodos.set(chave,p);
 }
 const resultado={...novo,periodos:[...periodos.values()].sort((a,b)=>b.fim.localeCompare(a.fim)).slice(0,12)};
 if(['erro','aguardando_dados','aguardando_configuracao'].includes(novo.contatos?.estado)&&(anterior.contatos?.estado==='ok'||anterior.contatos?.ultimaLeituraConfirmada))resultado.contatos={...anterior.contatos,estado:novo.contatos.estado,ultimaLeituraConfirmada:true,tentativaEm:novo.coletadoEm};
 return resultado;
}
