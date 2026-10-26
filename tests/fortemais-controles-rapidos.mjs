import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function setup(){
 const {document,window}=parseHTML('<html><body></body></html>'),timers=new Map();let timer=0;
 const c=vm.createContext({document,window,console,structuredClone,URL,Blob,crypto,atob,confirm:()=>true,alert(){},setTimeout(fn){timers.set(++timer,fn);return timer},clearTimeout(id){timers.delete(id)},flush(){const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn())},E:{obras:[]},filtro:{},salvar(){}});
 for(const name of ['fortemais-apoio-modelo.js','fortemais-ferramentas-modelo.js','fortemais-materiais.js','fortemais-ferramentas.js'])vm.runInContext(readFileSync(new URL('../publico/'+name,import.meta.url),'utf8'),c);
 const p=c.fmFerramentasPainel();document.body.append(p);return {c,p,document};
}
const input=(p,name)=>p.querySelector('[name="'+name+'"]');
const wrapper=(p,name)=>input(p,name).closest('.fmf-field');
const edit=(p,name,value)=>{const field=input(p,name);field.value=value;field.oninput();return field};
const choose=(p,c,id)=>{const search=p.querySelector('[aria-label="Buscar ferramenta"]');search.value=c.FortemaisFerramentasModelo.catalogo.find(t=>t.id===id).titulo;search.oninput();p.querySelector('[data-tool="'+id+'"]').click()};
const chip=(p,name,value)=>wrapper(p,name).querySelector('button[data-value="'+value+'"]');
const saveDraft=(p,c)=>{input(p,'nome').value='Teste fictício de controles';p.querySelector('[data-action="rascunho"]').click();assert.match(p.querySelector('.fmf-message').textContent,/Rascunho salvo/);return c.E.fortemaisApoio.simulacoes.at(-1).versoes.at(-1)};

test('25 ferramentas mantêm medidas vazias e controles auxiliares fora dos dados salvos',()=>{
 const {c,p}=setup();for(const tool of c.FortemaisFerramentasModelo.catalogo){choose(p,c,tool.id);for(const field of tool.campos.filter(f=>f.type==='number')){assert.ok(input(p,field.key),tool.id+':'+field.key);if(field.default===undefined)assert.equal(input(p,field.key).value,'',tool.id+':'+field.key)}assert.equal(p.querySelectorAll('input[type="range"][name]').length,0,tool.id);assert.equal(c.E.fortemaisApoio,undefined)}
});

test('régua vazia não grava zero e botões incrementais aguardam um valor informado',()=>{
 const {c,p}=setup(),field=wrapper(p,'largura');assert.equal(input(p,'largura').value,'');assert.equal(field.querySelector('.fmf-ruler-box').dataset.state,'empty');assert.match(field.querySelector('.fmf-ruler').getAttribute('aria-valuetext'),/Não informado/);assert.ok([...field.querySelectorAll('.fmf-step-button')].every(b=>b.disabled));
 const saved=saveDraft(p,c);assert.equal(Object.hasOwn(saved.inputs,'largura'),false);assert.equal(Object.hasOwn(saved.inputs,''),false);assert.equal(saved.inputs.perdaPct,10);
});

test('régua preserva decimal exato, adapta escala e apresenta cinco marcas coerentes',()=>{
 const {c,p}=setup();edit(p,'largura','123,4567');const field=wrapper(p,'largura'),range=field.querySelector('.fmf-ruler');assert.equal(input(p,'largura').value,'123,4567');assert.equal(Number(range.max),130);assert.equal(Number(range.step),0.0001);assert.equal(range.getAttribute('aria-valuenow'),'123.4567');assert.equal(range.getAttribute('aria-valuetext'),'123,4567 m');assert.deepEqual([...field.querySelectorAll('.fmf-ruler-ticks span')].map(n=>Number(n.dataset.value)),[0,32.5,65,97.5,130]);
 assert.equal(saveDraft(p,c).inputs.largura,'123,4567');
});

test('aumentar e diminuir preservam vírgula e casas informadas sem arredondar a medida',()=>{
 const {p}=setup();edit(p,'largura','1,235');let field=wrapper(p,'largura');const buttons=field.querySelectorAll('.fmf-step-button');buttons[1].click();assert.equal(input(p,'largura').value,'1,245');buttons[0].click();assert.equal(input(p,'largura').value,'1,235');edit(p,'largura','0');assert.equal(buttons[0].disabled,true);buttons[1].click();assert.equal(input(p,'largura').value,'0.01');
});

test('chips de escolha atualizam o select fonte, anunciam seleção e preservam rascunho dos vãos',()=>{
 const {p}=setup();assert.equal(chip(p,'temAberturas','nao').getAttribute('aria-pressed'),'true');chip(p,'temAberturas','sim').click();assert.equal(input(p,'temAberturas').value,'sim');assert.equal(chip(p,'temAberturas','sim').getAttribute('aria-pressed'),'true');[...p.querySelectorAll('button')].find(b=>b.textContent==='+ Adicionar janela').click();edit(p,'aberturas[0].largura','1,75');chip(p,'temAberturas','nao').click();assert.equal(input(p,'aberturas[0].largura'),null);chip(p,'temAberturas','sim').click();assert.equal(input(p,'aberturas[0].largura').value,'1,75');assert.equal(input(p,'temAberturas').getAttribute('aria-hidden'),'true');assert.equal(input(p,'temAberturas').getAttribute('tabindex'),'-1');
});

test('chips, régua e botão incremental invalidam resultado e acionam recálculo sem salvar',()=>{
 const {c,p}=setup();p.querySelector('[data-action="exemplo"]').click();assert.equal(p.querySelector('[data-action="salvar"]').disabled,false);chip(p,'perdaPct','15').click();assert.equal(input(p,'perdaPct').value,'15');assert.equal(p.querySelector('[data-action="salvar"]').disabled,true);c.flush();assert.equal(p.querySelector('[data-action="salvar"]').disabled,false);
 const range=wrapper(p,'largura').querySelector('.fmf-ruler');range.value='8.25';range.oninput();assert.equal(input(p,'largura').value,'8.25');assert.equal(p.querySelector('[data-action="salvar"]').disabled,true);c.flush();assert.match(p.querySelector('.fmf-kpis').textContent,/24,75 m²/);
 wrapper(p,'largura').querySelectorAll('.fmf-step-button')[1].click();assert.equal(p.querySelector('[data-action="salvar"]').disabled,true);assert.equal(c.E.fortemaisApoio,undefined);
});

test('linhas têm identificação, contagem e faces explícitas sem duplicar propriedades',()=>{
 const {c,p}=setup();choose(p,c,'reboco');const rows=p.querySelector('.fmf-rows');assert.match(rows.querySelector('.fmf-rows-empty').textContent,/Adicione uma linha/);rows.querySelector('[data-action="adicionar-linha"]').click();assert.match(p.querySelector('.fmf-row-heading').textContent,/Superfície 1/);assert.equal(input(p,'areas[0].faces').value,'');chip(p,'areas[0].faces','2').click();assert.equal(input(p,'areas[0].faces').value,'2');edit(p,'areas[0].largura','4,25');assert.equal(p.querySelectorAll('input[type="range"][name]').length,0);const saved=saveDraft(p,c);assert.deepEqual(Object.keys(saved.inputs.areas[0]).sort(),['faces','largura']);assert.equal(saved.inputs.areas[0].largura,'4,25');assert.equal(saved.inputs.areas[0].faces,'2');
});

test('seleção de modo oculta o campo inteiro e limpar uma seleção volta a exigir escolha',()=>{
 const {c,p}=setup();choose(p,c,'impermeabilizacao');chip(p,'modo','rolo').click();assert.equal(wrapper(p,'consumo').hidden,true);assert.equal(wrapper(p,'roloLargura').hidden,false);chip(p,'modo','liquido').click();assert.equal(wrapper(p,'consumo').hidden,false);assert.equal(wrapper(p,'roloLargura').hidden,true);wrapper(p,'modo').querySelector('.fmf-choice-clear').click();assert.equal(input(p,'modo').value,'');p.querySelector('[data-action="calcular"]').click();assert.match(p.querySelector('.fmf-message').textContent,/escolha uma opção/);assert.equal(p.querySelector('[data-action="salvar"]').disabled,true);
});

test('campos técnicos não oferecem presets e os controles não ficam dentro de labels',()=>{
 const {c,p}=setup();const technical=new Set(['fck','diametro','secao','carga','consumo','cimento','areia','brita','densidade','fatorSolto','fatorNatural','rendimento','condutores','demao','sobreposicao']);
 for(const tool of c.FortemaisFerramentasModelo.catalogo){choose(p,c,tool.id);p.querySelector('[data-action="exemplo"]').click();for(const field of p.querySelectorAll('.fmf-input-panel input[name],.fmf-input-panel select[name]')){const key=field.name.split('.').at(-1);if(technical.has(key)){const box=field.closest('.fmf-field');assert.equal(box.querySelector('.fmf-ruler'),null,tool.id+':'+key);assert.equal(box.querySelector('.fmf-value-chips'),null,tool.id+':'+key)}}assert.equal(p.querySelectorAll('label button,label input[type="range"]').length,0,tool.id);for(const field of p.querySelectorAll('.fmf-number'))assert.ok(p.querySelector('label[for="'+field.id+'"]'),tool.id+':'+field.name)}
});

test('entrada inválida ou negativa continua exata até o usuário alterá-la',()=>{
 const {c,p}=setup();edit(p,'largura','-12,345');let range=wrapper(p,'largura').querySelector('.fmf-ruler');assert.ok(Number(range.min)<=-12.345);assert.equal(input(p,'largura').value,'-12,345');assert.equal(range.getAttribute('aria-valuenow'),'-12.345');edit(p,'largura','inválido');assert.equal(input(p,'largura').value,'inválido');assert.match(range.getAttribute('aria-valuetext'),/Valor inválido/);assert.equal(saveDraft(p,c).inputs.largura,'inválido');
});
