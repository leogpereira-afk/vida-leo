import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

const fontes = [
  {id:'i1',data:'2025-01-31',empresa:'Empresa Alfa',instituicao:'Banco A',tipo:'Investimentos',valor:120,obs:'Conta de teste'},
  {id:'i2',data:'2025-01-05',empresa:'Empresa Beta',instituicao:'Banco B',tipo:'Investimento',valor:80},
  {id:'r1',data:'2025-01-10',empresa:'Empresa Gama',instituicao:'Banco C',tipo:'Retirada',valor:50},
];
function app(registros=fontes){
  const a=setup();
  a.run(`E.rendimentos=${JSON.stringify(registros)};filtro.rendAno=2025;atual='rendimentos';tela();Object.assign(RendimentosUI.estado(),{aba:'lancamentos',grupo:'mes',anos:[2025]});tela();`);
  return a;
}
const registros=a=>JSON.parse(a.run('JSON.stringify(E.rendimentos)'));
function copiar(a){
  const b=a.document.querySelector('[data-ra-copiar]');
  assert.ok(b,'botão de cópia no cabeçalho do mês');
  b.onclick();return a.document.querySelector('.ra-copia-form');
}
const enviar=f=>f.onsubmit({preventDefault(){}});
const linhas=f=>[...f.querySelectorAll('.ra-copia-item')];
function linha(f,empresa){
  const r=linhas(f).find(x=>x.textContent.includes(empresa));
  assert.ok(r,'linha de cópia para '+empresa);return r;
}
function selecionar(f,empresa,on=true){
  const r=linha(f,empresa),input=r.querySelector('[data-copia-selecionar]');
  assert.ok(input,'seleção individual de '+empresa);
  input.checked=on;input.onchange({target:input});return r;
}
function valor(f,empresa,v){linha(f,empresa).querySelector('[data-copia-valor]').value=v;}
function todos(f){const b=f.querySelector('[data-copia-todos]');assert.ok(b,'selecionar todos');b.onclick();}
function limpar(f){const b=f.querySelector('[data-copia-limpar]');assert.ok(b,'limpar seleção');b.onclick();}

// Detecta cópia automática e gravação de registros que o usuário não escolheu.
test('abre todos os tipos sem seleção e cancelar não altera a base',()=>{
  const a=app(),antes=a.run('JSON.stringify(E)'),f=copiar(a);
  assert.equal(linhas(f).length,3);
  assert.match(f.textContent,/28\/02\/2025/);
  assert.match(f.textContent,/Conta de teste/);
  assert.match(f.textContent,/Retirada/);
  assert.equal(f.querySelectorAll('[data-copia-selecionar]').length,3);
  assert.ok([...f.querySelectorAll('[data-copia-selecionar]')].every(x=>!x.checked));
  assert.ok([...f.querySelectorAll('[data-copia-valor]')].every(x=>x.value===''&&x.disabled&&!x.required));
  assert.ok(f.querySelector('[type=submit]').disabled);
  assert.match(f.querySelector('[data-copia-resumo]').textContent,/0/);
  enviar(f);assert.equal(a.run('JSON.stringify(E)'),antes);
  f.querySelector('[data-copia-cancelar]').onclick();assert.equal(a.run('JSON.stringify(E)'),antes);
});

test('selecionar todos e limpar sincronizam contagem, obrigatoriedade e confirmação',()=>{
  const a=app(),f=copiar(a);
  todos(f);
  assert.ok([...f.querySelectorAll('[data-copia-selecionar]')].every(x=>x.checked));
  assert.ok([...f.querySelectorAll('[data-copia-valor]')].every(x=>!x.disabled&&x.required));
  assert.equal(f.querySelector('[type=submit]').disabled,false);
  assert.match(f.querySelector('[type=submit]').textContent,/3/);
  assert.match(f.querySelector('[data-copia-resumo]').textContent,/3/);
  limpar(f);
  assert.ok([...f.querySelectorAll('[data-copia-selecionar]')].every(x=>!x.checked));
  assert.ok([...f.querySelectorAll('[data-copia-valor]')].every(x=>x.disabled&&!x.required));
  assert.ok(f.querySelector('[type=submit]').disabled);
  assert.match(f.querySelector('[data-copia-resumo]').textContent,/0/);
  enviar(f);assert.equal(registros(a).length,3);
});

test('copia somente escolhidos e ignora valor inválido no desmarcado',()=>{
  const a=app(),f=copiar(a);todos(f);
  valor(f,'Empresa Alfa','200,25');valor(f,'Empresa Beta','erro');valor(f,'Empresa Gama','90');
  selecionar(f,'Empresa Beta',false);
  assert.match(f.querySelector('[type=submit]').textContent,/2/);
  assert.match(f.querySelector('[data-copia-resumo]').textContent,/2/);
  enviar(f);
  const base=registros(a),novos=base.slice(3);
  assert.equal(novos.length,2);
  assert.deepEqual(novos.map(x=>x.copiadoDeId).sort(),['i1','r1']);
  const alfa=novos.find(x=>x.copiadoDeId==='i1');
  assert.equal(alfa.data,'2025-02-28');assert.equal(alfa.valor,200.25);assert.equal(alfa.obs,'Conta de teste');
  assert.equal(alfa.instituicao,'Banco A');assert.equal(alfa.tipo,'Investimentos');
  assert.equal(novos.find(x=>x.copiadoDeId==='r1').tipo,'Retirada');
  assert.equal(new Set(base.map(x=>x.id)).size,5);
  assert.deepEqual(base.slice(0,3),fontes);
  assert.equal(a.run('RendimentosUI.estado().meses[0]'),2);
  enviar(f);assert.equal(registros(a).length,5);
});

test('valida todo o lote escolhido antes de inserir qualquer lançamento',()=>{
  const a=app(),f=copiar(a);
  selecionar(f,'Empresa Alfa');selecionar(f,'Empresa Gama');
  valor(f,'Empresa Alfa','200,25');valor(f,'Empresa Gama','erro');enviar(f);
  assert.deepEqual(registros(a),fontes);
  assert.match(f.querySelector('[role=alert]').textContent,/valor|número/i);
  valor(f,'Empresa Gama','0');enviar(f);assert.deepEqual(registros(a),fontes);
  valor(f,'Empresa Gama','');enviar(f);assert.deepEqual(registros(a),fontes);
  valor(f,'Empresa Gama','-10,50');enviar(f);
  assert.equal(registros(a).length,5);
  assert.equal(registros(a).find(x=>x.copiadoDeId==='r1').valor,-10.5);
});

test('mês composto só por retiradas e pró-labore permite copiar',()=>{
  const a=app([{...fontes[2]},{id:'p1',data:'2025-01-20',empresa:'Empresa Delta',tipo:'Pró-Labore',valor:25}]),f=copiar(a);
  assert.equal(linhas(f).length,2);selecionar(f,'Empresa Delta');valor(f,'Empresa Delta','30');enviar(f);
  assert.equal(registros(a).length,3);
  assert.equal(registros(a).at(-1).tipo,'Pró-Labore');assert.equal(registros(a).at(-1).data,'2025-02-20');
});

test('lista o mês inteiro apesar de filtros e paginação, mantendo histórico anual fora',()=>{
  const rs=Array.from({length:45},(_,i)=>({id:'l'+i,data:'2025-01-05',empresa:i===0?'Alvo':'Empresa '+i,tipo:i%2?'Retirada':'Investimentos',valor:i+1}));
  rs.push({id:'outro-mes',data:'2025-02-05',empresa:'Fora',tipo:'Retirada',valor:2});
  rs.push({id:'anual',data:'2025-01-05',empresa:'Anual',tipo:'Investimentos',granularidade:'anual',valor:10});
  const a=app(rs);
  a.run(`Object.assign(RendimentosUI.estado(),{busca:'Alvo',tipo:'Investimentos',empresas:['Alvo'],situacao:'Registrados',de:'2025-01-05',ate:'2025-01-05'});tela()`);
  assert.equal(a.document.querySelectorAll('[data-ra-lanc]').length,1);
  const f=copiar(a);
  assert.equal(linhas(f).length,45);
  assert.match(f.textContent,/mês inteiro|todos os lançamentos|filtros/i);
  selecionar(f,'Empresa 44');valor(f,'Empresa 44','77');enviar(f);
  assert.equal(registros(a).length,48);assert.equal(registros(a).at(-1).copiadoDeId,'l44');
});

test('dezembro avança o ano e repetições já copiadas não ficam disponíveis',()=>{
  const a=app([{id:'fim',data:'2025-12-31',empresa:'Empresa Alfa',tipo:'Retirada',valor:1}]),f=copiar(a);
  assert.match(f.textContent,/31\/01\/2026/);todos(f);valor(f,'Empresa Alfa','2');enviar(f);
  a.run(`Object.assign(RendimentosUI.estado(),{anos:[2025],meses:[]});tela()`);
  const g=copiar(a);assert.equal(g.querySelectorAll('[data-copia-selecionar]').length,0);
  assert.match(g.textContent,/já.*copiad/i);
  assert.ok(!g.querySelector('[type=submit]')||g.querySelector('[type=submit]').disabled);
});

test('data de janeiro é limitada ao último dia de fevereiro bissexto',()=>{
  const a=app([{id:'b1',data:'2024-01-31',empresa:'Empresa Alfa',tipo:'Retirada',valor:1}]);
  a.run(`Object.assign(RendimentosUI.estado(),{anos:[2024]});tela()`);
  const f=copiar(a);todos(f);valor(f,'Empresa Alfa','2');enviar(f);
  assert.equal(registros(a).at(-1).data,'2024-02-29');
});

test('alteração de origem escolhida interrompe lote sem criar registros',()=>{
  const a=app(),f=copiar(a);todos(f);
  valor(f,'Empresa Alfa','10');valor(f,'Empresa Beta','20');valor(f,'Empresa Gama','30');
  a.run(`E.rendimentos[2].obs='Correção concorrente';`);const antes=registros(a);enviar(f);
  assert.deepEqual(registros(a),antes);assert.match(f.querySelector('[role=alert]').textContent,/origem.*mudou|origem.*alter|atualiz/i);
});

test('remoção de origem escolhida interrompe lote',()=>{
  const a=app(),f=copiar(a);selecionar(f,'Empresa Alfa');valor(f,'Empresa Alfa','10');
  a.run('E.rendimentos.splice(0,1)');const antes=registros(a);enviar(f);
  assert.deepEqual(registros(a),antes);assert.match(f.querySelector('[role=alert]').textContent,/origem|removid/i);
});

test('origem desmarcada alterada não impede copiar uma origem válida escolhida',()=>{
  const a=app(),f=copiar(a);selecionar(f,'Empresa Alfa');valor(f,'Empresa Alfa','10');
  a.run(`E.rendimentos[1].obs='Correção concorrente';`);enviar(f);
  assert.equal(registros(a).length,4);assert.equal(registros(a).at(-1).copiadoDeId,'i1');
  assert.equal(registros(a)[1].obs,'Correção concorrente');
});

test('duplicidade inserida enquanto modal está aberto impede nova cópia',()=>{
  const a=app(),f=copiar(a);selecionar(f,'Empresa Alfa');valor(f,'Empresa Alfa','10');
  a.run(`E.rendimentos.push({id:'c1',copiadoDeId:'i1',data:'2025-02-28',empresa:'Empresa Alfa',tipo:'Investimentos',valor:15});`);
  const antes=registros(a);enviar(f);
  assert.deepEqual(registros(a),antes);assert.match(f.querySelector('[role=alert]').textContent,/já.*copiad/i);
});

test('falha ao persistir reverte lote e permite repetir com a seleção intacta',()=>{
  const a=app(),f=copiar(a);selecionar(f,'Empresa Alfa');selecionar(f,'Empresa Gama');
  valor(f,'Empresa Alfa','10');valor(f,'Empresa Gama','20');
  const antes=registros(a),mt=a.run('E._mt');
  a.ctx.localStorage.setItem=()=>{throw Error('Falha de armazenamento')};enviar(f);
  assert.deepEqual(registros(a),antes);assert.equal(a.run('E._mt'),mt);
  assert.match(f.querySelector('[role=alert]').textContent,/Falha de armazenamento/);
  assert.equal([...f.querySelectorAll('[data-copia-selecionar]')].filter(x=>x.checked).length,2);
  assert.equal(linha(f,'Empresa Alfa').querySelector('[data-copia-valor]').value,'10');
  a.ctx.localStorage.setItem=()=>{};enviar(f);assert.equal(registros(a).length,5);
});
