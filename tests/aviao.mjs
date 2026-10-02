import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

const planilha=()=>({
  mensal:{
    A1:'Aeronave Modelo X PS-ABC',A2:'Titularidade: Empresa Exemplo',
    F3:'Participação Societária',G3:'0.20',I3:'32000',G4:'50000',I4:'240000',
    F7:'Manutenção Mensal (Minha Cota)',G7:'900',I7:'3000',
    A4:'2030-08-25',B4:'Dinheiro',C4:'12000',
    A5:'2030-08-27',B5:'Transferência',C5:'21000',
    A6:'2030-08-31',B6:'Transferência',C6:'6000',
    A12:'2030-09-01',B12:'2030-09-05',D12:'900',E12:'Pago',F12:'2030-09-05',
    A13:'2030-10-01',B13:'2030-10-05',D13:'900',E13:'A Vencer',
  },
  viagem:{A6:'2030-10-10',B6:'Combustível',C6:'Rota exemplo',D6:'700',E6:'140',F6:'Pendente'},
});
test('planilha: lê aporte, mensalidade e despesa sem deduzir parcela da porcentagem',()=>{
  const {run,ctx}=setup();const x=planilha();ctx.m=x.mensal;ctx.d=x.viagem;
  const p=JSON.parse(run('JSON.stringify(aviaoDaPlanilha(m,d))'));
  assert.equal(p.matricula,'PS-ABC');
  assert.equal(p.participacao,0.20);
  assert.equal(p.manutencaoMinha,900);
  assert.equal(p.manutencaoTotalFonte,3000);
  assert.equal(p.aportes.reduce((s,a)=>s+a.valor,0),39000);
  assert.equal(p.mensalidades.length,2);
  assert.equal(p.despesas[0].minhaCota,140);
});

test('importador: mostra conferência e só grava após o clique em aplicar',async()=>{
  const {run,ctx,document}=setup(),x=planilha();
  ctx.m=x.mensal;ctx.d=x.viagem;
  const p=JSON.parse(run('JSON.stringify({...aviaoDaPlanilha(m,d),manutencaoTotalAtual:5000})'));
  const json=JSON.stringify(p);
  ctx.arquivo={name:'aviao.json',size:json.length,text:async()=>json};
  await run('importarAviao(arquivo)');
  assert.equal(run('E.aviao.matricula'),'');
  const dialog=document.querySelector('[role=dialog]');
  assert.match(dialog.textContent,/Confira os valores antes de gravar/);
  assert.equal(dialog.querySelector('input[type=number]').value,'5000');
  [...dialog.querySelectorAll('button')].find(b=>b.textContent==='Aplicar dados conferidos').click();
  assert.equal(run('E.aviao.matricula'),'PS-ABC');
  assert.equal(run('E.aviao.manutencaoTotalAtual'),5000);
});

test('importação: total atual informado separadamente e reimportação não duplica nem desfaz decisões',()=>{
  const {run,ctx}=setup();const x=planilha();ctx.m=x.mensal;ctx.d=x.viagem;
  run("var p=validarPacoteAviao({...aviaoDaPlanilha(m,d),manutencaoTotalAtual:5000});E.aviao=mesclarAviaoImportado(E.aviao,p)");
  assert.equal(run('E.aviao.manutencaoTotalAtual'),5000);
  assert.equal(run('E.aviao.manutencaoMinha'),900);
  assert.equal(run('E.aviao.aportes.length'),3);
  run("E.aviao.mensalidades[1].status='Pago';E.aviao.mensalidades[1].editadoManual=true;E.aviao.despesas[0].viagemId='v1';E.aviao=mesclarAviaoImportado(E.aviao,p)");
  assert.equal(run('E.aviao.mensalidades.length'),2);
  assert.equal(run('E.aviao.despesas.length'),1);
  assert.equal(run("E.aviao.mensalidades[1].status"),'Pago');
  assert.equal(run("E.aviao.despesas[0].viagemId"),'v1');
  assert.equal(run('totaisAviao(E.aviao).aportado'),39000);
  assert.equal(run('totaisAviao(E.aviao).ganho'),11000);
});

test('importação: rejeita valor, matrícula, data e chave duplicada inválidos',()=>{
  const {run,ctx}=setup();const x=planilha();ctx.m=x.mensal;ctx.d=x.viagem;
  run('var p=aviaoDaPlanilha(m,d)');
  for(const expr of ["{...p,participacao:1.7}","{...p,matricula:'<script>'}",
    "{...p,mensalidades:[{...p.mensalidades[0],vencimento:'ontem'}]}",
    "{...p,despesas:[p.despesas[0],p.despesas[0]]}"])
    assert.throws(()=>run('validarPacoteAviao('+expr+')'));
});

test('viagem: usa o mesmo cadastro e soma só despesa extra vinculada, uma vez',()=>{
  const {run}=setup();
  run("E.viagens=[{id:'v1',evento:'Teste',aviaoId:'principal',status:'Confirmado',custos:[{valor:100}],gastos:900},{id:'v2',aviaoId:'principal',status:'Cancelado',custos:[],gastos:0}];E.aviao.despesas=[{viagemId:'v1',minhaCota:140,status:'Pendente'},{viagemId:'v1',minhaCota:50,status:'Cancelado'},{viagemId:'v2',minhaCota:90,status:'Pago'}]");
  assert.equal(run('custoViagem(E.viagens[0])'),240);
  assert.equal(run('custoViagem(E.viagens[1])'),0);
  assert.equal(run("despesasDoAviaoNaViagem(E.viagens[0]).length"),1);
});

test('viagem: não perde vínculo com aeronave enquanto houver despesas associadas',()=>{
  const {run,document}=setup();
  run("E.viagens=[{id:'v1',evento:'Teste',cidade:'SP',ida:'2030-10-10',volta:'2030-10-10',aviaoId:'principal',status:'Confirmado',custos:[],passagens:[],hoteis:[],tickets:[],viajantes:[],roteiro:[],lugares:[]}];E.aviao.despesas=[{id:'d1',viagemId:'v1',minhaCota:140,status:'Pendente'}];modalViagem(E.viagens[0])");
  const select=[...document.querySelectorAll('[role=dialog] select')].find(s=>[...s.options].some(o=>o.textContent==='Meu avião'));
  assert.ok(select);
  [...select.options].forEach(o=>{o.selected=o.value===''});
  select.dispatchEvent(new document.defaultView.Event('change',{bubbles:true}));
  assert.equal(run('E.viagens[0].aviaoId'),'principal');
});

test('Agenda: somente mensalidades não pagas aparecem no vencimento próprio',()=>{
  const {run}=setup();
  run("E.aviao.mensalidades=[{competencia:'2030-10-01',vencimento:'2030-10-05',minhaCota:900,status:'A Vencer'},{competencia:'2030-09-01',vencimento:'2030-09-05',minhaCota:900,status:'Pago'},{competencia:'2030-11-01',vencimento:'',status:'A Vencer'}]");
  const ev=JSON.parse(run("JSON.stringify(eventosDoEcossistema().filter(e=>e.fonte==='aviao'))"));
  assert.equal(ev.length,1);
  assert.equal(ev[0].data,'2030-10-05');
  assert.equal(ev[0].ir,'aviao');
});

test('painel: seções de visão, custos, viagens e fotos são acessíveis',()=>{
  const {run,document}=setup();
  run("E.aviao.nome='Avião de teste';E.aviao.matricula='PS-ABC';E.aviao.participacao=.20;atual='aviao';vAviao(document.getElementById('main'))");
  assert.match(document.getElementById('main').textContent,/participação na aeronave/);
  run("document.getElementById('main').replaceChildren();filtro.aviaoAba='sobre';vAviao(document.getElementById('main'))");
  assert.match(document.getElementById('main').textContent,/A história do avião/);
  assert.match(document.getElementById('main').textContent,/Adicionar fotos e documentos/);
  run("document.getElementById('main').replaceChildren();filtro.aviaoAba='custos';vAviao(document.getElementById('main'))");
  assert.match(document.getElementById('main').textContent,/Despesas extras/);
  run("document.getElementById('main').replaceChildren();filtro.aviaoAba='viagens';vAviao(document.getElementById('main'))");
  assert.match(document.getElementById('main').textContent,/Nova viagem no avião/);
});

test('custos: linhas importadas aparecem no livro do avião com edição',()=>{
  const {run,ctx,document}=setup(),x=planilha();
  ctx.m=x.mensal;ctx.d=x.viagem;
  run("E.aviao=mesclarAviaoImportado(E.aviao,validarPacoteAviao({...aviaoDaPlanilha(m,d),manutencaoTotalAtual:5000}));filtro.aviaoAba='custos';vAviao(document.getElementById('main'))");
  assert.equal(document.querySelectorAll('[data-bid="av-aportes"] tbody tr').length,3);
  assert.equal(document.querySelectorAll('[data-bid="av-mensal"] tbody tr').length,2);
  assert.equal(document.querySelectorAll('[data-bid="av-extras"] tbody tr').length,1);
  assert.equal(document.querySelectorAll('[data-bid="av-extras"] tbody button').length,1);
  assert.match(document.getElementById('main').textContent,/5\.000,00/);
});

test('visão e Gastos: diferença da parcela é visível sem somar o avião duas vezes',()=>{
  const {run,ctx,document}=setup(),x=planilha();
  ctx.m=x.mensal;ctx.d=x.viagem;
  run("E.aviao=mesclarAviaoImportado(E.aviao,validarPacoteAviao({...aviaoDaPlanilha(m,d),manutencaoTotalAtual:5000}));vAviao(document.getElementById('main'))");
  assert.match(document.querySelector('.aviao-contexto:last-of-type')?.textContent||document.getElementById('main').textContent,/100,00/);
  run("document.getElementById('main').replaceChildren();filtro.gastosMes='2030-10';vGastos(document.getElementById('main'))");
  const ponte=document.querySelector('#main .aviao-vinculo');
  assert.match(ponte.textContent,/900,00/);
  assert.match(ponte.textContent,/140,00/);
  assert.match(ponte.textContent,/fora do total de Gastos/);
});

test('Patrimônio: mostra a participação com acesso ao painel sem duplicar a carteira',()=>{
  const {run,document}=setup();
  run("E.aviao.matricula='PS-ABC';E.aviao.participacao=.20;E.aviao.valorCotaAtual=50000;vPatrimonio(document.getElementById('main'))");
  const ponte=document.querySelector('#main .aviao-vinculo');
  assert.match(ponte.textContent,/20%/);
  assert.match(ponte.textContent,/50\.000,00/);
  assert.match(ponte.textContent,/evitar dupla contagem/);
});

test('backup: estrutura do avião é validada e SEED público começa vazio',()=>{
  const {run}=setup();
  assert.throws(()=>run("validarBackup({viagens:[],aviao:{despesas:{}}})"),/aviao.despesas/);
  assert.equal(run("SEED.aviao.matricula"),'');
  assert.equal(run("SEED.aviao.manutencaoTotalAtual"),null);
  assert.equal(run("SEED.aviao.aportes.length"),0);
});
