import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {setup} from './helpers/dom.mjs';
const app=()=>{
  const a=setup(),storage=new Map();a.ctx.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
  for(const [file,api] of [['fortemais-compras-modelo.js','FortemaisComprasModelo'],['fortemais-compras.js','fmComprasPainel']])if(a.run('typeof '+api)==='undefined')vm.runInContext(readFileSync(new URL('../publico/'+file,import.meta.url),'utf8'),a.ctx);
  a.run("E=structuredClone(SEED);var obra={id:'obra-teste',nome:'Obra sintética',aporte:123,venda:456,fmPrevisao:{marcador:'preservar'}};var outra={id:'outra',nome:'Outra obra',fmCompras:{versao:1,listas:[]}};E.obras=[obra,outra];tela=()=>{};var painel=fmComprasPainel(obra);document.getElementById('main').appendChild(painel)");return {...a,storage};
};
const botao=(a,t)=>[...a.document.querySelectorAll('button')].find(b=>b.textContent===t);
const preencher=(a,n,v)=>{const campo=a.document.querySelector('.fmc-editor [name="'+n+'"]');assert.ok(campo,n);campo.value=v;campo.dispatchEvent(new a.document.defaultView.Event('input',{bubbles:true}));};
const enviar=a=>a.document.querySelector('.fmc-editor').onsubmit({preventDefault(){}});
const nova=a=>{botao(a,'Nova lista').click();preencher(a,'titulo','Materiais sintéticos');preencher(a,'descricao','Item fictício');preencher(a,'quantidade','2');};
const salva=a=>{nova(a);enviar(a);assert.equal(a.run('obra.fmCompras.listas.length'),1);};
const tick=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};

test('Compras: criar sem preços, persistir e reabrir preserva financeiro e outra obra',()=>{
  const a=app(),antes=a.run('JSON.stringify(outra)'),financeiro=a.run('JSON.stringify({aporte:obra.aporte,venda:obra.venda,prev:obra.fmPrevisao,gastos:E.gastos})');salva(a);
  assert.equal(a.run('obra.fmCompras.listas[0].itens[0].estimado'),null);assert.equal(a.run('painel._fmDirty'),false);assert.equal(a.run('JSON.stringify(outra)'),antes);assert.equal(a.run('JSON.stringify({aporte:obra.aporte,venda:obra.venda,prev:obra.fmPrevisao,gastos:E.gastos})'),financeiro);
  assert.ok([...a.storage.values()].some(v=>v.includes('Materiais sintéticos')));a.run("var guardada=JSON.parse(JSON.stringify(E));E=guardada;obra=E.obras[0];document.getElementById('main').replaceChildren();painel=fmComprasPainel(obra);document.getElementById('main').appendChild(painel)");assert.match(a.run('painel.textContent'),/Materiais sintéticos/);assert.match(a.run('painel.textContent'),/Não informado/);
});
test('Compras: quota restaura campo ausente e marcador, conserva rascunho e permite tentar novamente',()=>{
  const a=app();nova(a);a.run('E._mt=123');a.ctx.localStorage.setItem=()=>{throw Error('quota')};enviar(a);
  assert.equal(a.run('obra.fmCompras'),undefined);assert.equal(a.run('E._mt'),123);assert.equal(a.run('painel._fmDirty'),true);assert.equal(a.document.querySelector('[name=titulo]').value,'Materiais sintéticos');assert.match(a.document.querySelector('.fmc-editor [role=alert]').textContent,/Não foi possível salvar/);
  a.ctx.localStorage.setItem=(k,v)=>a.storage.set(k,v);enviar(a);assert.equal(a.run('obra.fmCompras.listas.length'),1);
});
test('Compras: falha em edição restaura exatamente o objeto anterior',()=>{
  const a=app();salva(a);a.run('var anterior=obra.fmCompras');botao(a,'Editar').click();preencher(a,'titulo','Alteração não salva');a.ctx.localStorage.setItem=()=>{throw Error('quota')};enviar(a);
  assert.equal(a.run('obra.fmCompras===anterior'),true);assert.equal(a.run('obra.fmCompras.listas[0].titulo'),'Materiais sintéticos');assert.equal(a.document.querySelector('[name=titulo]').value,'Alteração não salva');
});
for(const tipo of ['referência','mesmo objeto','estado'])test('Compras: conflito '+tipo+' não sobrescreve dados recebidos',()=>{
  const a=app();salva(a);botao(a,'Editar').click();preencher(a,'titulo','Meu rascunho');
  if(tipo==='estado')a.run("E=structuredClone(E);E.obras[0].fmCompras.listas[0].titulo='Outro acesso'");else if(tipo==='referência')a.run("obra.fmCompras=structuredClone(obra.fmCompras);obra.fmCompras.listas[0].titulo='Outro acesso'");else a.run("obra.fmCompras.listas[0].titulo='Outro acesso'");
  enviar(a);assert.equal(a.run('E.obras[0].fmCompras.listas[0].titulo'),'Outro acesso');assert.equal(a.document.querySelector('[name=titulo]').value,'Meu rascunho');assert.equal(a.run('painel._fmDirty'),true);assert.match(a.document.querySelector('.fmc-editor [role=alert]').textContent,/atualizadas/);
});
test('Compras: recebimento acima do pedido falha sem gravar; parcial e total atualizam situação',()=>{
  const a=app();salva(a);const id=a.run('obra.fmCompras.listas[0].itens[0].id');botao(a,'Conferir recebimento').click();preencher(a,id,'3');enviar(a);assert.equal(a.run('obra.fmCompras.listas[0].itens[0].recebido'),0);assert.match(a.document.querySelector('.fmc-editor [role=alert]').textContent,/superar/);
  preencher(a,id,'1');enviar(a);assert.equal(a.run('obra.fmCompras.listas[0].situacao'),'parcial');botao(a,'Conferir recebimento').click();preencher(a,id,'2');enviar(a);assert.equal(a.run('obra.fmCompras.listas[0].situacao'),'recebido');
});
test('Compras: cancelamento reversível exclui do resumo e não exclui itens',()=>{
  const a=app();salva(a);botao(a,'Cancelar lista').click();assert.equal(a.run('FortemaisComprasModelo.resumo(obra.fmCompras).pendentes'),0);assert.equal(a.run('obra.fmCompras.listas[0].itens.length'),1);botao(a,'Reativar lista').click();assert.equal(a.run('FortemaisComprasModelo.resumo(obra.fmCompras).pendentes'),1);
});
test('Compras: atualização e exportação durante rascunho não descartam edição',()=>{
  const a=app();nova(a);a.run('painel.atualizar();painel.exportar()');assert.equal(a.document.querySelector('[name=titulo]').value,'Materiais sintéticos');assert.equal(a.run('painel._fmDirty'),true);assert.match(a.run('painel.textContent'),/Salve ou cancele/);
});
test('Compras: preço zero é salvo, preços vazios continuam ausentes e unidades com frações são aceitas',()=>{
  const a=app();nova(a);preencher(a,'quantidade','1,5');preencher(a,'estimado','0');preencher(a,'cotado','1,01');enviar(a);assert.equal(a.run('obra.fmCompras.listas[0].itens[0].estimado'),0);assert.equal(a.run('obra.fmCompras.listas[0].itens[0].comprado'),null);assert.equal(a.run('FortemaisComprasModelo.resumo(obra.fmCompras).cotado.centavos'),152);
});
test('Compras: PDF usa retrato da obra, escapa conteúdo e diferencia totais parciais',()=>{
  const a=app();nova(a);preencher(a,'titulo','<img src=x>');preencher(a,'descricao','<script>erro</script>');preencher(a,'estimado','1');botao(a,'+ Adicionar item').click();const linhas=a.document.querySelectorAll('.fmc-item-editor');linhas[1].querySelector('[name=descricao]').value='Segundo item';enviar(a);a.run('var pdf=null;fmPdfAbrir=m=>{pdf=m;return true}');botao(a,'PDF de conferência').click();
  assert.equal(a.run('pdf.obra.id'),'obra-teste');assert.match(a.run('pdf.conteudo'),/&lt;img/);assert.doesNotMatch(a.run('pdf.conteudo'),/<script>/);assert.match(a.run('pdf.conteudo'),/Parcial:/);assert.match(a.run('pdf.nota'),/não gera despesas/);
});
test('Compras: anexos usam referência exata da lista e mantêm proteção enquanto enviam',async()=>{
  const a=app();salva(a);a.run('var ref=null;var concluir;arqPor=async()=>[];arqAdd=(r,f)=>{ref=r;return new Promise(resolve=>concluir=resolve)}');const d=a.document.querySelector('.fmc-lista-detalhes');d.open=true;d.dispatchEvent(new a.document.defaultView.Event('toggle'));await tick();const input=a.document.querySelector('.fmc-anexos input');Object.defineProperty(input,'files',{value:[{name:'ficticio.pdf',size:12,type:'application/pdf'}]});const envio=input.onchange();await tick();
  assert.equal(a.run('ref'),'obra:obra-teste:compra:'+a.run('obra.fmCompras.listas[0].id'));assert.equal(a.run('painel._fmDirty'),true);a.run('painel.atualizar()');assert.ok(a.document.querySelector('.fmc-anexos'));a.run('concluir({})');await envio;assert.equal(a.run('painel._fmDirty'),false);
});
test('Compras: arquivo com erro de envio mantém aviso e não altera dados da compra',async()=>{
  const a=app();salva(a);const antes=a.run('JSON.stringify(obra.fmCompras)');a.run('arqPor=async()=>[];arqAdd=async()=>{throw Error("Falha sintética de envio")}');const d=a.document.querySelector('.fmc-lista-detalhes');d.open=true;d.dispatchEvent(new a.document.defaultView.Event('toggle'));await tick();const input=a.document.querySelector('.fmc-anexos input');Object.defineProperty(input,'files',{value:[{name:'ficticio.pdf'}]});await input.onchange();assert.match(a.document.querySelector('.fmc-anexos [role=alert]').textContent,/Falha sintética/);assert.equal(a.run('JSON.stringify(obra.fmCompras)'),antes);assert.equal(a.run('painel._fmDirty'),false);
});
test('Compras no celular: preço inválido abre o material recolhido e conserva os outros campos até corrigir',()=>{
  const a=app();nova(a);preencher(a,'solicitante','Solicitante fictício');preencher(a,'estimado','25,10');botao(a,'+ Adicionar item').click();
  const materiais=a.document.querySelectorAll('.fmc-item-editor'),segundo=materiais[1],preco=segundo.querySelector('[name=cotado]');
  segundo.querySelector('[name=descricao]').value='Segundo material com especificação';segundo.querySelector('[name=especificacao]').value='Texto que deve continuar no rascunho';preco.value='12,345';
  assert.equal(Boolean(segundo.querySelector('details').open),false);enviar(a);
  assert.equal(a.run('obra.fmCompras'),undefined);assert.equal(segundo.querySelector('details').open,true);assert.equal(preco.getAttribute('aria-invalid'),'true');
  const ajuda=a.document.getElementById(preco.getAttribute('aria-describedby'));assert.match(ajuda.textContent,/cotado do material 2/);assert.equal(a.run('painel._fmDirty'),true);
  assert.equal(materiais[0].querySelector('[name=estimado]').value,'25,10');assert.equal(a.document.querySelector('[name=solicitante]').value,'Solicitante fictício');
  preco.value='12,34';preco.dispatchEvent(new a.document.defaultView.Event('input',{bubbles:true}));assert.equal(preco.hasAttribute('aria-invalid'),false);assert.equal(segundo.querySelector('.fmc-campo-erro'),null);enviar(a);
  assert.equal(a.run('obra.fmCompras.listas[0].itens.length'),2);assert.equal(a.run('obra.fmCompras.listas[0].itens[1].cotado'),1234);assert.equal(a.run('obra.fmCompras.listas[0].itens[1].especificacao'),'Texto que deve continuar no rascunho');assert.equal(a.run('obra.fmCompras.listas[0].itens[0].estimado'),2510);
});
test('Compras no celular: aponta campos obrigatórios e mantém a numeração após remover material',()=>{
  const a=app();botao(a,'Nova lista').click();enviar(a);assert.equal(a.document.querySelector('[name=titulo]').getAttribute('aria-invalid'),'true');
  preencher(a,'titulo','Lista sintética');enviar(a);assert.equal(a.document.querySelector('[name=descricao]').getAttribute('aria-invalid'),'true');
  preencher(a,'descricao','Primeiro material');botao(a,'+ Adicionar item').click();botao(a,'+ Adicionar item').click();
  assert.deepEqual([...a.document.querySelectorAll('.fmc-item-editor legend')].map(x=>x.textContent),['Material 1','Material 2','Material 3']);
  a.document.querySelectorAll('.fmc-item-editor')[1].querySelector('button').click();assert.deepEqual([...a.document.querySelectorAll('.fmc-item-editor legend')].map(x=>x.textContent),['Material 1','Material 2']);
  const segundo=a.document.querySelectorAll('.fmc-item-editor')[1];segundo.querySelector('[name=descricao]').value='Último material preservado';enviar(a);
  assert.equal(a.run('obra.fmCompras.listas[0].itens.length'),2);assert.equal(a.run('obra.fmCompras.listas[0].itens[1].descricao'),'Último material preservado');
});
test('Compras no celular: valores da lista têm rótulos próprios e preservam totais parciais, zero e não informado',()=>{
  const a=app();nova(a);preencher(a,'estimado','0');preencher(a,'cotado','12,50');botao(a,'+ Adicionar item').click();a.document.querySelectorAll('.fmc-item-editor')[1].querySelector('[name=descricao]').value='Material sem preços';enviar(a);
  const totais=[...a.document.querySelectorAll('.fmc-lista-totais>div')].map(x=>[x.querySelector('dt').textContent,x.querySelector('dd').textContent]);
  assert.equal(totais.length,3);assert.equal(totais[0][0],'Estimado');assert.match(totais[0][1],/Parcial:.*0,00/);assert.equal(totais[1][0],'Cotado');assert.match(totais[1][1],/Parcial:.*25,00/);assert.deepEqual(totais[2],['Comprado','Não informado']);
  assert.match(a.document.querySelector('.fmc-lista-resumo').textContent,/2 item\(ns\).*Solicitação:/);
});
