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

const demandasDuasAbas="E.demandas=[{id:'teste',titulo:'Cadastro sintético de sincronização',status:'Aberta',obs:'Conferência encerrada'},{id:'preservar',titulo:'Outra demanda sintética',status:'Aberta'}];E.agendaGoogleHistorico=[]";
function exclusaoEmOutraAba(a){
  const remoto=metadados(a);remoto.dados.demandas=remoto.dados.demandas.filter(d=>d.id!=='teste');return remoto;
}

test('Sync: aba sem edição adota exclusão remota por GET sem alerta, mesmo com busca focada',async()=>{
  const a=await app(demandasDuasAbas),remoto=exclusaoEmOutraAba(a);
  a.run("atual='demandas';filtro.demandasBusca='sintética';tela()");
  const busca=a.document.querySelector('.rotina-busca input');
  Object.defineProperty(a.document,'activeElement',{configurable:true,value:busca});
  let puts=0;
  a.ctx.fetch=async(_,op)=>{if(op.method==='PUT')puts++;return resposta(remoto)};
  await a.run('puxarNuvem()');
  assert.equal(a.alertas.length,0,'Uma aba sem edição apenas acompanha o que mudou no servidor');
  assert.equal(puts,0);assert.equal(a.run('E.demandas.length'),1);
  assert.equal(a.run('E.demandas[0].id'),'preservar');assert.equal(a.run('_tabBase'),20);
  assert.equal(a.run('filtro.demandasBusca'),'sintética');assert.equal(a.run('lerRascunhoSync()'),null);
});

test('Sync: PUT automático só de metadados recebe exclusão remota sem alerta nem nova gravação',async()=>{
  const a=await app(demandasDuasAbas),remoto=exclusaoEmOutraAba(a);let puts=0;
  a.run("E.agendaGoogleUltima={em:'2026-10-22T12:05:00Z',novos:0,atualizados:0};salvar()");
  a.ctx.fetch=async(_,op)=>op.method==='GET'?resposta(remoto):(puts++,resposta({erro:'conflito'},409));
  assert.equal(await a.run('enviarNuvem()'),false,'O PUT recusado não passa a ser uma gravação confirmada');
  assert.equal(a.alertas.length,0,'Metadados locais não transformam atualização remota em conflito de edição');
  assert.equal(puts,1);assert.equal(a.run('E.demandas.length'),1);
  assert.equal(a.run('E.demandas[0].id'),'preservar');assert.equal(a.run('_tabBase'),20);
});

for(const caminho of ['GET','PUT 409'])test('Sync: conflito de conteúdo local sem modal continua avisando por '+caminho,async()=>{
  const a=await app(demandasDuasAbas),remoto=exclusaoEmOutraAba(a);
  a.run("E.demandas[0].obs='Nota local ainda não enviada';salvar()");
  let puts=0;
  a.ctx.fetch=async(_,op)=>op.method==='GET'?resposta(remoto):(puts++,resposta({erro:'conflito'},409));
  await a.run(caminho==='GET'?'puxarNuvem()':'enviarNuvem()');
  assert.equal(a.alertas.length,1);assert.match(a.alertas[0],/Outro acesso/);
  assert.equal(a.run("JSON.parse(localStorage.getItem('cl_descartado')).dados.demandas[0].obs"),'Nota local ainda não enviada');
  assert.equal(a.run('E.demandas.length'),1);assert.equal(a.run('E.demandas[0].id'),'preservar');
  assert.equal(puts,caminho==='GET'?0:1);
});

test('Sync: base de conteúdo desconhecida continua avisando ao adotar alteração remota',async()=>{
  const a=await app(demandasDuasAbas),remoto=exclusaoEmOutraAba(a);
  a.run('_tabConteudo=null');a.ctx.fetch=async()=>resposta(remoto);await a.run('puxarNuvem()');
  assert.equal(a.alertas.length,1);assert.equal(a.run('_tabBase'),20);
});

for(const origem of ['data-uso-direto','fortemais'])test('Sync: formulário inline '+origem+' mantém aviso e recuperação mesmo com conteúdo local igual à base',async()=>{
  const a=await app(demandasDuasAbas),remoto=exclusaoEmOutraAba(a);
  a.ctx.origemFormulario=origem;
  a.run(`var formPendente=el('<section><h3>Formulário sintético</h3><label>Nota<textarea>Texto inline não gravado</textarea></label></section>');
    if(origemFormulario==='data-uso-direto')formPendente.setAttribute('data-uso-direto','');
    else{formPendente.setAttribute('data-fm-pagina','roi');formPendente._fmDirty=true}
    document.getElementById('main').appendChild(formPendente)`);
  a.ctx.fetch=async()=>resposta(remoto);await a.run('puxarNuvem()');
  assert.equal(a.alertas.length,1);assert.match(a.run('JSON.stringify(lerRascunhoSync())'),/Texto inline não gravado/);
  assert.equal(a.run('_tabBase'),20);assert.equal(a.run('E.demandas.length'),1);
});

// Linkedom não separa value de seu atributo como um campo digitado no browser.
function digitarSemGravar(campo,valor){
  Object.defineProperty(campo,'defaultValue',{configurable:true,writable:true,value:campo.defaultValue??(campo.tagName==='TEXTAREA'?campo.textContent:campo.getAttribute('value')||'')});
  Object.defineProperty(campo,'value',{configurable:true,writable:true,value:valor});
}
async function campoDeEscopo(a,origem){
  if(origem==='agente'){
    await a.run("atual='donboy';agentesUI.editando='agente-sintetico';vAgentes(document.getElementById('main'))");
    return a.document.querySelector('.ag-form [name=descricao]');
  }
  if(origem==='opção'){
    a.run("document.getElementById('main').appendChild(editorLista('areasDemanda',()=>{}))");
    return a.document.querySelector('.editor-lista-mobile form input');
  }
  if(origem==='célula'){
    a.run("document.getElementById('main').appendChild(tabela(E.demandas,[{k:'titulo',t:'Demanda'}],()=>{}))");
    return a.document.querySelector('table input[data-i="1"][data-k=titulo]');
  }
  await a.run("atual='config';vConfig(document.getElementById('main'))");
  return [...a.document.querySelectorAll('.bNome')].find(c=>c.value==='Empresa sintética');
}
const fontesRascunho=demandasDuasAbas+";E.agentes=[{id:'agente-sintetico',nome:'Analista sintético',ambiente:'Local',descricao:'Descrição inicial'}];E.empresasPJ=[{id:'empresa-sintetica',nome:'Empresa sintética'}]";
for(const origem of ['agente','opção','célula','empresa'])test('Sync: preserva rascunho real de '+origem+' antes de submit/change, incluindo campo raiz e vazio',async()=>{
  const a=await app(fontesRascunho),campo=await campoDeEscopo(a,origem),remoto=exclusaoEmOutraAba(a);
  assert.ok(campo);const valor=origem==='agente'?'':'Texto pendente de '+origem;
  digitarSemGravar(campo,valor);
  assert.equal(a.run('conteudoSync(E)===_tabConteudo'),true,'Digitar ainda não gravou o estado');
  a.ctx.fetch=async()=>resposta(remoto);await a.run('puxarNuvem()');
  assert.equal(a.alertas.length,1,'O formulário pendente precisa ser comunicado');
  const salvo=JSON.parse(a.run('JSON.stringify(lerRascunhoSync())'));
  assert.ok(salvo?.formularios.some(f=>f.campos.some(c=>c.valor===valor)),'O valor digitado fica recuperável');
  a.run('abrirRascunhoSync()');assert.match(a.document.querySelector('[data-recuperacao-sync] textarea').value,origem==='agente'?/\(vazio\)/:new RegExp(valor));
});

test('Sync: os quatro escopos sem alteração não geram rascunho nem alerta',async()=>{
  for(const origem of ['agente','opção','célula','empresa']){
    const a=await app(fontesRascunho);await campoDeEscopo(a,origem);
    assert.equal(a.run('guardarRascunhoSync()'),false,origem+' continua sem edição');
    const remoto=exclusaoEmOutraAba(a);a.ctx.fetch=async()=>resposta(remoto);await a.run('puxarNuvem()');
    assert.equal(a.alertas.length,0,origem+' sem edição acompanha o servidor');
  }
});

test('Sync: célula salva por change e PUT não vira rascunho falso numa atualização posterior',async()=>{
  const a=await app(fontesRascunho),campo=await campoDeEscopo(a,'célula');
  digitarSemGravar(campo,'Título confirmado');campo.dispatchEvent(new a.document.defaultView.Event('change',{bubbles:true}));
  assert.ok(a.document.querySelector('table input[data-i="1"]')===campo,'A tabela pode salvar sem substituir o campo');
  a.ctx.fetch=async(_,op)=>{a.remoto={mt:11,dados:JSON.parse(op.body).dados};return resposta({mt:11})};
  assert.equal(await a.run('enviarNuvem()'),true);
  const remoto=exclusaoEmOutraAba(a);a.ctx.fetch=async()=>resposta(remoto);await a.run('puxarNuvem()');
  assert.equal(a.alertas.length,0);assert.equal(a.run('lerRascunhoSync()'),null);
  assert.equal(a.run('E.demandas[0].titulo'),'Título confirmado');
});

test('Sync: nome de empresa confirmado renderiza outro campo com o novo valor inicial',async()=>{
  const a=await app(fontesRascunho),campo=await campoDeEscopo(a,'empresa');
  digitarSemGravar(campo,'Empresa confirmada');campo.onchange();await rodada();
  const novo=[...a.document.querySelectorAll('.bNome')].find(c=>c.value==='Empresa confirmada');
  assert.ok(novo&&novo!==campo);assert.equal(novo.getAttribute('value'),'Empresa confirmada');
  a.ctx.fetch=async(_,op)=>{a.remoto={mt:11,dados:JSON.parse(op.body).dados};return resposta({mt:11})};
  assert.equal(await a.run('enviarNuvem()'),true);
  const remoto=exclusaoEmOutraAba(a);a.ctx.fetch=async()=>resposta(remoto);await a.run('puxarNuvem()');
  assert.equal(a.alertas.length,0);assert.equal(a.run('lerRascunhoSync()'),null);
});

for(const [nome,valor,avisos] of [['foco sem edição',null,0],['alteração financeira','2345,67',1],['valor inválido','valor inválido',1]])test('Sync: moeda em tabela distingue '+nome+' da formatação inicial',async()=>{
  const a=await app(demandasDuasAbas+';E.demandas[1].valor=1234');
  a.run("document.getElementById('main').appendChild(tabela(E.demandas,[{k:'valor',t:'Valor',tipo:'moeda'}],()=>{}))");
  const campo=a.document.querySelector('input.moeda[data-i="1"]');
  digitarSemGravar(campo,campo.value);
  campo.dispatchEvent(new a.document.defaultView.Event('focusin',{bubbles:true}));
  assert.equal(campo.value,'1234','O foco muda somente o formato do mesmo valor');
  if(valor!==null)campo.value=valor;
  const remoto=exclusaoEmOutraAba(a);a.ctx.fetch=async()=>resposta(remoto);await a.run('puxarNuvem()');
  assert.equal(a.alertas.length,avisos);
  if(avisos)assert.ok(JSON.parse(a.run('JSON.stringify(lerRascunhoSync())')).formularios.some(f=>f.campos.some(c=>c.valor===valor)));
  else assert.equal(a.run('lerRascunhoSync()'),null);
});

test('Sync: primeira leitura sem base avisa e preserva rascunho inline sem modal aberto',async()=>{
  const a=await app(demandasDuasAbas),remoto=exclusaoEmOutraAba(a);
  a.run("_tabBase=0;_tabConteudo=null;document.getElementById('main').appendChild(editorLista('areasDemanda',()=>{}))");
  digitarSemGravar(a.document.querySelector('.editor-lista-mobile input'),'Texto anterior à primeira leitura');
  a.ctx.fetch=async()=>resposta(remoto);await a.run('puxarNuvem()');
  assert.equal(a.alertas.length,1);assert.match(a.run('JSON.stringify(lerRascunhoSync())'),/Texto anterior à primeira leitura/);
  assert.equal(a.run('_tabBase'),20);
});

test('Sync: primeira leitura sem base continua silenciosa quando não existe formulário pendente',async()=>{
  const a=await app(demandasDuasAbas),remoto=exclusaoEmOutraAba(a);
  a.run('_tabBase=0;_tabConteudo=null');a.ctx.fetch=async()=>resposta(remoto);await a.run('puxarNuvem()');
  assert.equal(a.alertas.length,0);assert.equal(a.run('_tabBase'),20);assert.equal(a.run('lerRascunhoSync()'),null);
});
