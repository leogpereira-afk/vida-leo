import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function setup(){
 const {document,window}=parseHTML('<html><body></body></html>');
 const c=vm.createContext({document,window,console,structuredClone,URL,Blob,atob,confirm:()=>true,alert(){},setTimeout(){return 1},clearTimeout(){},E:{obras:[]},filtro:{},salvar(){}});
 for(const name of ['fortemais-apoio-modelo.js','fortemais-ferramentas-modelo.js','fortemais-materiais.js','fortemais-ferramentas.js'])vm.runInContext(readFileSync(new URL('../publico/'+name,import.meta.url),'utf8'),c);
 const p=c.fmFerramentasPainel();document.body.append(p);return {p,c,document};
}

test('revisão: arrastar a régua mantém escala, marcas e passo durante a interação',()=>{
 const {p}=setup(),input=p.querySelector('[name="largura"]'),field=input.closest('.fmf-field'),range=field.querySelector('.fmf-ruler');input.value='123,4567';input.oninput();assert.equal(Number(range.max),130);const step=range.step;
 range.value='65';range.oninput();assert.equal(input.value,'65');assert.equal(Number(range.max),130,'a escala não deve encolher sob o ponteiro');assert.equal(range.step,step);assert.equal(field.querySelector('.fmf-ruler-ticks').lastElementChild.textContent,'130');
 range.value='32.5';range.onchange();assert.equal(input.value,'32.5');assert.equal(Number(range.max),130);
 input.value='15,25';input.oninput();assert.equal(Number(range.max),20,'a escala volta a adaptar quando o usuário digita');
});

test('revisão: campo numérico anuncia a unidade junto com seu nome acessível',()=>{
 const {p,c}=setup();for(const tool of c.FortemaisFerramentasModelo.catalogo){const search=p.querySelector('[aria-label="Buscar ferramenta"]');search.value=tool.titulo;search.oninput();p.querySelector('[data-tool="'+tool.id+'"]').click();p.querySelector('[data-action="exemplo"]').click();for(const f of tool.campos){if(f.type==='number'&&f.unit){const input=p.querySelector('[name="'+f.key+'"]');const unit=f.key==='embalagem'?({reboco:'kg',gesso:'kg',impermeabilizacao:'kg',pintura:'L',eletrica:'m',dados:'m',consumo:'kg'}[tool.id]||f.unit):f.unit;assert.ok(input.getAttribute('aria-label').includes(unit),tool.id+':'+f.key+' deve anunciar '+unit)}if(f.type==='rows'){for(const col of f.columns.filter(x=>x.type==='number'&&x.unit)){const input=p.querySelector('[name="'+f.key+'[0].'+col.key+'"]');if(input)assert.ok(input.getAttribute('aria-label').includes(col.unit),tool.id+':'+f.key+'.'+col.key+' deve anunciar '+col.unit)}}}}
});

test('revisão: controles abrem sem crypto e duas instâncias preservam IDs distintos',()=>{
 const {p,c,document}=setup();const other=c.fmFerramentasPainel();document.body.append(other);for(const panel of [p,other])assert.ok(panel.querySelector('[name="largura"]'));const ids=[...document.querySelectorAll('.fmf-field-label[for]')].map(l=>l.getAttribute('for'));assert.equal(new Set(ids).size,ids.length);for(const id of ids)assert.ok(document.getElementById(id));
});

test('revisão: unidade cm/mm atualiza o campo e sua leitura acessível sem converter o valor digitado',()=>{
 const {p,c}=setup();for(const id of ['reboco','gesso']){const search=p.querySelector('[aria-label="Buscar ferramenta"]');search.value=c.FortemaisFerramentasModelo.catalogo.find(t=>t.id===id).titulo;search.oninput();p.querySelector('[data-tool="'+id+'"]').click();p.querySelector('[data-action="exemplo"]').click();const before=p.querySelector('[name="consumo"]').value;
  for(const unit of ['mm','cm']){const selector=p.querySelector('[name="unidadeConsumo"]');selector.closest('.fmf-field').querySelector('button[data-value="'+unit+'"]').click();const amount=p.querySelector('[name="consumo"]');assert.equal(amount.value,before);assert.match(amount.getAttribute('aria-label'),new RegExp('kg/m²/'+unit));assert.equal(amount.closest('.fmf-field').querySelector('.fmf-number-line small').textContent,'kg/m²/'+unit);assert.equal(p.querySelector('[name="unidadeConsumo"]').value,unit)}
  if(id==='reboco'){p.querySelector('[name="modo"]').closest('.fmf-field').querySelector('button[data-value="composicao"]').click();for(const key of ['consumo','unidadeConsumo','embalagem'])assert.equal(p.querySelector('[name="'+key+'"]').closest('.fmf-field').hidden,true,key)}
 }
});
