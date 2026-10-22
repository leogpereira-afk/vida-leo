import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

const resposta=(dados,status=200)=>({status,ok:status>=200&&status<300,json:async()=>structuredClone(dados)});
const pendente=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}};
const rodada=()=>new Promise(resolve=>setImmediate(resolve));
const copiar=valor=>structuredClone(valor);
function inverterChaves(valor){
  if(Array.isArray(valor))return valor.map(inverterChaves);
  return valor&&typeof valor==='object'?Object.fromEntries(Object.entries(valor).reverse().map(([k,v])=>[k,inverterChaves(v)])):valor;
}
async function app(preparar=''){
  const a=setup(),itens=new Map([['cl_token','sessao-sintetica']]);
  const storage={getItem:k=>itens.get(k)||null,setItem:(k,v)=>itens.set(k,String(v)),removeItem:k=>itens.delete(k)};
  a.ctx.localStorage=storage;a.ctx.sessionStorage=storage;a.alertas=[];a.ctx.alert=texto=>a.alertas.push(texto);
  a.run(`window.__testeSync=true;E=carregar();E._mt=100;${preparar};guardarEstadoLocal(E)`);
  a.remoto={mt:10,dados:JSON.parse(a.run('JSON.stringify(E)'))};
  a.ctx.fetch=async()=>resposta(a.remoto);
  await a.run('puxarNuvem()');
  assert.equal(a.run('_tabBase'),10);assert.equal(a.alertas.length,0);
  return a;
}
function formulario(a){
  a.run("novoCompromissoRotina('2027-01-10')");
  const modal=a.document.querySelector('#modais .fundo');
  modal.querySelector('[name=titulo]').value='Texto ainda em edição';
  return modal;
}
function conferirFormulario(a,modal){
  assert.ok(a.document.querySelector('#modais .fundo')===modal,'A conferência mantém o formulário aberto e suas referências');
  assert.equal(modal.querySelector('[name=titulo]').value,'Texto ainda em edição');
  assert.equal(a.alertas.length,0,'Gravação própria ou metadados não são outro acesso com alteração de conteúdo');
  assert.equal(a.run('lerRascunhoSync()'),null,'O formulário não precisou ser substituído por recuperação');
}
function editar(a,titulo='Alteração local pendente'){
  a.ctx.tituloLocal=titulo;
  a.run("E.agenda=[{id:'local',titulo:tituloLocal,data:'2027-01-10'}];E._mt=150;guardarEstadoLocal(E)");
}
function metadados(a,mt=20){
  const dados=inverterChaves(copiar(a.remoto.dados));
  dados._mt=mt*100;dados.agendaGoogleUltima={em:'2026-10-22T12:00:00Z',novos:0,atualizados:0,arquivados:0,pendencias:0,origem:'servidor'};
  return {mt,dados};
}

test('Sync: GET anterior ao próprio PUT espera a confirmação sem fechar o formulário',async()=>{
  const a=await app(),modal=formulario(a),get=pendente(),put=pendente();
  let enviado;
  a.ctx.fetch=async(_,op)=>{
    if(op.method==='GET')return get.promise;
    enviado=JSON.parse(op.body);return put.promise;
  };
  const leitura=a.run('puxarNuvem()');editar(a);
  const envio=a.run('enviarNuvem()');
  assert.equal(enviado.base,10);
  get.resolve(resposta({mt:20,dados:enviado.dados}));await rodada();
  const alertasAntesDaConfirmacao=a.alertas.length;
  put.resolve(resposta({mt:20}));await Promise.all([leitura,envio]);
  assert.equal(alertasAntesDaConfirmacao,0,'O GET não pode chamar o próprio PUT de outro acesso enquanto ele aguarda resposta');
  conferirFormulario(a,modal);assert.equal(a.run('_tabBase'),20);
});

test('Sync: leitura iniciada durante PUT usa a base confirmada depois do envio',async()=>{
  const a=await app(),modal=formulario(a),put=pendente();editar(a);
  let gets=0,enviado;
  a.ctx.fetch=async(_,op)=>{
    if(op.method==='PUT'){enviado=JSON.parse(op.body);return put.promise}
    gets++;return resposta({mt:20,dados:enviado.dados});
  };
  const envio=a.run('enviarNuvem()'),leitura=a.run('puxarNuvem()');
  assert.equal(gets,0);put.resolve(resposta({mt:20}));await Promise.all([envio,leitura]);
  assert.equal(gets,1);conferirFormulario(a,modal);assert.equal(a.run('_tabBase'),20);
});

test('Sync: metadados da Agenda e ordem de chaves JSONB avançam a base sem trocar o formulário',async()=>{
  const a=await app(),modal=formulario(a),remoto=metadados(a);
  a.run('var estadoAntesDaConferencia=E');a.ctx.fetch=async()=>resposta(remoto);
  await a.run('puxarNuvem()');
  conferirFormulario(a,modal);assert.equal(a.run('E===estadoAntesDaConferencia'),true);
  assert.equal(a.run('_tabBase'),20);assert.equal(a.run('E._mt'),2000);
  assert.equal(a.run('E.agendaGoogleUltima.origem'),'servidor');
  assert.equal(a.run('lerEstadoLocal().agendaGoogleUltima.origem'),'servidor');
});

test('Sync: botão Sincronizar mantém texto inline quando a conferência só atualiza metadados',async()=>{
  const a=await app(),remoto=metadados(a);
  a.run('document.getElementById("main").appendChild(el(\'<section data-uso-direto><label>Notas<textarea name="notas">Texto inline ainda em edição</textarea></label></section>\'))');
  const campo=a.document.querySelector('[data-uso-direto] textarea');
  a.ctx.fetch=async()=>resposta(remoto);await a.run('sincronizarAgora()');
  assert.ok(a.document.querySelector('[data-uso-direto] textarea')===campo,'Sincronizar não recria a tela sem mudança de conteúdo');
  assert.equal(campo.value,'Texto inline ainda em edição');assert.equal(a.alertas.length,0);
});

test('Sync: metadados mais novos preservam conteúdo local pendente com _mt menor e fazem PUT com CAS atualizado',async()=>{
  const a=await app(),modal=formulario(a),remoto=metadados(a);editar(a);
  const puts=[];
  a.ctx.fetch=async(_,op)=>{
    if(op.method==='GET')return resposta(remoto);
    puts.push(JSON.parse(op.body));return resposta({mt:21});
  };
  await a.run('puxarNuvem()');
  conferirFormulario(a,modal);assert.equal(puts.length,1);assert.equal(puts[0].base,20);
  assert.equal(puts[0].dados.agenda[0].titulo,'Alteração local pendente');
  assert.equal(puts[0].dados.agendaGoogleUltima.origem,'servidor');
  assert.equal(a.run('E.agenda[0].titulo'),'Alteração local pendente');assert.equal(a.run('_tabBase'),21);
});

test('Sync: PUT 409 somente por metadados relê a base e tenta uma única vez com o conteúdo local',async()=>{
  const a=await app(),modal=formulario(a),remoto=metadados(a);editar(a);
  const puts=[];
  a.ctx.fetch=async(_,op)=>{
    if(op.method==='GET')return resposta(remoto);
    puts.push(JSON.parse(op.body));return puts.length===1?resposta({erro:'conflito',mt:20},409):resposta({mt:21});
  };
  const ok=await a.run('enviarNuvem()');
  assert.equal(ok,true);assert.deepEqual(puts.map(p=>p.base),[10,20]);
  assert.ok(puts.every(p=>p.dados.agenda[0].titulo==='Alteração local pendente'));
  conferirFormulario(a,modal);assert.equal(a.run('_tabBase'),21);
});

test('Sync: segundo 409 de metadados encerra a tentativa e preserva edição local e formulário',async()=>{
  const a=await app(),modal=formulario(a);editar(a);
  let puts=0,gets=0;
  a.ctx.fetch=async(_,op)=>{
    if(op.method==='GET')return resposta(metadados(a,20+(gets++)));
    puts++;return resposta({erro:'conflito'},409);
  };
  assert.equal(await a.run('enviarNuvem()'),false);
  assert.equal(puts,2,'Uma rodada não faz tentativas sem limite');assert.equal(gets,2);
  assert.equal(a.run('E.agenda[0].titulo'),'Alteração local pendente');conferirFormulario(a,modal);
});

test('Sync: falha ao conferir 409 mantém base anterior e não autoriza outro PUT',async()=>{
  const a=await app(),modal=formulario(a);editar(a);let puts=0;
  a.ctx.fetch=async(_,op)=>{
    if(op.method==='GET')throw Error('rede indisponível');
    puts++;return resposta({erro:'conflito'},409);
  };
  assert.equal(await a.run('enviarNuvem()'),false);assert.equal(puts,1);
  assert.equal(a.run('_tabBase'),10);assert.equal(a.run('E.agenda[0].titulo'),'Alteração local pendente');conferirFormulario(a,modal);
});

test('Sync: a base do PUT confirmado reflete o payload enviado mesmo com nova edição durante a resposta',async()=>{
  const a=await app(),modal=formulario(a),primeiro=pendente();editar(a,'Primeiro envio');
  let enviado;
  a.ctx.fetch=async(_,op)=>{enviado=JSON.parse(op.body);return primeiro.promise};
  const envio=a.run('enviarNuvem()');editar(a,'Segunda edição preservada');
  primeiro.resolve(resposta({mt:20}));await envio;
  a.remoto={mt:20,dados:enviado.dados};const remoto=metadados(a,30),puts=[];
  a.ctx.fetch=async(_,op)=>{
    if(op.method==='GET')return resposta(remoto);
    puts.push(JSON.parse(op.body));return resposta({mt:31});
  };
  await a.run('puxarNuvem()');
  assert.equal(puts.length,1);assert.equal(puts[0].base,30);
  assert.equal(puts[0].dados.agenda[0].titulo,'Segunda edição preservada');conferirFormulario(a,modal);
});

for(const [nome,alterar] of [
  ['evento Google',d=>{d.agenda[0].googleAtualizado='mudou'}],
  ['histórico da agenda',d=>{d.agendaGoogleHistorico[0].em='2026-10-22T13:00:00Z'}],
  ['_mt dentro de registro',d=>{d.agenda[0]._mt=2}],
  ['agendaGoogleUltima dentro de registro',d=>{d.agenda[0].agendaGoogleUltima='mudou'}],
  ['ordem dos compromissos',d=>{d.agenda.reverse()}],
])test('Sync: mudança real em '+nome+' continua preservando rascunho e adotando servidor',async()=>{
  const a=await app("E.agenda=[{id:'a',titulo:'Compromisso A',googleAtualizado:'anterior',_mt:1,agendaGoogleUltima:'anterior'},{id:'b',titulo:'Compromisso B'}];E.agendaGoogleHistorico=[{em:'2026-10-22T11:00:00Z',registro:{id:'antigo'}}]");
  formulario(a);const remoto=metadados(a);alterar(remoto.dados);
  a.ctx.fetch=async()=>resposta(remoto);await a.run('puxarNuvem()');
  assert.equal(a.alertas.length,1);assert.match(a.alertas[0],/Outro acesso/);
  assert.equal(a.document.querySelector('#modais .fundo'),null);
  assert.match(a.run('JSON.stringify(lerRascunhoSync())'),/Texto ainda em edição/);
  assert.equal(a.run('_tabBase'),20);
});

test('Sync: PUT 409 com alteração real adota servidor e preserva rascunho sem repetir a gravação',async()=>{
  const a=await app(),modal=formulario(a);editar(a);
  const remoto=metadados(a);remoto.dados.agenda=[{id:'outro',titulo:'Salvo em outro aparelho'}];let puts=0;
  a.ctx.fetch=async(_,op)=>op.method==='GET'?resposta(remoto):(puts++,resposta({erro:'conflito'},409));
  assert.equal(await a.run('enviarNuvem()'),false);assert.equal(puts,1);
  assert.equal(a.run('E.agenda[0].titulo'),'Salvo em outro aparelho');assert.equal(a.alertas.length,1);
  assert.notEqual(a.document.querySelector('#modais .fundo'),modal);
  assert.match(a.run('JSON.stringify(lerRascunhoSync())'),/Texto ainda em edição/);
});
