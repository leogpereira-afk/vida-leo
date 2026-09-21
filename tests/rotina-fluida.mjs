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
test('Viagens: ordem cronológica de ida mantém canceladas no final e preserva origem',()=>{
 const {run,document}=setup();run("var viagensTeste=[{id:'ferias',evento:'Férias',ida:'2026-12-26',volta:'2027-01-03',status:'Confirmado'},{id:'agosto',evento:'Agosto',ida:'2026-08-12',volta:'2026-08-16',status:'Realizado'},{id:'setembro',evento:'Setembro',ida:'2026-09-15',volta:'2026-09-19',status:'Confirmado'},{id:'janeiro',evento:'Janeiro',ida:'2027-01-10',volta:'2027-01-12',status:'Em Planejamento'},{id:'cancelada',evento:'Cancelada',ida:'2026-02-01',volta:'2026-02-02',status:'Cancelado'},{id:'sem-data',evento:'Sem data'},{id:'invalida',evento:'Data inválida',ida:'2026-02-30'}];var viagensAntes=JSON.stringify(viagensTeste)");
 assert.equal(run("ordenarViagensRotina(viagensTeste).map(x=>x.id).join(',')"),'agosto,setembro,ferias,janeiro,sem-data,invalida,cancelada');
 assert.equal(run('JSON.stringify(viagensTeste)===viagensAntes'),true);
 run("filtro.viagensAno='todos';filtro.viagens='Todas';E.viagens=viagensTeste;vViagens(document.getElementById('main'))");
 const tabela=document.querySelector('[data-bid="vg-lista"]');
 const linhas=[...tabela.querySelectorAll('tbody tr')].map(l=>l.textContent);
 for(const [i,nome] of ['Agosto','Setembro','Férias','Janeiro','Sem data','Data inválida','Cancelada'].entries())assert.ok(linhas[i].includes(nome));
 assert.match(tabela.textContent,/Por data de ida, da mais antiga para a mais recente/);
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

/* O SELETOR DE LIGAÇÃO GRAVA O ID, NÃO O NOME.
   Consulta e sessão de fisioterapia são os dois únicos campos do app cujas
   opções são {v,t} -- valor é o id da queixa, texto é o nome dela. Até
   21/09/2026 o formulário montava as opções com esc() direto sobre o objeto,
   e as duas saíam "[object Object]", com o mesmo valor: não dava para ligar
   nada pelo botão "+ Adicionar", só editando a célula da tabela depois. */
function escolher(form, nome, valor) {
  const c = form.querySelector('[name="' + nome + '"]');
  assert.ok(c, 'campo ' + nome);
  /* Num <select> deste ajudante de DOM, `value` é só de leitura: quem manda é
     o atributo `selected` da opção, e o getter responde a partir dele. Num
     <input> é o contrário, e `.options` nem existe. */
  if (c.tagName === 'SELECT') {
    const o = [...(c.querySelectorAll('option'))].find(o => o.getAttribute('value') === valor);
    assert.ok(o, 'não há opção com valor ' + valor + ' em ' + nome);
    for (const outra of c.querySelectorAll('option')) outra.removeAttribute('selected');
    o.setAttribute('selected', '');
  } else {
    c.value = valor;
  }
  return c;
}

for (const [tipo, lista, rotulo, obrig] of [
  ['consultas', 'consultas', 'consulta', 'especialidade'],
  ['fisio', 'fisio', 'sessão de fisioterapia', 'oque'],
]) {
  test(`entrada: ${rotulo} guarda o ID da queixa escolhida no botão de adicionar`, () => {
    const {run, document} = setup();
    run("E.queixas=[{id:'q1',oque:'Dor no ombro',data:'2026-03-12'},{id:'q2',oque:'Enxaqueca',data:'2026-05-02'}];novoCuidadoRotina('" + tipo + "')");
    const form = document.querySelector('.rotina-form');
    const sel = form.querySelector('[name="queixaId"]');
    assert.ok(sel, 'o campo de ligação tem de existir no formulário');
    assert.doesNotMatch(sel.innerHTML, /\[object Object\]/, 'a opção virou [object Object]: o id da queixa não chega ao value');

    /* NÃO BASTA O HTML SAIR CERTO -- o que importa é o id CHEGAR ao registro
       gravado. Um seletor bonito que grava vazio não liga nada. O ajudante de
       DOM daqui simula a seleção de <select> (é o que tests/financeiro-fluido
       já faz), então dá para conferir de ponta a ponta. */
    escolher(form, obrig, 'Teste');
    escolher(form, 'queixaId', 'q2');
    form.onsubmit({preventDefault() {}});
    assert.equal(run(`E.${lista}.length`), 1, 'o registro não foi gravado');
    assert.equal(run(`E.${lista}[0].queixaId`), 'q2', 'a queixa escolhida não chegou ao registro');
  });

  /* A lista da tabela rotula "Dor no ombro · desde 12/03"; a do formulário
     rotulava só "Dor no ombro". Duas queixas com o mesmo nome -- a dor que
     voltou, que é o motivo de a queixa ter data -- ficavam indistinguíveis
     na hora de criar o registro. Uma lista só, nos dois lugares. */
  test(`entrada: ${rotulo} distingue duas queixas de mesmo nome pela data`, () => {
    const {run, document} = setup();
    run("E.queixas=[{id:'q1',oque:'Dor no ombro',data:'2026-03-12'},{id:'q2',oque:'Dor no ombro',data:'2026-09-15'}];novoCuidadoRotina('" + tipo + "')");
    const html = document.querySelector('.rotina-form [name="queixaId"]').innerHTML;
    assert.match(html, /12\/03/, 'falta a data que separa uma queixa da outra');
    assert.match(html, /15\/09/);
  });
}

/* OPÇÃO QUE O DONO APAGOU NÃO VOLTA NUM REGISTRO NOVO.
   `opcoesSelect` preserva valor fora da lista de propósito -- em registro
   SALVO, sumir com a escolha do dono seria apagar dado. Mas em registro NOVO
   o valor é só o padrão embutido no código: quando o conserto de 21/09/2026
   passou o formulário a usar essa função, "Trabalho" -- apagado dos Tipos de
   viagem nas Configurações -- voltava à lista E já vinha marcado. */
test('entrada: tipo apagado das Configurações não ressuscita em registro novo', () => {
  const {run, document} = setup();
  run("E.config=E.config||{};E.config.tiposViagem=['Família','Casal','Amigos'];novaViagemRotina()");
  const sel = document.querySelector('.rotina-form [name="tipo"]');
  const valores = [...sel.querySelectorAll('option')].map(o => o.getAttribute('value'));
  assert.deepEqual(valores, ['Família', 'Casal', 'Amigos'], 'voltou opção que o dono apagou');
  assert.doesNotMatch(sel.innerHTML, /selected/, 'uma opção apagada não pode vir marcada');
});

/* E o outro lado: em registro SALVO o valor fora da lista continua à vista,
   senão o conserto acima vira apagador silencioso. */
test('campos: valor gravado fora da lista continua aparecendo em registro salvo', () => {
  const {run} = setup();
  const html = run("opcoesSelect(['Família','Casal'],'Trabalho')");
  assert.match(html, /value="Trabalho"/, 'o valor gravado sumiu da lista');
  assert.match(html, /selected/);
});
