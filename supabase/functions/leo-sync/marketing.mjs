import {CHAVE_FORTEMAIS, CHAVE_ADMIN, detalharFortemais} from './marketing-fortemais.mjs';
// Resumo de leitura para o dono da Central. Nunca retorna tokens, público,
// comentários, contatos nem o cache bruto. A origem tem vínculo fixo por empresa.
export const EMPRESAS = Object.freeze([
  {id:'fortemais',nome:'Fortemais'}, {id:'impresilk',nome:'Impresilk'},
  {id:'domo',nome:'Domo'}, {id:'minaslab',nome:'MinasLab'},
  {id:'diamond',nome:'Diamond'}, {id:'bosques',nome:'Portal dos Bosques'},
]);
const CONFIG = {
  impresilk:{host:'impresilk.com.br',instagram:'impresilk',google:'mkt_fonte_google',meta:'mkt_fonte_meta'},
  fortemais:{host:'fortemais.net',instagram:'fortemais'},
};
const lista=x=>Array.isArray(x)?x:[];
const txt=x=>typeof x==='string'?x.slice(0,180):null;
const numero=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0?x:null;
const dia=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x?x:null;
const instante=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))?new Date(x).toISOString():null;
const host=x=>{try{return new URL(x).hostname.toLowerCase().replace(/^www\./,'')}catch{return null}};
const estados=['ok','parcial','falta_configurar','falta_conectar','reconectar','aguardando_aprovacao','erro'];
const MOTIVOS={falta_configurar:'Falta configurar a fonte desta empresa.',falta_conectar:'Falta autorizar a conta desta empresa.',reconectar:'A fonte precisa de nova autorização.',aguardando_aprovacao:'Aguardando aprovação do provedor.',erro:'A última coleta falhou.',parcial:'A última coleta trouxe dados parciais.'};
const METRICAS={site:['usuarios','sessoes','visualizacoes','eventos_chave'],google:['impressoes','cliques_site','ligacoes','rotas'],instagram:['alcance','visualizacoes','interacoes','toques_links']};

function semanas(linhas,tipo){
  const vistos=new Set();
  return lista(linhas).filter(r=>r&&dia(r.semana)).slice(-12).map(r=>{
    if(vistos.has(r.semana))throw Error('Semana duplicada na fonte.');vistos.add(r.semana);
    const pronta=tipo==='instagram'?r.madura===true:tipo==='google'?r.fechada===true:true;
    return {semana:r.semana,pronta,...Object.fromEntries(METRICAS[tipo].map(k=>[k,pronta?numero(r[k]):null]))};
  }).sort((a,b)=>a.semana.localeCompare(b.semana));
}

function fonte(tipo,cache,identidade,agora){
  const parte=tipo==='site'?'ga4':tipo==='google'?'perfil':'instagram';
  const p=cache?.partes?.[parte];
  const dados=cache?.dados?.[parte];
  const base={id:tipo,estado:'falta_conectar',coletadoEm:null,atrasado:false,identidade:null,semanas:[],origens:[],paginas:[],periodo:null,avisos:[]};
  if(!cache)return {...base,motivo:MOTIVOS.falta_conectar};
  const estado=estados.includes(p?.estado)?p.estado:'erro';
  const coletadoEm=instante(p?.coletado_em);
  const atual={...base,estado,coletadoEm,atrasado:!!coletadoEm&&agora-Date.parse(coletadoEm)>48*3600000,motivo:MOTIVOS[estado]||null};
  if(tipo==='google'&&estado==='aguardando_aprovacao')atual.motivo='O acesso à API do Perfil da Empresa aguarda aprovação do Google.';
  if(!dados)return atual;
  const certa=tipo==='instagram'?dados.usuario?.toLowerCase()===identidade.instagram:
    host(tipo==='site'?dados.propriedade?.fluxo?.site:dados.local?.site)===identidade.host;
  if(!certa)return {...base,estado:'vinculo_divergente',motivo:'A conta coletada não corresponde à empresa selecionada. Revise o vínculo.'};
  // Histórico só é exibido com a data da parte, não com a data geral da coleta.
  if(!coletadoEm)return {...atual,estado:'erro',motivo:'A fonte não confirmou a data de leitura destes indicadores.'};
  atual.identidade=tipo==='instagram'?'@'+identidade.instagram:identidade.host;
  atual.semanas=semanas(tipo==='instagram'?dados.por_semana:dados.semanas,tipo);
  if(tipo==='site'){
    atual.periodo={inicio:dia(cache.dados?.periodo?.inicio),fim:dia(cache.dados?.periodo?.fim)};
    // A origem é semanal. Páginas são de toda a janela: nunca fingir filtro semanal.
    atual.origens=lista(dados.canais).filter(r=>dia(r.semana)).slice(0,300).map(r=>({semana:r.semana,nome:txt(r.canal),sessoes:numero(r.sessoes)}));
    atual.paginas=lista(dados.paginas).slice(0,10).map(r=>({nome:txt(r.caminho),visualizacoes:numero(r.visualizacoes)}));
    if(lista(dados.cortados).length||lista(dados.recusados).length)atual.avisos.push('Alguns relatórios foram limitados ou recusados pelo Google.');
    if(dados.qualidade?.limiar_privacidade||dados.qualidade?.amostragem||dados.qualidade?.linha_other)atual.avisos.push('O Google aplicou limites de qualidade ou privacidade aos dados.');
  }
  if(tipo==='instagram')atual.avisos.push('Os números da conta podem incluir anúncios. Alcance não é visita ao perfil.');
  if(tipo==='google'&&estado==='aguardando_aprovacao')atual.motivo='O acesso à API do Perfil da Empresa aguarda aprovação do Google.';
  return atual;
}

export function resumirMarketing(empresa,linhas,agora=Date.now()){
  const marca=EMPRESAS.find(x=>x.id===empresa);
  if(!marca)throw Error('Empresa inválida.');
  const config=CONFIG[empresa]||{};
  const porChave=new Map(lista(linhas).map(r=>[r.chave,r.valor]));
  // Os conectores atuais são exclusivos da Impresilk. Outras empresas nunca
  // herdam seu cache. A configuração e autorização delas são uma etapa separada.
  return {ok:true,empresa:marca,empresas:EMPRESAS,lidoEm:new Date(agora).toISOString(),
    fontes:['site','google','instagram'].map(tipo=>fonte(tipo,porChave.get(tipo==='instagram'?config.meta:config.google),config,agora)),
    ...(empresa==='fortemais'?{detalhe:detalharFortemais(linhas,agora)}:{})};
}

export async function lerMarketing(sb,empresa,agora=Date.now()){
  if(!EMPRESAS.some(x=>x.id===empresa))throw Error('Empresa inválida.');
  const config=CONFIG[empresa]||{};
  const chaves=empresa==='fortemais'?[CHAVE_FORTEMAIS,CHAVE_ADMIN,...["ga4","search","perfil","instagram","meta_ads","google_ads"].map(f=>"leo_marketing_fortemais_direto_"+f)]:[config.google,config.meta].filter(Boolean);
  if(!chaves.length)return resumirMarketing(empresa,[],agora);
  const {data,error}=await sb.from('painel_cache').select('chave,valor').in('chave',chaves);
  if(error)throw Error('Não foi possível consultar os indicadores. Tente novamente.');
  return resumirMarketing(empresa,data,agora);
}
