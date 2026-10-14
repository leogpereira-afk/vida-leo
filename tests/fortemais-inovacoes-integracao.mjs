import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

function app(){
  const a=setup(),storage=new Map(),session=new Map();
  const memoria=map=>({getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)});
  a.ctx.localStorage=memoria(storage);a.ctx.sessionStorage=memoria(session);
  a.run('E=structuredClone(SEED);atual="fortemais";tela=()=>{}');
  return {...a,storage,session};
}
function preencher(document,nome,valor){
  const campo=document.querySelector('#modais [name="'+nome+'"]');
  assert.ok(campo,'Campo disponível: '+nome);
  if(campo.tagName==='SELECT'){
    [...campo.options].forEach(o=>o.selected=false);
    const opcao=[...campo.options].find(o=>o.value===valor);assert.ok(opcao,'Opção disponível: '+valor);opcao.selected=true;
  }else campo.value=valor;
  campo.dispatchEvent(new document.defaultView.Event('input',{bubbles:true}));
  campo.dispatchEvent(new document.defaultView.Event('change',{bubbles:true}));
}
function enviar(document){
  const form=document.querySelector('#modais form');assert.ok(form,'Formulário da inovação aberto');
  form.reportValidity=()=>true;
  form.onsubmit({preventDefault(){}});
}
function criar(a,titulo='Descoberta de teste'){
  a.run('fmInovacoesEditor(null,()=>{})');preencher(a.document,'titulo',titulo);enviar(a.document);
  assert.equal(a.run('E.fortemaisInovacoes.length'),1);
}
function cancelar(a){
  const botao=[...a.document.querySelectorAll('#modais button')].find(b=>b.textContent==='Cancelar');
  assert.ok(botao);a.ctx.confirm=()=>true;botao.click();
}

test('Inovações: cadastro sem obra permanece após recarregar e mantém ID',()=>{
  const a=app();criar(a,'  Melhorar o conforto da casa  ');
  assert.equal(a.run('E.obras.length'),0);
  assert.equal(a.run('E.fortemaisInovacoes[0].titulo'),'Melhorar o conforto da casa');
  const id=a.run('E.fortemaisInovacoes[0].id');assert.ok(id);
  a.run('E=carregar()');assert.equal(a.run('E.fortemaisInovacoes[0].id'),id);
  assert.equal(a.run('E.fortemaisInovacoes[0].situacao'),'Para avaliar');
  assert.equal(a.document.querySelector('#modais .fundo'),null);
});

test('Inovações: editar e arquivar conserva a descoberta e seu histórico',()=>{
  const a=app();criar(a);const id=a.run('E.fortemaisInovacoes[0].id'),criadoEm=a.run('E.fortemaisInovacoes[0].criadoEm');
  a.run('fmInovacoesEditor(E.fortemaisInovacoes[0],()=>{})');
  preencher(a.document,'descricao','Nova solução pesquisada');preencher(a.document,'aplicacao','Conferir no projeto das próximas casas');
  preencher(a.document,'referencia','https://example.com/solucao');preencher(a.document,'situacao','Aplicar nas próximas obras');enviar(a.document);
  a.run('fmInovacoesEditor(E.fortemaisInovacoes[0],()=>{})');preencher(a.document,'situacao','Arquivada');enviar(a.document);
  a.run('E=carregar()');assert.equal(a.run('E.fortemaisInovacoes.length'),1);assert.equal(a.run('E.fortemaisInovacoes[0].id'),id);
  assert.equal(a.run('E.fortemaisInovacoes[0].criadoEm'),criadoEm);assert.equal(a.run('E.fortemaisInovacoes[0].situacao'),'Arquivada');
  assert.equal(a.run('E.fortemaisInovacoes[0].descricao'),'Nova solução pesquisada');
  assert.equal(a.run('E.fortemaisInovacoes[0].aplicacao'),'Conferir no projeto das próximas casas');
  assert.equal(a.run('E.fortemaisInovacoes[0].referencia'),'https://example.com/solucao');
  assert.ok(a.run('E.fortemaisInovacoes[0].historico.length')>=3);
});

test('Inovações: cancelar criação e edição deixa os dados intactos',()=>{
  const a=app();a.run('fmInovacoesEditor(null,()=>{})');preencher(a.document,'titulo','Não salvar');cancelar(a);
  assert.equal(a.run('E.fortemaisInovacoes.length'),0);criar(a);
  const antes=a.run('JSON.stringify(E)');a.run('fmInovacoesEditor(E.fortemaisInovacoes[0],()=>{})');
  preencher(a.document,'descricao','Mudança cancelada');cancelar(a);assert.equal(a.run('JSON.stringify(E)'),antes);
});

test('Inovações: dados inválidos mantêm o formulário sem criar registro',()=>{
  const a=app();a.run('fmInovacoesEditor(null,()=>{})');enviar(a.document);
  assert.equal(a.run('E.fortemaisInovacoes.length'),0);assert.ok(a.document.querySelector('#modais .fundo'));
  preencher(a.document,'titulo','Título válido');preencher(a.document,'referencia','javascript:alert(1)');enviar(a.document);
  assert.equal(a.run('E.fortemaisInovacoes.length'),0);assert.equal(a.document.querySelector('[name=titulo]').value,'Título válido');
  assert.ok(a.document.querySelector('.fmi-erro[role=alert]').textContent.trim());
});

test('Inovações: falha de armazenamento reverte o estado e preserva o rascunho para nova tentativa',()=>{
  const a=app();criar(a);const antes=a.run('JSON.stringify(E)'),gravar=a.ctx.localStorage.setItem;
  a.run('fmInovacoesEditor(E.fortemaisInovacoes[0],()=>{})');preencher(a.document,'descricao','Texto que não pode sumir');
  a.ctx.localStorage.setItem=()=>{throw Error('QuotaExceededError')};enviar(a.document);
  assert.equal(a.run('JSON.stringify(E)'),antes);assert.equal(a.document.querySelector('[name=descricao]').value,'Texto que não pode sumir');
  assert.ok(a.document.querySelector('.fmi-erro[role=alert]').textContent.trim());
  a.ctx.localStorage.setItem=gravar;enviar(a.document);assert.equal(a.run('E.fortemaisInovacoes.length'),1);
  assert.equal(a.run('E.fortemaisInovacoes[0].descricao'),'Texto que não pode sumir');
});

test('Inovações: edição antiga não sobrescreve atualização feita enquanto o formulário estava aberto',()=>{
  const a=app();criar(a);a.run('fmInovacoesEditor(E.fortemaisInovacoes[0],()=>{})');preencher(a.document,'titulo','Edição antiga');
  a.run('E.fortemaisInovacoes=E.fortemaisInovacoes.map(x=>({...x,titulo:"Alteração mais recente"}))');enviar(a.document);
  assert.equal(a.run('E.fortemaisInovacoes[0].titulo'),'Alteração mais recente');
  assert.equal(a.document.querySelector('[name=titulo]').value,'Edição antiga');assert.ok(a.document.querySelector('.fmi-erro[role=alert]').textContent.trim());
});

test('Inovações: restauração antiga começa vazia e backup inválido é recusado',()=>{
  const a=app();a.ctx.localStorage.setItem('centralLeo.v1',JSON.stringify({viagens:[],obras:[{id:'obra-sintetica',nome:'Obra de teste'}]}));
  a.run('E=carregar()');assert.equal(a.run('E.fortemaisInovacoes.length'),0);assert.equal(a.run('E.obras[0].id'),'obra-sintetica');
  criar(a);assert.doesNotThrow(()=>a.run('validarBackup(JSON.parse(JSON.stringify(E)))'));
  assert.throws(()=>a.run('validarBackup({viagens:[],fortemaisInovacoes:"inválido"})'));
  assert.throws(()=>a.run('validarBackup({...E,fortemaisInovacoes:[E.fortemaisInovacoes[0],E.fortemaisInovacoes[0]]})'));
  assert.throws(()=>a.run('validarBackup({...E,fortemaisInovacoes:[{...E.fortemaisInovacoes[0],titulo:123}]})'));
  assert.throws(()=>a.run('validarBackup({...E,fortemaisInovacoes:[{...E.fortemaisInovacoes[0],referencia:"javascript:alert(1)"}]})'));
});

test('Inovações: transporte existente envia a coleção com a base de concorrência',async()=>{
  const a=app();criar(a);let payload,metodo;
  a.ctx.fetch=async(_url,opcoes)=>{metodo=opcoes.method;payload=JSON.parse(opcoes.body);return {status:200,json:async()=>({mt:43})}};
  a.run('_tabBase=42');await a.run('apiPut()');assert.equal(metodo,'PUT');assert.equal(payload.base,42);
  assert.equal(payload.dados.fortemaisInovacoes.length,1);assert.equal(payload.dados.fortemaisInovacoes[0].titulo,'Descoberta de teste');
  assert.ok(payload.dados.fortemaisInovacoes[0].id);assert.equal(payload.dados.obras.length,0);
});

test('Inovações: atualização remota preserva os textos digitados para recuperação',()=>{
  const a=app();criar(a);a.run('var remoto=structuredClone(E);fmInovacoesEditor(E.fortemaisInovacoes[0],()=>{})');
  preencher(a.document,'descricao','Rascunho ainda não salvo');a.run('adotaNuvem({dados:remoto,mt:70},false)');
  assert.equal(a.document.querySelector('#modais .fundo'),null);assert.equal(a.run('_tabBase'),70);
  assert.match(a.run('JSON.stringify(lerRascunhoSync())'),/Rascunho ainda não salvo/);
  assert.notEqual(a.run('E.fortemaisInovacoes[0].descricao'),'Rascunho ainda não salvo');
  assert.ok(a.document.querySelector('[data-abrir-rascunho-sync]'));
});

test('Inovações: nova aba abre e cadastra sem consultar custos do servidor',async()=>{
  const a=app();a.run('filtro.fmVisao="inovacoes";var consultasCustos=0;fmResumo=async()=>{consultasCustos++;throw Error("Servidor indisponível")};var telaNova=vFortemais(document.getElementById("main"))');
  await a.run('telaNova');assert.equal(a.run('consultasCustos'),0);
  const aba=a.document.querySelector('[data-fm-visao=inovacoes]');assert.ok(aba);assert.ok(a.document.querySelector('[data-fm-visao=obras]'));
  assert.equal(aba.getAttribute('aria-selected')||aba.getAttribute('aria-pressed'),'true');
  assert.equal(a.document.querySelector('[data-bid=fm-obras]'),null);criar(a);assert.equal(a.run('E.fortemaisInovacoes.length'),1);
});

test('Inovações: troca superior não descarta uma edição de ROI da obra',async()=>{
  const a=app();let aviso='';a.ctx.alert=texto=>aviso=texto;
  a.run(`E.obras=[{id:'obra-aba',nome:'Obra de teste',fmPrevisao:{venda:400000,terreno:80000,construcao:160000,documentacaoPct:1,comissaoPct:5,impostoPct:6,outras:12000,investidores:[{id:'socio',nome:'Sócio sintético',pct:100,aporte:100000,roiPrevisto:{aporte:100000,recebimento:120000}}],fluxos:[]}}];filtro.fmVisao='obras';filtro.fmAberta='obra-aba';filtro.fmAbas={'obra-aba':'roi'}`);
  await a.run('vFortemais(document.getElementById("main"))');
  const roi=a.document.querySelector('[data-fm-pagina=roi]');assert.ok(roi);assert.equal(roi.hidden,false);
  const valor=roi.querySelector('input');assert.ok(valor);valor.value='150000';valor.dispatchEvent(new a.document.defaultView.Event('input',{bubbles:true}));
  a.document.querySelector('[data-fm-visao=inovacoes]').click();
  assert.equal(a.run('filtro.fmVisao'),'obras');assert.equal(roi.hidden,false);assert.equal(valor.value,'150000');assert.match(aviso,/Salve ou cancele/);
});

test('Inovações: editar uma descoberta mantém obras, aportes, links e cálculos intactos',()=>{
  const a=app();a.run(`E.obras=[{id:'obra-teste',nome:'Obra sintética',vendaValor:100,impostoValor:10,fmPrevisao:{venda:500000,terreno:100000,construcao:200000,documentacaoPct:1,comissaoPct:5,impostoPct:6,outras:0,investidores:[],fluxos:[]}}];E.obraAportes=[{id:'aporte-teste',obra:'obra-teste',valor:1000}];E.fortemaisLinks=[{id:'link-teste',titulo:'Referência',url:'https://example.com'}];var financeiroAntes=JSON.stringify([E.obras,E.obraAportes,E.fortemaisLinks]);var calculoAntes=JSON.stringify(fmPrevContas(E.obras[0]));`);
  criar(a);a.run('fmInovacoesEditor(E.fortemaisInovacoes[0],()=>{})');preencher(a.document,'situacao','Adotada');enviar(a.document);
  assert.equal(a.run('JSON.stringify([E.obras,E.obraAportes,E.fortemaisLinks])'),a.run('financeiroAntes'));
  assert.equal(a.run('JSON.stringify(fmPrevContas(E.obras[0]))'),a.run('calculoAntes'));
});

test('Inovações: lista mostra conteúdo literal e referência com abertura isolada',()=>{
  const a=app();criar(a,'<img src=x onerror=alert(1)> Ideia');a.run('fmInovacoesEditor(E.fortemaisInovacoes[0],()=>{})');
  preencher(a.document,'referencia','https://example.com/manual');enviar(a.document);
  a.run('document.getElementById("main").appendChild(fmInovacoesPainel())');
  const item=a.document.querySelector('.fmi-item[data-inovacao-id]');assert.ok(item);assert.match(item.textContent,/<img src=x/);assert.equal(item.querySelector('img'),null);
  const link=item.querySelector('a[href="https://example.com/manual"]');assert.ok(link);assert.equal(link.getAttribute('target'),'_blank');
  assert.match(link.getAttribute('rel')||'',/noopener/);assert.match(link.getAttribute('rel')||'',/noreferrer/);
});

test('Inovações: cartão e histórico mostram o dia e horário locais da alteração',()=>{
  const a=app();
  const NativeDate=Date;
  a.ctx.Date=class extends NativeDate{
    constructor(...argumentos){super(...(argumentos.length?argumentos:['2026-01-03T01:30:00.000Z']))}
    static now(){return 1767403800000}
  };
  criar(a);a.run('document.getElementById("main").appendChild(fmInovacoesPainel())');
  assert.equal(a.run('E.fortemaisInovacoes[0].atualizadoEm'),'2026-01-03T01:30:00.000Z');
  const item=a.document.querySelector('.fmi-item');
  assert.match(item.querySelector('.fmi-item-meta').textContent,/Atualizada em 02\/01\/2026/);
  const historico=item.querySelector('.fmi-historico li span').textContent;
  assert.match(historico,/02\/01\/2026/);assert.match(historico,/22:30/);
  assert.doesNotMatch(historico,/03\/01\/2026/);
});

test('Inovações: primeiro item para próximas obras atualiza o badge superior sem recarregar',async()=>{
  const a=app();a.run('filtro.fmVisao="inovacoes"');await a.run('vFortemais(document.getElementById("main"))');
  const badge=a.document.querySelector('[data-fm-visao=inovacoes] .fmi-contagem');assert.ok(badge);assert.equal(badge.hidden,true);
  const novo=[...a.document.querySelectorAll('.fmi-cab button')].find(b=>b.textContent==='+ Nova inovação');assert.ok(novo);novo.click();
  preencher(a.document,'titulo','Solução para próximos projetos');preencher(a.document,'situacao','Aplicar nas próximas obras');enviar(a.document);
  assert.equal(badge.hidden,false);assert.equal(badge.textContent,'1');assert.match(badge.title,/1 para aplicar/);
  assert.equal(a.document.querySelector('[data-fmi-resumo=aAplicar] b').textContent,'1');
  assert.equal(a.document.querySelectorAll('.fmi-item').length,1);
});

test('Inovações: resposta antiga dos custos não adiciona obras nem erro após trocar a aba',async()=>{
  const a=app();a.run(`filtro.fmVisao='obras';E.obras=[{id:'obra-atrasada',nome:'Obra de teste'}];var consultas=0;fmResumo=()=>{consultas++;return new Promise(resolve=>window.resumoAntigo=resolve)};tela=()=>{const main=document.getElementById('main');main.replaceChildren();vFortemais(main)};var carregamentoAntigo=vFortemais(document.getElementById('main'));`);
  assert.equal(a.run('consultas'),1);a.document.querySelector('[data-fm-visao=inovacoes]').click();
  assert.equal(a.run('filtro.fmVisao'),'inovacoes');assert.ok(a.document.querySelector('.fmi-painel'));
  await a.run('window.resumoAntigo(null);carregamentoAntigo');
  assert.equal(a.run('consultas'),1);assert.equal(a.document.querySelector('[data-bid=fm-obras]'),null);
  assert.ok(a.document.querySelector('.fmi-painel'));assert.equal(a.document.querySelector('[aria-label="Buscar obra"]'),null);
  assert.doesNotMatch(a.document.getElementById('main').textContent,/Não consegui falar com o servidor/);
});
