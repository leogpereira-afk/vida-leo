import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';
const luminance=hex=>hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
test('Identidade: áreas mantêm contraste AA e Rendimentos usa o azul da marca do Léo',()=>{
 const {run}=setup();const mods=JSON.parse(run('JSON.stringify(MODS.filter(m=>!m.url).map(m=>m.id))'));const areas=JSON.parse(run('JSON.stringify(LeonardoDesign.areas)'));
 assert.deepEqual(Object.keys(areas).sort(),mods.sort());assert.equal(new Set(Object.entries(areas).filter(([id])=>id!=='rendimentos').map(([,a])=>a[0])).size,mods.length-1);assert.deepEqual(areas.rendimentos.slice(0,2),areas.inicio.slice(0,2));assert.equal(areas.rendimentos[2],areas.inicio[0]);
 for(const [id,[accent,light,hero]] of Object.entries(areas)){
  assert.ok(contrast(accent,'#ffffff')>=4.5,id+' botão');
  assert.ok(contrast(hero,'#ffffff')>=(id==='rendimentos'?4.5:7),id+' cabeçalho');
  assert.ok(contrast(light,'#161c33')>=4.5,id+' modo escuro');
 }
});
test('Identidade: navegar troca a área e mantém dados, filtros e gravações intactos',()=>{
 const {run,document}=setup();run("var temaDadosAntes=JSON.stringify(E);var temaGravacoes=0;localStorage.setItem=()=>{temaGravacoes++}");
 for(const id of ['agenda','gastos','saude','rendimentos','config']){
  run(`irTela('${id}')`);assert.equal(document.body.dataset.leoArea,id);assert.equal(document.querySelector('.pagina').dataset.leoArea,id);assert.ok(document.querySelector('#main h1'));
 }
 assert.equal(run('JSON.stringify(E)===temaDadosAntes'),true);assert.equal(run('temaGravacoes'),0);
});
