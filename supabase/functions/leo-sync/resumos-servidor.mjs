import {coletarResumo} from './resumos-core.mjs';
export const CHAVE_RESUMOS='inicio_google_cache';
const bases={gmail:'https://gmail.googleapis.com/gmail/v1/users/me/',drive:'https://www.googleapis.com/drive/v3/'};
export function permiteResumo(escopo,servico){const scopes=new Set((escopo||'').split(/\s+/));return scopes.has('https://www.googleapis.com/auth/'+(servico==='gmail'?'gmail.readonly':'drive.readonly'));}
export async function atualizarResumos(sb,obterToken,{fetcher=fetch,agora=()=>new Date()}={}){
 const lerConfig=async chave=>{const r=await sb.from('leo_config').select('valor').eq('chave',chave).maybeSingle();if(r.error)throw Error('banco');return r.data?.valor};
 const gravar=async valor=>{const r=await sb.from('leo_config').upsert({chave:CHAVE_RESUMOS,valor,atualizado_em:agora().toISOString()},{onConflict:'chave'});if(r.error)throw Error('banco');};
 const anterior=await lerConfig(CHAVE_RESUMOS)||{};
 const conexao=await lerConfig('google_refresh');
 const acesso=await obterToken();
 if(!acesso?.token){await gravar({});return {ok:false,motivo:'autorizacao'};}
 const resultado={};
 for(const servico of ['gmail','drive']){
  if(!permiteResumo(acesso.escopo,servico)){resultado[servico]={precisaAutorizar:true};continue;}
  let semPermissao=false;
  try{
   const dados=await coletarResumo(servico,async(s,path)=>{
    if(s!==servico||!bases[s])throw Error('servico');
    const r=await fetcher(bases[s]+path,{headers:{Authorization:'Bearer '+acesso.token},signal:AbortSignal.timeout(8000)});
    if(!r.ok){if([401,403].includes(r.status))semPermissao=true;const e=Error('consulta');e.status=r.status;throw e;}return r.json();
   });
   // Somente o resumo necessário; nunca corpo, snippet, anexos ou conteúdo dos arquivos.
   if(semPermissao)throw Error('permissao');
   const items=dados.items.map(x=>servico==='drive'?{id:x.id,name:x.name}:{id:x.id,threadId:x.threadId,internalDate:x.internalDate,labelIds:(x.labelIds||[]).filter(v=>v==='UNREAD'),payload:{headers:(x.payload?.headers||[]).filter(h=>['subject','from','date'].includes(h.name.toLowerCase())).map(h=>({name:h.name,value:h.value}))}});
   resultado[servico]={items,conta:dados.conta||'',parcial:!!dados.parcial,em:agora().getTime()};
  }catch(e){resultado[servico]=semPermissao||[401,403].includes(e.status)?{precisaAutorizar:true}:{...anterior[servico],erro:'Consulta indisponível. Última leitura preservada.',tentativa:agora().getTime()};}
 }
 // Desconectar durante a coleta não pode ressuscitar um cache privado.
 const refresh=await lerConfig('google_refresh');
 if(!refresh?.token||refresh.token!==conexao?.token){return {ok:false,motivo:'conexao_alterada'};}
 await gravar(resultado);
 return {ok:true,servicos:Object.fromEntries(Object.entries(resultado).map(([k,v])=>[k,{atualizado:!!v.em&&!v.erro,pendente:!!(v.erro||v.precisaAutorizar),quantidade:v.items?.length||0}]))};
}
