import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function app(aba='roi'){
  const a=setup(),itens=new Map([['cl_token','token-ficticio']]);
  const memoria={getItem:k=>itens.get(k)||null,setItem:(k,v)=>itens.set(k,String(v)),removeItem:k=>itens.delete(k)};
  a.ctx.localStorage=memoria;a.ctx.sessionStorage=memoria;a.ctx.alert=()=>{};a.ctx.abaInicial=aba;
  a.run(`E=structuredClone(SEED);atual='fortemais';E.obras=[{
    id:'obra-teste',nome:'Obra sintética anterior',
    fmPrevisao:{venda:400000,terreno:80000,construcao:160000,documentacaoPct:1,comissaoPct:5,impostoPct:6,outras:12000,
      investidores:[{id:'socio-teste',nome:'Sócio sintético',aporte:100000,pct:100}],fluxos:[]},
    fmArquivosMetadados:{arquivo:{titulo:'Título anterior',categoria:'Estrutural'}}
  }];filtro.fmAberta='obra-teste';filtro.fmAbas={'obra-teste':abaInicial};
  arqIndice=async()=>new Map([['obra:obra-teste',[{id:'arquivo',ref:'obra:obra-teste',nome:'Projeto sintético.pdf',tipo:'application/pdf',tam:10,em:'2026-10-14'}]]]);todosArquivos=async()=>[];tela()`);
  await tick();return a;
}
function alterar(a,input,valor){input.value=valor;input.dispatchEvent(new a.document.defaultView.Event('input',{bubbles:true}));}
async function adotar(a){
  a.run(`var remoto=structuredClone(E);remoto.obras[0].nome='Obra sintética atualizada';remoto.obras[0].fmPrevisao.investidores[0].aporte=200000;remoto.obras[0].fmArquivosMetadados.arquivo.titulo='Título remoto';adotaNuvem({dados:remoto,mt:70},false)`);
  await tick();
}
function conferirRemoto(a){
  assert.equal(a.run('E.obras[0].nome'),'Obra sintética atualizada');
  assert.equal(a.document.querySelector('.fm-projeto-abre strong').textContent,'Obra sintética atualizada','A ficha usa a obra adotada, sem referência órfã');
  assert.equal(a.run('E.obras[0].fmPrevisao.investidores[0].aporte'),200000);
  assert.equal(a.run('E.obras[0].fmPrevisao.investidores[0].roiPrevisto'),undefined,'A recuperação não aplica o valor digitado à versão remota');
  assert.equal(a.run('E.obras[0].fmArquivosMetadados.arquivo.titulo'),'Título remoto');
  assert.equal(a.run('_tabBase'),70);
}

test('Fortemais Sync: ROI inline vira texto recuperável e a ficha adota a base remota',async()=>{
  const a=await app(),input=a.document.querySelector('[data-fm-pagina=roi] input');
  alterar(a,input,'120000');await adotar(a);
  conferirRemoto(a);
  assert.equal(a.run('document.querySelector("[data-fm-pagina=roi]")._fmDirty'),false);
  assert.equal(a.run('financeiroNumero(document.querySelector("[data-fm-pagina=roi] input").value)'),200000);
  const salvo=JSON.parse(a.run('JSON.stringify(lerRascunhoSync())'));
  assert.ok(salvo?.formularios.some(f=>/ROI/.test(f.titulo)&&/Obra sintética anterior/.test(f.titulo)&&f.campos.some(c=>c.valor==='120000')),'O rascunho identifica a aba e a obra de origem');
  const antes=a.run('JSON.stringify(E)');a.run('abrirRascunhoSync()');
  assert.match(a.document.querySelector('[data-recuperacao-sync] textarea').value,/120000/);
  assert.equal(a.run('JSON.stringify(E)'),antes);
});

test('Fortemais Sync: classificação inline permanece recuperável sem sobrescrever metadados remotos',async()=>{
  const a=await app('documentos');
  [...a.document.querySelectorAll('.fmdoc-item button')].find(b=>b.textContent==='Classificar').click();
  alterar(a,a.document.querySelector('.fmdoc-editor [name=titulo]'),'Classificação ainda não salva');
  alterar(a,a.document.querySelector('.fmdoc-editor [name=descricao]'),'Conferir a revisão sintética');
  await adotar(a);conferirRemoto(a);
  assert.equal(a.document.querySelector('.fmdoc-editor'),null,'A edição não aponta mais para a obra antiga');
  assert.match(a.document.querySelector('.fmdoc-lista').textContent,/Título remoto/);
  const salvo=JSON.parse(a.run('JSON.stringify(lerRascunhoSync())'));
  assert.ok(salvo?.formularios.some(f=>/Projetos e documentos/.test(f.titulo)&&/Obra sintética anterior/.test(f.titulo)&&f.campos.some(c=>c.valor==='Classificação ainda não salva')));
  const antes=a.run('JSON.stringify(E)');a.run('abrirRascunhoSync()');
  assert.match(a.document.querySelector('[data-recuperacao-sync] textarea').value,/Conferir a revisão sintética/);
  assert.equal(a.run('JSON.stringify(E)'),antes);
});

test('Fortemais Sync: captura inline exclui segredos e abas que não foram alteradas',async()=>{
  const a=await app();alterar(a,a.document.querySelector('[data-fm-pagina=roi] input'),'120000');
  a.run(`document.querySelector('[data-fm-pagina=roi]').appendChild(el('<label>Senha<input type=password value=senha-sintetica></label>'));
  document.querySelector('[data-fm-pagina=roi]').appendChild(el('<label>Token API<input value=token-sintetico></label>'));
  document.querySelector('[data-fm-pagina=roi]').appendChild(el('<input type=hidden value=oculto-sintetico>'));
  document.querySelector('[data-fm-pagina=tir]').appendChild(el('<textarea aria-label="Sem alteração">Texto de outra aba intacta</textarea>'));guardarRascunhoSync()`);
  const salvo=a.run('JSON.stringify(lerRascunhoSync())');
  assert.match(salvo,/120000/);
  assert.doesNotMatch(salvo,/senha-sintetica|token-sintetico|oculto-sintetico|Texto de outra aba intacta/);
});
