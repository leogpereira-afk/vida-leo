import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers/dom.mjs';

const tick = () => new Promise(resolve => setImmediate(resolve));
const button = (root,name) => [...root.querySelectorAll('button')].find(item => item.textContent === name);
const card = (app,name) => [...app.document.querySelectorAll('.holding-cartao')].find(item => item.querySelector('h3').textContent === name);

function app(imoveis) {
  const a = setup();
  a.ctx.imoveisTeste = structuredClone(imoveis);
  a.run(`
    let sequenciaTeste = 0;
    const apiHoldingTeste = {
      listar: () => imoveisTeste,
      novoId: () => 'registro-teste-' + ++sequenciaTeste,
      hoje: () => '2026-11-06',
      abrirAviao: () => irTela('aviao'),
      abrirImoveis: () => irTela('universo-imoveis'),
      abrirResumo: () => irTela('universo-holding'),
      gravarSerie: async (id,dados) => { imoveisTeste = HoldingModelo.gravarSerie(imoveisTeste,id,dados); },
      editarParcela: async (id,dados) => { imoveisTeste = HoldingModelo.editarParcela(imoveisTeste,id,dados); },
      pagarParcela: async (id,parcelaId) => { imoveisTeste = HoldingModelo.pagarParcela(imoveisTeste,id,parcelaId,'2026-11-06'); },
      gravarDespesa: async (id,dados) => { imoveisTeste = HoldingModelo.gravarDespesa(imoveisTeste,id,dados); },
      pagarDespesa: async (id,despesaId) => { imoveisTeste = HoldingModelo.pagarDespesa(imoveisTeste,id,despesaId,'2026-11-06'); },
      gravarImovel: async dados => { imoveisTeste = HoldingModelo.salvarImovel(imoveisTeste,dados); },
      gravarPagamento: async (id,dados) => { imoveisTeste = HoldingModelo.salvarPagamento(imoveisTeste,id,dados); }
    };
    HoldingUI.render(document.getElementById('main'),apiHoldingTeste);
  `);
  return a;
}
function alterar(a,campo,valor) {
  const input = a.document.querySelector(`.holding-form [name="${campo}"]`);
  input.value = valor;
  input.dispatchEvent(new a.document.defaultView.Event('input',{bubbles:true}));
}
async function salvar(a) {
  a.document.querySelector('.holding-form').dispatchEvent(new a.document.defaultView.Event('submit',{bubbles:true,cancelable:true}));
  await tick();
}
function imovel(id,nome,totalCentavos = null) { return { id,nome,totalCentavos,pagamentos:[] }; }

test('Cadastro com valor pendente apresenta ação para informar aquisição e preserva o nome como texto', async () => {
  const a = app([]);
  assert.equal(a.document.querySelectorAll('button[aria-label="Abrir avião"]').length,1);
  button(a.document,'+ Cadastrar imóvel').click();
  alterar(a,'nome','Sala de teste <img src=x>');
  await salvar(a);
  const item = card(a,'Sala de teste <img src=x>');
  assert.equal(item.querySelector('img'),null);
  assert.equal(item.querySelector('progress'),null);
  assert.ok(button(item,'Informar valor'));
  assert.match(item.textContent,/A informar/);
  button(item,'Informar valor').click();
  alterar(a,'total','1.000,00');
  await salvar(a);
  assert.equal(a.ctx.imoveisTeste[0].totalCentavos,100000);
  assert.equal(card(a,'Sala de teste <img src=x>').querySelector('.holding-status').textContent,'Em pagamento');
});

test('Cada lançamento pertence ao imóvel escolhido, persiste no histórico e a correção quita sem duplicar a parcela', async () => {
  const a = app([imovel('sala-a','Sala A',10000),imovel('sala-b','Sala B',20000)]);
  button(card(a,'Sala B'),'Plano').click();
  card(a,'Sala B').querySelector('.holding-historico').open=true;
  button(card(a,'Sala B'),'Lançar pagamento manual').click();
  alterar(a,'valor','50,00');
  alterar(a,'descricao','Entrada sintética');
  await salvar(a);
  assert.equal(a.ctx.imoveisTeste[0].pagamentos.length,0);
  assert.equal(a.ctx.imoveisTeste[1].pagamentos.length,1);
  const id = a.ctx.imoveisTeste[1].pagamentos[0].id;
  assert.match(card(a,'Sala B').textContent,/25%/);
  a.run("HoldingUI.render(document.getElementById('main'),apiHoldingTeste)");
  button(card(a,'Sala B'),'Plano').click();
  const historico = card(a,'Sala B').querySelector('.holding-historico');
  historico.open = true;
  assert.match(historico.textContent,/06\/11\/2026/);
  assert.match(historico.textContent,/Entrada sintética/);
  button(historico,'Corrigir').click();
  alterar(a,'valor','200,00');
  await salvar(a);
  const registro = a.ctx.imoveisTeste[1];
  assert.equal(registro.pagamentos.length,1);
  assert.equal(registro.pagamentos[0].id,id);
  assert.equal(registro.pagamentos[0].valorCentavos,20000);
  assert.equal(card(a,'Sala B').querySelector('.holding-status').textContent,'Quitado');
  assert.equal(button(card(a,'Sala B'),'Lançar pagamento manual'),undefined);
});

test('Erro mantém os campos para corrigir e um envio repetido enquanto a gravação espera cria uma única parcela', async () => {
  const a = app([imovel('sala','Sala',10000)]);
  const grava = a.run('apiHoldingTeste.gravarPagamento');
  let chamadas = 0, liberar;
  a.ctx.gravarComAtraso = async (...args) => {
    chamadas++;
    if (chamadas === 1) throw Error('Valor alterado em outro acesso');
    await new Promise(resolve => { liberar=resolve; });
    return grava(...args);
  };
  a.run('apiHoldingTeste.gravarPagamento = gravarComAtraso');
  button(card(a,'Sala'),'Plano').click();
  card(a,'Sala').querySelector('.holding-historico').open=true;
  button(card(a,'Sala'),'Lançar pagamento manual').click();
  const form = a.document.querySelector('.holding-form');
  assert.equal(form.hasAttribute('data-holding-rascunho'),false);
  alterar(a,'valor','25,00');
  alterar(a,'descricao','Lançamento a preservar');
  assert.equal(form.hasAttribute('data-holding-rascunho'),true);
  await salvar(a);
  assert.equal(a.document.querySelector('.holding-form'),form);
  assert.equal(form.querySelector('[name="descricao"]').value,'Lançamento a preservar');
  assert.match(form.querySelector('[role="alert"]').textContent,/outro acesso/);
  assert.equal(a.document.querySelector('.holding-feedback'),null,'Erro de gravação não produz mensagem de sucesso');
  await salvar(a);
  await salvar(a);
  assert.equal(chamadas,2);
  liberar();
  await tick();
  assert.equal(a.document.querySelector('.holding-form'),null);
  assert.equal(a.ctx.imoveisTeste[0].pagamentos.length,1);
});

test('Edição usa a base da abertura, recuperar dados atuais ao cancelar não aplica o rascunho', async () => {
  const a = app([imovel('sala','Sala anterior',20000)]);
  a.ctx.gravarEmConflito = async (dados,base) => {
    assert.equal(base.nome,'Sala anterior');
    assert.equal(dados.nome,'Minha alteração');
    throw Error('Conflito de edição');
  };
  a.run('apiHoldingTeste.gravarImovel = gravarEmConflito');
  button(card(a,'Sala anterior'),'Sala anterior').click();
  alterar(a,'nome','Minha alteração');
  a.ctx.imoveisTeste[0].nome = 'Nome visto no servidor';
  a.document.querySelector('dialog').dataset.holdingAtualizar = '1';
  await salvar(a);
  assert.match(a.document.querySelector('[role="alert"]').textContent,/Conflito de edição/);
  assert.equal(a.document.querySelector('.holding-feedback'),null,'Conflito de edição não confirma salvamento');
  assert.equal(a.document.querySelector('.holding-form [name="nome"]').value,'Minha alteração');
  button(a.document.querySelector('dialog'),'Cancelar').click();
  assert.ok(card(a,'Nome visto no servidor'));
  assert.equal(a.document.querySelector('dialog'),null);
});

function selecionarTipo(a,tipo) {
  const campo=a.document.querySelector('.holding-form select[name="tipo"]');
  [...campo.querySelectorAll('option')].find(option=>option.value===tipo).selected=true;
  campo.dispatchEvent(new a.document.defaultView.Event('change',{bubbles:true}));
}
async function confirmarPago(a,form) {
  const check=form.querySelector('input[type=checkbox]');
  check.checked=true;check.dispatchEvent(new a.document.defaultView.Event('change',{bubbles:true}));
  await tick();
}

test('O plano organiza parcelas mensais e a baixa de uma linha atualiza o percentual somente uma vez',async()=>{
  const a=app([imovel('sala','Sala',10000)]);
  button(card(a,'Sala'),'Plano').click();
  button(card(a,'Sala'),'+ Lançamento').click();
  const opcoes=[...a.document.querySelectorAll('.holding-form select option')].map(opt=>opt.textContent);
  assert.deepEqual(opcoes,['Parcela de aquisição','Investimento no imóvel','Condomínio','Impostos']);
  alterar(a,'descricao','Prestação');alterar(a,'valor','30,00');alterar(a,'vencimento','2026-01-31');alterar(a,'quantidade','2');
  await salvar(a);
  const ficha=()=>card(a,'Sala');
  const linhas=()=>[...ficha().querySelectorAll('.holding-compromisso')];
  assert.equal(linhas().length,2);assert.match(linhas()[1].textContent,/28\/02\/2026/);
  for(const [i,linha] of linhas().entries()) {
    const vencimento=i===0?'31/01/2026':'28/02/2026';
    for(const btn of [linha.querySelector('input[type=checkbox]'),button(linha,'Editar')]) {
      const label=btn.getAttribute('aria-label');
      assert.ok(label.includes(`parcela ${i+1} de 2`));
      assert.ok(label.includes(vencimento));
      assert.ok(label.includes('30,00'));
    }
  }
  const baixar=linhas()[0].querySelector('.holding-baixa');
  await Promise.all([confirmarPago(a,baixar),confirmarPago(a,baixar)]);
  assert.equal(a.ctx.imoveisTeste[0].pagamentos.length,1);assert.match(ficha().querySelector('.holding-linha').textContent,/30%/);
  assert.equal(linhas()[0].querySelector('.holding-mensal-c5').textContent,'06/11/2026');
  assert.equal(linhas()[0].querySelector('.holding-mensal-status').textContent,'Pago');
  linhas()[0].querySelector('.holding-ver-pago').click();
  assert.match(ficha().querySelector('.holding-dados-baixa').textContent,/06\/11\/2026/);
  assert.equal(a.ctx.imoveisTeste[0].pagamentos.length,1);
  assert.equal(button(ficha().querySelector('.holding-historico'),'Corrigir'),undefined);
  button(linhas()[1],'Editar').click();alterar(a,'valor','40,00');await salvar(a);
  assert.match(linhas()[1].textContent,/40,00/);assert.match(ficha().querySelector('.holding-linha').textContent,/30%/);
});

test('Condomínio incompleto permite cadastrar sem data, completar o valor e baixar como despesa fora da aquisição',async()=>{
  const a=app([imovel('sala','Sala',90000)]), ficha=()=>card(a,'Sala');
  button(ficha(),'Despesas').click();button(ficha(),'+ Despesa avulsa').click();
  selecionarTipo(a,'condominio');alterar(a,'descricao','Condomínio de teste');
  await salvar(a);
  let item=ficha().querySelector('.holding-compromisso');
  assert.match(item.textContent,/Condomínio/);assert.match(item.textContent,/Valor a informar/);
  assert.equal(item.querySelector('.holding-pago').disabled,true);assert.equal(a.ctx.imoveisTeste[0].despesas[0].vencimento,null);
  button(item,'Editar').click();alterar(a,'valor','45,00');await salvar(a);
  item=ficha().querySelector('.holding-compromisso');assert.equal(item.querySelector('.holding-pago').disabled,false);
  await confirmarPago(a,item.querySelector('.holding-baixa'));
  assert.match(ficha().querySelector('.holding-tipostotal').textContent,/Condomínio.*45,00/);
  assert.equal(a.ctx.imoveisTeste[0].despesas[0].pagoEm,'2026-11-06');assert.equal(a.ctx.imoveisTeste[0].pagamentos.length,0);
  assert.match(ficha().querySelector('.holding-linha').textContent,/0%/);
});

test('Imposto iniciado no plano aparece em despesas, e trocar o painel preserva um lançamento em edição',async()=>{
  const a=app([imovel('sala','Sala',20000)]), ficha=()=>card(a,'Sala');
  button(ficha(),'Plano').click();button(ficha(),'+ Lançamento').click();
  selecionarTipo(a,'impostos');alterar(a,'descricao','Taxa sintética');alterar(a,'valor','20,00');
  button(ficha(),'Despesas').click();assert.equal(a.document.querySelector('[name="descricao"]').value,'Taxa sintética');
  assert.match(a.document.querySelector('[role="alert"]').textContent,/Salve ou cancele/);
  await salvar(a);
  assert.equal(button(ficha(),'Despesas').getAttribute('aria-expanded'),'true');
  assert.equal(a.ctx.imoveisTeste[0].despesas[0].tipo,'impostos');assert.match(ficha().querySelector('.holding-tipostotal').textContent,/Impostos.*20,00/);
});

function filtrar(a,ficha,nome,valor) {
  const select=ficha.querySelector(`select[name="holding-${nome}"]`);
  [...select.querySelectorAll('option')].find(o=>o.value===valor).selected=true;
  select.dispatchEvent(new a.document.defaultView.Event('change',{bubbles:true}));
}
function totaisResumo(ficha) {
  return Object.fromEntries([...ficha.querySelectorAll('.holding-controle-total > button')].map(g=>[g.querySelector('small').textContent,g.querySelector('strong').textContent.replace(/\s/g,' ')]));
}

test('Filtros de mês e natureza recalculam valores e status das linhas, mantendo datas reais e valores a informar',async()=>{
  const propriedade=imovel('sala','Sala',100000);
  const despesa=(id,tipo,valorCentavos,vencimento,pagoEm=null)=>({id,descricao:id,tipo,valorCentavos,vencimento,pagoEm});
  propriedade.despesas=[
    despesa('antiga','condominio',6000,'2026-11-05'),
    despesa('hoje','condominio',2000,'2026-11-06'),
    despesa('recebida','condominio',2000,'2026-11-12','2026-11-02'),
    despesa('futura','impostos',50000,'2026-12-08'),
    despesa('incompleta','investimento',null,null)
  ];
  const a=app([propriedade]),ficha=()=>card(a,'Sala');button(ficha(),'Despesas').click();
  const linhas=()=>[...ficha().querySelectorAll('.holding-compromisso')];
  assert.deepEqual(new Set(linhas().map(l=>l.dataset.situacao)),new Set(['Em atraso','Vence hoje','Pago','A vencer','Vencimento a informar']));
  assert.match(totaisResumo(ficha())['Total previsto'],/600,00.*1 a informar/);
  assert.equal(totaisResumo(ficha())['% quitado'],'A informar');
  assert.equal(linhas().find(l=>l.dataset.situacao==='Pago').querySelector('.holding-mensal-c5').textContent,'02/11/2026');
  filtrar(a,ficha(),'tipo','condominio');filtrar(a,ficha(),'mes','2026-11');
  assert.equal(linhas().length,3);
  assert.deepEqual(totaisResumo(ficha()),{'Total previsto':'R$ 100,00','Total pago':'R$ 20,00','Total pendente':'R$ 80,00','% quitado':'20%'});
  const venceHoje=linhas().find(l=>l.dataset.situacao==='Vence hoje');
  await confirmarPago(a,venceHoje.querySelector('form'));
  assert.deepEqual(totaisResumo(ficha()),{'Total previsto':'R$ 100,00','Total pago':'R$ 40,00','Total pendente':'R$ 60,00','% quitado':'40%'});
  assert.equal(ficha().querySelector('[name="holding-tipo"]').value,'condominio');
  filtrar(a,ficha(),'tipo','investimento');filtrar(a,ficha(),'mes','sem');
  assert.equal(linhas().length,1);assert.equal(totaisResumo(ficha())['% quitado'],'A informar');
  assert.equal(linhas()[0].querySelector('.holding-pago').disabled,true);
  filtrar(a,ficha(),'tipo','impostos');
  assert.equal(linhas().length,0);assert.equal(totaisResumo(ficha())['% quitado'],'A informar');
});

test('Controle mensal do plano soma só parcelas vinculadas e deixa os pagamentos manuais no histórico da aquisição',()=>{
  const propriedade=imovel('sala','Sala',100000);
  propriedade.parcelas=[{id:'prev1',descricao:'Parcela identificada',valorCentavos:40000,vencimento:'2026-10-31'}];
  propriedade.pagamentos=[{id:'manual',descricao:'Entrada independente',valorCentavos:20000,data:'2026-10-02'},
    {id:'confirmado',parcelaId:'prev1',descricao:'Parcela identificada',valorCentavos:40000,data:'2026-10-29'}];
  const a=app([propriedade]),ficha=card(a,'Sala');button(ficha,'Plano').click();
  assert.deepEqual(totaisResumo(card(a,'Sala')),{'Total previsto':'R$ 400,00','Total pago':'R$ 400,00','Total pendente':'R$ 0,00','% quitado':'100%'});
  assert.equal(card(a,'Sala').querySelectorAll('.holding-compromisso').length,1);
  assert.match(card(a,'Sala').querySelector('.holding-historico').textContent,/Entrada independente/);
});

test('Falha na baixa desmarca a caixa e preserva o pendente; mudar o recorte não descarta formulário aberto',async()=>{
  const propriedade=imovel('sala','Sala',50000);
  propriedade.parcelas=[{id:'jan',descricao:'Mensal',valorCentavos:10000,vencimento:'2026-01-05'}];
  const a=app([propriedade]),ficha=()=>card(a,'Sala');button(ficha(),'Plano').click();
  a.run('apiHoldingTeste.pagarParcela = async()=>{ throw Error("Baixa conflitante"); }');
  const form=ficha().querySelector('.holding-baixa');await confirmarPago(a,form);
  assert.match(form.querySelector('[role="alert"]').textContent,/conflitante/);
  assert.equal(form.querySelector('input').checked,false);assert.equal(form.querySelector('input').disabled,false);
  assert.equal(totaisResumo(ficha())['Total pendente'],'R$ 100,00');
  button(ficha(),'+ Lançamento').click();alterar(a,'descricao','Manter meu rascunho');
  filtrar(a,ficha(),'mes','2026-01');
  assert.equal(ficha().querySelector('[name="holding-mes"]').value,'todos');
  assert.equal(ficha().querySelector('.holding-form [name="descricao"]').value,'Manter meu rascunho');
});

function arquivoDoTeste(a,banco) {
  a.ctx.arquivosTeste=banco;
  a.run(`
    globalThis.consultasAnexoTeste=[];
    arqGravarLocal=async reg=>{arquivosTeste.set(reg.id,reg);return reg;};
    arqPorLocal=async id=>arquivosTeste.get(id)||null;
    arqPor=async ref=>{consultasAnexoTeste.push(ref);return [...arquivosTeste.values()].filter(a=>a.ref===ref).map(a=>({...a,pendente:true}));};
    arqDel=async()=>{throw Error('Um anexo não pode ser removido neste ensaio.');};
  `);
}
function botaoAnexo(a,descricao) {
  return [...a.document.querySelectorAll('.holding-anexos-abrir')].find(b=>b.getAttribute('aria-label').startsWith(`Boleto e comprovantes: ${descricao},`));
}

test('Boleto fica vinculado à mesma despesa depois de editar, baixar e recarregar; o download conserva os bytes',async()=>{
  const propriedade=imovel('imovel-teste','Imóvel com despesas',40000);
  propriedade.despesas=[{id:'conta:2',tipo:'impostos',descricao:'Taxa sintética',vencimento:'2026-11-08',valorCentavos:2000,pagoEm:null}];
  propriedade.parcelas=[{id:'conta:2',descricao:'Parcela de teste',vencimento:'2026-11-09',valorCentavos:4000}];
  const a=app([propriedade]),banco=new Map();arquivoDoTeste(a,banco);
  const ficha=()=>card(a,propriedade.nome);button(ficha(),'Despesas').click();
  assert.equal(a.ctx.consultasAnexoTeste.length,0);
  botaoAnexo(a,'Taxa sintética').click();await tick();
  const ref=a.run("HoldingUI.refAnexos('imovel-teste','despesa','conta:2')");
  assert.deepEqual([...a.ctx.consultasAnexoTeste],[ref]);
  const antes=JSON.stringify(a.ctx.imoveisTeste);
  const bytes='%PDF-1.4\n% Arquivo sintético para testar integridade.\n%%EOF\n';
  const pdf=new Blob([bytes],{type:'application/pdf'});Object.defineProperty(pdf,'name',{value:'boleto-de-teste.pdf'});
  const input=a.document.querySelector('.holding-anexos input[type="file"]');
  Object.defineProperty(input,'files',{value:[pdf]});input.onchange();await tick();
  assert.equal(banco.size,1);assert.equal([...banco.values()][0].ref,ref);
  assert.match(a.document.querySelector('.holding-anexos').textContent,/boleto-de-teste.pdf/);
  assert.match(a.document.querySelector('.holding-anexos').textContent,/neste aparelho/);
  assert.equal(JSON.stringify(a.ctx.imoveisTeste),antes);
  botaoAnexo(a,'Taxa sintética').click();
  button(ficha().querySelector('.holding-compromisso'),'Editar').click();alterar(a,'descricao','Taxa revisada');await salvar(a);
  await confirmarPago(a,ficha().querySelector('.holding-baixa'));
  assert.equal(a.ctx.imoveisTeste[0].despesas[0].valorCentavos,2000);
  assert.equal(a.ctx.imoveisTeste[0].pagamentos.length,0);
  const b=app(a.ctx.imoveisTeste);arquivoDoTeste(b,banco);const restaurado=()=>card(b,propriedade.nome);
  button(restaurado(),'Plano').click();botaoAnexo(b,'Parcela de teste').click();await tick();
  assert.match(b.document.querySelector('.holding-anexos').textContent,/Nenhum arquivo/);
  button(restaurado(),'Despesas').click();botaoAnexo(b,'Taxa revisada').click();await tick();
  assert.equal(b.ctx.consultasAnexoTeste.at(-1),ref);assert.match(b.document.querySelector('.holding-anexos').textContent,/boleto-de-teste.pdf/);
  let capturado;
  b.document.addEventListener('click',ev=>{if(ev.target.download) capturado=ev.target.href;});
  await b.document.querySelector('.holding-anexos a.baixar').onclick({preventDefault(){}});
  assert.match(capturado,/^blob:/);assert.equal(await (await fetch(capturado)).text(),bytes);URL.revokeObjectURL(capturado);
});

test('Referências de anexo separam imóveis, séries, tipos e IDs importados com caracteres especiais',()=>{
  const a=app([]),ref=a.ctx.HoldingUI.refAnexos;
  assert.notEqual(ref('a:despesa:b','despesa','c'),ref('a','despesa','b:despesa:c'));
  assert.notEqual(ref('a','despesa','x_3a_y'),ref('a','despesa','x:y'));
  assert.notEqual(ref('a','despesa','x'),ref('b','despesa','x'));
  assert.notEqual(ref('a','parcela','x'),ref('a','despesa','x'));
  assert.doesNotMatch(ref('a/b','parcela','série:2'),/\//);
  assert.throws(()=>ref('a','despesa',''),/Salve o lançamento/);
});

test('Histórico mostra o mesmo boleto da parcela quitada e separa o comprovante de um pagamento manual',async()=>{
  const propriedade=imovel('imovel-anexos','Sala do ensaio',50000);
  propriedade.parcelas=[{id:'linha',descricao:'Mensal do ensaio',vencimento:'2026-11-15',valorCentavos:1000}];
  propriedade.pagamentos=[{id:'linha',descricao:'Entrada de teste',data:'2026-11-01',valorCentavos:3000}];
  const a=app([propriedade]), banco=new Map();arquivoDoTeste(a,banco);
  const ficha=()=>card(a,propriedade.nome);button(ficha(),'Plano').click();
  const pdf=new Blob(['%PDF-1.4\n% sintético\n%%EOF\n'],{type:'application/pdf'});
  Object.defineProperty(pdf,'name',{value:'parcela-teste.pdf'});
  botaoAnexo(a,'Mensal do ensaio').click();await tick();
  const input=a.document.querySelector('.holding-anexos input[type=file]');
  Object.defineProperty(input,'files',{value:[pdf]});input.onchange();await tick();
  const refParcela=a.run("HoldingUI.refAnexos('imovel-anexos','parcela','linha')");
  assert.equal([...banco.values()][0].ref,refParcela);
  await confirmarPago(a,ficha().querySelector('.holding-baixa'));
  const historico=ficha().querySelector('.holding-historico');historico.open=true;
  const itemHist=descricao=>[...historico.querySelectorAll('li')].find(li=>li.querySelector('.holding-parcela-ref')?.textContent.includes(descricao));
  const vinculado=itemHist('Mensal do ensaio');button(vinculado,'Boleto e comprovantes').click();await tick();
  assert.equal(a.ctx.consultasAnexoTeste.at(-1),refParcela);assert.match(vinculado.querySelector('.holding-anexos').textContent,/parcela-teste.pdf/);
  const manual=itemHist('Entrada de teste');button(manual,'Boleto e comprovantes').click();await tick();
  const refManual=a.run("HoldingUI.refAnexos('imovel-anexos','pagamento','linha')");
  assert.equal(a.ctx.consultasAnexoTeste.at(-1),refManual);assert.notEqual(refManual,refParcela);
  assert.match(manual.querySelector('.holding-anexos').textContent,/Nenhum arquivo/);
  const comp=new Blob(['PDF do pagamento de teste'],{type:'application/pdf'});Object.defineProperty(comp,'name',{value:'comprovante-manual.pdf'});
  const anexoManual=manual.querySelector('input[type=file]');Object.defineProperty(anexoManual,'files',{value:[comp]});anexoManual.onchange();await tick();
  button(manual,'Corrigir').click();alterar(a,'descricao','Entrada corrigida');await salvar(a);
  const b=app(a.ctx.imoveisTeste);arquivoDoTeste(b,banco);
  button(card(b,propriedade.nome),'Plano').click();b.document.querySelector('.holding-historico').open=true;
  botaoAnexo(b,'Entrada corrigida').click();await tick();
  assert.match(b.document.querySelector('.holding-anexos').textContent,/comprovante-manual.pdf/);
  assert.doesNotMatch(b.document.querySelector('.holding-anexos').textContent,/parcela-teste.pdf/);
  assert.equal(banco.size,2);
});

test('Agendamento em despesa em aberto é independente do vencimento, da baixa e de seus anexos',async()=>{
  const propriedade=imovel('imovel-agenda','Sala com agendamento',50000);
  propriedade.despesas=[{id:'conta',descricao:'Despesa do ensaio',tipo:'condominio',valorCentavos:1000,vencimento:'2026-11-15',pagoEm:null}];
  const a=app([propriedade]), ficha=()=>card(a,propriedade.nome);button(ficha(),'Despesas').click();
  button(ficha(),'+ Despesa avulsa').click();assert.equal(a.document.querySelector('[name=agendadoPara]'),null);button(a.document.querySelector('.holding-form'),'Cancelar').click();
  button(ficha().querySelector('.holding-compromisso'),'Editar').click();alterar(a,'agendadoPara','2026-11-05');await salvar(a);
  let linha=ficha().querySelector('.holding-compromisso');assert.equal(linha.dataset.situacao,'A vencer');
  assert.equal(linha.querySelector('.holding-pago').checked,false);assert.match(linha.textContent,/Agendado para 05\/11\/2026/);
  assert.equal(linha.querySelector('.holding-mensal-c2').textContent,'15/11/2026');assert.equal(linha.querySelector('.holding-mensal-c5').textContent,'—');
  assert.equal(a.ctx.imoveisTeste[0].despesas[0].pagoEm,null);assert.equal(totaisResumo(ficha())['Total pendente'],'R$ 10,00');
  await confirmarPago(a,linha.querySelector('.holding-baixa'));linha=ficha().querySelector('.holding-compromisso');
  assert.equal(linha.dataset.situacao,'Pago');assert.doesNotMatch(linha.textContent,/Agendado para/);assert.equal(linha.querySelector('.holding-mensal-c5').textContent,'06/11/2026');
});
