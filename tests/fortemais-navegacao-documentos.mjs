import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

function app(){
  const a=setup();
  a.run(`E=structuredClone(SEED);atual='fortemais';E.obras=[
    {id:'obra-a',nome:'Obra de teste A',fmPrevisao:{venda:400000,terreno:80000,construcao:160000,documentacaoPct:1,comissaoPct:5,impostoPct:6,outras:12000,investidores:[{id:'socio',nome:'Sócio de teste',aporte:100000,pct:100}],fluxos:[]}},
    {id:'obra-b',nome:'Obra de teste B'}];filtro.fmAberta='obra-a';filtro.fmAbas={'obra-a':'previsao'};`);
  return a;
}
async function abrir(a){await a.run('vFortemais(document.getElementById("main"))');await new Promise(r=>setImmediate(r));}

test('Fortemais: projetos e documentos continuam acessíveis enquanto os custos aguardam o servidor',async()=>{
  const a=app();let liberar;
  a.ctx.aguardarCustos=new Promise(ok=>{liberar=ok});
  a.run('fmResumo=()=>aguardarCustos');
  const render=a.run('vFortemais(document.getElementById("main"))');
  try{
    const aba=a.document.querySelector('[data-pagina=documentos]');
    assert.ok(aba,'A área documental precisa abrir sem esperar pelo financeiro');
    aba.click();
    assert.equal(a.document.querySelector('[data-fm-pagina=documentos]').hidden,false);
    assert.ok(a.document.querySelector('[data-fm-exportacao=realizado]').disabled,'PDF realizado aguarda a consulta, sem exportar uma lista ainda incompleta');
  }finally{liberar({});await render;}
});

test('Fortemais: cadastro recolhível e projetos/documentos usam a mesma obra sem modificar os valores',async()=>{
  const a=app(),antes=a.run('JSON.stringify(E)');await abrir(a);
  const cadastro=a.document.querySelector('details.fm-identidade');assert.ok(cadastro);assert.equal(cadastro.hasAttribute('open'),false);
  assert.ok(cadastro.querySelector('summary'));
  a.document.querySelector('[data-pagina=documentos]').click();
  assert.equal(a.document.querySelector('[data-fm-pagina=documentos]').hidden,false);
  a.document.querySelector('[data-pagina=previsao]').click();
  assert.equal(a.document.querySelector('[data-fm-pagina=previsao]').hidden,false);
  assert.match(a.document.querySelector('[data-fm-pagina=previsao]').textContent,/R\$\s*400\.000,00/);
  assert.equal(a.run('JSON.stringify(E)'),antes);
});

test('Fortemais: trocar de obra não descarta uma tabela ROI ainda não salva',async()=>{
  const a=app();let aviso='';a.ctx.alert=s=>{aviso=s};a.run('filtro.fmAbas={"obra-a":"roi"}');await abrir(a);
  const entrada=a.document.querySelector('[data-fm-pagina=roi] input');entrada.value='120000';entrada.dispatchEvent(new a.document.defaultView.Event('input',{bubbles:true}));
  [...a.document.querySelectorAll('.fm-projeto-abre')].find(x=>x.textContent.includes('Obra de teste B')).click();
  assert.equal(a.run('filtro.fmAberta'),'obra-a');assert.equal(entrada.value,'120000');assert.match(aviso,/Salve ou cancele/);
  assert.equal(a.run('E.obras[0].fmPrevisao.investidores[0].roiPrevisto'),undefined);
});

test('Fortemais: exportar pela ação comum respeita a edição não salva de ROI',async()=>{
  const a=app();let aviso='',aberturas=0;a.ctx.alert=s=>{aviso=s};a.ctx.window.open=()=>{aberturas++;return null};
  a.run('filtro.fmAbas={"obra-a":"roi"}');await abrir(a);
  const entrada=a.document.querySelector('[data-fm-pagina=roi] input');entrada.value='120000';entrada.dispatchEvent(new a.document.defaultView.Event('input',{bubbles:true}));
  const exportar=a.document.querySelector('.fm-obra-toolbar [data-fm-exportacao=previsao]');assert.ok(exportar);exportar.click();
  assert.equal(aberturas,0);assert.match(aviso,/Salve ou cancele/);
});

test('Fortemais: resposta financeira antiga não adiciona comparativos na aba Inovações',async()=>{
  const a=app();let liberar;a.ctx.aguardarCustos=new Promise(ok=>{liberar=ok});a.run('fmResumo=()=>aguardarCustos');
  const render=a.run('vFortemais(document.getElementById("main"))');
  a.run('filtro.fmVisao="inovacoes";document.getElementById("main").replaceChildren()');
  await a.run('vFortemais(document.getElementById("main"))');
  liberar(null);await render;
  assert.ok(a.document.querySelector('.fmi-painel'));assert.equal(a.document.querySelector('.fm-comparativos'),null);
  assert.doesNotMatch(a.document.querySelector('main').textContent,/Não consegui falar com o servidor/);
});

test('Fortemais: backup inválido de documentos é recusado sem exigir uma lista de demandas',()=>{
  const a=app();
  for(const valor of [null,[],{a:{dataDocumento:'2026-02-30'}},{a:{titulo:42}}]){
    a.ctx.mapaInvalido=valor;
    assert.throws(()=>a.run('validarBackup({...E,obras:[{id:"obra-a",nome:"Obra de teste",fmArquivosMetadados:mapaInvalido}]})'));
  }
  assert.doesNotThrow(()=>a.run('validarBackup({...E,obras:[{id:"obra-a",nome:"Obra de teste",fmArquivosMetadados:{a:{categoria:"Estrutural",dataDocumento:"2026-02-28"}}}]})'));
});

test('Fortemais: enviar pendentes da obra não envia arquivos de outra obra ou da Central',async()=>{
  const a=setup({hostname:'exemplo.test'});
  a.ctx.localStorage={getItem:k=>k==='cl_token'?'token-ficticio':null,setItem(){},removeItem(){}};
  a.ctx.fila=[{id:'a',ref:'obra:obra-a',nome:'Projeto.pdf',tipo:'application/pdf',tam:3,em:'2026-10-14',blob:new Blob(['abc'])},{id:'d',ref:'obra:obra-a:demanda:demanda-1',nome:'Detalhe.pdf',tipo:'application/pdf',tam:3,em:'2026-10-14',blob:new Blob(['abc'])},{id:'b',ref:'obra:obra-a2',nome:'Outro.pdf',tipo:'application/pdf',tam:3,em:'2026-10-14',blob:new Blob(['abc'])},{id:'c',ref:'empresa:teste',nome:'Empresa.pdf',tipo:'application/pdf',tam:3,em:'2026-10-14',blob:new Blob(['abc'])}];
  a.run(`db=async()=>({transaction:()=>({objectStore:()=>({openCursor:()=>{const req={};let pos=0;const enviar=()=>Promise.resolve().then(()=>req.onsuccess?.({target:{result:pos<fila.length?{value:fila[pos++],continue:enviar}:null}}));enviar();return req}})})});arqIndice=async()=>new Map();var enviados=[],apagados=[];arqSubir=async(reg)=>enviados.push(reg.ref);arqApagarLocal=async(id)=>apagados.push(id)`);
  await a.run('arqSubirPendentes(false,"obra:obra-a")');
  assert.deepEqual(Array.from(a.run('enviados')),['obra:obra-a','obra:obra-a:demanda:demanda-1']);
  assert.deepEqual(Array.from(a.run('apagados')),['a','d']);
});
