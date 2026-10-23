/* Tratamentos: organização pessoal de prescrições, sem inferir dose ou conduta. */
const SaudeTratamentos = (() => {
  const ativo=t=>['Em andamento','Contínuo'].includes(t.status);
  const controlaEstoque=t=>!!String(t.unidade||'').trim();
  const numero=v=>v!==''&&v!=null&&Number.isFinite(Number(v))?Number(v):null;
  const formatarNumero=v=>numero(v)===null?'Não informado':numero(v).toLocaleString('pt-BR',{maximumSignificantDigits:21});
  const numeroCampo=v=>numero(v)===null?'':String(numero(v));
  const unidadeExibida=u=>/^(?:un|und|unidades?)\.?$/i.test(String(u||'').trim())?'und':String(u||'').trim();
  function saldo(t){
    if((numero(t.estoqueInicial)===null&&!(t.compras||[]).length)||(t.compras||[]).some(c=>numero(c.quantidade)===null))return null;
    return +(Number(t.estoqueInicial||0)+(t.compras||[]).reduce((s,c)=>s+Number(c.quantidade||0),0)-(t.usos||[]).filter(u=>!u.desfeitoEm).reduce((s,u)=>s+Number(u.quantidade||0),0)).toFixed(4);
  }
  function alertaReposicao(t){
    const n=saldo(t),q=numero(t.consumoPorCiclo),limite=numero(t.alertaEstoque),usosRestantes=n!==null&&q>0?Math.floor(n/q):null;
    if(!controlaEstoque(t))return{nivel:'pendente',rotulo:'Sem controle',texto:'Defina a unidade e a quantidade disponível em Editar para acompanhar a reposição.',usosRestantes:null};
    if(n===null)return{nivel:'pendente',rotulo:'Não informado',texto:'Quantidade disponível a confirmar. Complete a quantidade comprada ou o estoque inicial.',usosRestantes:null};
    if(n<=0)return{nivel:'critico',rotulo:'Sem estoque',texto:'Sem estoque disponível. Registre a reposição quando a compra for recebida.',usosRestantes:0};
    const baixo=limite!==null?n<=limite:usosRestantes!==null&&usosRestantes<=3;
    const detalhe=formatarNumero(n)+' '+unidadeExibida(t.unidade)+(usosRestantes!==null?' · '+usosRestantes+' uso(s) completo(s) na quantidade cadastrada':'');
    return{nivel:baixo?'atencao':'ok',rotulo:baixo?'Comprar mais':'Disponível',texto:(baixo?'Estoque baixo: ':'Saldo disponível: ')+detalhe+'.'+(baixo?(limite!==null?' Limite de aviso cadastrado: '+formatarNumero(limite)+' '+unidadeExibida(t.unidade)+'.':' Aviso padrão: até 3 usos; ajuste o limite em Editar.') :''),usosRestantes};
  }
  function estoque(t){return alertaReposicao(t).rotulo}

  function registrarUso(t,uso){
    if(!ativo(t))throw Error('Confirme o tratamento e deixe-o em andamento antes de registrar o uso.');
    if(!dataISOValida(uso.data)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(uso.hora))throw Error('Informe data e horário válidos.');
    if(uso.data>hoje()||(uso.data===hoje()&&uso.hora>new Date().toTimeString().slice(0,5)))throw Error('Registre apenas um uso que já aconteceu.');
    if(!(numero(uso.quantidade)>0))throw Error('Informe a quantidade consumida na unidade do estoque.');
    if(numero(uso.quantidade)<0.0001)throw Error('A quantidade mínima para registro é 0,0001 na unidade do estoque.');
    if(!String(t.unidade||'').trim())throw Error('Defina a unidade do estoque antes de registrar o uso.');
    if((t.usos||[]).some(u=>!u.desfeitoEm&&u.data===uso.data&&u.hora===uso.hora&&(!uso.ocorrenciaId||!u.ocorrenciaId||u.ocorrenciaId===uso.ocorrenciaId)))throw Error('Já existe um uso nesse horário. Confira o histórico.');
    const n=saldo(t);if(n!==null&&uso.quantidade>n)throw Error('Quantidade maior que o estoque informado. Registre a compra ou corrija o estoque.');
    // Uma única ocorrência diária representa o mesmo uso no check, em Hoje
    // e no formulário avulso. O callback já traz o vínculo e não entra de novo.
    if(!uso.ocorrenciaId&&typeof SaudePainelModelo!=='undefined'){
      const ocorrencias=SaudePainelModelo.ocorrencias(t,uso.data);
      if(ocorrencias.length===1){
        const o=ocorrencias[0];
        if(o.estado==='Não utilizado')throw Error('Desfaça a situação Não utilizado no histórico antes de registrar o uso.');
        return SaudePainelModelo.registrarOcorrencia(t,{...uso,ocorrenciaId:o.id,estado:'Registrado'},u=>registrarUso(t,{...uso,...u}));
      }
    }
    t.usos=t.usos||[];t.usos.push({...uso,id:uid(),registradoEm:new Date().toISOString()});
  }
  const diario=t=>t.programacaoTipo?t.programacaoTipo==='diario':t.usoDiario===true||(t.usoDiario!==false&&numero(t.intervaloConsumoDias)===1);
  const usoHoje=t=>(t.usos||[]).find(u=>!u.desfeitoEm&&u.data===hoje());
  function registrarUsoDiario(t){
    if(!ativo(t))throw Error('Confirme que o medicamento está em andamento antes de marcar o uso diário.');
    if(!diario(t))throw Error('Marque a opção de uso diário em Editar.');
    if(new Set((t.horariosUso||[]).filter(h=>/^([01]\d|2[0-3]):[0-5]\d$/.test(h))).size>1)throw Error('Registre cada tomada no horário planejado; este item tem várias ocorrências.');
    if(usoHoje(t))throw Error('Já há um uso registrado hoje. Confira o histórico.');
    if(!(numero(t.consumoPorCiclo)>0)||!controlaEstoque(t))throw Error('Informe a quantidade diária e a unidade em Editar antes de marcar o uso.');
    registrarUso(t,{data:hoje(),hora:new Date().toTimeString().slice(0,5),quantidade:numero(t.consumoPorCiclo),tipoRegistro:'check-diario'});
  }
  function registrarCompra(t,d,compraId){
    if(!dataISOValida(d.data)||d.data>hoje())throw Error('Informe a data em que a compra foi recebida.');
    validarValorSaude(d.valor);const anterior=(t.compras||[]).find(c=>c.id===compraId);if(anterior&&gastoSaude('saude:compra:'+compraId)&&SaudeTratamentos.numero(d.valor)!==valorSaude('saude:compra:'+compraId,anterior))throw Error('Altere o valor no gasto vinculado.');
    if(!controlaEstoque(t))throw Error('Defina a unidade no tratamento primeiro.');
    if((d.quantidade!==''&&d.quantidade!=null&&!(numero(d.quantidade)>0))||!String(d.marca||'').trim())throw Error('Informe a marca e uma quantidade positiva, se conhecida.');
    const item={...(anterior||{}),...d,quantidade:numero(d.quantidade),id:compraId||uid(),atualizadoEm:new Date().toISOString()};
    const compras=(t.compras||[]).map(x=>({...x})),i=compras.findIndex(x=>x.id===compraId);
    if(compraId&&i<0)throw Error('Compra não encontrada. Reabra o histórico.');
    if(i>=0)compras[i]=item;else compras.push(item);
    const n=saldo({...t,compras});if(n!==null&&n<0)throw Error('A quantidade não pode ficar abaixo do consumo já registrado. Confira os movimentos.');
    t.compras=compras;
  }
  function lembrete(t){
    if(!ativo(t)||!dataISOValida(t.proximaData)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(t.horario||''))return null;
    return {id:'tratamento-'+t.id+'-'+t.proximaData+'-'+t.horario.replace(':',''),titulo:'Lembrete de cuidado',data:t.proximaData,hora:t.horario,local:'',obs:'Confira seu tratamento na Central do Léo.'};
  }
  return {ativo,controlaEstoque,numero,formatarNumero,numeroCampo,unidadeExibida,saldo,estoque,registrarCompra,registrarUso,registrarUsoDiario,diario,usoHoje,alertaReposicao,lembrete};
})();
let tratamentoSelecionado='',tratamentoFiltro='ativos';
function tratamentoCommit(t,fn){
  const antes=structuredClone(t),mt=Object.getOwnPropertyDescriptor(E,'_mt');
  try{fn();salvar();return true}catch(e){for(const k of Object.keys(t))delete t[k];Object.assign(t,antes);if(mt)Object.defineProperty(E,'_mt',mt);else delete E._mt;throw e}
}
function tratamentoForm(titulo,campos,base,aoSalvar,{principais=null,obrigatorios=[]}={}){
  abrirModal(titulo,'Salve apenas informações confirmadas. A prescrição original continua nos anexos.',(c,fechar)=>{
    const form=el('<form class="rotina-form trat-form"><div class="rotina-form-campos"></div><p role="alert" aria-live="polite" class="rotina-form-erro"></p><div class="rotina-form-acoes"><button type="button" class="btn ghost" data-cancelar>Cancelar</button><button type="submit" class="btn">Salvar</button></div></form>');
    const grade=form.querySelector('.rotina-form-campos');
    const extras=principais?el('<details class="trat-form-extras"><summary>Mais detalhes</summary><div class="rotina-form-campos"></div></details>'):null;
    if(extras)grade.after(extras);
    campos.forEach(([k,label,tipo='text',opcoes])=>{const l=el('<label><span>'+esc(label)+'</span></label>');const inp=tipo==='textarea'?el('<textarea rows="3"></textarea>'):opcoes?el('<select>'+opcoesSelect(opcoes,base[k]||'',false)+'</select>'):el('<input type="'+tipo+'">');inp.name=k;if(tipo==='checkbox'){inp.checked=base[k]===true;l.classList.add('trat-campo-check')}else if(opcoes){const escolhido=[...inp.options].find(o=>o.value===String(base[k]??''));if(escolhido)escolhido.selected=true}else inp.value=base[k]??'';if(tipo==='number'){inp.step='any';inp.min='0';inp.inputMode='decimal'}inp.required=obrigatorios.includes(k)||/\*\s*$/.test(label);if(tipo==='textarea')l.classList.add('trat-campo-longo');l.append(inp);(extras&&!principais.includes(k)&&!inp.required?extras.querySelector('.rotina-form-campos'):grade).append(l)});
    if(extras){const contar=()=>{const camposExtras=[...extras.querySelectorAll('input,select,textarea')],preenchidos=camposExtras.filter(i=>i.type==='checkbox'?i.checked:String(i.value??'').trim()!=='').length;extras.querySelector('summary').textContent='Mais detalhes · '+camposExtras.length+' campos'+(preenchidos?' · '+preenchidos+(preenchidos===1?' preenchido':' preenchidos'):'')};form.addEventListener('input',contar);form.addEventListener('change',contar);form.addEventListener('invalid',e=>{if(extras.contains(e.target))extras.open=true},true);contar()}
    form.querySelector('[data-cancelar]').onclick=fechar;
    form.onsubmit=e=>{e.preventDefault();try{const dados={};campos.forEach(([k])=>{const input=form.querySelector('[name="'+k+'"]');dados[k]=input.type==='checkbox'?input.checked:String(input.value??'').trim()});aoSalvar(dados);fechar()}catch(err){if(extras)extras.open=true;form.querySelector('[role=alert]').textContent=err.message}};
    c.append(form);
  });
}
function editarTratamento(t,grupo){
  const novo=!t;t=t||{id:uid(),status:'A confirmar',tipo:'Medicamento',...(grupo?{origemTratamentoId:grupo.id,medico:grupo.medico||''}:{})};
  tratamentoForm(novo?'Novo medicamento ou cuidado':'Editar medicamento ou cuidado',[
    ['oque','Nome do medicamento ou cuidado *'],['tipo','Tipo','select',['Medicamento','Suplemento','Procedimento','Fisioterapia','Acompanhamento','Outro']],
    ['status','Situação','select',['A confirmar','Em andamento','Contínuo','Pausado','Encerrado']],['motivo','Objetivo informado'],
    ['frequencia','Orientação / dose conforme a receita','textarea'],['usoDiario','Uso diário, conforme a orientação cadastrada','checkbox'],['horariosUsoTexto','Horários confirmados por tomada (ex.: 08:00, 20:00); vazio mantém total diário'],['inicio','Início confirmado','date'],['fim','Término previsto','date'],
    ['medico','Médico / profissional'],['especialidade','Especialidade informada'],['contatoMedico','Telefone do consultório','tel'],['enderecoMedico','Endereço do consultório'],
    ['unidade','Unidade do estoque (cápsula, ampola, g…)'],['estoqueInicial','Estoque inicial disponível','number'],['alertaEstoque','Avisar quando restarem (unidades)','number'],
    ['consumoPorCiclo','Quantidade por tomada configurada ou total diário, sem horários individuais (unidades do estoque)','number'],['intervaloConsumoDias','Intervalo confirmado entre ciclos (dias inteiros)','number'],['proximaData','Próximo cuidado confirmado','date'],['horario','Horário escolhido','time'],['obs','Pendências / orientações adicionais','textarea']
  ],{...t,usoDiario:SaudeTratamentos.diario(t),horariosUsoTexto:(t.horariosUso||[]).join(', ')},d=>{
    const horarios=String(d.horariosUsoTexto||'').split(/[,;\s]+/).filter(Boolean);if(horarios.some(h=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(h)))throw Error('Informe horários como 08:00 e 20:00, separados por vírgula.');d.horariosUso=[...new Set(horarios)].sort();delete d.horariosUsoTexto;
    if(d.usoDiario)d.intervaloConsumoDias=1;
    if(t.programacaoTipo){d.programacaoTipo=d.usoDiario?'diario':t.programacaoTipo==='diario'?'intervalo':t.programacaoTipo;if(!d.horariosUso.length)throw Error('Mantenha ao menos um horário ou ajuste em Dias e horários.');}
    if(!d.oque)throw Error('Informe o nome do tratamento.');
    for(const k of ['inicio','fim','proximaData'])if(d[k]&&!dataISOValida(d[k]))throw Error('Confira a data informada.');
    if(d.inicio&&d.fim&&d.fim<d.inicio)throw Error('O término deve ser posterior ao início.');
    for(const k of ['estoqueInicial','alertaEstoque'])if(d[k]!==''&&!(Number(d[k])>=0))throw Error('Estoque e limite devem ser positivos ou zero.');
    for(const k of ['consumoPorCiclo','intervaloConsumoDias'])if(d[k]!=null&&d[k]!==''&&!(Number.isFinite(Number(d[k]))&&Number(d[k])>0))throw Error('Informe um consumo e intervalo positivos ou deixe em branco.');
    if(d.intervaloConsumoDias!=null&&d.intervaloConsumoDias!==''&&!Number.isInteger(Number(d.intervaloConsumoDias)))throw Error('O intervalo deve ser informado em dias inteiros. Para uso diário, informe o total por dia.');
    if((t.compras||[]).length||(t.usos||[]).length){if(d.unidade!==t.unidade||String(d.estoqueInicial)!==String(t.estoqueInicial??''))throw Error('Há movimentos registrados: preserve a unidade e o estoque inicial; registre novas compras.');}
    if(novo){E.tratamentos.push({...t,...d});try{salvar()}catch(e){E.tratamentos.pop();throw e}}else tratamentoCommit(t,()=>Object.assign(t,d));
    tratamentoSelecionado=t.id;tratamentoGrupoSelecionado=t.origemTratamentoId||t.id;tratamentoVisao='itens';abaSaude='tratamentos';
  },{principais:['oque','tipo','status','frequencia'],obrigatorios:['oque']});
}
function comprarTratamento(t,compra){tratamentoForm('Registrar compra',[
  ['data','Data da compra','date'],['marca','Marca / laboratório comprado'],['quantidade','Quantidade recebida ('+(SaudeTratamentos.unidadeExibida(t.unidade)||'defina a unidade')+')','number'],['local','Farmácia / fornecedor'],['valor','Valor total da compra (R$)','number'],['obs','Observação']
],compra?{...compra,valor:valorSaude('saude:compra:'+compra.id,compra)??''}:{data:hoje()},d=>tratamentoCommit(t,()=>SaudeTratamentos.registrarCompra(t,d,compra?.id)))}
function usarTratamento(t){
  if(['Pausado','Encerrado'].includes(t.status)){alert('Este medicamento está '+t.status.toLowerCase()+'. Confira a situação em Editar antes de registrar um novo uso.');return}
  const confirmar=!SaudeTratamentos.ativo(t);
  tratamentoForm('Registrar uso realizado',[
    ['data','Data do uso','date'],['hora','Horário real','time'],['quantidade','Quantidade consumida ('+(SaudeTratamentos.unidadeExibida(t.unidade)||'unidade não definida')+')','number'],['obs','Observação'],
    ...(confirmar?[['confirmarEmUso','Confirmo que este medicamento ou cuidado está em uso','checkbox']]:[])
  ],{data:hoje(),hora:new Date().toTimeString().slice(0,5),quantidade:SaudeTratamentos.numeroCampo(t.consumoPorCiclo)},d=>registrarUsoTratamento(t,d));
}
function registrarUsoTratamento(t,d){
  return tratamentoCommit(t,()=>{
    if(!SaudeTratamentos.ativo(t)){
      if(['Pausado','Encerrado'].includes(t.status)||!d.confirmarEmUso)throw Error('Marque a confirmação de que o medicamento está em uso para continuar.');
      t.status='Em andamento';t.usoConfirmadoEm=new Date().toISOString();
    }
    const {confirmarEmUso,...uso}=d;if(d.ocorrenciaId&&typeof SaudePainelModelo!=='undefined')SaudePainelModelo.registrarOcorrencia(t,{...uso,quantidade:+d.quantidade,estado:'Registrado'},u=>SaudeTratamentos.registrarUso(t,u));else SaudeTratamentos.registrarUso(t,{...uso,quantidade:+d.quantidade});
  });
}
function quadroUsoDireto(t,aoSalvar){
  const box=el('<section class="trat-uso-direto"><h4>✓ Registrar uso</h4><form data-uso-direto><div class="trat-uso-linha"><label><span></span><input type="number" name="quantidade" min="0" step="any" required inputmode="decimal"></label><button class="btn" type="submit">Registrar uso</button></div><details><summary>Data, horário e observação</summary><div class="trat-uso-opcoes"><label>Data do uso<input type="date" name="data" required></label><label>Horário real<input type="time" name="hora"></label><label>Observação<input type="text" name="obs"></label></div></details><p role="alert" class="rotina-form-erro"></p></form><div data-alerta-reposicao role="status"><p></p></div></section>');
  const form=box.querySelector('form'),q=form.querySelector('[name=quantidade]'),bloqueado=['Pausado','Encerrado'].includes(t.status),unidade=SaudeTratamentos.controlaEstoque(t);
  q.value=SaudeTratamentos.numeroCampo(t.consumoPorCiclo);q.setAttribute('aria-label','Quantidade usada ('+(SaudeTratamentos.unidadeExibida(t.unidade)||'defina a unidade')+')');form.querySelector('.trat-uso-linha span').textContent='Quantidade usada · '+(SaudeTratamentos.unidadeExibida(t.unidade)||'unidade a definir');
  q.onblur=()=>{q.value=SaudeTratamentos.numeroCampo(q.value)};
  form.querySelector('[name=data]').value=hoje();form.querySelector('button').disabled=bloqueado||!unidade;
  if(typeof SaudePainelModelo!=='undefined'&&(t.horariosUso||[]).length){const l=el('<label class="trat-uso-ocorrencia">Ocorrência planejada<select name="ocorrenciaId"></select></label>');form.querySelector('.trat-uso-linha').after(l);const pintarOcorrencias=()=>{const s=l.querySelector('select');s.innerHTML='<option value="">Uso sem vínculo com horário planejado</option>';SaudePainelModelo.ocorrencias(t,form.querySelector('[name=data]').value).forEach(o=>s.append(el('<option value="'+esc(o.id)+'"'+(['Registrado','Não utilizado'].includes(o.estado)?' disabled':'')+'>'+esc(o.hora+' · '+o.estado)+'</option>')))};pintarOcorrencias();form.querySelector('[name=data]').onchange=pintarOcorrencias}
  if(!SaudeTratamentos.ativo(t)&&!bloqueado){const check=el('<label class="trat-uso-confirmar"><input type="checkbox" name="confirmarEmUso"> Confirmo que este medicamento ou cuidado está em uso</label>');form.querySelector('.trat-uso-linha').after(check)}
  if(bloqueado)box.append(el('<p class="trat-uso-nota">Uso pausado ou encerrado. Confira a situação em Editar antes de registrar.</p>'));
  const aviso=SaudeTratamentos.alertaReposicao(t),alerta=box.querySelector('[data-alerta-reposicao]');alerta.dataset.nivel=aviso.nivel;alerta.querySelector('p').textContent=aviso.texto;
  if(aviso.nivel==='pendente'){
    const compra=(t.compras||[]).slice().reverse().find(c=>SaudeTratamentos.numero(c.quantidade)===null);
    const b=acao(compra?'Informar quantidade da compra':'Definir unidade e estoque',()=>compra?comprarTratamento(t,compra):editarTratamento(t),'ghost mini');if(compra)b.dataset.completarCompra='';alerta.append(b);
  }
  form.onsubmit=e=>{e.preventDefault();try{
    registrarUsoTratamento(t,{data:form.querySelector('[name=data]').value,hora:form.querySelector('[name=hora]').value||new Date().toTimeString().slice(0,5),quantidade:q.value,obs:form.querySelector('[name=obs]').value.trim(),ocorrenciaId:form.querySelector('[name=ocorrenciaId]')?.value||'',confirmarEmUso:!!form.querySelector('[name=confirmarEmUso]')?.checked});aoSalvar(t.usos?.at(-1)?.id);
  }catch(erro){form.querySelector('[role=alert]').textContent=erro.message}};
  return box;
}
function desfazerUsoTratamento(t,id,aoAlterar){
  const uso=(t.usos||[]).find(u=>u.id===id);if(!uso||uso.desfeitoEm)return;
  if(!confirm('Desfazer este registro e devolver a quantidade ao estoque?'))return;
  try{tratamentoCommit(t,()=>uso.desfeitoEm=new Date().toISOString());aoAlterar()}catch(e){alert(e.message)}
}
function quadroUsosRecentes(t,aoAlterar){
  const usos=(t.usos||[]).filter(u=>!u.desfeitoEm).slice().sort((a,b)=>(String(b.data||'')+' '+String(b.hora||'')).localeCompare(String(a.data||'')+' '+String(a.hora||''))),box=el('<section class="trat-usos-recentes" tabindex="-1"><h4 role="status">✅ Usos registrados · '+usos.length+'</h4></section>');
  function tabela(lista){
    const tabela=el('<table class="trat-usos-tabela"><caption class="sr-only">Usos realizados de '+esc(t.oque||'medicamento ou cuidado')+'</caption><thead><tr><th scope="col">Quando</th><th scope="col">Quantidade</th><th scope="col"><span class="sr-only">Ações</span></th></tr></thead><tbody></tbody></table>');
    lista.forEach(u=>{const row=document.createElement('tr');row.dataset.usoId=u.id;row.tabIndex=-1;row.innerHTML='<td><time datetime="'+esc(u.data+'T'+u.hora)+'">'+esc(fmtDataAno(u.data))+' <b>'+esc(u.hora)+'</b></time>'+(u.obs?'<small>'+esc(u.obs)+'</small>':'')+'</td><td><strong>'+esc(SaudeTratamentos.formatarNumero(u.quantidade)+' '+SaudeTratamentos.unidadeExibida(t.unidade))+'</strong></td><td></td>';const b=acao('↩ Desfazer',()=>desfazerUsoTratamento(t,u.id,aoAlterar),'ghost mini');b.setAttribute('aria-label','Desfazer uso de '+fmtDataAno(u.data)+' às '+u.hora);row.lastElementChild.append(b);tabela.querySelector('tbody').append(row)});return tabela;
  }
  if(!usos.length){box.append(el('<p class="trat-muted">Nenhum uso registrado neste item.</p>'));return box}
  box.append(tabela(usos.slice(0,5)));
  if(usos.length>5){const anteriores=el('<details class="trat-usos-anteriores"><summary>Ver '+(usos.length-5)+' uso(s) anterior(es)</summary></details>');anteriores.append(tabela(usos.slice(5)));box.append(anteriores)}
  return box;
}
function evolucaoTratamento(t){tratamentoForm('Registrar evolução',[
  ['data','Data','date'],['descricao','Como você está / evolução percebida','textarea'],['efeitos','Sintomas ou efeitos percebidos','textarea'],['proximo','Próximo passo combinado','textarea']
],{data:hoje()},d=>{if(!dataISOValida(d.data)||d.data>hoje()||!d.descricao)throw Error('Informe uma data passada ou de hoje e descreva a evolução.');tratamentoCommit(t,()=>{t.evolucao=t.evolucao||[];t.evolucao.push({...d,id:uid()})})})}
function agendaTratamento(t){
  const a=SaudeTratamentos.lembrete(t);
  if(!a){alert('Confirme o tratamento, a próxima data e o horário em Editar.');return}
  if(a.data<hoje()){alert('A próxima data está no passado. Atualize antes de criar o lembrete.');return}
  abrirModal('Lembrete no Google Agenda','Envio opcional; nenhum medicamento ou diagnóstico será incluído no evento.',(c)=>{
    c.append(el('<p><b>Lembrete de cuidado</b> · '+fmtDataAno(a.data)+' às '+esc(a.hora)+'</p><p>Cria ou atualiza um evento nesta data, com avisos 1 dia e 1 hora antes. Novas datas precisam de novo envio. Encerrar o tratamento não apaga eventos já enviados.</p>'));
    const status=el('<p role="status"></p>');
    const b=acao('Conectar e enviar este lembrete',async()=>{b.disabled=true;try{
      if(!googleConectado('agendaEnviar'))await conectarGoogle('agendaEnviar');
      const resultado=await enviarLembreteGoogle(a);tratamentoCommit(t,()=>{t.lembretes=t.lembretes||[];t.lembretes=t.lembretes.filter(x=>x.id!==a.id);t.lembretes.push({...a,enviadoEm:new Date().toISOString(),link:resultado.htmlLink||''})});status.textContent='Lembrete confirmado no Google Agenda.';
    }catch(e){status.textContent=e.message}finally{b.disabled=false}});c.append(status,b);
  });
}
// A programação usa somente os dias, horários e quantidades confirmados pela pessoa.
function configurarProgramacaoTratamento(t,d){
  if(!['diario','semanal','intervalo'].includes(d.programacaoTipo))throw Error('Escolha como repetir as doses.');
  if(!dataISOValida(d.inicio)||d.fim&&(!dataISOValida(d.fim)||d.fim<d.inicio))throw Error('Confira as datas de início e término.');
  const horarios=[...new Set(d.horariosUso||[])].sort(),dias=[...new Set(d.diasUso||[])].sort();
  if(!horarios.length||horarios.some(h=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(h)))throw Error('Adicione pelo menos um horário válido.');
  if(d.programacaoTipo==='semanal'&&(!dias.length||dias.some(n=>!Number.isInteger(n)||n<0||n>6)))throw Error('Selecione os dias da semana.');
  const intervalo=Number(d.intervaloConsumoDias),q=Number(d.consumoPorCiclo),unidade=String(d.unidade||'').trim();
  if(d.programacaoTipo==='intervalo'&&(!Number.isInteger(intervalo)||intervalo<1))throw Error('Informe um intervalo de dias inteiros, a partir de 1.');
  if(!Number.isFinite(q)||q<0.0001||!unidade)throw Error('Informe a quantidade por dose e a unidade.');
  if(((t.usos||[]).length||(t.compras||[]).length)&&unidade!==t.unidade)throw Error('Preserve a unidade dos movimentos já registrados.');
  if(!SaudeTratamentos.ativo(t)&&!d.confirmarEmUso)throw Error('Confirme que este medicamento está em uso para ativar a programação.');
  Object.assign(t,{programacaoTipo:d.programacaoTipo,diasUso:d.programacaoTipo==='semanal'?dias:[],horariosUso:horarios,inicio:d.inicio,fim:d.fim||'',consumoPorCiclo:q,unidade,frequencia:String(d.frequencia||'').trim(),usoDiario:d.programacaoTipo==='diario',intervaloConsumoDias:d.programacaoTipo==='diario'?1:d.programacaoTipo==='intervalo'?intervalo:'',proximaData:d.inicio});
  if(!SaudeTratamentos.ativo(t)){t.status='Em andamento';t.usoConfirmadoEm=new Date().toISOString()}
}
function programarTratamento(t,aoSalvar){
  abrirModal('Dias e horários · '+t.oque,'Configure conforme sua receita. Depois, marque cada dose com Tomei.',(c,fechar)=>{
    const form=el('<form class="rotina-form trat-programar"><label>Como tomar<textarea name="frequencia" rows="2"></textarea></label><div class="trat-programar-grade"><label>Quantidade por dose<input name="consumoPorCiclo" type="number" min="0.0001" step="any" required inputmode="decimal"></label><label>Unidade<input name="unidade" required placeholder="Ex.: cápsula, mL"></label><label>Início<input name="inicio" type="date" required></label><label>Término (opcional)<input name="fim" type="date"></label><label>Repetir<select name="programacaoTipo"><option value="diario">Todos os dias</option><option value="semanal">Dias da semana</option><option value="intervalo">A cada X dias</option></select></label><label data-intervalo>A cada quantos dias?<input name="intervaloConsumoDias" type="number" min="1" step="1"></label></div><fieldset data-dias><legend>Dias da semana</legend><div class="trat-dias-semana"></div></fieldset><fieldset><legend>Horários de cada dose</legend><div data-horarios></div><button type="button" class="btn ghost mini" data-adicionar-hora>+ Horário</button></fieldset><p class="trat-muted">A quantidade informada vale para cada horário. Alterações no planejamento preservam os usos já registrados no histórico.</p><p role="alert" aria-live="polite"></p><div class="rotina-form-acoes"><button type="button" class="btn ghost" data-cancelar>Cancelar</button><button type="submit" class="btn">Salvar programação</button></div></form>');
    const campo=n=>form.querySelector('[name="'+n+'"]');
    for(const k of ['frequencia','unidade','fim'])campo(k).value=t[k]||'';
    campo('consumoPorCiclo').value=SaudeTratamentos.numeroCampo(t.consumoPorCiclo);campo('inicio').value=t.inicio||hoje();campo('intervaloConsumoDias').value=t.intervaloConsumoDias||'';
    const tipo=t.programacaoTipo||(SaudeTratamentos.diario(t)?'diario':SaudeTratamentos.numero(t.intervaloConsumoDias)>1?'intervalo':'diario');
    [...campo('programacaoTipo').options].find(o=>o.value===tipo).selected=true;
    if((t.usos||[]).length||(t.compras||[]).length)campo('unidade').readOnly=true;
    ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].forEach((nome,n)=>{const l=el('<label><input type="checkbox" name="diaUso" value="'+n+'"><span>'+nome+'</span></label>');l.querySelector('input').checked=(t.diasUso||[]).includes(n);form.querySelector('.trat-dias-semana').append(l)});
    const atualizar=()=>{form.querySelector('[data-dias]').hidden=campo('programacaoTipo').value!=='semanal';form.querySelector('[data-intervalo]').hidden=campo('programacaoTipo').value!=='intervalo';campo('intervaloConsumoDias').required=campo('programacaoTipo').value==='intervalo'};campo('programacaoTipo').onchange=atualizar;atualizar();
    function hora(valor=''){
      const row=el('<div class="trat-hora-linha"><input type="time" name="horaUso" required aria-label="Horário da dose"><button type="button" class="btn ghost mini">Remover</button></div>');row.querySelector('input').value=valor;row.querySelector('button').onclick=()=>row.remove();form.querySelector('[data-horarios]').append(row);
    }
    const horas=t.horariosUso?.length?t.horariosUso:t.horario?[t.horario]:[''];horas.forEach(hora);form.querySelector('[data-adicionar-hora]').onclick=()=>hora();
    if(!SaudeTratamentos.ativo(t)){const check=el('<label class="trat-uso-confirmar"><input type="checkbox" name="confirmarEmUso"> Confirmo que este medicamento está em uso e quero ativar a programação</label>');form.querySelector('[role=alert]').before(check)}
    form.querySelector('[data-cancelar]').onclick=fechar;
    form.onsubmit=e=>{e.preventDefault();try{
      const d={};for(const k of ['frequencia','unidade','consumoPorCiclo','inicio','fim','programacaoTipo','intervaloConsumoDias'])d[k]=campo(k).value;
      d.horariosUso=[...form.querySelectorAll('[name=horaUso]')].map(i=>i.value);d.diasUso=[...form.querySelectorAll('[name=diaUso]')].filter(i=>i.checked).map(i=>Number(i.value));d.confirmarEmUso=!!campo('confirmarEmUso')?.checked;
      tratamentoCommit(t,()=>configurarProgramacaoTratamento(t,d));fechar();aoSalvar();
    }catch(e){form.querySelector('[role=alert]').textContent=e.message}};
    c.append(form);
  });
}
function quadroProgramacaoTratamento(t,aoAlterar){
  const box=el('<section class="trat-programacao"><div class="trat-toolbar"><h4>Dias e horários</h4></div><div data-programacao-conteudo></div></section>');
  box.querySelector('.trat-toolbar').append(acao(t.programacaoTipo?'Editar programação':'Programar dias e horários',()=>programarTratamento(t,aoAlterar),'ghost mini'));
  const conteudo=box.querySelector('[data-programacao-conteudo]');
  if(!t.programacaoTipo){conteudo.append(el('<p>Defina os dias, horários e a quantidade de cada dose. Depois, é só clicar em <b>Tomei</b>.</p>'));return box}
  const nomes=['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
  const repeticao=t.programacaoTipo==='semanal'?(t.diasUso||[]).map(n=>nomes[n]).join(', '):t.programacaoTipo==='intervalo'?'A cada '+t.intervaloConsumoDias+' dias':'Todos os dias';
  conteudo.append(el('<p>'+esc(repeticao)+' · '+esc(SaudeTratamentos.formatarNumero(t.consumoPorCiclo)+' '+SaudeTratamentos.unidadeExibida(t.unidade))+' por dose · '+esc((t.horariosUso||[]).join(' / '))+'</p>'));
  if(!SaudeTratamentos.ativo(t)){conteudo.append(el('<p>Programação pausada. Confira a situação do medicamento antes de registrar novas doses.</p>'));return box}
  const controles=el('<div class="trat-programacao-navegar"><label>Mostrar a partir de <input type="date" aria-label="Primeiro dia da tabela"></label></div>'),inicio=controles.querySelector('input');inicio.value=hoje();
  const diasDepois=(d,n)=>{const data=new Date(d+'T12:00:00Z');data.setUTCDate(data.getUTCDate()+n);return data.toISOString().slice(0,10)};
  controles.append(acao('Hoje',()=>{inicio.value=hoje();pintar()},'ghost mini'),acao('Próximos 7 dias',()=>{if(dataISOValida(inicio.value)){inicio.value=diasDepois(inicio.value,7);pintar()}},'ghost mini'));
  const tabela=el('<div class="trat-programacao-tabela"></div>'),aviso=el('<p role="status" aria-live="polite"></p>');conteudo.append(controles,tabela,aviso);inicio.onchange=pintar;
  function pintar(){
    tabela.innerHTML='';aviso.textContent='';if(!dataISOValida(inicio.value)){aviso.textContent='Escolha uma data válida.';return}
    const table=el('<table><caption>Doses programadas · 7 dias</caption><thead><tr><th scope="col">Dia</th><th scope="col">Horário</th><th scope="col">Dose</th><th scope="col">Situação</th></tr></thead><tbody></tbody></table>');let total=0;
    for(let n=0;n<7;n++)for(const o of SaudePainelModelo.ocorrencias(t,diasDepois(inicio.value,n))){
      total++;const uso=(t.usos||[]).find(u=>!u.desfeitoEm&&(u.id===o.evento?.usoId||u.ocorrenciaId===o.id))||(o.estado==='Registrado'?(t.usos||[]).find(u=>!u.desfeitoEm&&u.data===o.data&&!u.ocorrenciaId):null);
      const row=document.createElement('tr');row.innerHTML='<td>'+esc(fmtDataAno(o.data))+'<small>'+esc(nomes[new Date(o.data+'T12:00:00Z').getUTCDay()])+(o.data===hoje()?' · Hoje':'')+'</small></td><td>'+esc(o.hora)+'</td><td>'+esc(SaudeTratamentos.formatarNumero(uso?.quantidade??o.quantidade)+' '+SaudeTratamentos.unidadeExibida(t.unidade))+'</td><td></td>';const cel=row.lastElementChild;
      if(o.estado==='Registrado'){
        cel.append(el('<span class="trat-dose-tomada">✓ Tomado'+(uso?.hora?' às '+esc(uso.hora):'')+'</span>'));
        if(uso)cel.append(acao('Desfazer',()=>desfazerUsoTratamento(t,uso.id,aoAlterar),'ghost mini'));
      }else if(o.data===hoje()&&o.estado!=='Não utilizado'){
        const b=acao('Tomei',()=>{b.disabled=true;try{
          registrarUsoTratamento(t,{data:o.data,hora:new Date().toTimeString().slice(0,5),quantidade:o.quantidade,ocorrenciaId:o.id});aoAlterar();
        }catch(e){aviso.textContent=e.message;b.disabled=false}},'mini');b.dataset.tomei=o.id;b.setAttribute('aria-label','Tomei a dose das '+o.hora+' de '+t.oque);cel.append(b);
        if(o.estado==='Adiado')cel.append(el('<small>Adiado para '+esc(o.adiadoPara)+'</small>'));
      }else cel.textContent=o.estado==='Não utilizado'?'Não utilizado':o.data>hoje()?'Programado':'Sem registro';
      table.querySelector('tbody').append(row);
    }
    tabela.append(total?table:el('<p>Nenhuma dose programada neste período.</p>'));
  }
  pintar();conteudo.append(el('<p class="trat-muted">Tomei registra o horário real do clique. Para uma dose de outro dia, use Registrar outro uso abaixo.</p>'));return box;
}

function quadroItensTratamento(itens,grupo,{selecionarPrimeiro=true}={}){
  const sec=el('<section class="tratamentos-itens"><div class="trat-toolbar"><h2>Medicamentos e cuidados</h2><div class="trat-actions"></div></div><div class="trat-filtros"></div><div class="trat-split"><aside class="trat-lista" aria-label="Itens prescritos do tratamento"></aside><div class="trat-detalhe"></div></div></section>');
  const actions=sec.querySelector('.trat-actions');actions.append(acao('+ Medicamento / cuidado',()=>editarTratamento(null,grupo),'ghost mini'));
  function pintar(){
    const ativos=itens.filter(t=>!['Encerrado','Pausado'].includes(t.status));
    const lista=tratamentoFiltro==='ativos'?ativos:tratamentoFiltro==='compras'?ativos.filter(t=>SaudeTratamentos.controlaEstoque(t)&&['Sem estoque','Comprar mais','Não informado'].includes(SaudeTratamentos.estoque(t))):itens;
    const filtros=sec.querySelector('.trat-filtros');filtros.innerHTML='';[['ativos','Em acompanhamento',ativos.length],['compras','Compras',linhasComprasSaude(itens).length],['todos','Todos',itens.length]].forEach(([k,n,q])=>{const b=acao(n+' · '+q,()=>{tratamentoFiltro=k;pintar()},'ghost mini');b.setAttribute('aria-pressed',String(tratamentoFiltro===k));filtros.append(b)});
    const l=sec.querySelector('.trat-lista'),d=sec.querySelector('.trat-detalhe');l.innerHTML='';d.innerHTML='';
    sec.classList.toggle('trat-modo-compras',tratamentoFiltro==='compras');if(tratamentoFiltro==='compras'){d.append(quadroComprasSaude(itens));return}
    if(!lista.length){d.append(el('<div class="trat-empty"><h3>Nenhum item neste filtro</h3><p>Adicione os medicamentos e cuidados prescritos para este tratamento.</p></div>'));return}
    const t=lista.find(x=>x.id===tratamentoSelecionado)||(selecionarPrimeiro?lista[0]:null);if(t)tratamentoSelecionado=t.id;
    lista.forEach(x=>{const b=el('<button type="button" class="trat-item"><strong>'+esc(x.oque||'Sem nome')+'</strong><small>'+esc(x.tipo||'Tratamento')+' · '+esc(x.status||'A confirmar')+'</small><span>'+esc(SaudeTratamentos.controlaEstoque(x)?SaudeTratamentos.estoque(x):'Acompanhamento')+'</span></button>');b.setAttribute('aria-pressed',String(x===t));b.onclick=()=>{tratamentoSelecionado=x.id;pintar()};l.append(b)});
    if(!t){d.append(el('<div class="trat-empty"><h3>💊 Escolha um medicamento ou cuidado</h3><p>Selecione um item da lista para consultar a orientação, os documentos e os registros ou informar um uso realizado.</p><p>Nenhum medicamento foi selecionado automaticamente.</p></div>'));return}
    const saldo=SaudeTratamentos.saldo(t),compras=(t.compras||[]).slice().sort((a,b)=>(a.data||'').localeCompare(b.data||'')),previsao=previsaoEstoqueTratamento(t),usos=(t.usos||[]).filter(x=>!x.desfeitoEm),evolucao=t.evolucao||[];
    d.append(el('<header><small>'+esc(t.tipo||'Tratamento')+'</small><h3>'+esc(t.oque||'Tratamento')+'</h3><p>'+esc(t.status||'A confirmar')+(t.inicio?' · início '+fmtDataAno(t.inicio):' · início não confirmado')+'</p></header>'));
    const mostrarUso=id=>{pintar();const linha=[...d.querySelectorAll('[data-uso-id]')].find(r=>r.dataset.usoId===id);if(linha?.closest('details'))linha.closest('details').open=true;const alvo=linha||d.querySelector('.trat-usos-recentes');alvo?.focus({preventScroll:true});alvo?.scrollIntoView({block:'nearest'})};
    const usoDireto=SaudeTratamentos.controlaEstoque(t)||['Medicamento','Suplemento'].includes(t.tipo)?quadroUsoDireto(t,mostrarUso):null;
    const a=el('<div class="trat-actions"></div>');a.append(acao('✏️ Editar',()=>editarTratamento(t),'ghost mini'));if(SaudeTratamentos.controlaEstoque(t))a.append(acao('🛒 Compra',()=>comprarTratamento(t),'ghost mini'));a.append(acao('📈 Evolução',()=>evolucaoTratamento(t),'ghost mini'),acao('📅 Lembrete',()=>agendaTratamento(t),'ghost mini'));d.append(a);
    d.append(el('<section class="trat-info trat-como-tomar"><h4>Como tomar</h4><p class="trat-texto">'+esc(t.frequencia||'Cadastre a orientação da sua receita em Dias e horários.')+'</p></section>'));
    if(typeof SaudePainelModelo!=='undefined')d.append(quadroProgramacaoTratamento(t,pintar));
    if(usoDireto){if(t.programacaoTipo){const manual=el('<details class="trat-info"><summary>Registrar outro uso ou corrigir data e horário</summary></details>');manual.append(usoDireto);d.append(manual)}else d.append(usoDireto);}
    if(!t.programacaoTipo&&SaudeTratamentos.diario(t)&&!(t.horariosUso?.length>1)){
      const feito=!!SaudeTratamentos.usoHoje(t),configurado=SaudeTratamentos.controlaEstoque(t)&&SaudeTratamentos.numero(t.consumoPorCiclo)>0;
      const bloco=el('<section class="trat-diario"><label><input type="checkbox" data-uso-diario><span></span></label><p></p><p role="status" data-erro-uso-diario></p></section>'),check=bloco.querySelector('input');
      check.checked=feito;check.disabled=feito||!SaudeTratamentos.ativo(t)||!configurado;
      bloco.querySelector('span').textContent=feito?'Uso registrado hoje':'Usei hoje';
      bloco.querySelector('p').textContent=feito?'Confira data, horário e quantidade na linha abaixo.':!SaudeTratamentos.ativo(t)?'Confirme o início em Registrar uso ou confira a situação em Editar.':!configurado?'Em Editar, informe a unidade e a quantidade total diária para usar este check.':'Registra hoje e desconta '+SaudeTratamentos.formatarNumero(t.consumoPorCiclo)+' '+SaudeTratamentos.unidadeExibida(t.unidade)+' do estoque informado.';
      check.onchange=()=>{if(!check.checked)return;try{tratamentoCommit(t,()=>SaudeTratamentos.registrarUsoDiario(t));mostrarUso(t.usos?.at(-1)?.id)}catch(e){check.checked=false;bloco.querySelector('[data-erro-uso-diario]').textContent=e.message}};
      d.append(bloco);
    }
    if(!t.programacaoTipo&&t.horariosUso?.length>1)d.append(el('<p class="trat-uso-nota">Tomadas configuradas: '+esc(t.horariosUso.join(' · '))+'. Registre cada ocorrência na tela Hoje ou selecione o horário no formulário acima.</p>'));
    if(usoDireto||usos.length)d.append(quadroUsosRecentes(t,mostrarUso));
    const resumo=el('<div class="trat-resumo"></div>'),resumoCards=[];
    if(SaudeTratamentos.controlaEstoque(t)&&!usoDireto)resumoCards.push(['Estoque',saldo===null?'Quantidade a confirmar':SaudeTratamentos.formatarNumero(saldo)+' '+SaudeTratamentos.unidadeExibida(t.unidade),saldo===null?'Complete a quantidade em Editar ou Compra.':SaudeTratamentos.estoque(t)]);
    if(compras.at(-1)?.data)resumoCards.push(['Última compra',fmtDataAno(compras.at(-1).data),compras.at(-1).marca||'Marca não informada']);
    if(previsao.data)resumoCards.push(['Previsão de acabar',fmtDataAno(previsao.data),previsao.motivo]);
    if(t.proximaData&&!t.programacaoTipo)resumoCards.push(['Próximo cuidado',fmtDataAno(t.proximaData),t.horario||'Horário a definir']);
    resumoCards.forEach(([titulo,valor,nota])=>resumo.append(el('<div><small>'+esc(titulo)+'</small><b>'+esc(valor)+'</b><span>'+esc(nota)+'</span></div>')));
    if(!SaudeTratamentos.controlaEstoque(t))resumo.append(el('<p class="trat-previsao-pendente">Estoque: Não se aplica · sem controle de material.</p>'));
    if(!previsao.data){const nota=el('<p class="trat-previsao-pendente"></p>');nota.textContent='Previsão de duração: '+previsao.motivo;resumo.append(nota)}
    d.append(resumo);

    if(t.obs)d.append(el('<section class="trat-info"><h4>Orientações adicionais</h4><p class="trat-texto">'+esc(t.obs)+'</p></section>'));
    d.append(el('<details class="trat-info"><summary>🩺 Médico e consultório</summary><p>'+esc(t.medico||'Profissional a informar')+'</p><p>'+esc(t.especialidade||'')+'</p><p>'+esc(t.contatoMedico||'Telefone a informar')+'</p><p>'+esc(t.enderecoMedico||'Endereço a informar')+'</p></details>'));
    const arquivos=el('<details class="trat-info"><summary>📎 Receitas e documentos</summary></details>');arquivos.append(areaArquivos('tratamento:'+t.id,'Adicionar foto ou PDF do tratamento'));if(t.origemTratamentoId&&E.tratamentos.some(x=>x.id===t.origemTratamentoId)){arquivos.append(el('<p>Documentos do plano de origem:</p>'));arquivos.append(areaArquivos('tratamento:'+t.origemTratamentoId,'',true))}d.append(arquivos);
    const hist=el('<details class="trat-info"><summary>🕒 Histórico · '+(compras.length+usos.length+evolucao.length+(t.ocorrencias||[]).filter(o=>!o.desfeitoEm&&o.estado!=='Registrado').length)+' registros</summary></details>');
    const eventos=[...(t.ocorrencias||[]).filter(o=>!o.desfeitoEm&&o.estado!=='Registrado').map(o=>({...o,ocorrencia:true,texto:o.estado+(o.horaPrevista&&o.horaPrevista!=='dia'?' · planejado '+o.horaPrevista:'')+(o.adiadoPara?' · novo horário '+o.adiadoPara:'')})),...compras.map(x=>({...x,compra:true,texto:'Compra: '+(x.quantidade==null?'quantidade a informar':SaudeTratamentos.formatarNumero(x.quantidade)+' '+SaudeTratamentos.unidadeExibida(t.unidade))+' · '+x.marca})),...usos.map(x=>({...x,texto:'Uso às '+x.hora+': '+SaudeTratamentos.formatarNumero(x.quantidade)+' '+SaudeTratamentos.unidadeExibida(t.unidade),uso:true})),...evolucao.map(x=>({...x,texto:'Evolução: '+x.descricao+(x.efeitos?' · Sintomas: '+x.efeitos:'')+(x.proximo?' · Próximo passo: '+x.proximo:'')}))].sort((a,b)=>b.data.localeCompare(a.data));
    eventos.forEach(x=>{const row=el('<div class="trat-historico"><b>'+fmtDataAno(x.data)+'</b><p>'+esc(x.texto)+'</p><small>'+esc(x.obs||'')+'</small></div>');if(x.compra){const c=t.compras.find(c=>c.id===x.id),ref='saude:compra:'+c.id,v=valorSaude(ref,c);row.append(el('<p>'+esc(c.local||'Local a informar')+' · '+esc(v===null?'Valor a informar':brl(v))+'</p>'),acao('Corrigir compra',()=>comprarTratamento(t,c),'ghost mini'),acao(gastoSaude(ref)?'💸 Ver gasto vinculado':'💸 Vincular a Gastos',()=>vincularGastoSaude(ref,c),'ghost mini'));}if(x.uso)row.append(acao('Desfazer registro',()=>desfazerUsoTratamento(t,x.id,pintar),'ghost mini'));if(x.ocorrencia)row.append(acao('Desfazer situação',()=>{try{tratamentoCommit(t,()=>t.ocorrencias.find(o=>o.id===x.id).desfeitoEm=new Date().toISOString());pintar()}catch(e){alert(e.message)}},'ghost mini'));hist.append(row)});d.append(hist);
  }
  pintar();return sec;
}
function validarPacoteTratamentos(p){
  if(!p||p.formato!=='central-saude-v1'||!Array.isArray(p.tratamentos)||p.tratamentos.length>100)throw Error('Pacote de tratamentos inválido.');
  const ids=new Set();
  for(const t of p.tratamentos){if(!t||typeof t.id!=='string'||!/^import-[a-z0-9-]{3,90}$/.test(t.id)||ids.has(t.id)||!String(t.oque||'').trim())throw Error('Tratamento sem identificação válida ou repetido.');ids.add(t.id);if(t.compraConfirmada&&(!dataISOValida(t.compraConfirmada.data)||t.compraConfirmada.data>hoje()||typeof t.compraConfirmada.marca!=='string'||!t.compraConfirmada.marca))throw Error('Compra confirmada inválida.');
    if(!Array.isArray(t.arquivos||[]))throw Error('Lista de anexos inválida.');
    for(const a of t.arquivos||[])if(!a.nome||!/^data:(image\/(jpeg|png|webp)|application\/pdf);base64,[A-Za-z0-9+/=]+$/.test(a.dados||'')||a.dados.length>34*1024*1024)throw Error('Anexo inválido ou maior que 25 MB.');
  }
  for(const t of p.tratamentos)if(t.origemTratamentoId){const pai=p.tratamentos.find(x=>x.id===t.origemTratamentoId);if(!pai)throw Error('Plano de origem não encontrado no pacote.');if(pai===t||pai.origemTratamentoId)throw Error('Itens devem pertencer diretamente a um tratamento principal.');}
  if(p.medidas!=null&&!Array.isArray(p.medidas))throw Error('Lista de medidas inválida.');
  const pais=new Set(p.tratamentos.filter(t=>!t.origemTratamentoId).map(t=>t.id));
  const registros=new Set();
  for(const m of p.medidas||[]){
    if(!/^import-[a-z0-9-]{3,90}$/.test(m.id||'')||registros.has(m.id)||m.tratamentoId&&!pais.has(m.tratamentoId))throw Error('Medição inválida ou sem tratamento principal.');
    registros.add(m.id);validarMedidaTratamento({...m,fonte:m.fonte||'Documento importado'});
  }
  if(p.consultas!=null&&!Array.isArray(p.consultas))throw Error('Lista de consultas inválida.');
  for(const c of p.consultas||[]){
    if(!/^import-[a-z0-9-]{3,90}$/.test(c.id||'')||registros.has(c.id)||!pais.has(c.tratamentoId)||!dataISOValida(c.data)||!String(c.profissional||'').trim()||!['A confirmar','Agendada','Realizada','Cancelada'].includes(c.situacao))throw Error('Consulta inválida ou sem tratamento principal.');
    if(c.situacao==='Realizada'&&c.data>hoje()||c.retorno&&(!dataISOValida(c.retorno)||c.retorno<c.data))throw Error('Confira as datas da consulta.');
    registros.add(c.id);validarValorSaude(c.valor);
  }
  return p;
}
async function aplicarPacoteTratamentos(p,avisar=()=>{}){
  validarPacoteTratamentos(p);
  // Antes de incluir, a conta e o índice remoto precisam estar disponíveis.
  if(!DEV&&(!_tabBase||!await arqIndice()))throw Error('Sincronize a conta antes de importar.');
  const campos=['id','oque','tipo','motivo','frequencia','medico','clinica','especialidade','contatoMedico','enderecoMedico','unidade','obs','origemTratamentoId'];
  const anteriores={tratamentos:structuredClone(E.tratamentos),peso:structuredClone(E.peso),consultas:structuredClone(E.consultas)};
  try{
    for(const original of p.tratamentos)if(!E.tratamentos.some(x=>x.id===original.id)){
      const t={status:'A confirmar',inicio:'',compras:[],usos:[],evolucao:[]};campos.forEach(k=>{if(typeof original[k]==='string')t[k]=original[k]});
      if(original.compraConfirmada)t.compras=[{id:uid(),data:original.compraConfirmada.data,marca:original.compraConfirmada.marca,quantidade:null,obs:'Compra informada pelo usuário; quantidade pendente.'}];
      E.tratamentos.push(t);
    }
    for(const m of p.medidas||[])if(!E.peso.some(x=>x.id===m.id)){
      const validada=validarMedidaTratamento({...m,fonte:m.fonte||'Documento importado'}),registro={};
      for(const k of ['id','data','tratamentoId','fonte','obs',...METRICAS_TRATAMENTO.map(x=>x[0]),'altura','cintura'])if(validada[k]!=null)registro[k]=validada[k];
      E.peso.push(registro);
    }
    for(const c of p.consultas||[])if(!E.consultas.some(x=>x.id===c.id)){
      const registro={};for(const k of ['id','tratamentoId','data','hora','situacao','tipoConsulta','profissional','especialidade','local','contato','endereco','motivo','conduta','retorno','horaRetorno','obs'])if(typeof c[k]==='string')registro[k]=c[k];
      if(c.valor!==''&&c.valor!=null)registro.valor=+c.valor;E.consultas.push(registro);
    }
    salvar();
  }catch(e){Object.assign(E,anteriores);throw e}
  if(!DEV&&!await enviarNuvem())throw Error('Os registros ainda não foram confirmados na nuvem. Confira a sincronização e tente novamente.');
  for(const original of p.tratamentos){
    const existentes=await arqPor('tratamento:'+original.id);
    for(const a of original.arquivos||[]){if(existentes.some(x=>x.nome===a.nome))continue;
      const [prefix,b64]=a.dados.split(','),mime=prefix.slice(5).split(';')[0];const blob=new Blob([Uint8Array.from(atob(b64),c=>c.charCodeAt(0))],{type:mime});blob.name=a.nome;
      await arqAdd('tratamento:'+original.id,blob);existentes.push({nome:a.nome});avisar('Anexo salvo: '+a.nome);
    }
  }
  return p.tratamentos.length;
}
function importarPacoteTratamentos(){
  abrirModal('Importar receitas e tratamentos','Escolha o pacote privado. Nada será incluído sem sua confirmação.',(c)=>{
    const input=el('<input type="file" accept=".json,application/json" aria-label="Pacote privado de tratamentos">');const status=el('<p role="status"></p>');let p=null;
    const b=acao('Importar registros e fotos',async()=>{if(!p)return;b.disabled=true;try{const n=await aplicarPacoteTratamentos(p,s=>status.textContent=s);status.textContent=n+' tratamentos conferidos e anexos salvos. '+(DEV?'Armazenamento local neste navegador.':'Confira o estado de sincronização dos anexos.');abaSaude='tratamentos'}catch(e){status.textContent=e.message+' Os itens já salvos foram preservados; é possível tentar novamente.'}finally{b.disabled=false}});b.disabled=true;
    input.onchange=async()=>{p=null;b.disabled=true;try{const f=input.files?.[0];if(!f)return;if(f.size>100*1024*1024)throw Error('Use um pacote de até 100 MB.');p=validarPacoteTratamentos(JSON.parse(await f.text()));status.textContent=p.tratamentos.length+' tratamentos · '+p.tratamentos.reduce((n,t)=>n+(t.arquivos||[]).length,0)+' anexos. Serão incluídos como A confirmar, sem datas de uso, estoque ou compras presumidas.';b.disabled=false}catch(e){status.textContent=e.message}};
    c.append(input,status,b);
  });
}

/* Um plano reúne seus itens; IDs e referências de anexos são preservados. */
let tratamentoGrupoSelecionado='',tratamentoVisao='resumo',tratamentoMetrica='peso';
function gruposTratamento(){
  const ids=new Set(E.tratamentos.map(t=>t.id));
  return E.tratamentos.filter(t=>!t.origemTratamentoId||!ids.has(t.origemTratamentoId)).map(plano=>{
    const filhos=E.tratamentos.filter(t=>t.origemTratamentoId===plano.id);
    const principal=filhos.length>0||plano.tipo==='Plano de tratamento';
    return {plano,itens:principal?filhos:[plano],principal};
  }).sort((a,b)=>prioridadeGrupoTratamento(a)-prioridadeGrupoTratamento(b));
}
function prioridadeGrupoTratamento(grupo){return grupo.principal?(/emagrec/i.test(normaliza(grupo.plano.oque||''))?0:1):2}
function tratamentoAbrirVisaoGeral(){
  const grupo=gruposTratamento()[0];tratamentoGrupoSelecionado=grupo?.plano.id||'';tratamentoSelecionado='';tratamentoVisao='resumo';
  if(typeof saudeIr==='function')saudeIr('tratamentos');else{abaSaude='tratamentos';tela()}
}
function medidasTratamento(g){return E.peso.filter(m=>m.tratamentoId===g.id&&dataISOValida(m.data)&&m.data<=hoje()).sort((a,b)=>a.data.localeCompare(b.data))}
function gastoSaude(ref){return E.gastos.find(g=>g.origemRef===ref)}
function valorSaude(ref,registro){const g=gastoSaude(ref);return SaudeTratamentos.numero(g?g.valor:registro.valor)}
function resumoGrupoTratamento(grupo){
  const itens=grupo.itens,consultas=E.consultas.filter(c=>c.tratamentoId===grupo.plano.id);
  const custos=[...consultas.map(c=>({ref:'saude:consulta:'+c.id,registro:c,nome:c.tipoConsulta||'Consulta'})),...itens.flatMap(t=>(t.compras||[]).map(c=>({ref:'saude:compra:'+c.id,registro:c,nome:'Compra · '+t.oque})))];
  return {itens:itens.length,comprados:itens.filter(t=>(t.compras||[]).length).length,usos:itens.reduce((s,t)=>s+(t.usos||[]).filter(u=>!u.desfeitoEm).length,0),pendentes:itens.filter(t=>!t.status||t.status==='A confirmar').length,consultas,medidas:medidasTratamento(grupo.plano),custos,total: custos.reduce((s,c)=>s+(valorSaude(c.ref,c.registro)||0),0),semValor:custos.filter(c=>valorSaude(c.ref,c.registro)===null).length};
}
function editarPlanoTratamento(t){
  const novo=!t;t=t||{id:uid(),tipo:'Plano de tratamento',status:'A confirmar'};
  tratamentoForm(novo?'Novo tratamento':'Editar tratamento',[
    ['oque','Nome do tratamento *'],['motivo','Objetivo do acompanhamento'],['status','Situação','select',['A confirmar','Em andamento','Contínuo','Pausado','Encerrado']],
    ['medico','Médico responsável'],['especialidade','Área do acompanhamento'],['clinica','Clínica / consultório'],['contatoMedico','Contato do consultório','tel'],['enderecoMedico','Endereço do consultório'],
    ['inicio','Início confirmado','date'],['fim','Término previsto','date'],['obs','Observações do plano','textarea']
  ],t,d=>{
    if(!d.oque)throw Error('Informe o nome do tratamento.');
    for(const k of ['inicio','fim'])if(d[k]&&!dataISOValida(d[k]))throw Error('Confira as datas.');
    if(d.inicio&&d.fim&&d.fim<d.inicio)throw Error('O término não pode ser anterior ao início.');
    if(novo){E.tratamentos.push({...t,...d});try{salvar()}catch(e){E.tratamentos.pop();throw e}}else tratamentoCommit(t,()=>Object.assign(t,d));
    tratamentoGrupoSelecionado=t.id;tratamentoSelecionado='';tratamentoVisao='resumo';abaSaude='tratamentos';
  },{principais:['oque','status','medico','motivo'],obrigatorios:['oque']});
}
const METRICAS_TRATAMENTO=[['peso','Peso','kg',500],['gordura','Gordura corporal','%',100],['massaGorda','Massa de gordura','kg',500],['massaMagra','Massa livre de gordura','kg',500],['agua','Água corporal','L',200],['imcLaudo','IMC do laudo','',100],['visceral','Gordura visceral','nível',100],['basal','Metabolismo basal','kcal',10000],['idadeMetabolica','Idade metabólica','anos',150],['indiceApendicular','Índice apendicular','kg/m²',100]];
function validarMedidaTratamento(d){
  if(!dataISOValida(d.data)||d.data>hoje())throw Error('Informe a data da medição realizada.');
  if(!String(d.fonte||'').trim())throw Error('Informe a fonte da medição.');
  const out={...d};let n=0;
  for(const [k,label,,max] of [...METRICAS_TRATAMENTO,['altura','Altura','m',3],['cintura','Cintura','cm',300]]){
    if(d[k]===''||d[k]==null){out[k]='';continue}
    const v=SaudeTratamentos.numero(d[k]);if(v===null||v<0||v>max||(['peso','altura'].includes(k)&&v===0))throw Error('Confira '+label.toLowerCase()+'.');out[k]=v;n++;
  }
  if(!n)throw Error('Informe pelo menos uma medida.');return out;
}
function editarMedidaTratamento(g,m){
  tratamentoForm(m?'Editar medição':'Registrar medição',[
    ['data','Data da medição','date'],['fonte','Fonte (exame, balança, avaliação…)'],...METRICAS_TRATAMENTO.map(([k,l,u])=>[k,l+(u?' ('+u+')':''),'number']),['altura','Altura (m)','number'],['cintura','Cintura (cm)','number'],['obs','Observações','textarea']
  ],m||{data:hoje()},d=>{const dados=validarMedidaTratamento(d);if(m)tratamentoCommit(m,()=>Object.assign(m,dados,{tratamentoId:g.id}));else{E.peso.push({...dados,id:uid(),tratamentoId:g.id});try{salvar()}catch(e){E.peso.pop();throw e}}},{principais:['data','fonte','peso'],obrigatorios:['data','fonte']});
}
function vincularMedidaTratamento(g){
  abrirModal('Usar medição já registrada','Vincula a medição existente a este tratamento, sem criar outra cópia.',(c,fechar)=>{
    const lista=E.peso.filter(m=>!m.tratamentoId&&dataISOValida(m.data)&&m.data<=hoje());
    if(!lista.length)c.append(el('<p>Nenhuma medição sem vínculo. Registre uma nova medição neste tratamento.</p>'));
    lista.forEach(m=>c.append(acao(fmtDataAno(m.data)+' · '+(m.peso||'—')+' kg',()=>{try{tratamentoCommit(m,()=>m.tratamentoId=g.id);fechar()}catch(e){alert(e.message)}},'ghost')));
  });
}
function editarConsultaTratamento(g,c){
  const novo=!c;c=c||{id:uid(),tratamentoId:g.id,data:hoje(),profissional:g.medico||'',endereco:g.enderecoMedico||'',contato:g.contatoMedico||'',local:g.clinica||'',situacao:'A confirmar',tipoConsulta:'Consulta'};
  const ref='saude:consulta:'+c.id;
  tratamentoForm(novo?'Consulta ou retorno':'Editar consulta',[
    ['tipoConsulta','Tipo','select',['Consulta','Retorno']],['data','Data','date'],['hora','Horário','time'],['situacao','Situação','select',['A confirmar','Agendada','Realizada','Cancelada']],['profissional','Nome do médico'],['especialidade','Especialidade / área'],['local','Consultório / clínica'],['contato','Contato','tel'],['endereco','Endereço'],['motivo','Motivo da consulta'],['conduta','O que ficou combinado','textarea'],['retorno','Data do próximo retorno','date'],['horaRetorno','Horário do retorno','time'],['valor','Valor total (R$)','number'],['obs','Observações','textarea']
  ],{...c,valor:valorSaude(ref,c)??''},d=>{
    if(!dataISOValida(d.data)||!d.profissional)throw Error('Informe a data e o médico.');
    if(d.retorno&&(!dataISOValida(d.retorno)||d.retorno<d.data))throw Error('Confira a data de retorno.');
    if(d.situacao==='Realizada'&&d.data>hoje())throw Error('Uma consulta futura ainda não foi realizada.');
    validarValorSaude(d.valor);if(gastoSaude(ref)&&SaudeTratamentos.numero(d.valor)!==valorSaude(ref,c))throw Error('Este valor está ligado a Gastos. Altere-o no lançamento vinculado.');
    if(novo){E.consultas.push({...c,...d});try{salvar()}catch(e){E.consultas.pop();throw e}}else tratamentoCommit(c,()=>Object.assign(c,d));
  },{principais:['tipoConsulta','data','hora','situacao','profissional','local'],obrigatorios:['data','profissional']});
}
function validarValorSaude(v){if(v!==''&&v!=null&&(SaudeTratamentos.numero(v)===null||+v<0))throw Error('Informe um valor válido ou deixe em branco.')}
function criarVinculoGastoSaude(ref,registro,d){
  if(gastoSaude(ref))throw Error('Este registro já está vinculado a Gastos.');
  const anterior=structuredClone(E.gastos);
  try{
    if(d.existente){const g=E.gastos.find(x=>x.id===d.existente);if(!g||g.origemRef)throw Error('Gasto indisponível ou já vinculado.');g.origemRef=ref;}
    else{
      const valor=SaudeTratamentos.numero(registro.valor);if(!(valor>0)||!dataISOValida(registro.data))throw Error('Informe o valor e a data antes de criar o gasto.');
      if(d.situacao==='Pago'&&(!dataISOValida(d.pagoEm)||d.pagoEm>hoje()))throw Error('Informe a data do pagamento realizado.');
      E.gastos.push({id:uid(),oque:d.descricao||'Despesa de saúde',classe:'Saúde',natureza:'Despesa pessoal',mes:registro.data.slice(0,7),data:registro.data,valor,origemRef:ref,situacao:d.situacao||'Não informado',pagoEm:d.situacao==='Pago'?d.pagoEm:'',obs:''});
    }salvar();
  }catch(e){E.gastos=anterior;throw e}
}
function vincularGastoSaude(ref,registro){
  const existente=gastoSaude(ref);if(existente){modalLancamentoGasto(existente);return}
  abrirModal('Vincular a Gastos','Escolha um lançamento existente ou crie um novo. O vínculo evita repetir a mesma despesa.',(c,fechar)=>{
    const f=el('<form class="rotina-form"><label>Lançamento<select name="existente"><option value="">Criar novo gasto</option>'+E.gastos.filter(g=>!g.origemRef).map(g=>'<option value="'+esc(g.id)+'">'+esc((g.data||g.mes)+' · '+g.oque+' · '+brl(g.valor))+'</option>').join('')+'</select></label><p>Valor registrado: <b>'+esc(SaudeTratamentos.numero(registro.valor)===null?'A informar':brl(registro.valor))+'</b>. Ao usar um gasto existente, o valor e o pagamento dele passam a valer aqui.</p><label>Descrição no financeiro<input name="descricao" value="Despesa de saúde"></label><label>Pagamento<select name="situacao"><option>Não informado</option><option>Pendente</option><option>Pago</option></select></label><label>Data do pagamento<input type="date" name="pagoEm"></label><p role="status"></p><button class="btn" type="submit">Salvar vínculo</button></form>');
    f.onsubmit=e=>{e.preventDefault();try{const d={};['existente','descricao','situacao','pagoEm'].forEach(k=>d[k]=f.querySelector('[name='+k+']').value);criarVinculoGastoSaude(ref,registro,d);fechar()}catch(e){f.querySelector('[role=status]').textContent=e.message}};c.append(f);
  });
}
function lembreteConsultaTratamento(c,retorno=false){
  const data=retorno?c.retorno:c.data,hora=retorno?c.horaRetorno:c.hora;
  if(c.situacao==='Cancelada'){alert('Consulta cancelada.');return}
  agendaTratamento({id:c.id+(retorno?'-retorno':'-consulta'),status:'Em andamento',proximaData:data,horario:hora});
}
function quadroConsultasTratamento(g){
  const box=el('<section class="trat-card"><div class="trat-toolbar"><h3>🩺 Consultas e retornos</h3></div><div class="trat-consultas"></div></section>');box.querySelector('.trat-toolbar').append(acao('+ Consulta / retorno',()=>editarConsultaTratamento(g),'mini'));
  const lista=E.consultas.filter(c=>c.tratamentoId===g.id).sort((a,b)=>(b.data||'').localeCompare(a.data||''));
  if(!lista.length)box.querySelector('.trat-consultas').append(el('<p class="trat-muted">Nenhuma consulta vinculada a este tratamento.</p>'));
  lista.forEach(c=>{const ref='saude:consulta:'+c.id,v=valorSaude(ref,c),row=el('<article class="trat-consulta"><header><strong>'+esc(c.tipoConsulta||'Consulta')+' · '+fmtDataAno(c.data)+(c.hora?' · '+esc(c.hora):'')+'</strong><span>'+esc(c.situacao||'A confirmar')+'</span></header><p><b>'+esc(c.profissional||g.medico||'Profissional a informar')+'</b> · '+esc(c.local||'Consultório a informar')+'</p><p>'+esc(c.endereco||'Endereço a informar')+' · '+esc(c.contato||'Contato a informar')+'</p><p>'+esc(c.conduta||c.motivo||'Orientações a registrar')+'</p><p>Retorno: '+(c.retorno?fmtDataAno(c.retorno):'A combinar')+' · Valor: <b>'+esc(v===null?'A informar':brl(v))+'</b>'+(gastoSaude(ref)?' · '+esc(gastoSaude(ref).situacao||'Pagamento não informado'):'')+'</p><div class="trat-actions"></div></article>');const a=row.querySelector('.trat-actions');a.append(acao('Editar',()=>editarConsultaTratamento(g,c),'ghost mini'),acao(gastoSaude(ref)?'💸 Ver gasto vinculado':'💸 Vincular a Gastos',()=>vincularGastoSaude(ref,c),'ghost mini'));if(c.situacao==='Agendada')a.append(acao('📅 Lembrete da consulta',()=>lembreteConsultaTratamento(c),'ghost mini'));if(c.retorno)a.append(acao('📅 Lembrete do retorno',()=>lembreteConsultaTratamento(c,true),'ghost mini'));const docs=el('<details><summary>📎 Documentos da consulta</summary></details>');docs.append(areaArquivos('consulta:'+c.id,'Receita, pedido ou recibo'));row.append(docs);box.querySelector('.trat-consultas').append(row)});return box;
}
function quadroEvolucaoGrupo(g,comTabela=true){
  const ms=medidasTratamento(g),box=el('<section class="trat-card"><div class="trat-toolbar"><h3>📈 Evolução do tratamento</h3><div class="trat-actions"></div></div><div class="trat-grafico"></div></section>');
  if(comTabela)box.querySelector('.trat-actions').append(acao('+ Medição',()=>editarMedidaTratamento(g),'mini'));box.querySelector('.trat-actions').append(acao('Vincular medição existente',()=>vincularMedidaTratamento(g),'ghost mini'),acao('+ Relato',()=>evolucaoTratamento(g),'ghost mini'));
  const select=el('<label class="trat-metrica">Indicador <select aria-label="Indicador de evolução">'+METRICAS_TRATAMENTO.map(([k,l])=>'<option value="'+k+'">'+l+'</option>').join('')+'</select></label>');select.querySelector('select').value=tratamentoMetrica;
  const graf=box.querySelector('.trat-grafico');box.insertBefore(select,graf);
  function desenhar(){graf.innerHTML='';const [k,l,u]=METRICAS_TRATAMENTO.find(x=>x[0]===tratamentoMetrica)||METRICAS_TRATAMENTO[0];const pontos=ms.filter(m=>SaudeTratamentos.numero(m[k])!==null);
    if(pontos.length<2)graf.append(el('<div class="trat-baseline"><span>◎</span><div><b>'+esc(pontos.length?Number(pontos[0][k]).toLocaleString('pt-BR')+' '+u:'Sem medição vinculada')+'</b><p>'+esc(pontos.length?'Ponto inicial em '+fmtDataAno(pontos[0].data)+'. A próxima medição permitirá comparar a evolução.':'Vincule uma medição existente ou registre os dados do exame.')+'</p></div></div>'));
    else{const valores=pontos.map(m=>+m[k]),min=Math.min(...valores),max=Math.max(...valores),range=max-min||1,xs=pontos.map(m=>Date.parse(m.data+'T12:00:00Z')),ini=Math.min(...xs),span=Math.max(...xs)-ini||1,coords=valores.map((v,i)=>[40+((xs[i]-ini)/span)*520,140-(v-min)/range*105]);graf.append(el('<svg viewBox="0 0 600 190" role="img" aria-label="'+esc(l+' por data. Valores na tabela abaixo.')+'"><title>'+esc(l+' · '+pontos.length+' medições')+'</title><path d="M40 155H570" stroke="var(--linha)"/><polyline points="'+coords.map(p=>p.join(',')).join(' ')+'" fill="none" stroke="var(--sucesso)" stroke-width="3"/>'+coords.map((p,i)=>'<circle cx="'+p[0]+'" cy="'+p[1]+'" r="5" fill="var(--sucesso)"><title>'+esc(fmtDataAno(pontos[i].data)+' · '+valores[i]+' '+u)+'</title></circle>').join('')+'<text x="40" y="180" fill="currentColor" font-size="12">'+fmtDataAno(pontos[0].data)+'</text><text x="560" y="180" text-anchor="end" fill="currentColor" font-size="12">'+fmtDataAno(pontos.at(-1).data)+'</text></svg>'));const delta=+(valores.at(-1)-valores[0]).toFixed(2);graf.append(el('<p class="trat-muted">Variação registrada: '+(delta>0?'+':'')+delta.toLocaleString('pt-BR')+' '+esc(u)+' entre a primeira e a última medição.</p>'))}
    const tabela=el('<div class="trat-medicoes"><table><caption>'+esc(l)+' · histórico do tratamento</caption><thead><tr><th>Data</th><th>Valor</th><th>Fonte</th><th>Detalhes</th></tr></thead><tbody></tbody></table></div>');ms.slice().reverse().forEach(m=>{const tr=document.createElement('tr');tr.innerHTML='<td>'+fmtDataAno(m.data)+'</td><td>'+esc(SaudeTratamentos.numero(m[k])===null?'Não informado':Number(m[k]).toLocaleString('pt-BR')+' '+u)+'</td><td>'+esc(m.fonte||'Registro de saúde')+'</td><td></td>';tr.lastElementChild.append(acao('Editar medição',()=>editarMedidaTratamento(g,m),'ghost mini'));tabela.querySelector('tbody').append(tr)});if(comTabela)graf.append(tabela);
  }select.querySelector('select').onchange=e=>{tratamentoMetrica=e.target.value;desenhar()};desenhar();
  for(const e of (g.evolucao||[]).slice().sort((a,b)=>b.data.localeCompare(a.data)))box.append(el('<div class="trat-historico"><b>'+fmtDataAno(e.data)+'</b><p>'+esc(e.descricao)+'</p><p>'+esc(e.efeitos||'')+'</p><p>'+esc(e.proximo||'')+'</p></div>'));
  return box;
}
function dashboardTratamento(grupo,abrir){
  const r=resumoGrupoTratamento(grupo),g=grupo.plano,ult=r.medidas.at(-1),box=el('<div class="trat-dashboard"><div class="trat-kpis"></div><div class="trat-dashboard-linha"></div></div>');
  const kpis=box.querySelector('.trat-kpis');
  for(const [k,l,u] of METRICAS_TRATAMENTO.slice(0,4)){const v=ult?SaudeTratamentos.numero(ult[k]):null;kpis.append(el('<article class="trat-kpi"><small>'+esc(l)+'</small><b>'+esc(v===null?'—':v.toLocaleString('pt-BR')+' '+u)+'</b><span>'+esc(v===null?'Ainda não informado':fmtDataAno(ult.data))+'</span></article>'))}
  const oper=el('<div class="trat-status-grid"></div>');[['💊',r.itens,'Itens prescritos','itens'],['🛒',r.comprados,'Com compra registrada','itens'],['✓',r.usos,'Usos registrados','itens'],['💸',r.custos.length>r.semValor?brl(r.total):'A informar','Valores informados','consultas']].forEach(([ic,v,l,tab])=>oper.append(acao(ic+' '+v+' · '+l,()=>tab==='consultas'?custosTratamento(grupo):abrir(tab),'ghost')));box.append(oper);
  box.querySelector('.trat-dashboard-linha').append(quadroEvolucaoGrupo(g,false));
  const dados=el('<section class="trat-card"><h3>🧬 Dados da última avaliação</h3><dl class="trat-dados"></dl><p class="trat-muted">'+esc(ult?(ult.fonte||'Registro de saúde')+' · '+fmtDataAno(ult.data):'Nenhuma medição vinculada.')+'</p></section>');METRICAS_TRATAMENTO.slice(4).forEach(([k,l,u])=>{const v=ult?SaudeTratamentos.numero(ult[k]):null;dados.querySelector('dl').append(el('<div><dt>'+l+'</dt><dd>'+esc(v===null?'A informar':v.toLocaleString('pt-BR')+' '+u)+'</dd></div>'))});box.querySelector('.trat-dashboard-linha').append(dados);
  const prox=[...r.consultas.filter(c=>c.situacao==='Agendada'&&c.data>=hoje()).map(c=>({data:c.data,label:c.tipoConsulta||'Consulta'})),...r.consultas.filter(c=>c.situacao!=='Cancelada'&&dataISOValida(c.retorno)&&c.retorno>=hoje()).map(c=>({data:c.retorno,label:'Retorno'})),...grupo.itens.filter(t=>SaudeTratamentos.lembrete(t)&&t.proximaData>=hoje()).map(t=>({data:t.proximaData,label:t.oque}))].sort((a,b)=>a.data.localeCompare(b.data));
  const rodape=el('<div class="trat-dashboard-linha"><section class="trat-card"><h3>📅 Próximos cuidados</h3>'+(prox.length?prox.slice(0,4).map(x=>'<p>'+fmtDataAno(x.data)+' · '+esc(x.label)+'</p>').join(''):'<p class="trat-muted">Nenhuma próxima data confirmada.</p>')+'</section><section class="trat-card"><h3>📋 Para completar</h3><p>'+r.pendentes+' itens aguardam confirmação do acompanhamento.</p><p>'+r.semValor+' compras ou consultas sem valor informado.</p><p class="trat-muted">Compra registrada não significa uso realizado. Valores não informados ficam fora da soma.</p></section></div>');box.append(rodape);return box;
}
function quadroTratamentos(){
  const sec=el('<section data-bid="sa-trat" class="tratamentos-hub"><div class="trat-toolbar"><h2>Meus tratamentos</h2><div class="trat-actions"></div></div><div class="trat-escolha"><nav class="trat-grupos" aria-label="Escolher plano de tratamento"></nav><details class="trat-avulsos"><summary></summary><div class="trat-avulsos-lista"></div></details></div><div class="trat-plano"></div></section>');
  sec.querySelector('.trat-actions').append(acao('+ Novo tratamento',()=>editarPlanoTratamento(),'mini'),acao('📎 Importar receitas',importarPacoteTratamentos,'ghost mini'));
  function pintar(){
    const grupos=gruposTratamento(),nav=sec.querySelector('.trat-grupos'),avulsos=sec.querySelector('.trat-avulsos'),conteudo=sec.querySelector('.trat-plano');nav.innerHTML='';conteudo.innerHTML='';avulsos.lastElementChild.innerHTML='';
    nav.hidden=!grupos.some(x=>x.principal);
    if(!grupos.length){avulsos.hidden=true;conteudo.append(el('<div class="trat-card"><h3>Um espaço para cada tratamento</h3><p>Crie um tratamento e reúna consultas, itens prescritos, documentos e evolução.</p></div>'));return}
    const grupo=grupos.find(x=>x.plano.id===tratamentoGrupoSelecionado)||grupos.find(x=>x.itens.some(i=>i.id===tratamentoSelecionado))||grupos[0],g=grupo.plano;tratamentoGrupoSelecionado=g.id;
    const soltos=grupos.filter(x=>!x.principal);avulsos.hidden=!soltos.length;avulsos.querySelector('summary').textContent='💊 Itens sem plano · '+soltos.length;avulsos.open=!grupo.principal;
    grupos.forEach(x=>{const b=acao((x.principal?'🩺 ':'💊 ')+(x.plano.oque||'Tratamento'),()=>{tratamentoGrupoSelecionado=x.plano.id;tratamentoSelecionado=x.principal?'':x.plano.id;tratamentoVisao=x.principal?'resumo':'itens';pintar()},'ghost');b.setAttribute('aria-pressed',String(x===grupo));(x.principal?nav:avulsos.lastElementChild).append(b)});
    if(!grupo.principal){conteudo.append(el('<header class="trat-avulso-head"><h3>💊 Medicamento ou cuidado sem plano</h3><p>Este cadastro não está vinculado a um plano de tratamento.</p></header>'));conteudo.append(quadroItensTratamento(grupo.itens,null,{selecionarPrimeiro:false}));return}
    const hero=el('<header class="trat-plano-hero"><span class="trat-plano-icone" aria-hidden="true">🩺</span><div><small>SEU TRATAMENTO · '+esc(g.status||'A confirmar')+'</small><h2>'+esc(g.oque||'Tratamento')+'</h2><p class="trat-medico"><b>'+esc(g.medico||'Médico a informar')+'</b>'+esc(g.clinica?' · '+g.clinica:'')+'</p><p>'+esc(g.motivo||g.especialidade||'Consultas, prescrições e evolução reunidas.')+'</p></div><div class="trat-actions"></div></header>');hero.querySelector('.trat-actions').append(acao('✏️ Editar tratamento',()=>editarPlanoTratamento(g),'ghost mini'));conteudo.append(hero);
    const local=el('<details class="trat-contato"><summary>📍 Consultório e informações do plano</summary><p>'+esc(g.enderecoMedico||'Endereço a informar')+' · '+esc(g.contatoMedico||'Contato a informar')+'</p><p>'+esc(g.obs||'')+'</p></details>');
    const tabs=el('<nav class="trat-subtabs" aria-label="Seções do tratamento"></nav>'),corpo=el('<div class="trat-corpo"></div>'),barra=el('<div class="trat-secoes-barra"></div>'),secoes=[['resumo','📊 Visão geral'],['consultas','🩺 Consultas e retornos'],['itens','💊 Itens prescritos'],['evolucao','📈 Evolução'],['documentos','📎 Documentos']],seletor=el('<label class="trat-secao-mobile">Seção do tratamento<select aria-label="Seção do tratamento">'+secoes.map(([k,l])=>'<option value="'+k+'"'+(tratamentoVisao===k?' selected':'')+'>'+l+'</option>').join('')+'</select></label>');barra.append(tabs,seletor,local);conteudo.append(barra,corpo);
    const abrir=v=>{tratamentoVisao=v;pintar()};seletor.querySelector('select').onchange=e=>abrir(e.target.value);secoes.forEach(([k,l])=>{const b=acao(l,()=>abrir(k),'ghost');b.setAttribute('aria-pressed',String(tratamentoVisao===k));tabs.append(b);if(k==='resumo'){
      const itensUso=grupo.itens.filter(t=>SaudeTratamentos.controlaEstoque(t)||['Medicamento','Suplemento'].includes(t.tipo));
      const registrar=acao('✓ Registrar uso',()=>{tratamentoSelecionado='';tratamentoFiltro='ativos';abrir('itens');conteudo.querySelector('.trat-item')?.focus()});
      registrar.disabled=!itensUso.length;if(registrar.disabled)registrar.title='Adicione um medicamento ou cuidado com unidade para registrar o uso.';hero.querySelector('.trat-actions').append(registrar);
    }});
    if(tratamentoVisao==='itens')corpo.append(quadroItensTratamento(grupo.itens,g,{selecionarPrimeiro:false}));
    else if(tratamentoVisao==='consultas')corpo.append(quadroConsultasTratamento(g));
    else if(tratamentoVisao==='evolucao')corpo.append(tabelaCompletaEvolucao(g),quadroEvolucaoGrupo(g,false));
    else if(tratamentoVisao==='documentos'){const docs=el('<section class="trat-card"><h3>📎 Documentos do tratamento</h3><p class="trat-muted">Receitas, exames e orientações deste plano.</p></section>');docs.append(areaArquivos('tratamento:'+g.id,'Adicionar foto ou PDF'));corpo.append(docs)}
    else corpo.append(dashboardTratamento(grupo,abrir));
  }pintar();return sec;
}

function custosTratamento(grupo){
  abrirModal('Custos do tratamento','Valores informados nas consultas e compras. Despesas vinculadas usam o valor atual de Gastos.',c=>{
    const r=resumoGrupoTratamento(grupo);c.append(el('<p><b>'+esc(r.custos.length>r.semValor?brl(r.total):'Valores a informar')+'</b> · '+r.semValor+' registros sem valor.</p>'));
    if(!r.custos.length)c.append(el('<p>Registre uma consulta ou compra para acompanhar seus custos.</p>'));
    r.custos.forEach(x=>{const v=valorSaude(x.ref,x.registro),g=gastoSaude(x.ref),row=el('<article class="trat-historico"><b>'+esc(x.nome)+'</b><p>'+esc(x.registro.data?fmtDataAno(x.registro.data):'Data a informar')+' · '+esc(x.registro.local||'Local a informar')+'</p><p>'+esc(v===null?'Valor a informar':brl(v))+' · '+esc(g?(g.situacao||'Pagamento não informado'):'Sem vínculo financeiro')+'</p></article>');row.append(acao(g?'Ver gasto vinculado':'Vincular a Gastos',()=>vincularGastoSaude(x.ref,x.registro),'ghost mini'));c.append(row)});
  });
}

/* Compras pessoais: uma referência estável liga recebimento e lançamento. */
function linhasComprasSaude(itens){
  return itens.flatMap(t=>{
    const compras=(t.compras||[]).map(c=>({t,c,comprado:true}));
    if(t.pedidoCompra)compras.unshift({t,c:t.pedidoCompra,comprado:false});
    else if(!compras.length&&!['Encerrado','Pausado'].includes(t.status)&&(SaudeTratamentos.controlaEstoque(t)||['Medicamento','Suplemento'].includes(t.tipo)))compras.unshift({t,c:{id:'pedido-'+t.id},comprado:false});
    return compras;
  });
}
function compraSaudeTransacao(t,fn){
  const antes=structuredClone(t),gastos=structuredClone(E.gastos),mt=Object.getOwnPropertyDescriptor(E,'_mt');
  try{fn();salvar()}catch(e){Object.keys(t).forEach(k=>delete t[k]);Object.assign(t,antes);E.gastos=gastos;if(mt)Object.defineProperty(E,'_mt',mt);else delete E._mt;throw e}
}
function salvarCompraListaSaude(t,id,d,comprado){
  if(!id)throw Error('Reabra a compra para continuar.');
  const anterior=(t.compras||[]).find(c=>c.id===id),ref='saude:compra:'+id;
  const num=SaudeTratamentos.numero;
  validarValorSaude(d.valor);
  if(d.quantidade!==''&&d.quantidade!=null&&!(num(d.quantidade)>0))throw Error('Informe uma quantidade positiva ou deixe em branco.');
  if(num(d.quantidade)!==null&&!SaudeTratamentos.controlaEstoque(t))throw Error('Defina a unidade no item antes de informar a quantidade.');
  if(comprado&&(!dataISOValida(d.data)||d.data>hoje()))throw Error('Informe a data em que recebeu a compra.');
  if(!comprado&&anterior)throw Error('Use Voltar a pendente para desfazer esta compra.');
  const atual=gastoSaude(ref),escolhido=d.existente?E.gastos.find(g=>g.id===d.existente):null;
  if(d.existente&&(!escolhido||(escolhido.origemRef&&escolhido.origemRef!==ref)))throw Error('Gasto indisponível ou vinculado a outra compra.');
  if(atual&&escolhido&&atual.id!==escolhido.id)throw Error('Esta compra já tem um gasto. Edite o vínculo atual.');
  if(comprado&&!escolhido&&!(num(d.valor)>0))throw Error('Informe o valor total da compra para vincular aos gastos, ou escolha um gasto existente.');
  if(comprado&&!escolhido&&d.situacao==='Pago'&&(!dataISOValida(d.pagoEm)||d.pagoEm>hoje()))throw Error('Informe a data do pagamento realizado.');
  compraSaudeTransacao(t,()=>{
    const c={...(anterior||t.pedidoCompra||{}),...d,id,quantidade:num(d.quantidade),valor:num(d.valor),atualizadoEm:new Date().toISOString()};delete c.existente;
    if(!comprado){t.pedidoCompra=c;return}
    const gastos=E.gastos.filter(g=>g.origemRef===ref);if(gastos.length>1)throw Error('Há mais de um gasto vinculado. Confira os lançamentos antes de continuar.');
    let g=atual||escolhido;
    if(escolhido&&!atual){c.valor=num(escolhido.valor);if(!(c.valor>0))throw Error('Escolha uma despesa com valor positivo.');g.origemRef=ref;c.gastoCriadoPelaLista=false;}
    else{
      if(!g){
        const guardado=t.pedidoCompra?.gastoRetirado;
        const gid=guardado?.id||'gasto-'+id;
        if(E.gastos.some(x=>x.id===gid))throw Error('O gasto foi alterado. Reabra a lista antes de confirmar.');
        g={...(guardado||{}),id:gid,oque:'Compra de saúde · '+t.oque,classe:'Saúde',natureza:'Despesa pessoal',origemRef:ref};E.gastos.push(g);c.gastoCriadoPelaLista=true;
      }
      Object.assign(g,{valor:num(d.valor),data:d.data,mes:d.data.slice(0,7),situacao:['Pago','Pendente'].includes(d.situacao)?d.situacao:'Não informado',pagoEm:d.situacao==='Pago'?d.pagoEm:''});
    }
    delete c.gastoRetirado;
    const compras=(t.compras||[]).filter(x=>x.id!==id);compras.push(c);
    const saldo=SaudeTratamentos.saldo({...t,compras});if(saldo!==null&&saldo<0)throw Error('A quantidade ficaria abaixo do consumo registrado. Confira os movimentos.');
    t.compras=compras;if(t.pedidoCompra?.id===id||!anterior)delete t.pedidoCompra;
  });
}
function desfazerCompraListaSaude(t,id){
  const c=(t.compras||[]).find(x=>x.id===id);if(!c)throw Error('Compra não encontrada.');
  if(t.pedidoCompra&&t.pedidoCompra.id!==id)throw Error('Já existe outra compra pendente para este item.');
  const compras=t.compras.filter(x=>x.id!==id),restante=SaudeTratamentos.saldo({...t,compras});
  if((restante!==null&&restante<0)||(restante===null&&(t.usos||[]).some(u=>!u.desfeitoEm)))throw Error('Não é possível desfazer sem conferir o estoque já consumido.');
  compraSaudeTransacao(t,()=>{
    const g=gastoSaude('saude:compra:'+id);t.pedidoCompra={...c};t.compras=compras;
    if(g&&c.gastoCriadoPelaLista){t.pedidoCompra.gastoRetirado=structuredClone(g);E.gastos=E.gastos.filter(x=>x.id!==g.id)}
    else if(g){delete g.origemRef; t.pedidoCompra.existente=g.id;}
  });
}
function formularioCompraListaSaude(linha,confirmar=false){
  const {t,c,comprado}=linha,g=gastoSaude('saude:compra:'+c.id);
  abrirModal(comprado?'Editar compra':confirmar?'Confirmar compra':'Planejar compra','Comprado registra o recebimento. O pagamento é informado separadamente.',(box,fechar)=>{
    const f=el('<form class="compra-saude-form"><label>Quantidade ('+esc(SaudeTratamentos.unidadeExibida(t.unidade)||'unidade não definida')+')<input name="quantidade" type="number" min="0.0001" step="any" inputmode="decimal"></label><label>Valor total (R$)<input name="valor" inputmode="decimal" placeholder="0,00"></label><label>Data da compra<input name="data" type="date"></label><label>Marca / fornecedor<input name="marca"></label><label>Pagamento<select name="situacao"><option>Não informado</option><option>Pendente</option><option>Pago</option></select></label><label>Data do pagamento<input name="pagoEm" type="date"></label><label class="compra-saude-amplo">Gasto<select name="existente"><option value="">'+(g?'Atualizar gasto já vinculado':'Criar gasto ao confirmar a compra')+'</option></select></label><p class="compra-saude-amplo compra-saude-nota">'+(g?'A edição atualiza o mesmo lançamento em Gastos.':'Se já lançou esta despesa, selecione o gasto existente para não duplicar. Planejar não lança despesas.')+'</p><p role="alert" class="compra-saude-amplo"></p><div class="compra-saude-amplo trat-actions"><button type="button" class="btn ghost" data-cancelar>Cancelar</button><button class="btn" type="submit">'+(comprado?'Salvar alterações':confirmar?'Confirmar comprado':'Salvar pendente')+'</button></div></form>');
    const bases={...c,data:c.data||hoje(),valor:g?g.valor:c.valor,situacao:g?.situacao||c.situacao||'Não informado',pagoEm:g?.pagoEm||c.pagoEm||''};
    for(const k of ['quantidade','valor','data','marca','situacao','pagoEm'])f.querySelector('[name='+k+']').value=k==='valor'&&bases[k]!=null?Number(bases[k]).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):bases[k]??'';
    const sel=f.querySelector('[name=existente]');
    if(!g)for(const x of E.gastos.filter(x=>!x.origemRef&&+x.valor>0))sel.append(el('<option value="'+esc(x.id)+'">'+esc((x.data||x.mes||'')+' · '+x.oque+' · '+brl(x.valor))+'</option>'));
    sel.value=c.existente||'';sel.disabled=!!g||!(comprado||confirmar);
    const vinculo=()=>{const usando=!!sel.value;for(const k of ['valor','situacao','pagoEm'])f.querySelector('[name='+k+']').disabled=usando};sel.onchange=vinculo;vinculo();
    f.querySelector('[data-cancelar]').onclick=fechar;
    f.onsubmit=e=>{e.preventDefault();const b=f.querySelector('[type=submit]');if(b.disabled)return;b.disabled=true;try{
      const d={};for(const k of ['quantidade','valor','data','marca','situacao','pagoEm','existente'])d[k]=f.querySelector('[name='+k+']').value;
      if(d.valor.trim())d.valor=financeiroNumero(d.valor);
      salvarCompraListaSaude(t,c.id,d,comprado||confirmar);fechar();
    }catch(e){f.querySelector('[role=alert]').textContent=e.message;b.disabled=false}};
    box.append(el('<h3>'+esc(t.oque)+'</h3>'),f);
  });
}
function quadroComprasSaude(itens){
  const box=el('<section class="compra-saude"><header class="trat-toolbar"><div><h3>🛒 Lista de compras</h3><p class="compra-saude-nota">Marque o que recebeu e acompanhe o custo nos seus gastos.</p></div></header><div class="compra-saude-totais"></div><div class="trat-filtros" aria-label="Situação da compra"></div><div class="compra-saude-linhas"></div></section>');let filtro='todos';
  const nova=()=>abrirModal('Adicionar à lista','Escolha o item que deseja comprar.',(b,fechar)=>{const s=el('<select aria-label="Item da compra">'+itens.filter(t=>!t.pedidoCompra).map(t=>'<option value="'+esc(t.id)+'">'+esc(t.oque)+'</option>').join('')+'</select>');const ok=acao('Adicionar pendente',()=>{const t=itens.find(t=>t.id===s.value);if(!t)return;try{tratamentoCommit(t,()=>{if(!t.pedidoCompra)t.pedidoCompra={id:uid()}});fechar()}catch(e){alert(e.message)}});ok.disabled=!s.options.length;b.append(s,ok)});
  box.querySelector('header').append(acao('+ Adicionar compra',nova,'ghost mini'));
  function pintar(){
    const linhas=linhasComprasSaude(itens),pend=linhas.filter(l=>!l.comprado),feitas=linhas.filter(l=>l.comprado);
    const total=ls=>ls.reduce((n,l)=>n+(SaudeTratamentos.numero(l.comprado?valorSaude('saude:compra:'+l.c.id,l.c):l.c.valor)||0),0);
    box.querySelector('.compra-saude-totais').innerHTML='<div><small>Pendentes · '+pend.length+'</small><b>'+brl(total(pend))+'</b><span>Estimativa informada</span></div><div><small>Comprados · '+feitas.length+'</small><b>'+brl(total(feitas))+'</b><span>Valores registrados</span></div><div><small>Valores a informar</small><b>'+linhas.filter(l=>SaudeTratamentos.numero(l.comprado?valorSaude('saude:compra:'+l.c.id,l.c):l.c.valor)===null).length+'</b><span>Não entram nos totais</span></div>';
    const filtros=box.querySelector('.trat-filtros');filtros.replaceChildren();for(const [k,n,q] of [['todos','Todos',linhas.length],['pendente','Pendentes',pend.length],['comprado','Comprados',feitas.length]]){const b=acao(n+' · '+q,()=>{filtro=k;pintar()},'ghost mini');b.setAttribute('aria-pressed',String(filtro===k));filtros.append(b)}
    const lista=box.querySelector('.compra-saude-linhas');lista.replaceChildren();
    for(const l of linhas.filter(l=>filtro==='todos'||(filtro==='comprado')===l.comprado)){
      const {t,c,comprado}=l,g=gastoSaude('saude:compra:'+c.id),v=comprado?valorSaude('saude:compra:'+c.id,c):SaudeTratamentos.numero(c.valor);
      const row=el('<article class="compra-saude-linha '+(comprado?'comprada':'pendente')+'"><label class="compra-saude-check"><input type="checkbox" aria-label="Comprado: '+esc(t.oque)+'"><span>'+ (comprado?'✓ Comprado':'Pendente')+'</span></label><div class="compra-saude-item"><strong>'+esc(t.oque)+'</strong><small>'+esc((c.quantidade==null?'Quantidade a informar':SaudeTratamentos.formatarNumero(c.quantidade)+' '+SaudeTratamentos.unidadeExibida(t.unidade))+(c.marca?' · '+c.marca:''))+'</small></div><div class="compra-saude-valor"><b>'+esc(v===null?'Valor a informar':brl(v))+'</b><small>'+esc(comprado?(g?'Vinculado a Gastos · '+(g.situacao||'Pagamento não informado'):'Sem vínculo financeiro'):'Compra pendente')+'</small></div><div class="trat-actions"></div></article>');
      const check=row.querySelector('input');check.checked=comprado;check.onchange=()=>{check.checked=comprado;if(!comprado){formularioCompraListaSaude(l,true);return}if(confirm('Voltar esta compra a pendente? A quantidade sai do estoque. O gasto criado por esta lista sai dos totais e pode ser restaurado; um gasto preexistente será apenas desvinculado.')){try{desfazerCompraListaSaude(t,c.id);pintar()}catch(e){alert(e.message)}}};
      const a=row.querySelector('.trat-actions');a.append(acao(comprado?'Editar':'Informar valor',()=>formularioCompraListaSaude(l),'ghost mini'));if(comprado)a.append(acao(g?'Ver gasto':'Vincular gasto',()=>vincularGastoSaude('saude:compra:'+c.id,c),'ghost mini'));lista.append(row);
    }
    if(!lista.children.length)lista.append(el('<p class="trat-empty">Nenhuma compra neste filtro.</p>'));
  }pintar();return box;
}
