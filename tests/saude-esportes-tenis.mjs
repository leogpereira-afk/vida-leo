import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';

const base = new URL('../publico/', import.meta.url);
const KEY = 'vidaLeo.esportes.tenis.v1';
const PHOTO = 'data:image/webp;base64,UklGRi4AAABXRUJQVlA4ICIAAABQAQCdASoCAAIAAUAmJQBOgCgAAP7iRrr1pbm4TEYZ1gAA';
const json = value => JSON.parse(JSON.stringify(value));
const valid = extra => ({brand: 'Marca de exemplo', model: 'Modelo de teste', modality: 'corrida', ...extra});
let testTabCounter = 0;
const genericInput = (bytes, type = 'image/png', extra = {}) => new File([Uint8Array.from(bytes)], 'foto-teste', {type, ...extra});

function app({storage = new Map(), quota = false, readError = false, withUI = false, bitmapWidth = 1600, bitmapHeight = 900, bitmapError = false, canvasData = PHOTO} = {}) {
  let now = Date.parse('2026-11-17T15:00:00Z'), counter = 0;
  const tab = ++testTabCounter;
  const reads = [], writes = [], canvasCalls = [], network = [];
  const {document, HTMLElement} = parseHTML('<!doctype html><html><body></body></html>');
  HTMLElement.prototype.focus = function() {};
  const nativeCreateElement = document.createElement.bind(document);
  document.createElement = tag => {
    const element = nativeCreateElement(tag);
    if (String(tag).toLowerCase() === 'canvas') {
      element.getContext = () => ({clearRect() {}, drawImage(...args) { canvasCalls.push({type: 'draw', args}); }});
      element.toDataURL = (type, quality) => {canvasCalls.push({type, quality, width: element.width, height: element.height});return canvasData;};
    }
    return element;
  };
  class Clock extends Date {
    constructor(...args) {super(...(args.length ? args : [now]));}
    static now() {return now;}
  }
  const ctx = vm.createContext({
    console, document, Date: Clock, URL, URLSearchParams, Blob, File, Uint8Array, ArrayBuffer,
    TextEncoder, TextDecoder, atob, btoa, structuredClone, setTimeout, clearTimeout,
    crypto: {randomUUID: () => 'generic-test-id-' + tab + '-' + (++counter)},
    localStorage: {
      getItem(key) {reads.push(key);if(readError)throw new Error('Armazenamento indisponível no teste');return storage.get(key) ?? null;},
      setItem(key, value) {if(quota)throw new Error('Quota de teste');writes.push(key);storage.set(key, String(value));}
    },
    createImageBitmap: async () => {if(bitmapError)throw new Error('Falha de decodificação de teste');return {width: bitmapWidth, height: bitmapHeight, close() {}};},
    fetch(...args) {network.push(args);throw new Error('Inventário local não deve usar rede');},
    alert() {throw new Error('Erro deve aparecer na interface');},
    confirm() {throw new Error('Remoção usa confirmação na interface');}
  });
  ctx.window = ctx;
  for (const forbidden of ['E', 'CFG', 'sessionStorage']) Object.defineProperty(ctx, forbidden, {
    get() {throw new Error('Não acessar estado pessoal: ' + forbidden);},
    set() {throw new Error('Não alterar estado pessoal: ' + forbidden);}
  });
  vm.runInContext(readFileSync(new URL('saude-esportes-tenis.js', base), 'utf8'), ctx, {filename: 'saude-esportes-tenis.js'});
  if (withUI) {
    for (const name of ['saude-esportes-dados.js', 'saude-esportes.js']) vm.runInContext(readFileSync(new URL(name, base), 'utf8'), ctx, {filename: name});
    const root = ctx.saudeEsportes();document.body.append(root);
  }
  return {ctx, model: ctx.SaudeEsportesTenis, document, storage, reads, writes, network, canvasCalls,
    get root() {return document.querySelector('[data-esportes="biblioteca"]');},
    setQuota(value) {quota = value;}, setReadError(value) {readError = value;}, setTime(value) {now = Date.parse(value);}};
}
function submit(form) {return form.onsubmit({preventDefault() {}});}
function fill(form, values) {
  for(const [name,value] of Object.entries(values)) {
    const input=form.querySelector(`[name="${name}"]`);assert.ok(input, 'Campo ' + name);
    if(input.tagName==='SELECT'){for(const option of input.options)option.selected=false;input.querySelector(`[value="${value}"]`).selected=true;}
    else input.value=value;
    if(input.tagName==='SELECT')input.onchange?.({target:input});else input.oninput?.({target:input});
  }
}
function gear(a, id='corrida') {
  a.root.querySelector(`[data-esp-modalidade="${id}"]`).click();
  a.root.querySelector('[data-esp-tab="gear"]').click();
  return a.root.querySelector('[data-esp-tenis]');
}

test('tênis: começa vazio, usa apenas armazenamento isolado e não acessa E ou rede', () => {
  const a=app();
  assert.deepEqual(json(a.model.get().items),[]);
  assert.equal(a.network.length,0);assert.equal(a.writes.length,0);
  assert.ok(a.reads.length>0&&a.reads.every(k=>k===KEY));
});

test('tênis: salvar, recarregar e editar mantêm identidade, datas e foto omitida', () => {
  const a=app(), first=a.model.save(valid({photo:PHOTO}));
  assert.ok(first.id);assert.equal(first.photo,PHOTO);
  assert.equal(new Date(first.createdAt).toISOString(),'2026-11-17T15:00:00.000Z');
  const b=app({storage:a.storage});assert.deepEqual(json(b.model.get().items),[json(first)]);
  b.setTime('2026-11-18T15:00:00Z');
  const updated=b.model.save(valid({id:first.id,model:'Modelo corrigido'}));
  assert.equal(updated.id,first.id);assert.equal(updated.createdAt,first.createdAt);assert.equal(updated.photo,PHOTO);
  assert.equal(new Date(updated.updatedAt).toISOString(),'2026-11-18T15:00:00.000Z');
  assert.equal(b.model.get().items.length,1);
  b.model.save(valid({id:first.id,photo:''}));assert.equal(b.model.get().items[0].photo,'');
  assert.ok([...a.writes,...b.writes].every(k=>k===KEY));assert.equal(a.network.length+b.network.length,0);
});

test('tênis: cópias retornadas não permitem alterar silenciosamente o inventário', () => {
  const a=app();const saved=a.model.save(valid());saved.brand='Alteração externa';
  const list=a.model.get();list.items[0].model='Alteração externa';list.items.push(valid());
  const next=a.model.get();assert.equal(next.items.length,1);assert.equal(next.items[0].brand,'Marca de exemplo');assert.equal(next.items[0].model,'Modelo de teste');
});

test('tênis: campos obrigatórios, limites e modalidade inválida não gravam', () => {
  for(const input of [valid({brand:''}),valid({brand:'   '}),valid({model:''}),valid({model:'  '}),valid({brand:'x'.repeat(81)}),valid({model:'x'.repeat(121)}),valid({modality:'arbitraria'}),valid({modality:'__proto__'})]) {
    const a=app();assert.throws(()=>a.model.save(input));assert.equal(a.writes.length,0);assert.equal(a.model.get().items.length,0);
  }
});

test('tênis: limite de itens é explícito, sem apagar os anteriores', () => {
  const a=app();for(let i=0;i<30;i++)a.model.save(valid({model:'Modelo '+i}));
  const before=a.storage.get(KEY);assert.throws(()=>a.model.save(valid({model:'Além do limite'})));
  assert.equal(a.model.get().items.length,30);assert.equal(a.storage.get(KEY),before);
});

test('tênis: falha ao gravar ou remover não perde dados nem anuncia persistência', () => {
  const a=app();const first=a.model.save(valid()),before=a.storage.get(KEY);a.setQuota(true);
  assert.throws(()=>a.model.save(valid({model:'Falha de gravação'})));
  assert.throws(()=>a.model.save(valid({id:first.id,brand:'Falha de edição'})));
  assert.throws(()=>a.model.remove(first.id));
  assert.equal(a.storage.get(KEY),before);assert.equal(a.model.get().items.length,1);assert.equal(a.model.get().items[0].brand,first.brand);
});

test('tênis: leitura indisponível ou cache inválido não é sobrescrito por cadastro novo', () => {
  for(const corrupted of ['{quebrado',JSON.stringify({version:999,items:[]}),JSON.stringify({version:1,items:'não é lista'})]) {
    const storage=new Map([[KEY,corrupted]]),a=app({storage});
    assert.ok(a.model.get().error);assert.throws(()=>a.model.save(valid()));assert.equal(storage.get(KEY),corrupted);assert.equal(a.writes.length,0);
  }
  const a=app({readError:true});assert.ok(a.model.get().error);assert.throws(()=>a.model.save(valid()));assert.equal(a.writes.length,0);
});

test('tênis: cadastros e remoções em duas abas preservam alterações recentes', () => {
  const storage=new Map(),a=app({storage}),b=app({storage});
  const one=a.model.save(valid({model:'Primeiro'}));const two=b.model.save(valid({model:'Segundo'}));
  assert.notEqual(one.id,two.id);assert.equal(app({storage}).model.get().items.length,2);
  a.model.remove(one.id);assert.deepEqual(json(app({storage}).model.get().items.map(x=>x.id)),[two.id]);
});

test('tênis: URLs remotas, SVG, MIME falso e fotos grandes não entram no cache', () => {
  const bad=[
    'https://example.invalid/foto.jpg','javascript:alert(1)','data:image/svg+xml;base64,PHN2Zy8+',
    'data:image/png;base64,iVBORw0KGgo=','data:image/webp;base64,PHN2Zy8+',
    'data:image/webp;base64,'+'A'.repeat(700000)
  ];
  for(const photo of bad){const a=app();assert.throws(()=>a.model.save(valid({photo})),photo.slice(0,50));assert.equal(a.writes.length,0);}
});

test('tênis: preparação rejeita arquivo grande antes de ler e assinaturas incompatíveis', async () => {
  const a=app();let read=false;
  await assert.rejects(a.model.preparePhoto({type:'image/jpeg',size:5*1024*1024+1,slice(){read=true;throw Error('Não ler');}}));assert.equal(read,false);
  for(const file of [genericInput([60,115,118,103,62],'image/svg+xml'),genericInput([60,115,118,103,62],'image/png'),genericInput([137,80,78,71,13,10,26,10],'image/jpeg')])await assert.rejects(a.model.preparePhoto(file));
  assert.equal(a.network.length,0);
});

test('tênis: preparação redimensiona para 800 px e produz WebP local', async () => {
  const a=app();const photo=await a.model.preparePhoto(genericInput([137,80,78,71,13,10,26,10]));
  assert.equal(photo,PHOTO);assert.ok(a.canvasCalls.some(c=>c.type==='draw'));
  const encoded=a.canvasCalls.find(c=>c.type==='image/webp');assert.ok(encoded);assert.ok(encoded.width<=800&&encoded.height<=800);assert.ok(encoded.width>0&&encoded.height>0);
  assert.equal(a.writes.length,0);assert.equal(a.network.length,0);
});

test('tênis: erro de decodificação, dimensões excessivas e saída inválida são visíveis', async () => {
  const file=genericInput([137,80,78,71,13,10,26,10]);
  for(const config of [{bitmapError:true},{bitmapWidth:10000,bitmapHeight:10000},{bitmapWidth:0},{canvasData:'data:image/png;base64,iVBORw0KGgo='},{canvasData:'data:image/webp;base64,'+'A'.repeat(700000)}]){
    const a=app(config);await assert.rejects(a.model.preparePhoto(file));assert.equal(a.writes.length,0);
  }
});

test('tênis UI: cadastrar na modalidade e remover exige confirmação explícita', async () => {
  const a=app({withUI:true});assert.ok(gear(a));
  a.root.querySelector('[data-esp-tenis-add]').click();let form=a.root.querySelector('[data-esp-tenis-form]');assert.ok(form);
  fill(form,valid({model:'Cadastro pela interface'}));await submit(form);
  assert.equal(a.model.get().items.length,1,a.root.querySelector('[role=alert]')?.textContent);assert.match(a.root.textContent,/Cadastro pela interface/);
  const id=a.model.get().items[0].id;a.root.querySelector(`[data-esp-tenis-remove="${id}"]`).click();
  assert.equal(a.model.get().items.length,1);const confirm=a.root.querySelector(`[data-esp-tenis-confirm="${id}"]`);assert.ok(confirm);confirm.click();
  assert.equal(a.model.get().items.length,0);assert.equal(a.network.length,0);
});

test('tênis UI: erro de persistência mantém formulário preenchido e aparece como erro', async () => {
  const a=app({withUI:true,quota:true});gear(a);a.root.querySelector('[data-esp-tenis-add]').click();
  const form=a.root.querySelector('[data-esp-tenis-form]');fill(form,valid({model:'Nome para preservar'}));await submit(form);
  assert.equal(a.model.get().items.length,0);const remaining=a.root.querySelector('[data-esp-tenis-form]');assert.ok(remaining);
  assert.equal(remaining.querySelector('[name="model"]').value,'Nome para preservar');
  const alert=a.root.querySelector('[role="alert"]');assert.ok(alert&&alert.textContent.trim());assert.equal(a.storage.has(KEY),false);
});

test('tênis UI: nomes hostis ficam como texto sem criar elementos executáveis', () => {
  const a=app({withUI:true});a.model.save(valid({brand:'<img src=x onerror="alert(1)">',model:'<script>alert(1)</script>'}));gear(a);
  const box=a.root.querySelector('[data-esp-tenis]');assert.ok(box);assert.equal(box.querySelectorAll('script,[onerror],[onload],img[src="x"]').length,0);
  assert.match(box.textContent,/alert\(1\)/);assert.equal(a.network.length,0);
});
