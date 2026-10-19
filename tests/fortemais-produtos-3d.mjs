import test from 'node:test';
import assert from 'node:assert/strict';
import '../publico/fortemais-ferramentas-modelo.js';
import '../publico/fortemais-produtos-3d.js';
import '../publico/fortemais-obra-3d.js';
import '../publico/fortemais-materiais.js';
const engine=globalThis.FortemaisFerramentasModelo, visual=globalThis.FortemaisProdutos3D, presets=globalThis.FortemaisMateriais;
const calc=(id,a={})=>engine.calcular(id,{...structuredClone(engine.catalogo.find(t=>t.id===id).exemplo),...a});
for(const item of engine.catalogo)test('3D '+item.id+' mantém cálculo e geometria finita nas vistas',()=>{
 const r=calc(item.id),before=JSON.stringify(r);
 for(const detail of [false,true])for(const mortar of [false,true]){const s=visual.criar(r.scene,{detail,mortar}),valid=globalThis.FortemaisObra3D.preparar(s);assert.equal(valid.skipped,0);assert.ok(s.elements.length<=3800);assert.equal(s.elements.length,valid.elements.length);assert.ok(s.caption);assert.ok(s.elements.length>0||s.noGeometry,item.id+' não pode ficar vazio sem explicar a ausência de geometria');}
 assert.equal(JSON.stringify(r),before);
});
test('tijolo frisado: vazados físicos 2 por 4, juntas e escolha do perfil',()=>{
 const a=presets.aplicar('itapira-8-furos',engine.catalogo[0].exemplo),r=calc('alvenaria',a),s=visual.criar(r.scene,{detail:true});
 const bricks=s.elements.filter(e=>e.kind==='box'&&e.layer!=='mortar'&&!e.label.includes('Friso'));assert.equal(bricks.length,8);
 // Centres of all eight holes must remain empty along the entire length.
 for(let y=0;y<4;y++)for(let z=0;z<2;z++){const p=[.095,(y+.5)*.19/4,(z+.5)*.09/2];assert.ok(!bricks.some(e=>p[0]>e.x&&p[0]<e.x+e.w&&p[1]>e.y&&p[1]<e.y+e.h&&p[2]>e.z&&p[2]<e.z+e.d));}
 assert.ok(s.elements.some(e=>e.label.includes('Friso')));assert.ok(s.elements.some(e=>e.layer==='mortar'));
 assert.ok(!visual.criar(r.scene,{detail:true,mortar:false}).elements.some(e=>e.layer==='mortar'));
 const smooth=visual.criar(calc('alvenaria',presets.aplicar('city-9-29',a)).scene,{detail:true});assert.ok(!smooth.elements.some(e=>e.label.includes('Friso')));
});
test('parede respeita vãos e módulos com junta; compra não depende do render',()=>{
 const r=calc('alvenaria',{perfilBloco:'ceramico-frisado',blocoEspessura:9,temAberturas:'sim',aberturas:[{tipo:'porta',largura:1,altura:2,quantidade:1}]}),s=visual.criar(r.scene);const blocks=s.elements.filter(e=>e.label.startsWith('Bloco'));
 assert.ok(blocks.length>10);assert.ok(blocks.every(e=>e.x>=1-1e-9||e.y>=2-1e-9));assert.equal(blocks[0].d,.09);
});
test('malha tem fios no passo informado e tubos têm seção aberta',()=>{
 const mesh=visual.criar(calc('malhas',{espacamento:150,diametro:4.2}).scene);assert.ok(mesh.elements.every(e=>e.kind==='line'));assert.ok(mesh.elements.length>100);
 const tube=visual.criar(calc('hidraulica').scene,{detail:true});assert.ok(tube.elements.some(e=>e.label.includes('interior')));assert.ok(tube.elements.every(e=>e.kind==='plane'));assert.match(tube.caption,/abreviado/);
});
test('reboco mantém espessura; pisos têm juntas e camada separável',()=>{
 const coat=visual.criar(calc('reboco',{espessuraCm:3}).scene);assert.equal(coat.elements.find(e=>e.layer==='mortar').d,.03);
 const floor=calc('pisos');assert.ok(visual.criar(floor.scene).elements.some(e=>e.layer==='mortar'));assert.equal(visual.criar(floor.scene,{mortar:false}).elements.length,floor.scene.elements.length);
});
test('sem dimensões físicas não inventa volume ou escala em metros',()=>{
 for(const id of ['consumo','produtividade'])assert.equal(visual.criar(calc(id).scene).elements.length,0);
 const old={elements:[],caption:'Antigo'};assert.equal(visual.criar(old).caption,'Antigo');
});
test('cenários extremos limitam geometria sem alterar o quantitativo',()=>{
 const r=calc('alvenaria',{largura:100,altura:100,aberturas:[]});const s=visual.criar(r.scene);assert.ok(s.elements.length<3801);assert.match(s.caption,/limitado/);
 const m=visual.criar(calc('malhas',{espacamento:.001,diametro:.001}).scene);assert.ok(m.elements.length<=3800);assert.match(m.caption,/limitado/);
});
