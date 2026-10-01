import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

const preparar=()=>{const ctx=setup();ctx.run(`E.planilhas=[{id:'a',nome:'Caixa',sheetId:'1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789',gid:'123'},{id:'b',nome:'Permutas',sheetId:'1BbCdEfGhIjKlMnOpQrStUvWxYz0123456789'}];`);return ctx;};
test('Planilhas têm acesso direto no início do menu e abrem sem consulta ao Drive',()=>{
 const {run,document}=preparar();run("menu()");
 const botoes=[...document.querySelectorAll('#nav button')];const planilhas=botoes.find(x=>x.textContent.includes('Planilhas'));
 assert.ok(planilhas);assert.ok(botoes.indexOf(planilhas)<botoes.findIndex(x=>x.textContent.includes('Rendimentos')));
 planilhas.click();assert.equal(run('atual'),'planilhas');assert.equal(document.querySelectorAll('.dv-cel').length,2);assert.equal(document.querySelector('.google-conexao'),null);
});
test('Busca local encontra o atalho, abre o editor e volta à lista preservada',()=>{
 const {run,document}=preparar();run("irTela('planilhas')");
 const busca=document.querySelector('[aria-label="Buscar planilha salva"]');assert.ok(busca);
 busca.value='perm';busca.oninput();const visiveis=[...document.querySelectorAll('.dv-cel')].filter(x=>!x.hidden);assert.equal(visiveis.length,1);assert.match(visiveis[0].textContent,/Permutas/);
 visiveis[0].querySelector('.dv-pasta').click();const quadro=document.querySelector('.dv-planilha iframe');assert.ok(quadro);assert.match(quadro.src,/docs.google.com\/spreadsheets/);
 [...document.querySelectorAll('button')].find(b=>b.textContent==='← Todas as planilhas').click();assert.equal(document.querySelectorAll('.dv-cel').length,2);assert.equal(run('E.planilhas.length'),2);
});
test('Drive destaca os atalhos antes da busca e abre a lista pelo destaque',()=>{
 const {run,document}=preparar();run("googleConectado=()=>true;driveSobre=async()=>({});driveListar=async()=>[];atual='drive';tela()");
 const destaque=document.querySelector('.dv-planilhas-destaque');assert.ok(destaque);assert.match(destaque.textContent,/2 planilhas/);
 destaque.querySelector('[data-planilhas-abrir]').click();assert.equal(run('atual'),'planilhas');assert.equal(document.querySelectorAll('.dv-cel').length,2);
});
