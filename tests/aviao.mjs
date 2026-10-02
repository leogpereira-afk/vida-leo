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
    A12:'2030-09-01',B12:'2030-09-05',C12:'3000',D12:'900',E12:'Pago',F12:'2030-09-05',G12:'Pagamento conferido',
    A13:'2030-10-01',B13:'2030-10-05',C13:'3000',D13:'900',E13:'A Vencer',
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
  assert.equal(p.mensalidades[0].valorTotal,3000);
  assert.equal(p.mensalidades[0].pagoEm,'2030-09-05');
  assert.equal(p.mensalidades[0].obs,'Pagamento conferido');
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
  assert.match(document.getElementById('main').textContent,/Custos mensais/);
  assert.match(document.getElementById('main').textContent,/Custos de viagens/);
  run("document.getElementById('main').replaceChildren();filtro.aviaoAba='viagens';vAviao(document.getElementById('main'))");
  assert.match(document.getElementById('main').textContent,/Nova viagem no avião/);
});

test('custos: linhas importadas aparecem no livro do avião com edição',()=>{
  const {run,ctx,document}=setup(),x=planilha();
  ctx.m=x.mensal;ctx.d=x.viagem;
  run("E.aviao=mesclarAviaoImportado(E.aviao,validarPacoteAviao({...aviaoDaPlanilha(m,d),manutencaoTotalAtual:5000}));filtro.aviaoAba='custos';vAviao(document.getElementById('main'))");
  assert.equal(document.querySelectorAll('[data-bid="av-aportes"]').length,0);
  assert.equal(document.querySelectorAll('[data-bid="av-valores"]').length,0);
  assert.equal(document.querySelectorAll('[data-bid="av-mensal"] tbody tr').length,2);
  const mensal=document.querySelector('[data-bid="av-mensal"]');
  for(const coluna of ['Competência','Vencimento','Minha cota','Status','Data pagamento','Observações'])
    assert.ok([...mensal.querySelectorAll('th')].some(th=>th.textContent===coluna),coluna);
  assert.match(mensal.textContent,/Pagamento conferido/);
  assert.match(document.getElementById('main').textContent,/5\.000,00/);
  run("document.getElementById('main').replaceChildren();filtro.aviaoPlanilha='viagens';vAviao(document.getElementById('main'))");
  assert.equal(document.querySelectorAll('[data-bid="av-extras"] tbody tr').length,1);
  assert.equal(document.querySelectorAll('[data-bid="av-extras"] tbody button').length,1);
});

test('resumo da planilha reconcilia aquisição, referência, mensalidades e despesas sem cancelados',()=>{
  const {run,ctx}=setup(),x=planilha();ctx.m=x.mensal;ctx.d=x.viagem;
  run("var a=aviaoDaPlanilha(m,d);a.mensalidades.push({minhaCota:123,valorTotal:456,status:'Cancelado'});a.despesas.push({valorTotal:99,minhaCota:20,status:'Cancelado'})");
  const r=JSON.parse(run('JSON.stringify(resumoPlanilhaAviao(a))'));
  assert.equal(r.aporte,39000);assert.equal(r.pago,900);assert.equal(r.pendente,900);
  assert.equal(r.proxima,'2030-10-05');assert.equal(r.totalCotas,1800);assert.equal(r.totalMensal,6000);
  assert.equal(r.ganhoAporte,11000);assert.equal(r.ganhoReferencia,18000);
  assert.equal(r.retornoAporte,11000/39000);assert.equal(r.retornoReferencia,18000/32000);
  assert.equal(r.despesas,700);assert.equal(r.combustivel,700);assert.equal(r.minhaParte,140);
  assert.equal(run('resumoPlanilhaAviao(SEED.aviao).retornoAporte'),null);
});

test('reimportação acrescenta a coluna de total em cadastros antigos e preserva valores editados',()=>{
  const {run,ctx}=setup(),x=planilha();ctx.m=x.mensal;ctx.d=x.viagem;
  run("var p=aviaoDaPlanilha(m,d);E.aviao=mesclarAviaoImportado(E.aviao,p);E.aviao.administradora='Administradora exemplo';E.aviao.telefoneAdmin='Contato preservado';delete E.aviao.mensalidades[0].valorTotal;E.aviao.mensalidades[0].editadoManual=true;E.aviao.mensalidades[0].obs='Conferido por mim';E.aviao.mensalidades[1].valorTotal=5000;E.aviao.mensalidades[1].editadoManual=true;E.aviao=mesclarAviaoImportado(E.aviao,p)");
  assert.equal(run('E.aviao.mensalidades[0].valorTotal'),3000);
  assert.equal(run('E.aviao.mensalidades[0].obs'),'Conferido por mim');
  assert.equal(run('E.aviao.mensalidades[1].valorTotal'),5000);
  assert.equal(run('E.aviao.administradora'),'Administradora exemplo');
  assert.equal(run('E.aviao.telefoneAdmin'),'Contato preservado');
  assert.equal(run('E.aviao.mensalidades.length'),2);
});

test('mensalidades exibem só minha cota e preservam observações e dados importados',()=>{
  const {run,ctx,document}=setup(),x=planilha();ctx.m=x.mensal;ctx.d=x.viagem;
  run("E.aviao=mesclarAviaoImportado(E.aviao,{...aviaoDaPlanilha(m,d),manutencaoTotalAtual:5000});E.aviao.mensalidades[0].obs='<img src=x onerror=alert(1)>';filtro.aviaoAba='custos';vAviao(document.getElementById('main'))");
  const mensal=document.querySelector('[data-bid="av-mensal"]');
  assert.equal(mensal.querySelectorAll('img').length,0);assert.match(mensal.textContent,/<img/);
  assert.doesNotMatch(mensal.textContent,/Valor total|3\.000,00|6\.000,00/);
  assert.equal(run('E.aviao.mensalidades[0].valorTotal'),3000);
  assert.match(document.querySelector('.aviao-sheet-nota').textContent,/5\.000,00/);
  assert.match(mensal.querySelector('tfoot').textContent,/1\.800,00/);
  mensal.querySelector('tbody button').click();
  assert.doesNotMatch(document.querySelector('[role=dialog]').textContent,/Valor total da mensalidade/);
});

test('colar do Excel mantém células vazias, aspas, quebras e porcentagem brasileira',()=>{
  const {run,ctx}=setup();
  ctx.texto='Título\t\t"Texto com\nquebra e ""aspas"""\r\n\r\n\t\t\t\t\tParticipação Societária\t17,5%';
  const cells=JSON.parse(run('JSON.stringify(celulasColadasAviao(texto))'));
  assert.equal(cells.A1,'Título');assert.equal(cells.B1,'');
  assert.equal(cells.C1,'Texto com\nquebra e "aspas"');
  assert.equal(cells.F3,'Participação Societária');assert.equal(cells.G3,.175);
  ctx.texto='"Texto incompleto';assert.throws(()=>run('celulasColadasAviao(texto)'),/cortado/);
});

test('colagem só abre conferência, sem salvar antes de aplicar',()=>{
  const {run,ctx,document}=setup(),x=planilha();
  const tabular=(cells,cols,rows)=>Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>cells[String.fromCharCode(65+c)+(r+1)]??'').join('\t')).join('\n');
  run('colarPlanilhaAviao()');
  const fields=document.querySelectorAll('textarea');fields[0].value=tabular(x.mensal,9,13);fields[1].value=tabular(x.viagem,7,6);
  [...document.querySelectorAll('button')].find(b=>b.textContent==='Conferir dados').click();
  assert.equal(run('E.aviao.matricula'),'');
  assert.match(document.querySelector('[role=dialog]').textContent,/PS-ABC/);
  assert.match(document.querySelector('[role=dialog]').textContent,/Aplicar dados conferidos/);
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


test('Sobre o avião recebe aquisição e valores, com edição preservada',()=>{
  const {run,ctx,document}=setup(),x=planilha();ctx.m=x.mensal;ctx.d=x.viagem;
  run("E.aviao=mesclarAviaoImportado(E.aviao,{...aviaoDaPlanilha(m,d),manutencaoTotalAtual:5000});filtro.aviaoAba='sobre';vAviao(document.getElementById('main'))");
  assert.equal(document.querySelectorAll('[data-bid="av-aportes"] tbody tr').length,3);
  assert.ok(document.querySelector('[data-bid="av-valores"]'));
  assert.ok(document.querySelector('[data-bid="av-administracao"] input[type=tel]'));
  assert.ok(document.querySelector('[data-bid="av-administracao"] input[type=email]'));
  assert.equal(document.querySelectorAll('[data-bid="av-mensal"]').length,0);
  document.querySelector('[data-bid="av-aportes"] tbody button').click();
  assert.match(document.querySelector('[role=dialog]').textContent,/Editar aporte/);
});

test('vincular viagem usa o cadastro existente, preserva custos e transporte e não duplica',()=>{
  const {run,document}=setup();
  run("E.viagens=[{id:'v1',evento:'Reunião',ida:'2030-10-10',status:'Confirmado',transporte:'Carro e avião',custos:[{valor:100}],hotel:'Reserva mantida'},{id:'v2',evento:'Já vinculada',aviaoId:'principal'},{id:'v3',evento:'Cancelada',status:'Cancelado'}];filtro.aviaoAba='viagens';vAviao(document.getElementById('main'))");
  [...document.querySelectorAll('button')].find(b=>b.textContent==='Vincular viagem existente').click();
  const dlg=document.querySelector('[role=dialog]'),sel=dlg.querySelector('select');
  assert.equal(sel.options.length,2);
  assert.equal(run('E.viagens[0].aviaoId'),undefined);
  const ok=[...dlg.querySelectorAll('button')].find(b=>b.textContent==='Vincular ao avião');
  assert.equal(ok.disabled,true);sel.querySelector('[value="v1"]').selected=true;sel.onchange();ok.click();
  assert.equal(run('E.viagens.length'),3);assert.equal(run('E.viagens[0].aviaoId'),'principal');
  assert.equal(run('E.viagens[0].transporte'),'Carro e avião');assert.equal(run('E.viagens[0].hotel'),'Reserva mantida');
  assert.equal(run('custoViagem(E.viagens[0])'),100);
  assert.equal(document.querySelector('[role=dialog]'),null);
});

test('cancelar vínculo não altera dados; atualização durante escolha exige reabrir',()=>{
  const {run,document}=setup();
  run("E.viagens=[{id:'v1',evento:'Teste',status:'Confirmado'}];vincularViagemAviao()");
  [...document.querySelector('[role=dialog]').querySelectorAll('button')].find(b=>b.textContent==='Cancelar').click();
  assert.equal(run('E.viagens[0].aviaoId'),undefined);
  run('vincularViagemAviao()');const dlg=document.querySelector('[role=dialog]'),sel=dlg.querySelector('select');
  sel.querySelector('[value="v1"]').selected=true;sel.onchange();run('E=structuredClone(E)');
  [...dlg.querySelectorAll('button')].find(b=>b.textContent==='Vincular ao avião').click();
  assert.match(dlg.querySelector('[role=alert]').textContent,/atualizados/);
  assert.equal(run('E.viagens[0].aviaoId'),undefined);
});
