import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

function app(){
  const a=setup(),storage=new Map();
  a.ctx.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
  a.run(`E=structuredClone(SEED);atual='fortemais';
    E.obras=[{id:'obra-a',nome:'Obra teste A',vendaValor:777,impostoValor:99,
      fmPrevisao:{venda:400000,terreno:80000,construcao:160000,documentacaoPct:1,comissaoPct:5,impostoPct:6,outras:12000,
        investidores:[{id:'socio',nome:'Sócio',pct:100,aporte:100000,roiPrevisto:{aporte:100000,recebimento:120000}}],
        fluxos:[{id:'f1',investidorId:'socio',data:'2027-01-01',valor:100000,tipo:'Aporte previsto'},{id:'f2',investidorId:'socio',data:'2028-01-01',valor:120000,tipo:'Recebimento previsto'}]}},
      {id:'obra-b',nome:'Obra teste B'}];
    E.obraAportes=[{id:'aporte',obra:'obra-a',valor:987}];
    var obra=E.obras[0],seqDemanda=0;
    var contextoDemanda={now:'2026-10-08T14:00:00.000Z',uid:()=> 'teste-'+(++seqDemanda),autor:'Revisão'};
    var modDemanda=FortemaisDemandasModelo;
    var financeiroAntes=JSON.stringify([obra.fmPrevisao,obra.vendaValor,obra.impostoValor,E.obraAportes]);
    var resultadoAntes=JSON.stringify(fmPrevContas(obra));
    obra.fmDemandas=modDemanda.salvarEtapas(modDemanda.dados(obra),[{id:'doc',nome:'Documentação'}],contextoDemanda);
    obra.fmDemandas=modDemanda.salvarDemanda(obra.fmDemandas,{titulo:'Conferir documento',etapaId:'doc',responsavel:'Pessoa de teste',prazo:'2026-10-01',situacao:'Bloqueada',motivoBloqueio:'Falta retorno',links:[{url:'https://example.com/documento',nome:'Referência'}],checklist:[{texto:'Conferir matrícula'}]},null,contextoDemanda);
    var item=obra.fmDemandas.itens[0];`);
  return {...a,storage};
}

test('Demandas: recarregar preserva etapa, notas, checklist e referências sem alterar TIR/ROI',()=>{
  const {run}=app();
  run(`obra.fmDemandas=modDemanda.situacao(obra.fmDemandas,item.id,'Resolvida',contextoDemanda);
    obra.fmDemandas=modDemanda.salvarDemanda(obra.fmDemandas,{situacao:'Em andamento',observacao:'Reaberta para revisão'},item.id,contextoDemanda);
    salvar();E=carregar();obra=E.obras[0];item=obra.fmDemandas.itens[0]`);
  assert.equal(run('item.responsavel'),'Pessoa de teste');
  assert.equal(run('item.etapaId'),'doc');
  assert.equal(run('item.situacao'),'Em andamento');
  assert.equal(run('item.concluidoEm'),null);
  assert.equal(run('item.links[0].url'),'https://example.com/documento');
  assert.equal(run('item.checklist[0].texto'),'Conferir matrícula');
  assert.match(run('JSON.stringify(item.historico)'),/Reaberta para revisão/);
  assert.equal(run('JSON.stringify([obra.fmPrevisao,obra.vendaValor,obra.impostoValor,E.obraAportes])'),run('financeiroAntes'));
  assert.equal(run('JSON.stringify(fmPrevContas(obra))'),run('resultadoAntes'));
  assert.equal(run('E.obras[1].fmDemandas'),undefined);
});

test('Demandas: transporte existente envia conteúdo completo com a base de concorrência',async()=>{
  const {run,ctx}=app();let payload;
  ctx.fetch=async(_url,opts)=>{payload=JSON.parse(opts.body);return {status:200,json:async()=>({mt:43})}};
  run('_tabBase=42');await run('apiPut()');
  assert.equal(payload.base,42);
  assert.equal(payload.dados.obras[0].fmDemandas.itens[0].titulo,'Conferir documento');
  assert.equal(payload.dados.obras[0].fmPrevisao.venda,400000);
  assert.equal(payload.dados.obras[1].fmDemandas,undefined);
});

test('Demandas: adoção da nuvem restaura demandas e backup rejeita coleções malformadas',()=>{
  const {run}=app();
  assert.doesNotThrow(()=>run('validarBackup(E)'));
  run('var remoto=structuredClone(E);E=structuredClone(SEED);adotaNuvem({dados:remoto,mt:70},false)');
  assert.equal(run('E.obras[0].fmDemandas.itens[0].titulo'),'Conferir documento');
  assert.throws(()=>run('validarBackup({...E,obras:[{fmDemandas:{etapas:[],itens:"inválido"}}]})'),/inválida/);
  assert.throws(()=>run('validarBackup({...E,obras:[{fmDemandas:{etapas:[],itens:[{id:"d",titulo:"Teste",prazo:123}]}}]})'),/inválido/);
  assert.doesNotThrow(()=>run('validarBackup({...E,obras:[{id:"antiga",nome:"Sem demandas"}]})'));
});

test('Demandas: aba nova não altera cálculos nem permite abandonar edição de ROI',async()=>{
  const {run,document,ctx}=app();let aviso='';ctx.alert=t=>aviso=t;
  run('filtro.fmAberta="obra-a";filtro.fmAbas={"obra-a":"roi"}');
  await run('vFortemais(document.getElementById("main"))');await new Promise(r=>setImmediate(r));
  const roi=document.querySelector('[data-fm-pagina=roi]');
  assert.equal(roi.hidden,false);
  assert.ok(document.querySelector('[data-pagina=demandas]'));
  const valor=roi.querySelector('input');valor.value='150000';
  valor.dispatchEvent(new document.defaultView.Event('input',{bubbles:true}));
  document.querySelector('[data-pagina=demandas]').click();
  assert.equal(roi.hidden,false);assert.match(aviso,/Salve ou cancele/);
  assert.equal(run('JSON.stringify(fmPrevContas(obra))'),run('resultadoAntes'));
});

test('Modal: proteção de rascunho cobre fechar, fundo e Escape sem redesenhar finanças',()=>{
  const {run,document}=app();
  run(`var podeFechar=false,chamadasTela=0; tela=()=>chamadasTela++;
    abrirModal('Edição de teste','',c=>c.appendChild(el('<input name="titulo">')),null,{antesFechar:()=>podeFechar,recarregar:false})`);
  document.querySelector('#modais .fechar').click();assert.ok(document.querySelector('#modais .fundo'));
  const fundo=document.querySelector('#modais .fundo');fundo.onclick({target:fundo});assert.ok(fundo.isConnected);
  const e=new document.defaultView.Event('keydown');Object.defineProperty(e,'key',{value:'Escape'});document.dispatchEvent(e);assert.ok(fundo.isConnected);
  run('podeFechar=true');document.querySelector('#modais .fechar').click();
  assert.equal(document.querySelector('#modais .fundo'),null);assert.equal(run('chamadasTela'),0);
});

test('Excluir obra: limpeza inclui anexos das demandas da obra correta',async()=>{
  const {run,ctx}=app();ctx.confirm=()=>true;
  run('var referencias=[];apagarAnexosDe=async ref=>{referencias.push(ref);return true};apiSync=async()=>({ok:true})');
  await run('fmObraExcluir(obra,()=>{})');
  assert.equal(run('referencias.length'),2);
  assert.equal(run('referencias[0]'),'obra:obra-a');
  assert.equal(run('referencias[1]'),run('"obra:obra-a:demanda:"+item.id'));
  assert.equal(run('E.obras.length'),1);assert.equal(run('E.obras[0].id'),'obra-b');
});

export {app};

function submit(document){const form=document.querySelector('#modais form');form.reportValidity=()=>true;form.onsubmit({preventDefault(){}})}
function button(document,label){return [...document.querySelectorAll('#modais button')].find(b=>b.textContent===label)}

test('Demandas: cadastro só com título, edição completa, histórico e reabertura pela interface',()=>{
  const {run,document}=app();
  run('var atualizacoes=0;fmDemandasEditor(obra,null,()=>atualizacoes++)');
  document.querySelector('[name=titulo]').value='Somente o título';submit(document);
  assert.equal(run('obra.fmDemandas.itens.length'),2);assert.equal(run('atualizacoes'),1);
  assert.equal(run('obra.fmDemandas.itens[1].situacao'),'A fazer');
  run('fmDemandasEditor(obra,obra.fmDemandas.itens[1],()=>atualizacoes++)');
  for(const [key,value] of Object.entries({etapaId:'doc',responsavel:'Responsável novo',prazo:'2026-10-01',descricao:'Descrição preservada',proximaAcao:'Cobrar resposta',envolvidos:'Participante',prioridade:'alta',situacao:'Aguardando terceiro',aguardandoQuem:'Terceiro',retornoPendente:'Aprovação',observacao:'Primeiro contato'})){
    const campo=document.querySelector(`[name=${key}]`);
    if(campo.tagName==='SELECT'){[...campo.options].forEach(x=>x.selected=false);[...campo.options].find(x=>x.value===value).selected=true;}
    else campo.value=value;
  }
  button(document,'+ Adicionar item').click();document.querySelector('[aria-label="Item do checklist"]').value='Revisar arquivo';
  button(document,'+ Adicionar link').click();document.querySelector('[name=linkUrl]').value='https://example.com/referencia';
  submit(document);
  assert.equal(run('obra.fmDemandas.itens[1].checklist.length'),1);
  assert.equal(run('obra.fmDemandas.itens[1].links.length'),1);
  assert.equal(run('obra.fmDemandas.itens[1].retornoPendente'),'Aprovação');
  run('document.getElementById("main").appendChild(fmDemandasPainel(obra))');
  document.querySelector('[aria-label="Resolver demanda: Somente o título"]').click();
  assert.equal(run('obra.fmDemandas.itens[1].situacao'),'Resolvida');
  assert.ok(run('obra.fmDemandas.itens[1].concluidoEm'));
  [...document.querySelectorAll('.fmd-aviso button')].find(b=>b.textContent==='Desfazer').click();
  assert.equal(run('obra.fmDemandas.itens[1].situacao'),'Aguardando terceiro');
  assert.equal(run('obra.fmDemandas.itens[1].concluidoEm'),null);
  run('salvar();E=carregar();obra=E.obras[0];fmDemandasEditor(obra,obra.fmDemandas.itens[1],()=>{})');
  assert.match(document.querySelector('.fmd-historico').textContent,/Primeiro contato/);
  assert.match(document.querySelector('.fmd-historico').textContent,/Demanda reaberta/);
  assert.match(document.querySelector('.fmd-historico').textContent,/Demanda resolvida/);
  assert.equal(run('JSON.stringify(fmPrevContas(obra))'),run('resultadoAntes'));
});

test('Demandas: formulário inválido, conflito e falha de armazenamento preservam o rascunho',()=>{
  const {run,document,ctx}=app();run('fmDemandasEditor(obra,item,()=>{})');
  const antes=run('JSON.stringify(E)');document.querySelector('[name=titulo]').value='';submit(document);
  assert.match(document.querySelector('.fmd-erro').textContent,/título/);assert.equal(run('JSON.stringify(E)'),antes);
  document.querySelector('[name=titulo]').value='Rascunho preservado';ctx.localStorage.setItem=()=>{throw Error('quota')};submit(document);
  assert.match(document.querySelector('.fmd-erro').textContent,/rascunho/);assert.equal(run('JSON.stringify(E)'),antes);
  run('obra.fmDemandas=structuredClone(obra.fmDemandas)');submit(document);
  assert.match(document.querySelector('.fmd-erro').textContent,/atualizadas/);assert.equal(document.querySelector('[name=titulo]').value,'Rascunho preservado');
  assert.equal(run('obra.fmDemandas.itens[0].titulo'),'Conferir documento');
});

test('Demandas: filtros, etapas e indicadores da obra respondem às alterações',()=>{
  const {run,document}=app();
  run('document.getElementById("main").append(fmDemandasResumo(obra),fmDemandasPainel(obra));fmDemandasEditarEtapas(obra,()=>{})');
  button(document,'Usar 5 etapas sugeridas').click();submit(document);
  assert.equal(run('obra.fmDemandas.etapas.length'),6);assert.equal(run('obra.fmDemandas.itens.length'),1);
  document.querySelector('[data-resumo=atrasadas]').click();assert.equal(document.querySelectorAll('.fmd-card').length,1);
  const busca=document.querySelector('.fmd-filtros [name=texto]');busca.value='outro';busca.dispatchEvent(new document.defaultView.Event('input'));
  assert.equal(document.querySelectorAll('.fmd-card').length,0);
  busca.value='documento';busca.dispatchEvent(new document.defaultView.Event('input'));
  document.querySelector('[aria-label="Resolver demanda: Conferir documento"]').click();
  assert.equal(document.querySelector('.fmd-obra-resumo').textContent.includes('0 demandas abertas'),true);
  document.querySelector('[data-resumo=resolvidas]').click();
  assert.equal(document.querySelector('.fmd-resolvidas').open,true);
  assert.equal(document.querySelectorAll('.fmd-card').length,1);
});

test('Excluir obra: alteração nas demandas durante limpeza interrompe exclusão',async()=>{
  const {run,ctx}=app();ctx.confirm=()=>true;
  run('var avisos=[],custosApagados=0;alert=t=>avisos.push(t);apagarAnexosDe=async()=>{obra.fmDemandas=modDemanda.salvarDemanda(obra.fmDemandas,{titulo:"Criada durante exclusão"},null,contextoDemanda);return true};apiSync=async()=>{custosApagados++;return {ok:true}}');
  await run('fmObraExcluir(obra,()=>{})');
  assert.equal(run('E.obras.length'),2);assert.equal(run('custosApagados'),0);
  assert.equal(run('obra.fmDemandas.itens.length'),2);assert.match(run('avisos.join()'),/mudaram/);
});

test('Demandas: referências de anexos persistem após recarga e seus botões não submetem o formulário',async()=>{
  const {run,document}=app();
  run(`var refLida='';arqPor=async ref=>{refLida=ref;return [{id:'anexo-teste',nome:'Documento.pdf',tipo:'application/pdf',tam:100}]};fmDemandasEditor(obra,item,()=>{})`);
  await new Promise(r=>setImmediate(r));
  assert.equal(run('refLida'),run('"obra:obra-a:demanda:"+item.id'));
  const antes=run('JSON.stringify(E)'),event=new document.defaultView.Event('click',{bubbles:true,cancelable:true});
  document.querySelector('#modais .lixo').dispatchEvent(event);
  assert.equal(event.defaultPrevented,true);assert.equal(run('JSON.stringify(E)'),antes);
  run('salvar();E=carregar();obra=E.obras[0];item=obra.fmDemandas.itens[0];fmDemandasEditor(obra,item,()=>{})');
  await new Promise(r=>setImmediate(r));
  assert.equal(run('refLida'),run('"obra:obra-a:demanda:"+item.id'));
  assert.match(document.querySelector('#modais').textContent,/Documento.pdf/);
});

test('Demandas: progresso da etapa não muda com filtro de abertas',()=>{
  const {run,document}=app();
  run(`obra.fmDemandas=modDemanda.salvarDemanda(obra.fmDemandas,{titulo:'Concluída',etapaId:'doc',situacao:'Resolvida'},null,contextoDemanda);document.getElementById('main').appendChild(fmDemandasPainel(obra))`);
  document.querySelector('[data-resumo=abertas]').click();
  assert.equal(document.querySelectorAll('.fmd-card').length,1);
  assert.match(document.querySelector('.fmd-etapa-cab').textContent,/1 aberta · 1 de 2 demandas resolvidas/);
});
