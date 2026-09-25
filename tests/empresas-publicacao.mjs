import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './helpers/dom.mjs';
function app(){const a=setup();a.run("E=structuredClone(SEED);E.empresasPJ=[{id:'a',nome:'Alfa'},{id:'b',nome:'Beta'}];E.liderancas=[];E.planejamentoEmpresas=[];normalizarEmpresas(E);globalThis.emp=E.empresasPJ[0];atual='empresas';filtro.empresaId='a'");return a}
test('avaliação da liderança mantém histórico e separa os acordos por empresa',()=>{
 const a=app();a.run("globalThis.p=centralSalvarLider(emp,'',{nome:'Ana',responsabilidade:'Gestão',contribuicao:'Parcialmente',evidencia:'Entrega inicial',entregas:'Reduzir retrabalho',apoio:'Treinamento',revisarEm:'2026-10-30'});centralSalvarLider(emp,p.id,{nome:'Ana',evidencia:'Entrega melhorou',contribuicao:'Ajuda',situacaoAcordo:'Em andamento'});centralSalvarLider(E.empresasPJ[1],p.id,{nome:'Ana',responsabilidade:'Conselho'})");
 assert.equal(a.run('p.vinculos[0].avaliacoes[0].evidencia'),'Entrega inicial');
 assert.equal(a.run('p.vinculos[0].apoio'),'Treinamento');
 assert.equal(a.run('p.vinculos[1].evidencia'),undefined);
 a.run("filtro.empresaAba='liderancas';tela()");
 assert.match(a.document.querySelector('#empresa-liderancas').textContent,/Histórico de avaliações/);
 assert.match(a.document.querySelector('#empresa-liderancas').textContent,/Entrega melhorou/);
 assert.equal(a.run('validarBackup(structuredClone(E)).liderancas[0].vinculos[0].avaliacoes[0].evidencia'),'Entrega inicial');
});
test('abrir e fechar edição de liderança não grava avaliação',()=>{
 const a=app();a.run("globalThis.p=centralSalvarLider(emp,'',{nome:'Ana'});globalThis.antes=JSON.stringify(E);centralModalLider(emp,p)");
 for(const k of ['contribuicao','evidencia','apoio','proximoPasso','responsavelAcompanhamento','revisarEm','situacaoAcordo'])assert.ok(a.document.querySelector('[name='+k+']'),k);
 a.document.querySelector('#modais .fechar').click();assert.equal(a.run('JSON.stringify(E)'),a.run('antes'));
});
test('V.O.F. aparece no menu e apresentação começa pela teoria seguida da definição',()=>{
 const a=app();a.run('menu();abrirVofApresentacao(0)');
 assert.match(a.document.querySelector('#nav').textContent,/Método V.O.F./);
 const modal=a.document.querySelector('[role=dialog]');assert.ok(modal.classList.contains('modal-vof'));
 assert.match(modal.querySelector('[data-titulo]').textContent,/pirâmide invertida/);
 modal.querySelector('[data-proximo]').click();assert.match(modal.querySelector('[data-titulo]').textContent,/O que é o Método/);
 modal.querySelector('[data-proximo]').click();assert.ok(modal.querySelector('.vof-challenge'));
});
test('seleção empresarial lateral mantém alternativa móvel',()=>{
 const css=readFileSync(new URL('../publico/empresas.css',import.meta.url),'utf8');
 assert.match(css,/\.empresas-layout\{display:grid;grid-template-columns:220px minmax\(0,1fr\)/);
 const a=app();a.run('tela()');assert.ok(a.document.querySelector('.empresas-seletor'));assert.ok(a.document.querySelector('.empresa-select-mobile select'));
});
