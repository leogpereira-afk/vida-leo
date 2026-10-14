import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {setup} from './helpers/dom.mjs';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
const html=readFileSync(new URL('../publico/index.html',import.meta.url),'utf8');

function app(){
  const a=setup();
  a.ctx.alert=()=>{};
  a.ctx.location.hash='#fortemais';
  const mover=(estado,titulo,url)=>{if(url!==undefined)a.ctx.location.hash=new URL(url,'https://example.test/').hash;};
  a.ctx.history={pushState:mover,replaceState:mover};
  a.run(`E=structuredClone(SEED);atual='fortemais';E.obras=[{
    id:'obra-teste',nome:'Obra sintética',
    fmPrevisao:{venda:400000,terreno:80000,construcao:160000,documentacaoPct:1,comissaoPct:5,impostoPct:6,outras:12000,
      investidores:[{id:'socio-teste',nome:'Sócio sintético',aporte:100000,pct:100}],fluxos:[]}
  }];filtro.fmAberta='obra-teste';filtro.fmAbas={'obra-teste':'roi'};`);
  return a;
}
async function abrir(a){a.run('tela()');await tick();}
function editarRoi(a){
  const input=a.document.querySelector('[data-fm-pagina=roi] input');
  assert.ok(input,'Tabela ROI disponível');
  input.value='120000';
  input.dispatchEvent(new a.document.defaultView.Event('input',{bubbles:true}));
  assert.equal(a.run('document.querySelector("[data-fm-pagina=roi]")._fmDirty'),true);
}
function conferirRascunho(a){
  assert.equal(a.run('atual'),'fortemais');
  assert.equal(a.run('financeiroNumero(document.querySelector("[data-fm-pagina=roi] input").value)'),120000,'A navegação não pode substituir o valor digitado pelo aporte salvo');
  assert.equal(a.run('document.querySelector("[data-fm-pagina=roi]")._fmDirty'),true,'A edição continua não salva');
  assert.equal(a.run('E.obras[0].fmPrevisao.investidores[0].roiPrevisto'),undefined,'Bloquear a navegação não salva valores automaticamente');
}

// O helper DOM não guarda listeners de window. Executamos o registro real do
// aplicativo para testar a navegação, sem copiar a lógica do handler.
function popstate(a){
  const inicio=html.search(/window\.addEventListener\(\s*['"]popstate['"]/);
  assert.ok(inicio>=0,'Listener de navegação registrado pelo aplicativo');
  let nivel=0,aspas='',fim=-1;
  for(let i=html.indexOf('(',inicio);i<html.length;i++){
    const c=html[i];
    if(aspas){if(c==='\\')i++;else if(c===aspas)aspas='';continue;}
    if(c==='"'||c==="'"||c==='`'){aspas=c;continue;}
    if(c==='/'&&html[i+1]==='/'){i=html.indexOf('\n',i);continue;}
    if(c==='/'&&html[i+1]==='*'){i=html.indexOf('*/',i+2)+1;continue;}
    if(c==='(')nivel++;
    if(c===')'&&--nivel===0){fim=i+1;break;}
  }
  assert.ok(fim>inicio,'Registro completo do listener');
  let handler;
  a.ctx.window.addEventListener=(nome,fn)=>{if(nome==='popstate')handler=fn;};
  vm.runInContext(html.slice(inicio,fim),a.ctx);
  assert.equal(typeof handler,'function');
  return handler;
}

test('Fortemais: clicar novamente na mesma seção preserva a ROI não salva',async()=>{
  const a=app();await abrir(a);editarRoi(a);
  a.run('irTela("fortemais")');await tick();
  conferirRascunho(a);
});

test('Fortemais: voltar no navegador preserva a ROI e restaura o endereço da seção',async()=>{
  const a=app();await abrir(a);editarRoi(a);
  const voltar=popstate(a);
  a.ctx.location.hash='#inicio';
  voltar({type:'popstate',preventDefault(){}});await tick();
  conferirRascunho(a);
  assert.equal(a.ctx.location.hash,'#fortemais','O endereço acompanha a seção que permaneceu aberta');
});

test('Fortemais: abrir e cancelar o cadastro não descarta a ROI em edição',async()=>{
  const a=app();await abrir(a);editarRoi(a);
  a.document.querySelector('.fm-identidade').setAttribute('open','');
  const editar=[...a.document.querySelectorAll('.fm-identidade button')].find(b=>b.textContent==='Editar obra');
  assert.ok(editar);editar.click();
  // Tanto bloquear a abertura quanto cancelar sem redesenhar são válidos.
  a.document.querySelector('#modais .fechar')?.click();await tick();
  conferirRascunho(a);
});

test('Fortemais: ROI fica adaptável no celular antes da resposta dos custos',async()=>{
  const a=app();let liberar;
  a.ctx.aguardarCustos=new Promise(resolve=>{liberar=resolve;});
  a.run('fmResumo=()=>aguardarCustos');
  try{
    await abrir(a);
    const tabela=a.document.querySelector('[data-fm-pagina=roi] .fm-grade');
    assert.ok(tabela,'ROI disponível durante a consulta financeira');
    assert.equal(tabela.classList.contains('tabela-adaptavel'),true,'As linhas móveis não dependem da resposta financeira');
    assert.equal(tabela.querySelector('tbody td').dataset.label,'Sócio','Cada célula recebe o rótulo usado na leitura móvel');
  }finally{liberar({});await tick();}
});
