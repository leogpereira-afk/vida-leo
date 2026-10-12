// Publicação inclui módulos transitivos da fila e do catálogo pessoal.
import {validarLancamentoCentral,validarRegistroCentral,previaRegistroCentral} from './openclaw-central.ts';
import {executarCentralMake} from './openclaw-make.ts';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export const ACOES_FILA=['openclaw_propostas_listar','openclaw_propostas_criar','openclaw_propostas_decidir'];
const objeto=(v:any)=>v&&typeof v==='object'&&!Array.isArray(v);
const exigir=(ok:any,msg:string)=>{if(!ok)throw Error(msg)};
function campos(v:any,permitidos:string[]){exigir(objeto(v)&&Object.keys(v).every(k=>permitidos.includes(k)),'Campos não permitidos.');}
// Identidade canônica: ordem das propriedades não muda a proposta assinada.
export const canonical=(v:any):string=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':objeto(v)?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
export function normalizarProposta(p:any){
 campos(p,['id','registro']);exigir(UUID.test(p.id||''),'ID inválido.');
 const r=p.registro;exigir(objeto(r)&&r.chave===p.id,'Chave da proposta inválida.');
 let registro:any;
 if(r.tipo==='lista'){
  campos(r,['tipo','chave','lancamento','esperado','versaoEsperada']);
  exigir(/^\d{1,19}$/.test(r.versaoEsperada||'')&&(r.esperado===null||objeto(r.esperado)),'Prévia ou versão inválida.');
  const l=validarLancamentoCentral(r.lancamento),s=r.lancamento.semelhantes;
  exigir(s===undefined||Array.isArray(s)&&s.length<=100&&s.every((x:any)=>typeof x==='string'&&x.length<=150),'Semelhantes inválidos.');
  registro={tipo:'lista',chave:p.id,lancamento:{...l,...(s?{semelhantes:s}:{})},esperado:r.esperado,versaoEsperada:r.versaoEsperada};
 }else{
  campos(r,['tipo','chave','id','dados','esperado']);
  exigir(['viagem','hotel','demanda'].includes(r.tipo)&&typeof r.id==='string'&&r.id.length<=150&&(r.esperado===null||objeto(r.esperado)),'Registro inválido.');
  const {id,...dados}=r.dados||{};
  if(r.tipo==='hotel')exigir(UUID.test(id||''),'ID do hotel inválido.');else exigir(id===undefined,'ID fora do contrato.');
  const limpos=validarRegistroCentral(r.tipo,r.id,dados);
  registro={tipo:r.tipo,id:r.id,chave:p.id,dados:{...limpos,...(id?{id}:{})},esperado:r.esperado};
 }
 exigir(JSON.stringify(registro).length<=30000,'Proposta acima do limite.');
 return {id:p.id,registro,previa:previaRegistroCentral(registro),estado:'pendente'};
}
export function projetar(q:any){return {id:q.id,estado:q.estado,previa:q.previa,criadoEm:q.criado_em,atualizadoEm:q.atualizado_em,recibo:q.recibo||null,erro:q.erro||null,gravado:q.estado==='confirmado',expirada:q.estado==='pendente'&&Date.now()-Date.parse(q.criado_em)>86400000};}
export async function autenticarOpenclaw(req:Request,corpo:any,db:any,agora=Date.now()){
 try{
  if(req.method!=='POST'||!ACOES_FILA.includes(corpo?.acao))return false;
  const ts=req.headers.get('x-openclaw-ts')||'',sig=req.headers.get('x-openclaw-signature')||'';
  if(!/^\d{10}$/.test(ts)||Math.abs(agora/1000-Number(ts))>120||!/^[a-f0-9]{64}$/.test(sig))return false;
  const raw=JSON.stringify(corpo);if(raw.length>35000)return false;
  const {data,error}=await db.from('donboy_ponte').select('hash').limit(2);
  if(error||data?.length!==1||!/^[a-f0-9]{64}$/.test(data[0].hash))return false;
  const enc=new TextEncoder(),key=await crypto.subtle.importKey('raw',enc.encode(data[0].hash),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  return crypto.subtle.verify('HMAC',key,new Uint8Array(sig.match(/../g)!.map(x=>parseInt(x,16))),enc.encode(ts+'\n'+corpo.acao+'\n'+raw));
 }catch{return false}
}
export function bancoFila(db:any){
 const checked=async(q:any)=>{const {data,error}=await q;if(error)throw Error('Fila indisponível. Nenhuma confirmação recebida.');return data};
 return {
  listar:()=>checked(db.from('leo_openclaw_propostas').select('*').order('criado_em',{ascending:false}).limit(101)),
  obter:(id:string)=>checked(db.from('leo_openclaw_propostas').select('*').eq('id',id).maybeSingle()),
  criar:async(q:any)=>{const {error}=await db.from('leo_openclaw_propostas').insert(q);if(error&&error.code!=='23505')throw Error('Proposta não foi salva.');},
  trocar:(id:string,estado:string,dados:any)=>checked(db.from('leo_openclaw_propostas').update({...dados,atualizado_em:new Date().toISOString()}).eq('id',id).eq('estado',estado).select('*').maybeSingle()),
  recibo:async(q:any)=>{const {data,error}=await db.rpc('donboy_central_recibo',{p_acao:q.registro.tipo==='lista'?'central_confirmar':'central_registrar',p_registro:q.registro});if(error)throw Error('Não foi possível conferir o recibo.');return data},
  executar:async(q:any)=>{const c=await checked(db.from('donboy_central_make_config').select('webhook,segredo,ativo').eq('id',true).single());if(!c?.ativo)throw Error('Conexão Make da Central inativa.');return executarCentralMake({acao:q.registro.tipo==='lista'?'central_confirmar':'central_registrar',registro:q.registro},c)}
 };
}
export async function operarFila(c:any,b:any){
 exigir(ACOES_FILA.includes(c?.acao),'Ação inválida.');
 if(c.acao==='openclaw_propostas_listar'){
  campos(c,['acao']);const itens=await b.listar();return {ok:true,propostas:itens.slice(0,100).map(projetar),parcial:itens.length>100,consultadoEm:new Date().toISOString()};
 }
 if(c.acao==='openclaw_propostas_criar'){
  campos(c,['acao','proposta']);const q=normalizarProposta(c.proposta);
  await b.criar(q);const atual=await b.obter(q.id);
  exigir(atual&&canonical(atual.registro)===canonical(q.registro),'Esse ID já corresponde a outra proposta.');
  return {ok:true,proposta:projetar(atual)};
 }
 campos(c,['acao','id','decisao']);exigir(UUID.test(c.id||'')&&['aprovar','reprovar','conferir'].includes(c.decisao),'Decisão inválida.');
 let q=await b.obter(c.id);exigir(q,'Proposta não encontrada.');
 if(q.estado==='confirmado')return {ok:true,proposta:projetar(q),jaConcluido:true};
 if(c.decisao==='reprovar'){
  exigir(q.estado==='pendente','Apenas proposta ainda não executada pode ser reprovada.');
  const r=await b.trocar(q.id,'pendente',{estado:'reprovado'});exigir(r,'Proposta mudou. Atualize a fila.');return {ok:true,proposta:projetar(r)};
 }
 // Conferir nunca repete a escrita: usa apenas o recibo da chave original.
 if(c.decisao==='conferir'){
  exigir(['incerto','executando'].includes(q.estado),'Não há execução pendente de conferência.');
 }else{
  exigir(q.estado==='pendente','Não repita a aprovação. Use conferir resultado.');
  exigir(Date.now()-Date.parse(q.criado_em)<=86400000,'Prévia expirada. Prepare uma nova conferência no chat.');
  const r=await b.trocar(q.id,'pendente',{estado:'executando',erro:null});exigir(r,'Já existe uma decisão em andamento. Atualize a fila.');q=r;
  try{await b.executar(q)}catch{/* A consulta do recibo decide o resultado, não o HTTP do Make. */}
 }
 let recibo=null;try{recibo=await b.recibo(q)}catch{/* Preserve o estado incerto. */}
 const confirmado=recibo?.gravado===true&&!!(recibo.item_id||recibo.id);
 const patch=confirmado?{estado:'confirmado',recibo,erro:null}:{estado:'incerto',erro:'A gravação ainda não foi confirmada. Confira o resultado; não refaça o lançamento.'};
 const atual=await b.trocar(q.id,q.estado,patch)||await b.obter(q.id);
 return {ok:true,proposta:projetar(atual)};
}
