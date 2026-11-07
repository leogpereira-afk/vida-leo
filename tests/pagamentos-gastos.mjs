import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';
const json=x=>JSON.parse(JSON.stringify(x));
function app(){
 const a=setup(),s=new Map();a.ctx.localStorage={getItem:k=>s.get(k)||null,setItem:(k,v)=>s.set(k,v),removeItem:k=>s.delete(k)};
 a.run('E=carregar();E.gastos=[];E.empresasPJ=[];E._mt=100');
 a.estado=()=>json(a.run('E'));return a;
}
const registro=(tipo,id='r')=>tipo==='aportes'?{id,data:'2026-11-01',valor:125.23,forma:'Pix'}:tipo==='mensalidades'?{id,competencia:'2026-10-01',vencimento:'2026-10-10',minhaCota:125.23,status:'Pago',pagoEm:'2026-11-01'}:{id,data:'2026-10-10',descricao:'Despesa de ensaio',minhaCota:125.23,valorTotal:700,status:'Pago',pagoEm:'2026-11-01'};
function gravar(a,tipo,dados,base=null,op={}){a.ctx.q={tipo,dados,base,op};return a.run('aviaoGravarRegistro(q.tipo,q.dados,q.base,q.op)');}

test('Qualquer imóvel novo gera Gastos em parcelas, pagamentos manuais e despesas, sem configuração especial',async()=>{
 const a=app();
 await a.run(`holdingGravarImovel({id:'novo',nome:'Imóvel novo',totalCentavos:100000})`);
 a.run(`globalThis.base=structuredClone(E.holdingImoveis[0]);globalThis.serie={id:'parcela',descricao:'Mensal',primeiroVencimento:'2026-12-01',quantidade:1,valorCentavos:10000}`);
 await a.run(`holdingGravarSerie('novo',serie,base)`);
 for(let n=0;n<2;n++)await a.run(`holdingPagarParcela('novo','parcela',E.holdingImoveis[0].parcelas[0],E.holdingImoveis[0])`);
 assert.equal(a.estado().gastos.length,1);assert.equal(a.estado().gastos[0].empresaId,'');
 await a.run(`holdingGravarPagamento('novo',{id:'manual',descricao:'Entrada',data:'2026-10-10',valorCentavos:15000},null,E.holdingImoveis[0])`);
 await a.run(`holdingGravarDespesa('novo',{id:'custo',descricao:'Condomínio',tipo:'condominio',valorCentavos:5000,vencimento:'2026-11-01'},null,E.holdingImoveis[0])`);
 await a.run(`holdingPagarDespesa('novo','custo',E.holdingImoveis[0].despesas[0],E.holdingImoveis[0])`);
 const gastos=a.estado().gastos;assert.equal(gastos.length,3);assert.equal(gastos.reduce((s,g)=>s+g.valor,0),300);
 for(const g of gastos){a.ctx.g=g;assert.equal(a.run('holdingAnexosCompartilhados("gasto:"+g.id)'),a.run('gastoReferenciaOrigem(g)'));assert.equal(a.run('holdingAnexosCompartilhados(gastoReferenciaOrigem(g))'),a.run('gastoReferenciaOrigem(g)'));}
 a.run('E=carregar();validarBackup(E)');assert.equal(a.estado().gastos.length,3);
});

test('Avião gera um gasto por aporte, mensalidade e despesa, corrige o mesmo id e preserva a própria cota',async()=>{
 const a=app();
 for(const tipo of ['aportes','mensalidades','despesas']) {
  const dados=registro(tipo);await gravar(a,tipo,dados);await gravar(a,tipo,dados);
  const antes=a.estado(),g=antes.gastos.find(g=>g.aviaoTipo===tipo);
  assert.equal(g.valor,125.23);assert.equal(g.pagoEm,'2026-11-01');assert.equal(g.mes,'2026-11');
  const base=antes.aviao[tipo][0];await gravar(a,tipo,{...base,[tipo==='aportes'?'valor':'minhaCota']:150.45},base);
  assert.equal(a.estado().gastos.find(g=>g.aviaoTipo===tipo).id,g.id);assert.equal(a.estado().gastos.find(g=>g.aviaoTipo===tipo).valor,150.45);
 }
 assert.equal(a.estado().gastos.length,3);assert.equal(new Set(a.estado().gastos.map(g=>g.id)).size,3);
 a.run('E=carregar();validarBackup(E)');assert.equal(a.estado().gastos.length,3);
 for(const g of a.estado().gastos){a.ctx.g=g;assert.equal(a.run('holdingAnexosCompartilhados("gasto:"+g.id)'),a.run('aviaoRefPagamento(g.aviaoTipo,g.aviaoRegistroId)'));}
});

test('Reabertura, cancelamento e remoção retiram gasto ativo e conservam dados anteriores e referência do comprovante',async()=>{
 const a=app(),dados=registro('mensalidades');await gravar(a,'mensalidades',dados);
 const id=a.estado().gastos[0].id,ref=a.run('aviaoRefPagamento("mensalidades","r")');
 let base=a.estado().aviao.mensalidades[0];await gravar(a,'mensalidades',{...base,status:'A Vencer',pagoEm:''},base);
 assert.equal(a.estado().gastos.length,0);assert.equal(a.estado().aviao.mensalidades[0].historicoGastos[0].gasto.id,id);
 base=a.estado().aviao.mensalidades[0];await gravar(a,'mensalidades',{...base,status:'Pago',pagoEm:'2026-11-02'},base);
 assert.equal(a.estado().gastos[0].id,id);assert.equal(a.run('holdingAnexosCompartilhados("gasto:"+E.gastos[0].id)'),ref);
 base=a.estado().aviao.mensalidades[0];await gravar(a,'mensalidades',base,base,{excluir:true});
 assert.equal(a.estado().gastos.length,0);assert.equal(a.estado().aviao.mensalidades.length,0);assert.equal(a.estado().aviao.registrosExcluidos[0].gasto.id,id);
});

test('Avião não salva parcialmente com data ausente, quota ou formulário desatualizado',async()=>{
 const a=app(),d=registro('mensalidades');const inicial=a.estado();
 await assert.rejects(gravar(a,'mensalidades',{...d,pagoEm:''}),/data do pagamento/);assert.deepEqual(a.estado(),inicial);
 await gravar(a,'mensalidades',d);const base=a.estado().aviao.mensalidades[0];
 await gravar(a,'mensalidades',{...base,minhaCota:200},base);const antes=a.estado();
 await assert.rejects(gravar(a,'mensalidades',{...base,minhaCota:300},base),/mudou/);assert.deepEqual(a.estado(),antes);
 a.ctx.localStorage.setItem=()=>{throw Error('quota')};
 await assert.rejects(gravar(a,'mensalidades',{...antes.aviao.mensalidades[0],minhaCota:400},antes.aviao.mensalidades[0]),/salvar neste dispositivo/);assert.deepEqual(a.estado(),antes);
});

test('Avião confirma uma única gravação de fonte e gasto; conflito sem gasto não comunica sucesso',async()=>{
 for(const faltar of [false,true]) {
  const a=app();a.run('window.__testeSync=true;marcaBase(100,conteudoSync(E))');let remoto,puts=0;
  a.ctx.fetch=async(_,op)=>{if(op.method==='GET')return{ok:true,status:200,json:async()=>({mt:200,dados:remoto})};puts++;remoto=JSON.parse(op.body).dados;assert.equal(remoto.gastos.length,1);assert.equal(remoto.aviao.mensalidades.length,1);if(faltar)remoto.gastos=[];remoto._mt=200;return{ok:false,status:409,json:async()=>({})}};
  const p=gravar(a,'mensalidades',registro('mensalidades'));
  if(faltar)await assert.rejects(p,/mudou/);else assert.match(await p,/sincronizado/);
  assert.equal(puts,1);
 }
});

test('Gasto do avião protege campos financeiros, não repete no mês seguinte e volta ao registro de origem',async()=>{
 const a=app();await gravar(a,'despesas',registro('despesas'));
 a.run('modalLancamentoGasto(E.gastos[0])');
 for(const nome of ['valor','mes','data','pagoEm','empresaId','situacao'])assert.equal(a.document.querySelector('[name='+nome+']').disabled,true);
 [...a.document.querySelectorAll('button')].find(b=>b.textContent==='Abrir registro do avião').click();
 assert.match(a.document.querySelector('[role=dialog]').textContent,/Editar despesa do avião/);
 assert.ok(a.document.querySelector('.ff-attachments'));
 a.run('document.querySelector(".fundo").remove();financeiroRepetirGastos(E.gastos,"2027-01")');assert.equal(a.document.querySelectorAll('.ff-repeat-row').length,0);
});

test('Cancelar despesa vinculada à viagem preserva o vínculo e comprovantes no cadastro',async()=>{
 const a=app();a.run(`E.viagens=[{id:'v',evento:'Viagem de ensaio',transporte:'',custos:[]}];`);
 await gravar(a,'despesas',{...registro('despesas'),viagemId:'v'});
 assert.equal(a.estado().viagens[0].aviaoId,'principal');assert.equal(a.estado().gastos[0].valor,125.23);
 const base=a.estado().aviao.despesas[0];await gravar(a,'despesas',{...base,status:'Cancelado'},base);
 assert.equal(a.estado().gastos.length,0);assert.equal(a.estado().aviao.despesas[0].historicoGastos.length,1);
 assert.equal(a.estado().viagens[0].aviaoId,'principal');assert.equal(a.run('holdingAnexosCompartilhados(aviaoRefPagamento("despesas","r"))'),a.run('aviaoRefPagamento("despesas","r")'));
});

test('Abrir imóveis e avião não importa pagamentos antigos em Gastos',()=>{
 const a=app();a.ctx.reg=registro('aportes');a.run(`E.aviao.aportes=[reg];E.holdingImoveis=[{id:'i',nome:'Imóvel',totalCentavos:10000,pagamentos:[{id:'p',data:'2026-01-01',valorCentavos:10000}]}];vAviao(document.getElementById('main'));vUniversoImoveis(document.getElementById('main'))`);
 assert.equal(a.estado().gastos.length,0);
});

test('Operação conciliada na aquisição e em despesas reutiliza um gasto e uma referência de comprovante',async()=>{
 const a=app();
 a.run(`E.holdingImoveis=[{id:'i',nome:'Imóvel de ensaio',totalCentavos:10000,parcelas:[{id:'p',descricao:'Permuta',valorCentavos:10000,vencimento:'2026-11-01'}],pagamentos:[{id:'pg',parcelaId:'p',descricao:'Permuta',data:'2026-11-01',valorCentavos:10000}],despesas:[{id:'d',tipo:'investimento',descricao:'Permuta',valorCentavos:10000,vencimento:'2026-11-01',pagoEm:'2026-11-01'}]}];E.gastos=[{id:'unico',holdingImovelId:'i',holdingParcelaId:'p',holdingDespesaId:'d',valor:100,pagoEm:'2026-11-01'}];`);
 const canonical=a.run(`HoldingUI.refAnexos('i','parcela','p')`);
 assert.equal(a.run(`holdingAnexosCompartilhados(HoldingUI.refAnexos('i','despesa','d'))`),canonical);
 assert.equal(a.run(`holdingAnexosCompartilhados('gasto:unico')`),canonical);
 await a.run(`holdingPagarDespesa('i','d',E.holdingImoveis[0].despesas[0],E.holdingImoveis[0])`);
 await a.run(`holdingPagarParcela('i','p',E.holdingImoveis[0].parcelas[0],E.holdingImoveis[0])`);
 assert.equal(a.estado().gastos.length,1);assert.equal(a.estado().gastos[0].id,'unico');
 assert.equal(a.run(`holdingAnexosCompartilhados(HoldingUI.refAnexos('i','despesa','d'))`),canonical);
});
