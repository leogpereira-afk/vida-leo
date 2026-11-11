import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

const json=value=>JSON.parse(JSON.stringify(value));
const fixture=()=>({
  id:'viagem-formulario-demo',evento:'Encontro de demonstração',cidade:'Cidade de ensaio',
  ida:'2030-12-30',volta:'2031-01-03',hotel:'Hotel de ensaio',transporte:'Transporte legado de ensaio',
  aviaoId:'principal',status:'Confirmado',gastos:1350.75,obs:'Preservar observação de demonstração.',
  campoLegado:{origem:'legado-ficticio',codigo:'DEMO'},carro:{},
  custos:[{id:'custo-demo',descricao:'Hospedagem fictícia',valor:40,situacao:'Pendente'}],
  passagens:[{id:'trecho-demo',sentido:'Ida',de:'AAA',para:'BBB',data:'2030-12-30',hora:'10:00',localizador:'DEMO'}],
  hoteis:[{id:'hotel-demo',nome:'Hotel de ensaio',reserva:'RESERVA-DEMO',valor:40}],
  tickets:[],viajantes:[],roteiro:[],lugares:[],
});
function app(){
  const a=setup(),storage=new Map();
  a.ctx.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
  a.ctx.viagemDemo=fixture();
  a.run(`E=carregar();E.viagens=[structuredClone(viagemDemo)];E.gastos=[];E.aviao.despesas=[];E._mt=100;tela=()=>{};var impressoes=[];imprimirViagem=v=>impressoes.push(structuredClone(v));`);
  a.estado=()=>json(a.run('E'));
  a.abrir=()=>a.run('modalViagem(E.viagens[0])');
  return a;
}
const campo=(a,nome)=>a.document.querySelector(`.viagem-dados [name="${nome}"]`);
const botao=(a,texto)=>[...a.document.querySelectorAll('.viagem-acoes button')].find(b=>b.textContent===texto);
function evento(a,controle,tipo){controle.dispatchEvent(new a.document.defaultView.Event(tipo,{bubbles:true}));}
function selecionar(a,controle,valor){
  // LinkeDOM exposes select.value as getter-only; native browsers provide this setter.
  Object.defineProperty(controle,'value',{configurable:true,writable:true,value:valor});
  evento(a,controle,'change');
}

test('Abrir e concluir a ficha preserva os dados, vínculos e campos legados',()=>{
  const a=app();
  a.run(`E.aviao.despesas=[{id:'despesa-demo',viagemId:E.viagens[0].id,minhaCota:15,status:'Pendente'}];E.gastos=[{id:'gasto-demo',viagemId:E.viagens[0].id,viagemCustoId:'custo-demo',valor:40}];`);
  const antes=a.estado();a.abrir();
  for(const nome of ['evento','cidade','ida','volta','hotel','transporte','aviaoId','status','gastos','obs'])assert.ok(campo(a,nome),nome);
  assert.equal(campo(a,'transporte').value,'Transporte legado de ensaio');
  assert.deepEqual(a.estado(),antes);
  botao(a,'Concluir').click();
  assert.equal(a.document.querySelector('.viagem-edicao'),null);
  assert.deepEqual(a.estado(),antes);
});

test('Orçamento digitado sem blur é persistido antes de concluir ou imprimir',()=>{
  for(const acao of ['Concluir','Imprimir / PDF']){
    const a=app();a.abrir();const antes=a.estado().viagens[0];
    campo(a,'gastos').value='2.450,35';
    botao(a,acao).click();
    assert.deepEqual(a.estado().viagens[0],{...antes,gastos:2450.35});
    if(acao==='Imprimir / PDF'){
      assert.equal(a.run('impressoes.length'),1);
      assert.equal(a.run('impressoes[0].gastos'),2450.35);
      assert.ok(a.document.querySelector('.viagem-edicao'));
    }else assert.equal(a.document.querySelector('.viagem-edicao'),null);
    a.run('E=carregar()');assert.equal(a.estado().viagens[0].gastos,2450.35);
  }
});

test('Orçamento inválido preserva o valor anterior e bloqueia fechamento e impressão',()=>{
  const a=app();a.ctx.confirm=()=>true;a.abrir();const antes=a.estado();const valor=campo(a,'gastos');
  valor.value='valor inválido';
  botao(a,'Concluir').click();
  a.document.querySelector('.viagem-edicao .fechar').click();
  botao(a,'Imprimir / PDF').click();
  for(const rotulo of ['Ver gastos e comprovantes','+ Lançar custo','Apagar viagem']){
    const acao=[...a.document.querySelectorAll('.viagem-edicao button')].find(b=>b.textContent===rotulo);
    assert.ok(acao,rotulo);acao.click();
    assert.equal(a.document.querySelectorAll('.fundo').length,1,rotulo);
    assert.ok(a.document.querySelector('.viagem-edicao'),rotulo);
    assert.deepEqual(a.estado(),antes,rotulo);
  }
  assert.ok(a.document.querySelector('.viagem-edicao'));
  assert.equal(valor.value,'valor inválido');assert.equal(valor.getAttribute('aria-invalid'),'true');
  assert.equal(a.run('impressoes.length'),0);assert.deepEqual(a.estado(),antes);
  valor.value='0';botao(a,'Concluir').click();
  assert.equal(a.document.querySelector('.viagem-edicao'),null);assert.equal(a.run('E.viagens[0].gastos'),0);
});

test('Exclusão concluída fecha a ficha mesmo se houver edição durante a remoção dos anexos',async()=>{
  const a=app();a.ctx.confirm=()=>true;
  a.run('var liberarExclusao;apagarAnexosDe=()=>new Promise(resolve=>liberarExclusao=resolve)');
  a.abrir();const excluir=botao(a,'Apagar viagem').onclick();
  campo(a,'gastos').value='rascunho inválido durante exclusão';
  a.run('liberarExclusao(true)');await excluir;
  assert.equal(a.run('E.viagens.length'),0);
  assert.equal(a.document.querySelector('.viagem-edicao'),null);
});

test('Trocar transporte não remove aeronave e despesas vinculadas impedem desvinculação',()=>{
  const a=app(),avisos=[];a.ctx.alert=texto=>avisos.push(texto);
  a.run(`E.aviao.despesas=[{id:'despesa-demo',viagemId:E.viagens[0].id,minhaCota:15,status:'Pendente'}]`);
  a.abrir();selecionar(a,campo(a,'transporte'),'Carro');
  assert.equal(a.run('E.viagens[0].aviaoId'),'principal');assert.equal(campo(a,'aviaoId').hidden,false);
  const antes=a.estado();selecionar(a,campo(a,'aviaoId'),'');
  assert.deepEqual(a.estado(),antes);assert.equal(campo(a,'aviaoId').value,'principal');
  assert.match(avisos.join(' '),/despesas do avião vinculadas/);
});

test('Aviso de datas atravessa o ano e sinaliza inversão sem corrigir os dados automaticamente',()=>{
  const a=app();a.abrir();
  assert.equal(a.document.querySelector('.viagem-periodo').textContent,'5 dias de viagem');
  const idaInicial=a.run('E.viagens[0].ida');
  const volta=campo(a,'volta');volta.value='2030-12-29';evento(a,volta,'input');
  assert.equal(a.run('E.viagens[0].ida'),idaInicial);assert.equal(a.run('E.viagens[0].volta'),'2030-12-29');
  assert.match(a.document.querySelector('.viagem-periodo').textContent,/volta está antes da ida/);
  assert.equal(volta.getAttribute('aria-invalid'),'true');
  volta.value='2031-01-03';evento(a,volta,'input');
  assert.notEqual(volta.getAttribute('aria-invalid'),'true');
  assert.equal(a.run('E.viagens[0].ida'),idaInicial);assert.equal(a.run('E.viagens[0].volta'),'2031-01-03');
});
