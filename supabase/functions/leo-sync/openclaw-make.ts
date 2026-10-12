// O Make recebe uma autorização curta para um único pedido, nunca a chave da ponte.
const ACOES=new Set(['central_registrar','central_confirmar','central_diagnostico']);
const enc=new TextEncoder();
export const acaoCentralMake=(acao:unknown)=>typeof acao==='string'&&ACOES.has(acao);
async function chave(segredo:string){if(segredo.length<32)throw Error('Assinatura da Central não configurada.');return crypto.subtle.importKey('raw',enc.encode(segredo),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
const hex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
export async function assinarCentral(pedido:Record<string,unknown>,segredo:string,agora=Date.now()){
 if(!acaoCentralMake(pedido.acao))throw Error('Operação não permitida via Make.');
 const payload=JSON.stringify({aud:'donboy-central-pessoal-v1',exp:agora+120000,pedido});
 if(payload.length>40000)throw Error('Pedido grande demais.');
 return {payload,assinatura:hex(await crypto.subtle.sign('HMAC',await chave(segredo),enc.encode(payload)))};
}
export async function conferirCentral(envelope:unknown,segredo:string,agora=Date.now()):Promise<Record<string,unknown>>{
 const e=envelope as {payload?:unknown;assinatura?:unknown};
 if(!e||typeof e.payload!=='string'||e.payload.length>40000||typeof e.assinatura!=='string'||!/^[a-f0-9]{64}$/.test(e.assinatura))throw Error('Pedido assinado inválido.');
 const assinatura=new Uint8Array(e.assinatura.match(/../g)!.map(x=>parseInt(x,16)));
 if(!await crypto.subtle.verify('HMAC',await chave(segredo),assinatura,enc.encode(e.payload)))throw Error('Assinatura inválida.');
 const p=JSON.parse(e.payload);
 if(p.aud!=='donboy-central-pessoal-v1'||!Number.isSafeInteger(p.exp)||p.exp<agora||p.exp>agora+120000||!p.pedido||!acaoCentralMake(p.pedido.acao))throw Error('Pedido expirado ou fora do escopo.');
 return p.pedido;
}
export async function executarCentralMake(pedido:Record<string,unknown>,config:{webhook:string;segredo:string},buscar:typeof fetch=fetch){
 if(!/^https:\/\/hook\.us1\.make\.com\/[a-z0-9]+$/.test(config.webhook))throw Error('Make da Central ainda não configurado.');
 const envelope=await assinarCentral(pedido,config.segredo);
 let r:Response;
 try{r=await buscar(config.webhook,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({envelope:JSON.stringify(envelope)}),redirect:'error',signal:AbortSignal.timeout(45000)});}catch{throw Error('Make sem confirmação. O resultado pode ser incerto; confira o pedido antes de repetir.');}
 if(!r.ok)throw Error(`Make retornou HTTP ${r.status}; gravação não confirmada.`);
 let retorno:any;
 try{retorno=await r.json();}catch{throw Error('Make não devolveu recibo JSON. Resultado incerto.');}
 if(retorno?.erro)throw Error(String(retorno.erro).slice(0,500));
 if(pedido.acao==='central_diagnostico' ? retorno?.dados?.diagnostico!=='central-pessoal-20261007' : retorno?.dados?.gravado!==true)throw Error('A Central não confirmou o resultado via Make.');
 return retorno;
}
