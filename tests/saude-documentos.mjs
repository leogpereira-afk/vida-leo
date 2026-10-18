import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
import {parseHTML} from 'linkedom';
const file=new URL('../publico/saude-documentos.js',import.meta.url);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function ambiente({arquivos={},estado={},url='https://storage.example.test/laudo.pdf?assinatura=ficticia',falharSalvar=false,falharRef=''}={}){
 const {document,HTMLSelectElement}=parseHTML('<html><body></body></html>');
 Object.defineProperty(HTMLSelectElement.prototype,'value',{configurable:true,get(){return [...this.options].find(o=>o.selected)?.value||this.options[0]?.value||''},set(v){for(const o of this.options)o.removeAttribute('selected');[...this.options].find(o=>o.value===String(v))?.setAttribute('selected','')}});
 const modais=[],fechamentos=[],chamadas=[];
 const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const el=h=>{const d=document.createElement('div');d.innerHTML=h;return d.firstElementChild};
 const c=vm.createContext({document,URL,Date,Map,Set,console,structuredClone,E:estado,el,esc,
  acao:(t,f)=>{const b=el('<button></button>');b.textContent=t;b.onclick=f;return b},
  abrirModal:(t,s,m,close)=>{const box=el('<div></div>');document.body.append(box);modais.push(box);const fechar=()=>{close?.();box.remove()};fechamentos.push(fechar);m(box,fechar)},
  arqPor:async ref=>{if(ref===falharRef)throw Error('Falha fictícia');return arquivos[ref]||[]},
  arqUrlDe:async id=>{chamadas.push(['url',id]);return url},
  arqAdd:async(ref,f)=>{chamadas.push(['add',ref,f.name]);(arquivos[ref]||=[]).push({id:'novo',ref,nome:f.name,tipo:f.type,pendente:true})},
  arqSubirPendentes:async(a,ref)=>{chamadas.push(['subir',ref]);return {subiu:0,falhou:1}},
  salvar:()=>{chamadas.push(['salvar']);if(falharSalvar)throw Error('Falha fictícia ao salvar')}
 });
 vm.runInContext(readFileSync(new URL('../publico/saude-modelo.js',import.meta.url),'utf8'),c);
 if(existsSync(file))vm.runInContext(readFileSync(file,'utf8'),c);
 return {c,document,modais,fechamentos,chamadas};
}
const anexo={id:'a-ficticio',ref:'exame:e',nome:'Laudo fictício.pdf',tipo:'application/pdf',em:'2026-01-02',nuvem:true};
const clic=async(b)=>{assert.ok(b,'controle existe');await b.onclick?.({preventDefault(){}});await tick()};
const botao=(box,t)=>[...box.querySelectorAll('button')].find(b=>b.textContent===t);
test('catálogo preserva ID/ref existentes, deduplica sem copiar anexos e reporta falhas parciais',async()=>{
 const {c}=ambiente({estado:{exames:[{id:'e',exame:'Exame fictício'}],consultas:[{id:'c'}]},arquivos:{'saude:documentos':[anexo],'exame:e':[anexo,{...anexo,id:'b',ref:'exame:e',pendente:true,nuvem:false}]},falharRef:'consulta:c'});
 assert.equal(typeof c.saudeCatalogoDocumentos,'function');const r=await c.saudeCatalogoDocumentos();assert.equal(r.documentos.length,2);assert.equal(r.documentos[0].ref,'exame:e');assert.equal(r.documentos[1].id,'b');assert.equal(r.falhas[0].ref,'consulta:c');
});
test('leitor usa URL assinada e controles página/zoom sem alterar original e libera blob ao fechar',async()=>{
 const {c,modais,fechamentos}=ambiente({url:'blob:https://central.example.test/arquivo-ficticio'});let revogada;c.URL=class extends URL {static revokeObjectURL(u){revogada=u}};
 c.saudeAbrirDocumento(anexo);await tick();const box=modais[0],frame=box.querySelector('iframe');assert.ok(frame);assert.match(frame.src,/blob:https/);const pagina=box.querySelector('[data-sdoc="pagina"]');pagina.value='3';pagina.onchange();assert.match(frame.src,/#page=3/);const zoom=box.querySelector('[data-sdoc="zoom"]');zoom.value='150';zoom.onchange();assert.match(frame.src,/zoom=150/);assert.equal(anexo.ref,'exame:e');fechamentos[0]();assert.equal(revogada,'blob:https://central.example.test/arquivo-ficticio');
});
test('URL ativa, credenciais e documento SVG não entram no leitor nem em link',async()=>{
 for(const url of ['javascript:alert(1)','data:text/html,ativo','http://inseguro.test/a.pdf','https://usuario:senha@example.test/a.pdf']){
 const {c,modais}=ambiente({url});c.saudeAbrirDocumento(anexo);await tick();assert.equal(modais[0].querySelector('iframe,a[href]'),null);assert.match(modais[0].textContent,/segura|seguro/)}
 const {c,modais,chamadas}=ambiente();c.saudeAbrirDocumento({...anexo,tipo:'image/svg+xml'});await tick();assert.equal(modais[0].querySelector('iframe,img,a[href]'),null);assert.equal(chamadas.length,0);
});
test('revisão é rascunho: cancelar preserva estado; salvar permite retomada por ID e preserva origem',async()=>{
 const estado={exames:[{id:'e',exame:'Fictício'}]},a=ambiente({estado});a.c.saudeRevisarDocumento(anexo,'exame:e');await tick();const box=a.modais[0];assert.match(box.textContent,/manual/i);assert.equal(estado.saudeDocumentos,undefined);
 box.querySelector('[data-sdoc="textoOriginal"]').value='Transcrição fictícia';await clic(botao(box,'Adicionar item'));const item=box.querySelector('.sdoc-item');item.querySelector('[name="descricao"]').value='Marcador fictício';item.querySelector('[name="valor"]').value='12';item.querySelector('[name="unidade"]').value='u';item.querySelector('[name="estado"]').value='confirmado';box.querySelector('[data-sdoc="naoReconhecidos"]').value='Trecho ilegível fictício';
 await clic(botao(box,'Salvar revisão'));assert.equal(estado.saudeDocumentos['a-ficticio'].textoOriginal,'Transcrição fictícia');assert.equal(estado.saudeDocumentos['a-ficticio'].itens[0].estado,'confirmado');assert.equal(estado.saudeDocumentos['a-ficticio'].origem.ref,'exame:e');assert.equal(estado.saudeDocumentos['a-ficticio'].naoReconhecidos,'Trecho ilegível fictício');assert.equal(estado.exames[0].exame,'Fictício');
 a.c.saudeRevisarDocumento({...anexo,nome:'Nome alterado.pdf'},'exame:e');await tick();const retomada=a.modais.at(-1);assert.equal(retomada.querySelector('[data-sdoc="textoOriginal"]').value,'Transcrição fictícia');retomada.querySelector('[data-sdoc="textoOriginal"]').value='Descartar';a.fechamentos.at(-1)();assert.equal(estado.saudeDocumentos['a-ficticio'].textoOriginal,'Transcrição fictícia');
});
test('falha ao salvar restaura mapa anterior e mantém rascunho para nova tentativa',async()=>{
 const anterior={ref:'exame:e',textoOriginal:'Anterior',itens:[],origem:{anexoId:'a-ficticio',ref:'exame:e'}},estado={exames:[{id:'e'}],saudeDocumentos:{'a-ficticio':anterior},_mt:2},a=ambiente({estado,falharSalvar:true});a.c.saudeRevisarDocumento(anexo,'exame:e');await tick();const box=a.modais[0];box.querySelector('[data-sdoc="textoOriginal"]').value='Rascunho novo';await clic(botao(box,'Salvar revisão'));assert.equal(estado.saudeDocumentos['a-ficticio'],anterior);assert.equal(box.querySelector('[data-sdoc="textoOriginal"]').value,'Rascunho novo');assert.match(box.textContent,/Falha fictícia/);assert.equal(botao(box,'Salvar revisão').disabled,false);
});
test('biblioteca filtra por nome, tipo e data; pendência do arquivo é independente da revisão',async()=>{
 const estado={exames:[{id:'e'}],saudeDocumentos:{'a-ficticio':{itens:[{estado:'confirmado'}]}}},a=ambiente({estado,arquivos:{'exame:e':[anexo,{id:'imagem',ref:'exame:e',nome:'Foto fictícia.png',tipo:'image/png',em:'2025-01-01',pendente:true}]}});const box=a.c.quadroDocumentosSaude();a.document.body.append(box);await tick();assert.equal(box.querySelectorAll('.sdoc-card').length,2);const busca=box.querySelector('[data-sdoc="busca"]');busca.value='Foto';busca.oninput();assert.equal(box.querySelectorAll('.sdoc-card').length,1);assert.match(box.textContent,/aparelho|pendente/i);busca.value='';busca.oninput();const tipo=box.querySelector('[data-sdoc="tipo"]');tipo.value='pdf';tipo.onchange();assert.equal(box.querySelectorAll('.sdoc-card').length,1);tipo.value='';tipo.onchange();const de=box.querySelector('[data-sdoc="de"]');de.value='2026-01-01';de.onchange();assert.equal(box.querySelectorAll('.sdoc-card').length,1);
});
test('biblioteca filtra pela referência real e upload chama somente serviço existente sem gerar revisão',async()=>{
 const a=ambiente({estado:{exames:[{id:'e',exame:'Fictício'}]},arquivos:{'saude:documentos':[{...anexo,id:'geral',ref:'saude:documentos'}],'exame:e':[anexo]}}),box=a.c.quadroDocumentosSaude();await tick();const filtro=box.querySelector('[data-sdoc="ref"]');assert.ok(filtro);filtro.value='exame:e';filtro.onchange();assert.equal(box.querySelectorAll('.sdoc-card').length,1);assert.match(box.querySelector('.sdoc-card').textContent,/Fictício/);
 const select=box.querySelector('[aria-label="Registro de origem do anexo"]');select.value='exame:e';const input=box.querySelector('input[type=file]');Object.defineProperty(input,'files',{value:[{name:'Novo fictício.pdf',type:'application/pdf'}]});await input.onchange();assert.deepEqual(a.chamadas,[['add','exame:e','Novo fictício.pdf']]);assert.equal(a.c.E.saudeDocumentos,undefined);assert.match(box.textContent,/envio pendente/);
});
test('falha do leitor permite retomar sem salvar metadados nem guardar URL assinada',async()=>{
 const a=ambiente();let n=0;a.c.arqUrlDe=async()=>{if(n++===0)throw Error('Rede fictícia indisponível');return 'https://storage.example.test/original.pdf?token=ficticio'};a.c.saudeAbrirDocumento(anexo);await tick();assert.match(a.modais[0].textContent,/Rede fictícia/);await clic(botao(a.modais[0],'Tentar abrir novamente'));assert.ok(a.modais[0].querySelector('iframe'));assert.equal(a.c.E.saudeDocumentos,undefined);
});
test('revisão valida item vazio, página e cobertura antes de persistir, e cancelar nunca cria mapa',async()=>{
 const a=ambiente({estado:{exames:[{id:'e'}]}});a.c.saudeRevisarDocumento(anexo);await tick();const box=a.modais[0];await clic(botao(box,'Adicionar item'));await clic(botao(box,'Salvar revisão'));assert.equal(a.c.E.saudeDocumentos,undefined);assert.match(box.textContent,/Preencha o item/);const linha=box.querySelector('.sdoc-item');linha.querySelector('[name=descricao]').value='Item fictício';linha.querySelector('[name=pagina]').value='0';await clic(botao(box,'Salvar revisão'));assert.match(box.textContent,/Confira a página/);linha.querySelector('[name=pagina]').value='1';box.querySelector('[data-sdoc=cobertura]').value='completa';await clic(botao(box,'Salvar revisão'));assert.match(box.textContent,/Indique as páginas/);a.fechamentos[0]();assert.equal(a.c.E.saudeDocumentos,undefined);assert.equal(a.chamadas.filter(c=>c[0]==='salvar').length,0);
});
test('abrir origem resolve coleção plural e registro por ID no estado atual',async()=>{
 const colecoes={exame:'exames',tratamento:'tratamentos',consulta:'consultas',queixa:'queixas',vacina:'vacinas',peso:'peso',vitais:'vitais',fisio:'fisio'};
 for(const [prefixo,tipo] of Object.entries(colecoes)){
  const registro={id:'origem-ficticia'},a=ambiente({estado:{[tipo]:[registro]}}),chamadas=[];a.c.saudeEditarRegistro=(...args)=>chamadas.push(args);a.c.saudeRevisarDocumento({...anexo,ref:prefixo+':origem-ficticia'});await tick();await clic(botao(a.modais[0],'Abrir registro de origem'));assert.equal(chamadas.length,1);assert.equal(chamadas[0][0],tipo);assert.equal(chamadas[0][1],registro);a.c.E[tipo]=[];await clic(botao(a.modais[0],'Abrir registro de origem'));assert.equal(chamadas.length,1);assert.match(a.modais[0].textContent,/não está mais disponível/);
 }
});
test('cobertura completa recusa itens pendentes e trechos não reconhecidos até conferência explícita',async()=>{
 const a=ambiente({estado:{exames:[{id:'e'}]}});a.c.saudeRevisarDocumento(anexo);await tick();const box=a.modais[0];box.querySelector('[data-sdoc=cobertura]').value='completa';box.querySelector('[data-sdoc=paginasRevisadas]').value='1';await clic(botao(box,'Adicionar item'));const item=box.querySelector('.sdoc-item');item.querySelector('[name=descricao]').value='Item fictício';await clic(botao(box,'Salvar revisão'));assert.equal(a.c.E.saudeDocumentos,undefined);assert.match(box.textContent,/itens pendentes/i);item.querySelector('[name=estado]').value='confirmado';box.querySelector('[data-sdoc=naoReconhecidos]').value='Trecho fictício ilegível';await clic(botao(box,'Salvar revisão'));assert.equal(a.c.E.saudeDocumentos,undefined);assert.match(box.textContent,/não reconhecidos/i);box.querySelector('[data-sdoc=naoReconhecidos]').value='';await clic(botao(box,'Salvar revisão'));assert.equal(a.c.E.saudeDocumentos['a-ficticio'].cobertura,'completa');assert.equal(a.c.E.saudeDocumentos['a-ficticio'].itens[0].estado,'confirmado');
});
