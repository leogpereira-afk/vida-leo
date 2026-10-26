import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './helpers/dom.mjs';

const armas=readFileSync(new URL('../publico/documentos-armas.js',import.meta.url),'utf8');
let opcaoNativaAjustada=false;
function app(){
  const a=setup();
  // Linkedom 0.18 desmarca outra opção mesmo ao definir selected=false.
  // Esse ajuste apenas reproduz a seleção nativa, como documentos-chips.mjs.
  if(!opcaoNativaAjustada){
    const proto=Object.getPrototypeOf(a.document.createElement('option'));
    const descriptor=Object.getOwnPropertyDescriptor(proto,'selected');
    Object.defineProperty(proto,'selected',{...descriptor,set(valor){
      if(valor)descriptor.set.call(this,valor);else this.removeAttribute('selected');
    }});
    opcaoNativaAjustada=true;
  }
  a.run(armas);
  a.run(`
    E.pessoas=[{id:'p-ana',nome:'Ana Exemplo'},{id:'p-bruno',nome:'Bruno Exemplo'}];
    E.documentos=[
      {id:'ana-completo',nome:'Passaporte',dono:'Ana Exemplo',numero:'PASS-DEMO',onde:'Pasta de teste',validade:''},
      {id:'ana-parcial',nome:'CNH',dono:' ANA   EXEMPLO ',validade:'2001-01-01'},
      {id:'bruno-parcial',nome:'Certidão',dono:'Bruno Exemplo',numero:'CERT-DEMO',validade:'2099-01-01'},
      {id:'sem-titular',nome:'Carteira',numero:'CARTEIRA-DEMO'},
      {id:'arma-exemplo',grupo:'armas',tipoRegistro:'arma',nome:'Arma fictícia',dono:'Ana Exemplo',numero:'ARMA-DEMO',onde:'Local fictício',validade:'2099-01-01'}
    ];
    filtro.docAba='documentos';filtro.docBusca='';filtro.docPessoa='Todos';filtro.docStatus='Todos';filtro.docCadastro=false;
    atual='documentos';
  `);
  return a;
}
const json=(a,codigo)=>JSON.parse(a.run('JSON.stringify('+codigo+')'));
const chips=a=>[...a.document.querySelectorAll('#main .documento-chip')];
const grupo=(a,nome)=>[...a.document.querySelectorAll('#main .documentos-pessoa')].find(g=>g.querySelector('h2').textContent===nome);
const geral=a=>a.document.querySelector('#main .documentos-preenchimento-geral');
const porcentagemPessoa=(a,nome)=>grupo(a,nome).querySelector('.documentos-pessoa-preenchimento');
const botao=(root,texto)=>[...root.querySelectorAll('button')].find(b=>b.textContent.trim()===texto);
const chip=(a,nome)=>chips(a).find(c=>c.querySelector('strong')?.textContent===nome);
function selecionar(a,label,valor){
  const select=a.document.querySelector(`[aria-label="${label}"]`);
  assert.ok(select);
  [...select.options].forEach(o=>o.selected=false);
  const opcao=[...select.options].find(o=>o.value===valor);
  assert.ok(opcao,`Opção ${valor} disponível`);opcao.selected=true;select.onchange();
}
function campo(a,rotulo){
  return [...a.document.querySelectorAll('#modais .campo')].find(c=>c.querySelector('label')?.textContent===rotulo)?.querySelector('input,textarea,select');
}
function preencher(input,valor,tipo='input'){
  assert.ok(input);input.value=valor;
  input.dispatchEvent(new input.ownerDocument.defaultView.Event(tipo,{bubbles:true}));
}

test('preenchimento vazio informa os quatro campos básicos sem marcar titular implícito',()=>{
  const a=app(),vazio=json(a,'documentoPreenchimento({})');
  assert.equal(vazio.preenchidos,0);assert.equal(vazio.total,4);assert.equal(vazio.percentual,0);
  assert.deepEqual(vazio.faltantes.map(f=>f.k),['nome','dono','numero','onde']);
  assert.ok(vazio.faltantes.every(f=>typeof f.t==='string'&&f.t.trim()));
  const legado=json(a,"documentoPreenchimento({nome:'Documento',numero:'DEMO',onde:'Pasta'})");
  assert.equal(legado.percentual,75);
  assert.deepEqual(legado.faltantes.map(f=>f.k),['dono']);
});

test('preenchimento ignora espaços e rejeita objetos, booleanos e números não finitos',()=>{
  const a=app();
  assert.equal(a.run('documentoPreenchimento('+JSON.stringify({nome:' \n ',dono:'\t',numero:' ',onde:''})+').preenchidos'),0);
  assert.equal(a.run('documentoPreenchimento({nome:{},dono:[],numero:true,onde:Infinity}).preenchidos'),0);
  assert.equal(a.run('documentoPreenchimento({nome:null,dono:undefined,numero:NaN,onde:false}).preenchidos'),0);
  assert.equal(a.run("documentoPreenchimento({nome:' Documento ',dono:' Pessoa ',numero:0,onde:42}).percentual"),100);
});

test('100% de cadastro dispensa validade, observações e anexos e não declara documento em dia',()=>{
  const a=app();
  a.run("const completo={nome:'Documento',dono:'Pessoa Exemplo',numero:'DEMO',onde:'Pasta de teste'}");
  assert.equal(a.run('documentoPreenchimento(completo).percentual'),100);
  assert.equal(a.run('documentoPreenchimento(completo).faltantes.length'),0);
  assert.equal(a.run("statusDocumento({...completo,validade:'2001-01-01'})"),'Vencido');
  assert.equal(a.run("documentoPreenchimento({...completo,validade:'2001-01-01'}).percentual"),100);
  assert.equal(a.run("documentoPreenchimento({...completo,validade:'inválida'}).percentual"),100);
  assert.equal(a.run("documentoPreenchimento({validade:'2099-01-01',obs:'Anotação',anexosIds:['arquivo-demo']}).percentual"),0);
});

test('agregação conta campos e cadastros completos sem fabricar porcentagem para lista vazia',()=>{
  const a=app();
  assert.deepEqual(json(a,'documentosPreenchimento([])'),{preenchidos:0,total:0,percentual:null,completos:0,incompletos:0});
  assert.deepEqual(json(a,"documentosPreenchimento([{nome:'A',dono:'Pessoa',numero:'DEMO',onde:'Pasta'},{nome:'B',dono:'Pessoa',numero:'DEMO'},{nome:'C'}])"),{preenchidos:8,total:12,percentual:66,completos:1,incompletos:2});
});

test('agregação nunca arredonda cadastro incompleto para 100%',()=>{
  const a=app();
  a.run("const muitos=Array.from({length:100},(_,i)=>({nome:'Documento '+i,dono:'Pessoa',numero:'DEMO',onde:i===99?'':'Pasta'}))");
  assert.deepEqual(json(a,'documentosPreenchimento(muitos)'),{preenchidos:399,total:400,percentual:99,completos:99,incompletos:1});
});

test('calcular e mostrar preenchimento não modifica dados, ordem ou metadados existentes',()=>{
  const a=app();
  a.run("E.documentos[1].metadadoTeste={preservar:true};const antesPreenchimento=JSON.stringify(E)");
  a.run('E.documentos.forEach(documentoPreenchimento);documentosPreenchimento(E.documentos);tela()');
  assert.equal(a.run('JSON.stringify(E)===antesPreenchimento'),true);
  assert.equal(a.run('E.documentos[0].id'),'ana-completo');
});

test('porcentagens aparecem no geral, por pessoa e por chip sem incluir Armas',()=>{
  const a=app();a.run('tela()');
  assert.match(geral(a).textContent,/\b68%/);
  assert.match(porcentagemPessoa(a,'Ana Exemplo').textContent,/\b75%/);
  assert.match(porcentagemPessoa(a,'Bruno Exemplo').textContent,/\b75%/);
  assert.match(porcentagemPessoa(a,'Léo').textContent,/\b50%/);
  for(const [nome,percentual] of [['Passaporte',100],['CNH',50],['Certidão',75],['Carteira',50]]){
    assert.match(chip(a,nome).querySelector('.documento-chip-percentual').textContent,new RegExp('\\b'+percentual+'%'));
  }
  assert.equal(chips(a).length,4);
  assert.equal(chips(a).some(c=>c.textContent.includes('Arma fictícia')),false);
  assert.match(chip(a,'CNH').textContent,/Vencido/);
  assert.match(chip(a,'Passaporte').textContent,/Validade não informada/);
});

test('busca, pessoa e validade não reduzem denominadores de preenchimento',()=>{
  const a=app();a.run('tela()');
  selecionar(a,'Pessoa do documento','Ana Exemplo');
  selecionar(a,'Situação do documento','Vencido');
  const busca=a.document.querySelector('[aria-label="Buscar documento"]');busca.value='CNH';busca.oninput();
  assert.equal(chips(a).length,1);
  assert.match(chips(a)[0].querySelector('.documento-chip-percentual').textContent,/\b50%/);
  assert.match(geral(a).textContent,/\b68%/);
  assert.match(porcentagemPessoa(a,'Ana Exemplo').textContent,/\b75%/);
  busca.value='nenhum documento com esse nome';busca.oninput();
  assert.equal(chips(a).length,0);
  assert.match(geral(a).textContent,/\b68%/);
});

test('filtro de incompletos combina com pessoa, preserva percentuais e pode ser limpo',()=>{
  const a=app();a.run('tela()');
  botao(a.document.querySelector('#main'),'Só cadastros incompletos').click();
  assert.equal(a.run('filtro.docCadastro'),true);
  assert.equal(chips(a).length,3);
  assert.equal(chip(a,'Passaporte'),undefined);
  assert.match(geral(a).textContent,/\b68%/);
  selecionar(a,'Pessoa do documento','Ana Exemplo');
  assert.equal(chips(a).length,1);
  assert.match(porcentagemPessoa(a,'Ana Exemplo').textContent,/\b75%/);
  botao(a.document.querySelector('#main'),'Limpar filtros').click();
  assert.equal(a.run('filtro.docCadastro'),false);
  assert.equal(chips(a).length,4);
});

test('editor indica campos faltantes e os botões levam ao campo correspondente',()=>{
  const a=app();a.run('tela()');chip(a,'CNH').click();
  const painel=a.document.querySelector('.documento-preenchimento-editor');
  assert.match(painel.textContent,/\b50%/);
  const faltantes=json(a,"documentoPreenchimento(E.documentos.find(d=>d.id==='ana-parcial')).faltantes");
  for(const [chave,rotulo] of [['numero','Número / referência'],['onde','Onde está o original']]){
    const controle=campo(a,rotulo);let focou=false;controle.focus=()=>{focou=true};
    const acao=botao(painel,'Informar '+faltantes.find(f=>f.k===chave).t);
    assert.ok(acao);acao.click();assert.equal(focou,true);
  }
});

test('change após digitar preserva o botão Informar para o clique e o foco não se perderem',()=>{
  const a=app();a.run('tela()');chip(a,'CNH').click();
  const numero=campo(a,'Número / referência'),local=campo(a,'Onde está o original');
  preencher(numero,'NOVO-DEMO');
  const painel=a.document.querySelector('.documento-preenchimento-editor');
  const informar=botao(painel,'Informar Local do original');
  assert.ok(informar);
  let focou=false;local.focus=()=>{focou=true};

  // Ao clicar no atalho, o navegador dispara change no campo anterior
  // antes de concluir o clique. O alvo deve permanecer no mesmo DOM.
  numero.dispatchEvent(new numero.ownerDocument.defaultView.Event('change',{bubbles:true}));
  assert.equal(informar.isConnected,true);
  assert.equal(botao(painel,'Informar Local do original'),informar);
  informar.click();assert.equal(focou,true);

  // Continuar digitando uma referência preenchida não muda os faltantes.
  preencher(numero,'NOVO-DEMO-COMPLETO');
  assert.equal(informar.isConnected,true);
  assert.equal(botao(painel,'Informar Local do original'),informar);
  assert.match(painel.textContent,/\b75%/);
});

test('editor recalcula ao digitar e mudar campo e a tela reflete ao fechar',()=>{
  const a=app();a.run('tela()');chip(a,'CNH').click();
  const painel=()=>a.document.querySelector('.documento-preenchimento-editor');
  preencher(campo(a,'Número / referência'),'NOVO-DEMO');
  assert.match(painel().textContent,/\b75%/);
  preencher(campo(a,'Onde está o original'),'Pasta de teste','change');
  assert.match(painel().textContent,/\b100%/);
  assert.equal([...painel().querySelectorAll('button')].filter(b=>b.textContent.startsWith('Informar ')).length,0);
  preencher(campo(a,'Observações'),'Observação não altera denominador');
  assert.match(painel().textContent,/\b100%/);
  botao(a.document.querySelector('#modais'),'Pronto').click();
  assert.match(geral(a).textContent,/\b81%/);
  assert.match(porcentagemPessoa(a,'Ana Exemplo').textContent,/\b100%/);
  assert.match(chip(a,'CNH').querySelector('.documento-chip-percentual').textContent,/\b100%/);
  assert.match(chip(a,'CNH').textContent,/Vencido/);
});

test('apagar conteúdo de campo reduz preenchimento e cadastro concluído sai do filtro de incompletos',()=>{
  const a=app();a.run("filtro.docCadastro=true;tela()");chip(a,'CNH').click();
  preencher(campo(a,'Número / referência'),'NOVO-DEMO');
  preencher(campo(a,'Onde está o original'),'Pasta de teste');
  assert.match(a.document.querySelector('.documento-preenchimento-editor').textContent,/\b100%/);
  preencher(campo(a,'Número / referência'),'   ');
  assert.match(a.document.querySelector('.documento-preenchimento-editor').textContent,/\b75%/);
  preencher(campo(a,'Número / referência'),'NOVO-DEMO');
  botao(a.document.querySelector('#modais'),'Pronto').click();
  assert.equal(a.run('filtro.docCadastro'),true);
  assert.equal(chip(a,'CNH'),undefined);
  assert.equal(chips(a).length,2);
  assert.match(geral(a).textContent,/\b81%/);
});

test('criação limpa filtro de incompletos e mostra o cadastro salvo mesmo completo',()=>{
  const a=app();a.run("filtro.docCadastro=true;filtro.docPessoa='Ana Exemplo';tela()");
  botao(grupo(a,'Ana Exemplo'),'+ Documento').click();
  const form=a.document.querySelector('#modais form');
  for(const [k,v] of Object.entries({nome:'Identidade de teste',numero:'ID-DEMO',onde:'Pasta de teste'}))form.querySelector('[name='+k+']').value=v;
  form.onsubmit({preventDefault(){}});
  assert.equal(a.run('filtro.docCadastro'),false);
  assert.equal(a.run('E.documentos.length'),6);
  assert.match(chip(a,'Identidade de teste').querySelector('.documento-chip-percentual').textContent,/\b100%/);
  assert.match(geral(a).textContent,/\b75%/);
  assert.match(porcentagemPessoa(a,'Ana Exemplo').textContent,/\b83%/);
});

test('lista pessoal vazia não informa 0% ou 100% apesar de existir registro de Armas',()=>{
  const a=app();a.run("E.documentos=E.documentos.filter(d=>d.grupo==='armas');tela()");
  assert.ok(geral(a));
  assert.doesNotMatch(geral(a).textContent,/\d+%/);
  assert.equal(chips(a).length,0);
});
