import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
if(existsSync(new URL('../publico/fortemais-obra-3d.js',import.meta.url))) await import('../publico/fortemais-obra-3d.js');
test('projection preserves metric axes and rotation changes visible horizontal position',()=>{
 const r=globalThis.FortemaisObra3D; assert.ok(r,'renderer API exists');
 assert.deepEqual(r.projetar([2,3,4],{yaw:0,pitch:0,scale:10,cx:100,cy:100,orthographic:true}),{x:120,y:70,depth:4});
 const p=r.projetar([2,0,0],{yaw:Math.PI/2,pitch:0,scale:10,cx:100,cy:100,orthographic:true});
 assert.ok(Math.abs(p.x-100)<1e-8); assert.ok(Math.abs(p.depth+2)<1e-8);
});
test('invalid geometry cannot poison scene bounds and CPU work is capped',()=>{
 const r=globalThis.FortemaisObra3D; assert.ok(r);
 const valid={id:'a',kind:'box',x:0,y:0,z:0,w:2,h:3,d:4};
 const s=r.preparar({elements:[{...valid,w:NaN},valid,{kind:'line',points:[[0,0,0],[Infinity,1,1]]}]});
 assert.equal(s.elements.length,1); assert.deepEqual(s.min,[0,0,0]);assert.deepEqual(s.max,[2,3,4]);
 assert.equal(r.preparar({elements:Array(4100).fill(valid)}).elements.length,4000);
});
// Canvas is the browser boundary: retain the actual renderer and inspect drawing output.
function surface(){
 const calls=[];const context=new Proxy({}, {get:(o,k)=>o[k]||((...a)=>calls.push([k,...a])),set:(o,k,v)=>(o[k]=v,true)});
 class Element {constructor(tag){this.tagName=tag;this.children=[];this.style={};this.listeners={};this.ownerDocument=doc;this.attrs={};}append(x){this.children.push(x);x.parent=this;}remove(){this.parent.children=this.parent.children.filter(x=>x!==this);}setAttribute(k,v){this.attrs[k]=v;}addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}removeEventListener(k,fn){this.listeners[k]=this.listeners[k].filter(f=>f!==fn);}emit(k,e={}){for(const f of this.listeners[k]||[])f({preventDefault(){},...e});}getContext(){return context;}getBoundingClientRect(){return {left:0,top:0,width:500,height:260};}focus(){}}
 const doc={createElement:t=>new Element(t)};return {host:new Element('div'),calls};
}
test('keyboard zoom changes real projected drawing and destroy removes owned listeners',()=>{
 const previous=globalThis.ResizeObserver;globalThis.ResizeObserver=class{observe(){}disconnect(){}};
 try{const {host,calls}=surface();const api=globalThis.FortemaisObra3D.montar(host,{elements:[{id:'b',kind:'box',x:0,y:0,z:0,w:2,h:3,d:4}],caption:'<img>'});const root=host.children[0],canvas=root.children[1];
 const before=calls.filter(c=>c[0]==='moveTo').at(-1);canvas.emit('keydown',{key:'+'});const after=calls.filter(c=>c[0]==='moveTo').at(-1);assert.notEqual(before[1],after[1]);assert.equal(root.children[2].textContent.includes('<img>'),true);
 api.update({elements:[]});assert.ok(calls.some(c=>c[0]==='fillText'&&c[1]==='Calcule para visualizar a geometria.'));
 api.destroy();assert.equal(host.children.length,0);assert.equal(Object.values(canvas.listeners).flat().length,0);
 }finally{globalThis.ResizeObserver=previous;}
});
test('expanded renderer uses same canvas and Escape restores compact view and focus',()=>{
 const previous=globalThis.ResizeObserver;globalThis.ResizeObserver=class{observe(){}disconnect(){}};
 try{const {host,calls}=surface();const api=globalThis.FortemaisObra3D.montar(host,{elements:[]});const root=host.children[0],toolbar=root.children[0],canvas=root.children[1];const expand=toolbar.children.find(b=>b.textContent==='Ampliar 3D');assert.ok(expand,'expand action exists');let focused=0;expand.focus=()=>focused++;expand.emit('click');assert.equal(root.attrs.role,'dialog');assert.equal(root.attrs['aria-modal'],'true');assert.equal(root.children[1],canvas);const close=toolbar.children.find(b=>b.textContent==='Fechar 3D');assert.ok(close);assert.equal(close.hidden,false);canvas.emit('keydown',{key:'Escape'});assert.notEqual(root.attrs['aria-modal'],'true');assert.equal(close.hidden,true);assert.equal(focused,1);api.destroy();assert.equal(host.children.length,0);
 }finally{globalThis.ResizeObserver=previous;}
});
await import('../publico/fortemais-produtos-3d.js');
test('renderer alterna conjunto, peça e massa usando o mesmo resultado',()=>{
 const previous=globalThis.ResizeObserver;globalThis.ResizeObserver=class{observe(){}disconnect(){}};
 try{const {host}=surface();const scene={elements:[{id:'wall',kind:'box',x:0,y:0,z:0,w:2,h:1,d:.09}],product:{tool:'alvenaria',inputs:{largura:2,altura:1,blocoComprimento:19,blocoAltura:19,blocoEspessura:9,juntaCm:1,perfilBloco:'ceramico-frisado'}}};const before=JSON.stringify(scene),api=globalThis.FortemaisObra3D.montar(host,scene),root=host.children[0],bar=root.children[0];
 const detail=bar.children.find(b=>b.textContent==='Detalhe do produto');assert.equal(detail.hidden,false);assert.match(root.children[2].textContent,/Fiadas/);detail.emit('click');assert.match(root.children[2].textContent,/peça/);assert.equal(detail.textContent,'Ver conjunto');const layer=bar.children.find(b=>b.textContent==='Ocultar camada aplicada');layer.emit('click');assert.equal(layer.attrs['aria-pressed'],'false');detail.emit('click');assert.match(root.children[2].textContent,/Fiadas/);assert.equal(JSON.stringify(scene),before);api.update({elements:[]});assert.equal(detail.hidden,true);assert.equal(layer.hidden,true);api.destroy();
 }finally{globalThis.ResizeObserver=previous;}
});
