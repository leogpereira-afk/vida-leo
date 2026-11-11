import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

// All records are synthetic. Exercise the existing save contracts rather than
// coupling preservation checks to the visual groups or CSS used by each form.
const json=value=>JSON.parse(JSON.stringify(value));
const rendimento=()=>({id:'rendimento-demo',data:'2026-01-10',empresa:'Empresa de demonstração',valor:1234.56,tipo:'Distribuição',instituicao:'Banco fictício',obs:'Observação integral',vinculoExterno:{codigo:'ORIGEM-DEMO'}});
function app(){
  const a=setup(),storage=new Map();
  // LinkeDOM clears a sibling even when option.selected is set to false.
  // Match native single-select behavior so an untouched choice survives submit.
  const optionPrototype=Object.getPrototypeOf(a.document.createElement('option'));
  Object.defineProperty(optionPrototype,'selected',{configurable:true,
    get(){return this.hasAttribute('selected')},
    set(value){if(value){for(const sibling of this.parentElement?.querySelectorAll('option')||[])if(sibling!==this)sibling.removeAttribute('selected');this.setAttribute('selected','')}else this.removeAttribute('selected')}
  });
  a.ctx.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
  a.run('E=carregar();tela=()=>{};E._mt=100;');
  a.estado=()=>json(a.run('E'));
  return a;
}
function evento(a,input,tipo='input'){input.dispatchEvent(new a.document.defaultView.Event(tipo,{bubbles:true}));}
function campo(a,nome){
  const direto=a.document.querySelector(`#modais [name="${nome}"]`);if(direto)return direto;
  const label=[...a.document.querySelectorAll('#modais label')].find(l=>l.textContent.trim()===nome);
  assert.ok(label,`Campo ${nome} disponível`);
  return a.document.getElementById(label.htmlFor||label.getAttribute('for'))||label.querySelector('input,select,textarea');
}
function fechar(a){a.document.querySelector('#modais .fechar').click();}
function submit(form){form.onsubmit({preventDefault(){}});}
function botao(a,rotulo){const b=[...a.document.querySelectorAll('#modais button')].find(b=>b.textContent.trim()===rotulo);assert.ok(b,rotulo);return b;}
function abrirRendimento(a){a.ctx.rendimentoDemo=rendimento();a.run('E.rendimentos=[structuredClone(rendimentoDemo)];modalRendimento(E.rendimentos[0],false)');}

const existentes=[
  ['compromisso',`E.agenda=[{id:'agenda-demo',titulo:'Reunião fictícia',data:'2026-01-10',hora:'09:00',ate:'',local:'Sala de teste',tipo:'Tipo legado de demonstração',obs:'Nota original',origemExterna:{id:'DEMO'}}]`,`modalCompromisso(E.agenda[0])`],
  ['documento',`E.documentos=[{id:'documento-demo',nome:'Documento de demonstração',dono:'Pessoa fictícia',numero:'DEMO',validade:'2030-12-20',onde:'Pasta fictícia',obs:'Nota original',origemExterna:{id:'DEMO'}}]`,`modalDoc(E.documentos[0])`],
  ['pessoa',`E.pessoas=[{id:'pessoa-demo',nome:'Pessoa fictícia',relacao:'Relação legada de demonstração',nascimento:'2000-01-01',gosta:'Música',obs:'Nota original',origemExterna:{id:'DEMO'}}]`,`modalPessoa(E.pessoas[0])`],
  ['meta com passos',`E.metas=[{id:'meta-demo',meta:'Meta fictícia',area:'Pessoal',horizonte:'Este ano',prazo:'2030-12-20',status:'Aberta',obs:'Nota original',passos:[{id:'passo-demo',texto:'Passo original',feito:false}],origemExterna:{id:'DEMO'}}]`,`modalMeta(E.metas[0])`],
  ['rendimento',`E.rendimentos=[{id:'rendimento-demo',data:'2026-01-10',empresa:'Empresa fictícia',valor:1234.56,tipo:'Distribuição',instituicao:'Banco fictício',obs:'Nota original',origemExterna:{id:'DEMO'}}]`,`modalRendimento(E.rendimentos[0],false)`],
  ['bem com detalhes',`E.patrimonio=[{id:'bem-demo',nome:'Bem fictício',tipo:'Veículo',onde:'Cidade fictícia',valor:4500.25,falta:1000.1,avaliadoEm:'2026-01-10',situacao:'Em pagamento',documento:'DEMO',obs:'Nota original',origemExterna:{id:'DEMO'}}]`,`modalBem(E.patrimonio[0])`],
  ['desenvolvimento existente',`E.pdi=[{id:'pdi-demo',habilidade:'Habilidade fictícia',area:'Área legada de demonstração',status:'Praticando',como:'Ação original',medida:'Medida original',ate:'2030-12-20',porque:'Motivo original',origemExterna:{id:'DEMO'}}]`,`devModalAcao(E.pdi[0])`],
];
for(const [nome,preparar,abrir] of existentes)test(`Formulários: abrir e fechar ${nome} conserva todo o estado e os vínculos`,()=>{
  const a=app();a.run(preparar);const antes=a.estado();a.run(abrir);
  assert.ok(a.document.querySelector('[role=dialog]'));
  assert.deepEqual(a.estado(),antes,'Abrir não altera o cadastro');
  fechar(a);assert.equal(a.document.querySelector('[role=dialog]'),null);
  assert.deepEqual(a.estado(),antes,'Fechar sem editar não grava ou remove dados');
});

test('Formulários: compromisso continua salvando ao digitar e conserva tipo legado e origem',()=>{
  const a=app();a.run(existentes[0][1]);const antes=a.estado().agenda[0];a.run(existentes[0][2]);
  assert.equal(campo(a,'Tipo').value,antes.tipo);
  const titulo=campo(a,'O quê');titulo.value='Título revisado de demonstração';evento(a,titulo);
  assert.deepEqual(a.estado().agenda[0],{...antes,titulo:'Título revisado de demonstração'});
  fechar(a);a.run('E=carregar()');assert.deepEqual(a.estado().agenda[0],{...antes,titulo:'Título revisado de demonstração'});
});

test('Formulários: novo compromisso continua rascunho e cancelar descarta somente a inclusão',()=>{
  const a=app();a.run(existentes[0][1]);const antes=a.estado();a.run("novoCompromissoRotina('2030-12-20')");
  campo(a,'titulo').value='Rascunho fictício';evento(a,campo(a,'titulo'));
  assert.deepEqual(a.estado(),antes);botao(a,'Cancelar').click();assert.deepEqual(a.estado(),antes);
  assert.equal(a.document.querySelector('[role=dialog]'),null);
});

test('Formulários: edição financeira só grava ao salvar e Cancelar preserva inclusive campos ocultos',()=>{
  const a=app();abrirRendimento(a);const antes=a.estado();
  campo(a,'valor').value='2.450,35';evento(a,campo(a,'valor'));campo(a,'obs').value='Rascunho descartado';evento(a,campo(a,'obs'));
  assert.deepEqual(a.estado(),antes);botao(a,'Cancelar').click();assert.deepEqual(a.estado(),antes);
  assert.equal(a.document.querySelector('[role=dialog]'),null);
});

test('Formulários: erro monetário mantém dados e texto para correção; salvar válido conserva centavos e origem',()=>{
  const a=app();abrirRendimento(a);const antes=a.estado(),form=a.document.querySelector('.ff-form');
  campo(a,'valor').value='não é valor';campo(a,'obs').value='Nota revisada';submit(form);
  assert.deepEqual(a.estado(),antes);assert.equal(a.document.querySelector('.ff-form'),form);
  assert.equal(campo(a,'valor').value,'não é valor');assert.equal(form.querySelector('[role=alert]').hidden,false);
  campo(a,'valor').value='2.450,35';submit(form);
  assert.equal(a.document.querySelector('[role=dialog]'),null);
  assert.deepEqual(a.estado().rendimentos,[{...antes.rendimentos[0],valor:2450.35,obs:'Nota revisada'}]);
  a.run('E=carregar()');assert.equal(a.estado().rendimentos[0].valor,2450.35);
});

test('Formulários: detalhes recolhidos de patrimônio continuam editáveis sem mudar avaliação ou dívida',()=>{
  const a=app();a.run(existentes[5][1]);const antes=a.estado().patrimonio[0];a.run(existentes[5][2]);
  campo(a,'obs').value='Anotação revisada';submit(a.document.querySelector('.ff-form'));
  assert.deepEqual(a.estado().patrimonio[0],{...antes,obs:'Anotação revisada'});
});

test('Formulários: devFormulario de registro existente exige salvar e preserva valor legado e metadados',()=>{
  const a=app();a.run(existentes[6][1]);const antes=a.estado();a.run(existentes[6][2]);
  assert.equal(campo(a,'area').value,'Área legada de demonstração');
  campo(a,'como').value='Prática revisada';evento(a,campo(a,'como'));assert.deepEqual(a.estado(),antes);
  fechar(a);assert.deepEqual(a.estado(),antes);a.run(existentes[6][2]);campo(a,'como').value='Prática revisada';submit(a.document.querySelector('.dev-form'));
  assert.deepEqual(a.estado().pdi,[{...antes.pdi[0],como:'Prática revisada'}]);assert.equal(a.document.querySelector('[role=dialog]'),null);
});

test('Formulários: cadastro dev não inclui registro vazio e conserva rascunho até confirmar',()=>{
  const a=app(),antes=a.estado();a.run('novoRitual()');const form=a.document.querySelector('.dev-form');
  submit(form);assert.deepEqual(a.estado(),antes);assert.equal(form.querySelector('[role=alert]').hidden,false);
  campo(a,'ritual').value='Ritual de demonstração';campo(a,'comQuem').value='Pessoa fictícia';evento(a,campo(a,'ritual'));
  assert.deepEqual(a.estado(),antes);submit(form);
  assert.equal(a.estado().rituais.length,antes.rituais.length+1);
  assert.equal(a.estado().rituais.at(-1).ritual,'Ritual de demonstração');assert.equal(a.document.querySelector('[role=dialog]'),null);
});

test('Formulários: ficha de empresa conserva seus grupos existentes e salva sem duplicar campos ou perder vínculos',()=>{
  const a=app();a.run("E.empresasPJ=[{id:'empresa-demo',nome:'Empresa de demonstração',status:'Ativa',cidade:'Cidade fictícia',obs:'Nota original',documentosEmpresa:[],obrigacoesEmpresa:[],origemExterna:{id:'DEMO'}}]");
  const antes=a.estado();a.run('empresaModalFicha(E.empresasPJ[0])');
  assert.deepEqual(a.estado(),antes);
  const form=a.document.querySelector('.ff-form'),grupos=[...form.querySelectorAll('fieldset')];
  assert.deepEqual(grupos.map(g=>g.querySelector('legend').textContent),['Identificação da empresa','Cadastros e regime tributário','Sociedade e endereço','Contatos e referências']);
  for(const grupo of grupos)assert.ok(grupo.querySelector('input,select,textarea'),'Grupo possui campos para preencher');
  const nomes=[...form.querySelectorAll('[name]')].map(i=>i.name);assert.equal(new Set(nomes).size,nomes.length,'Não duplica os controles ao agrupar');
  campo(a,'obs').value='Anotação da empresa revisada';evento(a,campo(a,'obs'));assert.deepEqual(a.estado(),antes);
  submit(form);assert.equal(a.document.querySelector('[role=dialog]'),null);
  assert.deepEqual(a.estado().empresasPJ,[{...antes.empresasPJ[0],obs:'Anotação da empresa revisada'}]);
});

function focoSimulado(a){
  // Deliberately report boxes even for descendants of closed details, matching
  // the Chrome behavior that originally trapped Shift+Tab on a hidden upload.
  let atual=a.document.querySelector('#modais .fechar');
  Object.defineProperty(a.document,'activeElement',{configurable:true,get:()=>atual});
  for(const item of a.document.querySelectorAll('#modais button,#modais input,#modais summary,#modais .modal')){
    item.getClientRects=()=>[{}];item.focus=()=>{atual=item};item.blur=()=>{atual=null};
  }
  return {focar:selector=>a.document.querySelector(selector).focus(),tab:(shiftKey=false)=>{
    const e=new a.document.defaultView.Event('keydown',{bubbles:true,cancelable:true});e.key='Tab';e.shiftKey=shiftKey;
    a.document.dispatchEvent(e);return {alvo:atual,interceptado:e.defaultPrevented};
  }};
}
function modalTeclado(a){
  a.run(`abrirModal('Formulário de demonstração','',c=>c.appendChild(el('<div><button id="acao-principal">Salvar</button><details id="detalhes-externos"><summary id="resumo-externo">Mais detalhes</summary><input id="campo-recolhido"><button id="anexar-recolhido">Anexar documento</button><details id="detalhes-internos" open><summary id="resumo-interno">Mais opções</summary><button id="acao-interna">Ação interna</button></details></details><button id="fora-do-tab" tabindex="-1">Ação fora do Tab</button><button disabled>Indisponível</button></div>')))`);
  return focoSimulado(a);
}

test('Formulários: Shift+Tab ignora conteúdo recolhido e mantém o summary no ciclo de foco',()=>{
  const a=app(),teclado=modalTeclado(a),primeiro=a.document.querySelector('#modais .fechar');
  const anterior=teclado.tab(true);assert.equal(anterior.interceptado,true);
  assert.equal(anterior.alvo.id,'resumo-externo','Não tenta focar upload nem summary dentro do ancestral fechado');
  const seguinte=teclado.tab();assert.equal(seguinte.interceptado,true);assert.equal(seguinte.alvo,primeiro);
});

test('Formulários: abrir detalhes devolve seus controles ao foco e respeita recolhimento aninhado',()=>{
  const a=app(),teclado=modalTeclado(a);
  a.document.querySelector('#detalhes-externos').setAttribute('open','');
  assert.equal(teclado.tab(true).alvo.id,'acao-interna','Conteúdo expandido pode receber foco');
  teclado.focar('#modais .fechar');a.document.querySelector('#detalhes-internos').removeAttribute('open');
  assert.equal(teclado.tab(true).alvo.id,'resumo-interno','Cabeçalho interno continua acessível, botão recolhido não');
  assert.notEqual(a.document.activeElement.id,'fora-do-tab','tabindex negativo continua fora da navegação');
});
