/* Tarifas privadas em centavos. A simulação não cria lançamentos financeiros. */
const parcelasHoraAviao = [
  ['manutencao', 'Manutenção'],
  ['reservaMotor', 'Reserva para caixa de motor'],
  ['combustivel', 'Combustível'],
  ['oleo', 'Óleo lubrificante']
];

function tarifaHoraAviao(tarifas) {
  const custos = parcelasHoraAviao.map(([chave]) => tarifas?.horaCentavos?.[chave]);
  const intervalos = [tarifas?.pousoCentavos, tarifas?.hangaragemCentavos];
  const centavosValidos = valor => Number.isSafeInteger(valor) && valor >= 0;
  if (!custos.every(centavosValidos)) return null;
  if (!intervalos.every(faixa => Array.isArray(faixa) && faixa.length === 2 &&
    faixa.every(centavosValidos) && faixa[0] <= faixa[1])) return null;
  return custos.reduce((soma, custo) => soma + custo, 0);
}

function estimarVooAviao(tarifas, dados) {
  const hora = tarifaHoraAviao(tarifas);
  if (hora === null) return null;
  const inteiros = [dados.hIda, dados.mIda, dados.hVolta, dados.mVolta, dados.pousos, dados.pernoites, dados.extras];
  if (!inteiros.every(n => Number.isSafeInteger(n) && n >= 0) || dados.mIda > 59 || dados.mVolta > 59) return null;
  if (![dados.unitPouso, dados.unitHangar].every(n => n === null || (Number.isSafeInteger(n) && n >= 0))) return null;
  const minutos = (dados.hIda + dados.hVolta) * 60 + dados.mIda + dados.mVolta;
  if (!minutos || !Number.isSafeInteger(hora * minutos)) return null;
  const voo = Math.round(hora * minutos / 60);
  const porOcorrencia = (qtd, faixa, unitario) => faixa.map(n => qtd * (unitario ?? n));
  const pousos = porOcorrencia(dados.pousos, tarifas.pousoCentavos, dados.unitPouso);
  const hangar = porOcorrencia(dados.pernoites, tarifas.hangaragemCentavos, dados.unitHangar);
  const total = pousos.map((p, i) => voo + p + hangar[i] + dados.extras);
  return total.every(Number.isSafeInteger) ? {minutos, voo, pousos, hangar, total} : null;
}

function painelSimuladorAviao(container, cadastro) {
  const tarifas = cadastro.tarifasVoo;
  const hora = tarifaHoraAviao(tarifas);
  if (hora === null) {
    container.appendChild(el('<p class="aviao-contexto">As tarifas por hora e por ocorrência ainda precisam ser cadastradas para esta aeronave.</p>'));
    return;
  }
  const moeda = valor => brl(valor / 100);
  const faixa = valores => valores[0] === valores[1] ? moeda(valores[0]) : moeda(valores[0]) + ' a ' + moeda(valores[1]);
  const painel = el('<section class="aviao-simulador" aria-label="Simulador financeiro de viagem"></section>');
  const cabecalho = el('<header><h2>Simular viagem</h2><p>Informe os tempos previstos de voo e as cobranças da rota. O resultado mostra o custo da aeronave inteira.</p></header>');
  const ref = el('<details class="aviao-sim-ref"><summary></summary><dl></dl><p></p></details>');
  ref.querySelector('summary').textContent = moeda(hora) + ' por hora de voo · Ver composição';
  const linha = (dl, rotulo, valor) => {
    const dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = rotulo; dd.textContent = valor; dl.append(dt, dd);
  };
  const dl = ref.querySelector('dl');
  parcelasHoraAviao.forEach(([k, rotulo]) => linha(dl, rotulo, moeda(tarifas.horaCentavos[k]) + '/h'));
  linha(dl, 'Tarifa por pouso', faixa(tarifas.pousoCentavos));
  linha(dl, 'Hangaragem por atendimento ou pernoite', faixa(tarifas.hangaragemCentavos));
  ref.querySelector('p').textContent = tarifas.fonte ? 'Referência: ' + tarifas.fonte : 'Referência do cadastro da aeronave.';
  const form = el('<form class="aviao-sim-form" novalidate></form>');
  const campos = {};
  if (!filtro.aviaoSimulacao || filtro.aviaoSimulacao.matricula !== cadastro.matricula)
    filtro.aviaoSimulacao = {matricula: cadastro.matricula, pousos: '1', pernoites: '0'};
  const draft = filtro.aviaoSimulacao;
  function grupo(titulo, itens) {
    const fieldset = document.createElement('fieldset'), legend = document.createElement('legend');
    legend.textContent = titulo; fieldset.appendChild(legend);
    const grade = el('<div class="aviao-sim-grade"></div>');
    itens.forEach(([nome, rotulo, monetario, max]) => {
      const label = document.createElement('label'), inp = document.createElement('input');
      label.textContent = rotulo; inp.type = 'number'; inp.name = nome; inp.min = '0';
      inp.step = monetario ? '0.01' : '1'; inp.inputMode = monetario ? 'decimal' : 'numeric';
      if (max !== undefined) inp.max = String(max);
      inp.value = draft[nome] ?? ''; inp.placeholder = nome.startsWith('unit') ? 'Usar faixa' : '0';
      campos[nome] = inp; label.appendChild(inp); grade.appendChild(label);
    });
    fieldset.appendChild(grade); form.appendChild(fieldset);
  }
  grupo('Duração prevista de cada trecho', [
    ['hIda','Horas de ida'], ['mIda','Minutos de ida', false, 59],
    ['hVolta','Horas de volta'], ['mVolta','Minutos de volta', false, 59]
  ]);
  grupo('Despesas fora da hora de voo', [
    ['pousos','Pousos cobrados'], ['pernoites','Atendimentos / pernoites cobrados'],
    ['unitPouso','Valor cotado por pouso (R$)', true], ['unitHangar','Valor cotado por atendimento / pernoite (R$)', true],
    ['extras','Outras despesas da viagem (R$)', true]
  ]);
  form.appendChild(el('<p class="aviao-muted">Some os trechos com escalas nos tempos de ida e volta. Conte todos os pousos cobrados, inclusive no retorno. Se a tarifa já cobre atendimento e pernoite juntos, conte uma cobrança. Sem cotação, usamos a faixa de referência.</p>'));
  const resultado = el('<section class="aviao-sim-total" aria-live="polite" aria-atomic="true"><h3>Estimativa da viagem</h3><strong></strong><dl></dl></section>');
  const total = resultado.querySelector('strong'), linhas = resultado.querySelector('dl');
  function atualizar() {
    linhas.replaceChildren();
    const dados = {};
    for (const [nome, inp] of Object.entries(campos)) {
      draft[nome] = inp.value;
      if (inp.validity && !inp.validity.valid) { total.textContent = 'Confira os valores e use minutos de 0 a 59.'; return; }
      if (inp.step === '0.01') dados[nome] = inp.value === '' && nome.startsWith('unit') ? null : Math.round(Number(inp.value) * 100);
      else dados[nome] = Number(inp.value);
    }
    const calc = estimarVooAviao(tarifas, dados);
    if (!calc) { total.textContent = 'Informe a duração do voo para calcular.'; return; }
    total.textContent = faixa(calc.total);
    const duracao = Math.floor(calc.minutos / 60) + 'h' + String(calc.minutos % 60).padStart(2,'0');
    linha(linhas, 'Voo · ' + duracao, moeda(calc.voo));
    linha(linhas, 'Pousos · ' + dados.pousos, faixa(calc.pousos));
    linha(linhas, 'Hangaragem · ' + dados.pernoites, faixa(calc.hangar));
    linha(linhas, 'Outras despesas', moeda(dados.extras));
  }
  form.addEventListener('input', atualizar);
  form.addEventListener('submit', e => {e.preventDefault(); atualizar();});
  atualizar();
  painel.append(cabecalho, ref, form, resultado);
  container.appendChild(painel);
}
