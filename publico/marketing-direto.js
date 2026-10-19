(function(root){
'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const NOMES={ga4:'Site · Analytics',search:'Busca Google',perfil:'Perfil da Empresa',instagram:'Instagram',meta_ads:'Meta Ads',google_ads:'Google Ads'};
const RESULTADOS={projeto_ads:'Projeto Google aguardando acesso de produção',ok:'Leitura concluída',parcial:'Leitura parcial',api_desativada:'API ainda não ativada',escopo:'Revisar autorização',permissao:'Permissão insuficiente',temporario:'Serviço indisponível',coleta:'Falha na leitura',renovar:'Reconectar autorização',vinculo:'Revisar vínculo'};
// Uma única conclusão por retorno: a sincronização inicial pode remontar a tela.
const retornos=new Map();
function concluirRetorno(chamar,empresa){
 if(retornos.has(empresa))return retornos.get(empresa);
 if(!root.location||!root.sessionStorage)return Promise.resolve(false);
 const q=new URLSearchParams(root.location.search),nonce=q.get('fm');if(!nonce)return Promise.resolve(false);
 const prova=root.sessionStorage.getItem(empresa==='domo'?'dm-direto-prova':'fm-direto-prova');
 const retorno=(async()=>{
  root.history.replaceState(null,'',root.location.pathname+'#marketing');
  if(q.get('resultado')!=='ok')throw Error('O provedor não concluiu a autorização. Revise o aplicativo e conecte novamente.');
  await chamar('marketingDiretoConfirmar',{nonce,prova});root.sessionStorage.removeItem(empresa==='domo'?'dm-direto-prova':'fm-direto-prova');return true;
 })();retornos.set(empresa,retorno);return retorno;
}
function montar(el,{api,atualizar,empresa='fortemais'}){
 if(!['fortemais','domo'].includes(empresa))throw Error('Empresa inválida.');
 const nome=empresa==='domo'?'Domo':'Fortemais';
 let status=null,aviso='',ocupado=false,lista=null;
 const chamar=async (acao,extra={})=>{const r=await api('POST',{acao,empresa,...extra});if(r?.ok!==true)throw Error(r?.erro||'Não foi possível concluir a conexão.');return r};
 function desenhar(){if(!el.isConnected)return;el.innerHTML=`<section class="mkt-fonte fmkt-direto"><header><div><h2>Conexões diretas</h2><p class="mkt-nota">Google e Meta → servidor da Central → este painel. Sem Make. Coleta somente de leitura, iniciada por você.</p></div></header><p role="status" aria-live="polite">${esc(aviso)}</p>${!status?'<p>Consultando configuração…</p>':`<div class="fmkt-admin-grid">${['google','google_ads','meta'].map(p=>{const s=status.provedores[p]||{};return `<article class="fmkt-admin"><h3>${p==='google'?'Google · Site, Busca e Perfil':p==='google_ads'?'Google Ads · Relatórios':'Meta · Instagram e anúncios'}</h3><p>${!s.configurado?'Aplicativo direto ainda precisa ser configurado no servidor.':s.autorizado?'Autorização guardada. A coleta confirma o acesso a cada ativo.':'Aguardando sua autorização no provedor.'}</p><button type="button" data-conectar="${p}" ${ocupado||!s.configurado?'disabled':''}>${s.autorizado?'Reconectar':'Conectar diretamente'}</button></article>`}).join('')}</div><div class="fmkt-admin-grid">${Object.entries(NOMES).map(([f,n])=>{const a=status.fontes[f]||{},p=f==='google_ads'?'google_ads':['ga4','search','perfil'].includes(f)?'google':'meta';return `<article class="fmkt-admin"><h3>${n}</h3><p>${esc(a.ativo?.nome||'Ativo ainda não selecionado')}</p>${a.resultado?`<p>${esc(RESULTADOS[a.resultado]||'Revisar conexão')} · ${esc(a.tentativaEm?new Date(a.tentativaEm).toLocaleString('pt-BR'):'')}</p>`:''}<div class="fmkt-acoes"><button type="button" data-listar="${f}" ${ocupado||!status.provedores[p]?.autorizado?'disabled':''}>Selecionar conta</button><button type="button" data-coletar="${f}" ${ocupado||!a.ativo?'disabled':''}>Coletar indicadores</button></div></article>`}).join('')}</div><p class="mkt-nota">Google Ads usa autorização própria e exige acesso de produção no projeto Google Cloud. O painel consulta relatórios; não altera campanhas.</p>`}${lista?`<form data-vincular><h3>Vincular ${NOMES[lista.fonte]} à ${nome}</h3><p>${['meta_ads','google_ads'].includes(lista.fonte)?`Escolha somente a conta de anúncios da ${nome}. A seleção confirma esse vínculo.`:'O servidor confere o site ou perfil antes de salvar.'}</p>${lista.ativos.length?`<select name="ativo">${lista.ativos.map(a=>`<option value="${esc(a.id)}">${esc(a.nome)} · ${esc(a.id)}</option>`).join('')}</select><button type="submit" ${ocupado?'disabled':''}>Vincular à ${nome}</button>`:'<p>Nenhum ativo elegível foi encontrado nessa autorização.</p>'}${lista.limitado?'<p>Lista parcial: algumas contas não puderam ser incluídas ou o limite de consulta foi atingido.</p>':''}</form>`:''}</section>`;
 el.querySelectorAll('[data-conectar]').forEach(b=>b.onclick=()=>executar(async()=>{const bytes=crypto.getRandomValues(new Uint8Array(32)),prova=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');root.sessionStorage.setItem(empresa==='domo'?'dm-direto-prova':'fm-direto-prova',prova);const r=await chamar('marketingDiretoInicio',{provedor:b.dataset.conectar,prova});const u=new URL(r.url);if(!['accounts.google.com','www.facebook.com'].includes(u.hostname)||u.protocol!=='https:')throw Error('Endereço de autorização inválido.');root.location.assign(r.url)}));
 el.querySelectorAll('[data-listar]').forEach(b=>b.onclick=()=>executar(async()=>{lista={fonte:b.dataset.listar,...await chamar('marketingDiretoListar',{fonte:b.dataset.listar})}}));
 el.querySelectorAll('[data-coletar]').forEach(b=>b.onclick=()=>executar(async()=>{const r=await chamar('marketingDiretoColetar',{fonte:b.dataset.coletar});aviso=r.estado==='ok'?'Indicadores recebidos. Use Atualizar leitura para vê-los.':'Coleta parcial recebida. Confira os indicadores disponíveis e suas limitações.';status=await chamar('marketingDiretoStatus')}));
 const form=el.querySelector('[data-vincular]');if(form)form.onsubmit=e=>{e.preventDefault();executar(async()=>{await chamar('marketingDiretoVincular',{fonte:lista.fonte,ativo:form.querySelector('select').value});lista=null;status=await chamar('marketingDiretoStatus');aviso='Ativo vinculado. Agora você pode coletar os indicadores.'})};
 }
 async function executar(fn){if(ocupado)return;ocupado=true;aviso='';desenhar();try{await fn()}catch(e){aviso=e.message||'Não foi possível concluir.'}finally{ocupado=false;desenhar()}}
 desenhar();executar(async()=>{let confirmou=false,falha;try{confirmou=await concluirRetorno(chamar,empresa)}catch(e){falha=e}status=await chamar('marketingDiretoStatus');if(falha)throw falha;if(confirmou)aviso=`Autorização direta concluída. Selecione os ativos da ${nome} para coletar.`});
 return {ocupado:()=>ocupado};
}
root.LeoMarketingDireto={montar};
})(globalThis);
