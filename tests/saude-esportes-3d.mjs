import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import {parseHTML} from 'linkedom';
const src=readFileSync(new URL('../publico/saude-esportes-3d.js',import.meta.url),'utf8');
function setup(){const {document}=parseHTML('<html><body></body></html>');const ctx=vm.createContext({document,Math,queueMicrotask:()=>{},requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{}});vm.runInContext(src,ctx);return {api:ctx.SaudeEsportes3D,document};}
test('3D cobre as 35 práticas com poses finitas em todo o ciclo',()=>{const {api}=setup();assert.equal(Object.values(api.kinds).flat().length,35);for(const kind of new Set(Object.values(api.kinds).flat()))for(let t=0;t<=1;t+=.05){const p=api.pose(kind,t);assert.equal(Object.keys(p.joints).length,16,kind);for(const a of Object.values(p.joints)){assert.equal(a.length,3);assert.ok(a.every(Number.isFinite),kind)}}});
test('3D movimento tem mudança de fase; isometrias mantêm postura',()=>{const {api}=setup();for(const kind of new Set(Object.values(api.kinds).flat())){const a=JSON.stringify(api.pose(kind,0).joints),b=JSON.stringify(api.pose(kind,.33).joints);if(['plank','sideplank'].includes(kind))assert.equal(a,b);else assert.notEqual(a,b,kind)}});
test('3D ficha possui controles acessíveis e não inicia movimento automático',()=>{const {api,document}=setup();const orig=document.createElement.bind(document);document.createElement=name=>{const el=orig(name);if(name==='canvas')el.getContext=()=>null;return el};const node=api.create('musculacao',6,{title:'Agachamento',cue:'Controle'});assert.ok(node.querySelector('[aria-label="Fase do movimento"]'));assert.equal(node.querySelector('button').textContent,'▶ Reproduzir');assert.equal(node.querySelectorAll('button').length,6);assert.match(node.textContent,/Corpo humano/);assert.equal(api.create('inexistente',0,{}),null)});

test("3D todos os movimentos identificam músculos principais",()=>{const {api}=setup();for(const kind of new Set(Object.values(api.kinds).flat()))assert.ok(api.muscleMap[kind][0].length,kind)});


test('3D distingue fase de contração e retorno conforme o exercício',()=>{const {api}=setup();assert.match(api.phaseText('curl',.2),/concêntrica/);assert.match(api.phaseText('curl',.7),/excêntrica/);assert.match(api.phaseText('squat',.2),/excêntrica/);assert.match(api.phaseText('squat',.7),/concêntrica/);assert.match(api.phaseText('plank',.2),/Sustentação/)});


test('fechar ou trocar de ficha interrompe reprodução e restaura o botão',()=>{const {api}=setup();const node=api.create('musculacao',3,{title:'Rosca'});const play=node.querySelector('button');play.onclick();assert.equal(play.textContent,'Ⅱ Pausar');node.espDispose();assert.equal(play.textContent,'▶ Reproduzir')});
