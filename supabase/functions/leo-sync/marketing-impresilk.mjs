import {CATALOGO,projetarFonte,limparAdmin} from './marketing-fortemais.mjs';
import {marcaMarketing} from './marketing-marcas.mjs';
// Adapta somente os caches exclusivos da Impresilk. Nenhum contato, token,
// público nominal, texto de avaliação ou lead é incluído na projeção.
const arr=x=>Array.isArray(x)?x:[];
const num=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0?x:null;
const ratio=(a,b)=>num(a)!==null&&num(b)>0?a/b:null;
const add=(s,n)=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&Number.isFinite(Date.parse(s+'T12:00:00Z'))?new Date(Date.parse(s+'T12:00:00Z')+n*86400000).toISOString().slice(0,10):null;
const host=s=>{try{return new URL(s?.replace(/^sc-domain:/,'https://')).hostname.replace(/^www\./,'').toLowerCase()}catch{return ''}};
const map=(r,aliases={})=>({...r,...Object.fromEntries(Object.entries(aliases).map(([to,from])=>[to,r?.[from]]))});
const status=s=>({ok:'ok',parcial:'parcial',falta_configurar:'pendente',falta_conectar:'pendente',aguardando_aprovacao:'aguardando_provedor',reconectar:'reconectar',sem_permissao:'sem_permissao'}[s]||'erro');
function semanas(rows,transform,ready=r=>r.fechada===true,dias=[]){return arr(rows).map(r=>({inicio:r.semana,fim:r.fim||add(r.semana,6),completo:ready(r),metricas:ready(r)?transform(r):{},serie:arr(dias).filter(d=>(d.data||d.dia)>=r.semana&&(d.data||d.dia)<=(r.fim||add(r.semana,6))).map(d=>({dia:d.data||d.dia,...transform(d)}))}));}
function criar(cache,parte,identidade,periodos,extras={}){
 const p=cache?.partes?.[parte];
 return cache?{empresa:'impresilk',estado:status(p?.estado||cache.estado),coletadoEm:p?.coletado_em||null,identidade,periodos,...extras}:null;
}
export function detalharImpresilk(linhas,agora=Date.now()){
 const c=new Map(arr(linhas).map(r=>[r.chave,r.valor])),g=c.get('mkt_fonte_google'),m=c.get('mkt_fonte_meta'),a=c.get('mkt_fonte_google_ads');
 const gd=g?.dados||{},md=m?.dados||{},ad=a?.dados||{},ga=gd.ga4,sc=gd.search_console,gp=gd.perfil,ig=md.instagram;
 const raw={};
 const gaMap=r=>({...map(r,{novos_usuarios:'novos'}),tempo_engajamento:ratio(r.tempo_engajamento_s,r.sessoes)});
 const gps=semanas(ga?.semanas,gaMap,()=>true,ga?.dias);
 for(const p of gps){p.tabelas={canais:arr(ga?.canais).filter(r=>r.semana===p.inicio).map(r=>({...r,nome:r.canal})),dispositivos:arr(ga?.aparelhos).filter(r=>r.semana===p.inicio).map(r=>({...r,nome:r.aparelho}))};}
 // Listagens da janela completa não são apresentadas como listagens semanais.
 if(gd.periodo)gps.push({inicio:gd.periodo.inicio,fim:gd.periodo.fim,completo:false,metricas:{},tabelas:{paginas:arr(ga?.paginas).map(r=>({...r,nome:r.caminho})),cidades:arr(ga?.cidades).map(r=>({...r,nome:r.cidade}))}});
 raw.ga4=criar(g,'ga4',{site:ga?.propriedade?.fluxo?.site},gps,{qualidade:{...ga?.qualidade,limitado:arr(ga?.cortados).length>0}});
 raw.search=criar(g,'search_console',{site:sc?.propriedade?.site?.replace(/^sc-domain:/,'https://')},semanas(sc?.semanas,r=>r,r=>r.fechada===true,sc?.dias),{qualidade:{limitado:arr(sc?.cortados).length>0}});
 if(gd.periodo&&raw.search)raw.search.periodos.push({inicio:gd.periodo.inicio,fim:gd.periodo.fim,completo:false,metricas:sc?.tipos?.web||{},tabelas:{consultas:arr(sc?.consultas).map(r=>({...r,nome:r.consulta})),paginas:arr(sc?.paginas).map(r=>({...r,nome:r.pagina}))}});
 const ps=semanas(gp?.semanas,r=>r,r=>r.fechada===true,gp?.dias);
 for(const p of ps){const days=arr(gp?.dias).filter(r=>r.data>=p.inicio&&r.data<=p.fim);for(const tipo of ['busca','maps']){const vals=days.flatMap(d=>[d['impressoes_'+tipo+'_computador'],d['impressoes_'+tipo+'_celular']]);p.metricas['impressoes_'+tipo]=p.completo&&days.length===7&&vals.every(v=>num(v)!==null)?vals.reduce((x,y)=>x+y,0):null;}}
 raw.perfil=criar(g,'perfil',{site:gp?.local?.site},ps);
 raw.instagram=criar(m,'instagram',{usuario:ig?.usuario},semanas(ig?.por_semana,r=>map(r,{salvos:'salvamentos'}),r=>r.madura===true));
 // A página precisa ter sido escolhida pelo vínculo cadastrado, nunca por ser
 // a primeira página retornada pela API. A conta de anúncios e pixel também
 // pertencem ao conector dedicado; múltiplos ativos não são somados.
 const page=md.pagina,fbOk=page?.escolhida_por==='link'&&ig?.usuario?.toLowerCase()==='impresilk';
 raw.facebook=criar(m,'pagina',{nome:page?.nome,vinculo_confirmado:fbOk},semanas(page?.por_semana,r=>map(r,{interacoes:'engajamento',cliques:'cliques_acao'}),r=>r.dias_com_dado===7,page?.por_dia));
 const accts=arr(md.anuncios?.contas),ma=accts.length===1?accts[0]:null;
 const maMap=r=>({...r,cliques:r.cliques_link,ctr:ratio(r.cliques_link,r.impressoes),cpc:ratio(r.gasto,r.cliques_link),custo_lead:ratio(r.gasto,r.leads)});
 raw.meta_ads=criar(m,'anuncios',{conta:ma?.numero||ma?.id?.replace(/^act_/,''),vinculo_confirmado:!!ma&&fbOk},semanas(ma?.por_semana,maMap,r=>r.fechada===true,ma?.por_dia),{moeda:ma?.moeda});
 const account=ad.conta;
 const adsMap=r=>map(r,{cpc:'cpcMedio',custo_conversao:'custoPorConversao'});
 raw.google_ads=criar(a,'resumo',{conta:account?.idFormatado||account?.id,vinculo_confirmado:account?.tagConfere===true},semanas(ad.resumo?.semanas,adsMap,r=>r.fechada===true,ad.resumo?.dias),{moeda:account?.moeda});
 const pixels=arr(md.pixel?.pixels),matched=pixels.filter(p=>arr(p.urls).some(u=>host(u.url)==='impresilk.com.br')),px=matched.length===1?matched[0]:null;
 const pxMap=e=>({pageview:e?.PageView,lead:e?.Lead,contact:e?.Contact,eventos:e&&Object.values(e).every(v=>num(v)!==null)?Object.values(e).reduce((x,y)=>x+y,0):null});
 raw.pixel=criar(m,'pixel',{nome:px?.nome,vinculo_confirmado:!!px&&fbOk},md.pixel?.periodo?[{...md.pixel.periodo,completo:true,metricas:pxMap(px?.eventos_total),tabelas:{eventos:Object.entries(px?.eventos_total||{}).map(([nome,eventos])=>({nome,eventos}))},serie:arr(px?.eventos_por_dia).map(r=>({dia:r.dia,...pxMap(r.eventos)}))}]:[]);
 for(const id of ['linkedin','pinterest']){
  const cache=c.get('mkt_fonte_'+id),d=cache?.dados||{},perfil=id==='linkedin'?d.pagina:d.perfil;
  const parte=id==='linkedin'?'conteudo':'conta';
  const rows=id==='linkedin'?d.conteudo?.semanas:d.conta?.total?.semanas;
  raw[id]=criar(cache,parte,{nome:perfil?.nome,vinculo_confirmado:host(perfil?.site)==='impresilk.com.br'},semanas(rows,r=>id==='linkedin'?map(r,{reacoes:'curtidas'}):map(r,{cliques:'cliques_pin'}),r=>id==='linkedin'||r.pronta===true));
  // Ainda não conectado: não apresentar vínculo divergente por falta de perfil.
  if(!perfil)raw[id]=null;
 }
 for(const [id,data] of Object.entries({ga4:ga,search:sc,perfil:gp,instagram:ig,facebook:page,google_ads:account,meta_ads:ma,pixel:px}))if(!data)raw[id]=null;
 const marca=marcaMarketing('impresilk');
 return {versao:1,fontes:Object.keys(CATALOGO).map(id=>{
  const f=projetarFonte(id,raw[id],agora,marca);
  if(id==='pixel'&&pixels.length>1)f.avisos.push('Exibe somente o pixel identificado por eventos no domínio impresilk.com.br. Outros pixels não foram somados.');
  if(id==='ga4')f.avisos.push('Listagens da janela completa têm período próprio; visitantes semanais não são somados.');
  if(['linkedin','pinterest'].includes(id)&&!['ok','parcial'].includes(f.estado))f.avisos.push('Confira em Administração a situação da autorização e as pendências desta fonte.');
  return f;
 }),administracao:limparAdmin(c.get('leo_marketing_impresilk_admin'),'impresilk')};
}
