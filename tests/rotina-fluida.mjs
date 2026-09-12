import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

test('demanda concluída sem data mantém duração desconhecida',()=>{
 const {run}=setup();assert.equal(run("diasDemanda({criada:'2026-01-01',status:'Concluída'}).txt"),'—');
});
test('demanda com conclusão anterior à abertura não inventa zero dias',()=>{
 const {run}=setup();assert.equal(run("diasDemanda({criada:'2026-09-05',concluidoEm:'2026-09-02',status:'Concluída'}).txt"),'—');
});
test('Viagens: total acompanha a situação visível',()=>{
 const {run,document}=setup();run("filtro.viagensAno='2026';filtro.viagens='Confirmado';E.viagens=[{id:'a',evento:'A',ida:'2026-10-01',volta:'2026-10-02',status:'Confirmado',gastos:100},{id:'b',evento:'B',ida:'2026-11-01',volta:'2026-11-02',status:'Em Planejamento',gastos:900}];vViagens(document.getElementById('main'))");
 assert.match(document.querySelector('[data-bid="vg-lista"] tfoot').textContent,/100,00/);assert.doesNotMatch(document.querySelector('[data-bid="vg-lista"] tfoot').textContent,/1.000,00/);
});
test('Viagens: viagem que cruza o ano aparece no ano da volta',()=>{
 const {run,document}=setup();run("filtro.viagensAno='2027';filtro.viagens='Todas';E.viagens=[{id:'a',evento:'Virada',ida:'2026-12-26',volta:'2027-01-03',status:'Confirmado',gastos:100}];vViagens(document.getElementById('main'))");
 assert.match(document.querySelector('[data-bid="vg-lista"]').textContent,/Virada/);
});
test('Agenda: dia vazio também oferece inserção no próprio dia',()=>{
 const {run,document}=setup();run("document.getElementById('main').appendChild(gradeMes([],()=>{}))");
 const dia=document.querySelector('.diaCel');assert.equal(dia.getAttribute('role'),'button');dia.click();assert.match(document.getElementById('modais').textContent,/Compromisso neste dia/);
});
test('Saúde: novo exame aguardando não apaga leitura do resultado anterior',()=>{
 const {run,document}=setup();run("E.exames=[{id:'feito',exame:'LDL',data:'2026-01-01',valor:'90'},{id:'espera',exame:'LDL',data:'2026-02-01',valor:'',resultado:'Aguardando'}];vSaude(document.getElementById('main'))");
 const row=document.querySelector('[data-bid="sa-ex"] tbody tr');assert.match(row.textContent,/90/);assert.match(row.textContent,/01\/01\/2026/);
});

test('entrada: cancelar viagem não cria registro nem altera dados',()=>{
 const {run,document}=setup();const antes=run('JSON.stringify(E.viagens)');run('novaViagemRotina()');document.querySelector('[data-cancelar]').click();assert.equal(run('JSON.stringify(E.viagens)'),antes);
});
test('entrada: título em branco não pode ser salvo',()=>{
 const {run,document}=setup();run('novoCompromissoRotina()');const form=document.querySelector('.rotina-form');form.onsubmit({preventDefault(){}});assert.equal(run('E.agenda.length'),0);assert.match(form.textContent,/Preencha compromisso/);
});
test('entrada: compromisso abre na data selecionada e confirma uma vez',()=>{
 const {run,document}=setup();run("var abertoRotina='';modalCompromisso=x=>abertoRotina=x.id;novoCompromissoRotina('2027-03-14')");const form=document.querySelector('.rotina-form');form.querySelector('[name="titulo"]').value='Reunião';form.onsubmit({preventDefault(){}});form.onsubmit({preventDefault(){}});assert.equal(run('E.agenda.length'),1);assert.equal(run('E.agenda[0].data'),'2027-03-14');assert.equal(run('abertoRotina===E.agenda[0].id'),true);
});
test('entrada: datas de viagem invertidas bloqueiam inclusão',()=>{
 const {run,document}=setup();run('novaViagemRotina()');const form=document.querySelector('.rotina-form');for(const [k,v] of Object.entries({evento:'Teste',cidade:'Destino',ida:'2027-01-10',volta:'2027-01-05'}))form.querySelector('[name="'+k+'"]').value=v;form.onsubmit({preventDefault(){}});assert.equal(run('E.viagens.length'),0);assert.match(form.textContent,/data final/);
});
test('entrada: sinais vitais sem nenhuma medida não são gravados',()=>{
 const {run,document}=setup();run("novoCuidadoRotina('vitais')");const form=document.querySelector('.rotina-form');form.onsubmit({preventDefault(){}});assert.equal(run('E.vitais.length'),0);assert.match(form.textContent,/pelo menos uma medida/);
});
test('entrada: pesagem exige medida positiva',()=>{
 const {run,document}=setup();run("novoCuidadoRotina('peso')");const form=document.querySelector('.rotina-form');form.querySelector('[name="peso"]').value='0';form.onsubmit({preventDefault(){}});assert.equal(run('E.peso.length'),0);assert.match(form.textContent,/Confira peso/);
});
test('Viagens: ordem prioriza em andamento e próximas e preserva origem',()=>{
 const {run}=setup();run("var viagensTeste=[{id:'antiga',ida:'2020-01-01',volta:'2020-01-02'},{id:'futura',ida:'2099-01-01',volta:'2099-01-03'},{id:'atual',ida:hoje(),volta:hoje()},{id:'sem-data'}]");assert.equal(run("ordenarViagensRotina(viagensTeste).map(x=>x.id).join(',')"),'atual,futura,sem-data,antiga');assert.equal(run('viagensTeste[0].id'),'antiga');
});
test('Viagens: falta de nome não derruba gráfico de gastos',()=>{
 const {run}=setup();assert.doesNotThrow(()=>run("filtro.viagensAno='todos';E.viagens=[{id:'x',ida:'2026-01-01',volta:'2026-01-02',status:'Confirmado',gastos:100}];vViagens(document.getElementById('main'))"));
});
test('Viagens: registro antigo sem custos abre sem erro',()=>{
 const {run}=setup();assert.doesNotThrow(()=>run("modalViagem({id:'x',evento:'Antiga',ida:'2026-01-01',volta:'2026-01-02'})"));
});
test('Agenda: faixa iniciada anos atrás permanece no mês em exibição',()=>{
 const {run,document}=setup();run("filtro.agMes='2026-09';document.getElementById('main').appendChild(gradeMes([{data:'2020-01-01',ate:'2027-12-31',titulo:'Período extenso',fonte:'compromissos',ic:'📅'}],()=>{}))");assert.match(document.querySelector('.diaCel').textContent,/Período extenso/);
});
test('Agenda: faixa preserva o último dia da grade visível',()=>{
 const {run,document}=setup();run("filtro.agMes='2026-09';document.getElementById('main').appendChild(gradeMes([{data:'2026-09-01',ate:'2027-12-31',titulo:'Período',fonte:'compromissos',ic:'📅'}],()=>{}))");const dias=document.querySelectorAll('.diaCel');assert.match(dias[dias.length-1].getAttribute('aria-label'),/1 evento/);
});
test('Saúde: resultados futuros ficam pendentes e não são último registro',()=>{
 const {run}=setup();assert.equal(run("registrosResultadoSaude([{data:'2026-01-01',valor:'10'},{data:'2099-01-01',valor:'30'}]).length"),1);assert.equal(run("ultimoRegistroSaude([{data:'2026-02-30',peso:80}],['peso'])"),null);
});
test('Saúde: exame sem nome continua acessível para completar',()=>{
 const {run,document}=setup();run("E.exames=[{id:'x',data:'2026-01-01',exame:'',valor:''}];vSaude(document.getElementById('main'))");const pend=document.querySelector('[data-bid="sa-pend"]');assert.match(pend.textContent,/Exame sem nome/);pend.querySelector('button').click();assert.ok(document.querySelector('#modais input[list]'));
});
test('Saúde: valor zero aparece como resultado e não traço',()=>{
 const {run,document}=setup();run("E.exames=[{id:'x',data:'2026-01-01',exame:'Teste',valor:0}];vSaude(document.getElementById('main'))");assert.match(document.querySelector('.saude-exame-valor').textContent,/0/);
});
test('Saúde: aguardando e unidade diferente não ganham faixa automática',()=>{
 const {run}=setup();assert.equal(run("semaforo({exame:'LDL',valor:200,resultado:'Aguardando'})"),'');assert.equal(run("semaforo({exame:'LDL',valor:2.5,unidade:'mmol/L'})"),'');
});
test('Saúde: exames em unidades diferentes não ganham variação percentual',()=>{
 const {run,document}=setup();run("E.exames=[{id:'a',exame:'LDL',data:'2026-01-01',valor:100},{id:'b',exame:'LDL',data:'2026-02-01',valor:2.5,unidade:'mmol/L'}];vSaude(document.getElementById('main'))");assert.match(document.querySelector('[data-bid="sa-ex"] tbody tr').textContent,/Sem comparação numérica/);
});
test('Saúde: data futura não transforma acompanhamento em realizado',()=>{
 const {run}=setup();run("E.perfil={nascimento:'1980-01-01'};E.exames=[{exame:'Dentista (limpeza)',data:'2099-01-01',resultado:'Aguardando'}]");assert.equal(run("rastreiosPendentes(true).find(x=>x.nome==='Dentista (limpeza)').situacao"),'Sem registro');
});
test('Ficha de emergência PDF inclui saúde e contatos, sem dados bancários',()=>{
 const {run}=setup();run("var pdfRotina='';window.open=()=>({document:{write:s=>pdfRotina=s,close(){}},print(){}});E.sos={alergias:'Teste alergia',contato1:'Contato de teste'};E.bancos=[{banco:'Banco secreto',conta:'123456789'}];E.patrimonio=[{nome:'Imóvel privado'}];imprimirSOS()");assert.match(run('pdfRotina'),/Teste alergia/);assert.match(run('pdfRotina'),/Contato de teste/);assert.doesNotMatch(run('pdfRotina'),/Banco secreto|123456789|Imóvel privado/);
});
test('Saúde: resultado informa a unidade do laudo, inclusive no celular',()=>{
 const {run,document}=setup();run("E.exames=[{id:'x',exame:'LDL',data:'2026-01-01',valor:2.5,unidade:'mmol/L'}];vSaude(document.getElementById('main'))");assert.match(document.querySelector('[data-bid="sa-ex"] tbody tr').textContent,/mmol\/L/);assert.doesNotMatch(document.querySelector('[data-bid="sa-ex"] tbody tr').textContent,/mg\/dL/);assert.match(document.querySelector('.saude-exame-valor').textContent,/mmol\/L/);
});
test('Saúde: resumo de peso abre o histórico de medidas',()=>{
 const {run,document}=setup();run("atual='saude';vSaude(document.getElementById('main'));organizarSaude(document.getElementById('main'));");document.querySelector('.rotina-saude-atalho').click();assert.equal(document.querySelector('#saude-medidas').hidden,false);
});
