import {consultarSincronizacaoAgenda,reconciliarAgendaGoogle} from './agenda-core.mjs';
// Só leitura no Google. Grava exclusivamente a agenda do estado existente,
// por compare-and-swap; qualquer edição concorrente adia esta rodada inteira.
export async function sincronizarAgendaServidor(sb,obterToken,{fetcher=fetch,agora=()=>new Date(),novoId=()=>crypto.randomUUID()}={}){
 const inicio=agora(),prazo=Date.now()+85000;
 const registrar=async valor=>{const r=await sb.from('leo_config').upsert({chave:'agenda_cron_status',valor,atualizado_em:agora().toISOString()},{onConflict:'chave'});if(r.error)throw Error('status');};
 try{
  const {data:estado,error}=await sb.from('leo_estado').select('mt,dados').eq('id',true).maybeSingle();
  if(error||!estado||!Array.isArray(estado.dados?.agenda))throw Error('estado');
  const acesso=await obterToken();if(!acesso?.token)throw Error('autorizacao');
  const ler=async(_,path)=>{
   if(Date.now()>prazo)throw Error('prazo');
   const r=await fetcher('https://www.googleapis.com/calendar/v3/'+path,{headers:{Authorization:'Bearer '+acesso.token},signal:AbortSignal.timeout(Math.min(15000,Math.max(1,prazo-Date.now())))});
   if(!r.ok)throw Error('google');return r.json();
  };
  const consulta=await consultarSincronizacaoAgenda(estado.dados.agenda,ler,inicio);
  if(Date.now()>prazo)throw Error('prazo');
  const plano=reconciliarAgendaGoogle(estado.dados.agenda,estado.dados.agendaGoogleHistorico,consulta.lotes,inicio.toISOString(),novoId);
  const ultima={em:inicio.toISOString(),...plano.cont,pendencias:consulta.pendencias.length,origem:'servidor'};
  const mt=Math.max(agora().getTime(),Number(estado.mt)+1);
  const dados={...estado.dados,agenda:plano.agenda,agendaGoogleHistorico:plano.historico,agendaGoogleUltima:ultima,_mt:mt};
  const gravado=await sb.from('leo_estado').update({dados,mt,atualizado_em:agora().toISOString()}).eq('id',true).eq('mt',estado.mt).select('mt');
  if(gravado.error)throw Error('gravacao');
  if(!gravado.data?.length){await registrar({em:inicio.toISOString(),situacao:'adiado_por_edicao'});return {ok:true,adiado:true};}
  await registrar({em:inicio.toISOString(),situacao:consulta.pendencias.length?'parcial':'ok',...plano.cont,pendencias:consulta.pendencias.length});
  return {ok:true,...plano.cont,pendencias:consulta.pendencias.length};
 }catch(e){
  // Nunca registrar payload Google, token ou mensagens de erro que contenham dados.
  const motivo=['estado','autorizacao','prazo','gravacao'].includes(e.message)?e.message:'consulta';
  await registrar({em:inicio.toISOString(),situacao:'erro',motivo}).catch(()=>{});
  return {ok:false,motivo};
 }
}
