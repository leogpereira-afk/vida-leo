import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

const exame={data:'2020-01-02',exame:'Marcador fictício',valor:'15',unidade:'u'};
function iniciar(){
  const app=setup();
  app.run("E.exames=[];E.vitais=[];E.peso=[];E.histFamiliar=[];E.vacinas=[];E.consultas=[];E.tratamentos=[];E.agenda=[];E.documentos=[];E.viagens=[];E.perfil.nascimento='1980-01-01';");
  return app;
}
function importar(app,lista=[exame]){
  app.run('importarExamesRotina()');
  app.document.querySelector('.fundo textarea').value=JSON.stringify(lista);
  [...app.document.querySelectorAll('.fundo button')].find(b=>/Conferir/.test(b.textContent)).onclick();
  return [...app.document.querySelectorAll('.fundo button')].find(b=>/^Adicionar/.test(b.textContent));
}
const estado=app=>app.run('JSON.stringify(E)');
const falhar=app=>{app.ctx.localStorage.setItem=()=>{throw new Error('Armazenamento indisponível')};};

test('importação: armazenamento falhando preserva todo E e mantém a prévia aberta nas tentativas',()=>{
  const app=iniciar(),botao=importar(app),antes=estado(app);falhar(app);
  for(let i=0;i<2;i++){
    assert.doesNotThrow(()=>botao.onclick());
    assert.equal(estado(app),antes);
    assert.ok(app.document.querySelector('.fundo'));
    assert.match(app.document.querySelector('.fundo').textContent,/não foi possível salvar/i);
  }
});

test('importação: falha permite corrigir armazenamento e salvar só uma vez',()=>{
  const app=iniciar(),botao=importar(app);falhar(app);
  try{botao.onclick()}catch{}
  app.ctx.localStorage.setItem=()=>{};
  botao.onclick();botao.onclick();
  assert.equal(app.run('E.exames.length'),1);
  assert.equal(app.document.querySelector('.fundo'),null);
});

test('importação: clique repetido após sucesso não duplica nem regrava',()=>{
  const app=iniciar(),botao=importar(app);let escritas=0;app.ctx.localStorage.setItem=()=>{escritas++};
  botao.onclick();botao.onclick();
  assert.equal(app.run('E.exames.length'),1);assert.equal(escritas,1);
});

test('importação: revalida os já registrados após a prévia e dentro do mesmo arquivo',()=>{
  const app=iniciar(),botao=importar(app,[exame,{...exame,exame:' MARCADOR FICTÍCIO '},{...exame,exame:'Segundo fictício'}]);
  app.run('E.exames.push('+JSON.stringify({id:'preexistente',...exame})+')');
  botao.onclick();
  assert.deepEqual([...app.run('E.exames.map(x=>x.exame)')],['Marcador fictício','Segundo fictício']);
});

test('cadastro genérico: falha faz rollback completo e deixa tentar novamente',()=>{
  const app=iniciar();
  app.run("novoRegistroRotina('Novo registro',E.peso,{data:'2020-01-01'},[{k:'peso',t:'Peso',tipo:'number',obrigatorio:true}])");
  const form=app.document.querySelector('.rotina-form');form.querySelector('[name=peso]').value='80';
  const antes=estado(app);falhar(app);
  for(let i=0;i<2;i++){assert.doesNotThrow(()=>form.onsubmit({preventDefault(){}}));assert.equal(estado(app),antes);assert.match(form.textContent,/não foi possível salvar/i)}
  app.ctx.localStorage.setItem=()=>{};form.onsubmit({preventDefault(){}});form.onsubmit({preventDefault(){}});
  assert.equal(app.run('E.peso.length'),1);
});

test('histórico familiar: adicionar exige escolha de doença e não grava um diagnóstico presumido',()=>{
  const app=iniciar();app.run("vSaude(document.getElementById('main'));organizarSaude(document.getElementById('main'))");
  app.document.querySelector('[data-bid="sa-fam"] .mais').onclick();
  assert.equal(app.run('E.histFamiliar.length'),0);
  const form=app.document.querySelector('.rotina-form');assert.ok(form,'adicionar deve abrir um rascunho');
  assert.equal(form.querySelector('[name=doenca]').value,'');form.onsubmit({preventDefault(){}});
  assert.equal(app.run('E.histFamiliar.length'),0);
  const select=form.querySelector('[name=doenca]');select.querySelector('option[selected]')?.removeAttribute('selected');select.querySelectorAll('option')[1].selected=true;
  form.onsubmit({preventDefault(){}});assert.equal(app.run('E.histFamiliar.length'),1);
});

test('prevenção: catálogo conserva histórico sem criar prazo ou classificação individual',()=>{
  const app=iniciar();app.run("E.exames=[{exame:'Dentista (limpeza)',data:'2000-01-01',resultado:'Normal'}]");
  const item=app.run("rastreiosPendentes(true).find(x=>x.nome==='Dentista (limpeza)')");
  assert.equal(item.ultima,'2000-01-01');assert.equal(item.situacao,'A confirmar');assert.equal(item.venceEm,null);
  app.run("vSaude(document.getElementById('main'))");
  assert.match(app.document.querySelector('[data-bid="sa-rast"]').textContent,/A confirmar/);
  assert.doesNotMatch(app.document.querySelector('[data-bid="sa-rast"]').textContent,/Vencido|Vencendo|Em dia|A cada/);
  assert.equal(app.run("eventosDoEcossistema().filter(x=>x.fonte==='saude').length"),0);
  assert.equal(app.run("radar().some(x=>x.secao==='saude'&&/Dentista/.test(x.txt))"),false);
});

test('prevenção: datas explícitas continuam na agenda, no radar e no resumo',()=>{
  const app=iniciar();app.run("E.exames=[{id:'e',exame:'Exame fictício',data:'2020-01-01',resultado:'Normal',proximo:'2001-03-04'}];E.vacinas=[{id:'v',vacina:'Vacina fictícia',proxima:'2001-03-05'}];E.consultas=[{id:'c',especialidade:'Consulta fictícia',retorno:'2001-03-06'}]");
  assert.ok(app.run("eventosDoEcossistema().some(x=>x.fonte==='saude'&&x.data==='2001-03-04')"));
  assert.ok(app.run("radar().some(x=>x.secao==='saude'&&/Exame fictício/.test(x.txt))"));
  app.run("vSaude(document.getElementById('main'))");
  const resumo=app.document.querySelector('.saude-lembretes').textContent;
  for(const nome of ['Exame fictício','Vacina fictícia','Consulta fictícia'])assert.match(resumo,new RegExp(nome));
});
