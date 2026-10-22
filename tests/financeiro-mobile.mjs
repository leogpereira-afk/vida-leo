import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

function rendimentos(){
 const a=setup();
 a.run("E.rendHist={anos:[],totalAno:[],empresas:{}};E.rendimentos=[{id:'r-mobile-a',data:'2025-02-14',empresa:'Empresa fictícia de nome comprido',instituicao:'Banco fictício',tipo:'Distribuição',valor:1234.56,obs:'Observação integral para conferência',vinculoExterno:'preservar'},{id:'r-mobile-b',data:'2025-01-14',empresa:'Outra empresa fictícia',instituicao:'Outra instituição',tipo:'Ajuste',valor:-45,obs:'Estorno fictício'}];filtro.rendAno=2025;atual='rendimentos';tela();RendimentosUI.estado().aba='lancamentos';tela()");
 return a;
}

test('rendimento abre a ficha pela primeira coluna e preserva todas as colunas e dados',()=>{
 const a=rendimentos(),antes=a.run('JSON.stringify(E)'),row=a.document.querySelector('[data-ra-lanc="r-mobile-a"]');
 const abrir=row.querySelector('td:first-child .ra-lancamento-abrir');
 assert.ok(abrir,'A ficha precisa estar acessível antes de qualquer deslocamento horizontal');
 assert.match(abrir.textContent,/Empresa fictícia de nome comprido/);
 assert.match(abrir.textContent,/1\.234,56/);
 assert.equal(row.querySelectorAll('td').length,8);
 assert.match(row.textContent,/Banco fictício.*Distribuição/);
 assert.match(row.textContent,/Observação integral para conferência/);
 let parou=false;abrir.onclick({stopPropagation(){parou=true}});
 assert.equal(parou,true);
 const form=a.document.querySelector('[role=dialog] .ff-form');assert.ok(form);
 assert.equal(form.querySelector('[name=valor]').value,'1234,56');
 form.querySelector('button[type=button]').onclick();
 assert.equal(a.run('JSON.stringify(E)'),antes);
});

test('atalho de rendimento respeita busca, agrupamento e paginação da lista original',()=>{
 const a=rendimentos();
 a.run("Object.assign(RendimentosUI.estado(),{busca:'Outra empresa',grupo:'nenhum'});tela()");
 assert.equal(a.document.querySelectorAll('[data-ra-lanc]').length,1);
 const row=a.document.querySelector('[data-ra-lanc]');assert.equal(row.dataset.raLanc,'r-mobile-b');
 row.querySelector('.ra-lancamento-abrir').onclick({stopPropagation(){}});
 assert.equal(a.document.querySelector('[role=dialog] [name=obs]').value,'Estorno fictício');
 assert.equal(a.run('RendimentosUI.estado().busca'),'Outra empresa');
});

test('edição pela primeira coluna mantém vínculos não exibidos e valores negativos',()=>{
 const a=rendimentos();
 a.document.querySelector('[data-ra-lanc="r-mobile-a"] .ra-lancamento-abrir').onclick({stopPropagation(){}});
 const form=a.document.querySelector('[role=dialog] .ff-form');form.querySelector('[name=obs]').value='Revisão fictícia';form.onsubmit({preventDefault(){}});
 assert.equal(a.run("E.rendimentos.find(x=>x.id==='r-mobile-a').vinculoExterno"),'preservar');
 assert.equal(a.run("E.rendimentos.find(x=>x.id==='r-mobile-a').valor"),1234.56);
 assert.equal(a.run("E.rendimentos.find(x=>x.id==='r-mobile-b').valor"),-45);
});
