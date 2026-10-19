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
    if((t.usos||[]).some(u=>!u.desfeitoEm&&u.data===uso.data&&u.hora===uso.hora))throw Error('Já existe um uso nesse horário. Confira o histórico.');
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
  const diario=t=>t.usoDiario===true||(t.usoDiario!==false&&numero(t.intervaloConsumoDias)===1);
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
    const item={...d,quantidade:numero(d.quantidade),id:compraId||uid(),atualizadoEm:new Date().toISOString()};
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
function tratamentoForm(titulo,campos,base,aoSalvar){
  abrirModal(titulo,'Salve apenas informações confirmadas. A prescrição original continua nos anexos.',(c,fechar)=>{
    const form=el('<form class="rotina-form"><div class="rotina-form-campos"></div><p role="status" class="rotina-form-erro"></p><div class="rotina-form-acoes"><button type="button" class="btn ghost" data-cancelar>Cancelar</button><button type="submit" class="btn">Salvar</button></div></form>');
    const grade=form.querySelector('.rotina-form-campos');
    campos.forEach(([k,label,tipo='text',opcoes])=>{const l=el('<label><span>'+esc(label)+'</span></label>');const inp=tipo==='textarea'?el('<textarea rows="3"></textarea>'):opcoes?el('<select>'+opcoesSelect(opcoes,base[k]||'',false)+'</select>'):el('<input type="'+tipo+'">');inp.name=k;if(tipo==='checkbox'){inp.checked=base[k]===true;l.classList.add('trat-campo-check')}else inp.value=base[k]??'';if(tipo==='number'){inp.step='any';inp.min='0'}l.append(inp);grade.append(l)});
    form.querySelector('[data-cancelar]').onclick=fechar;
    form.onsubmit=e=>{e.preventDefault();try{const dados={};campos.forEach(([k])=>{const input=form.querySelector('[name="'+k+'"]');dados[k]=input.type==='checkbox'?input.checked:String(input.value??'').trim()});aoSalvar(dados);fechar()}catch(err){form.querySelector('[role=status]').textContent=err.message}};
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
    if(!d.oque)throw Error('Informe o nome do tratamento.');
    for(const k of ['inicio','fim','proximaData'])if(d[k]&&!dataISOValida(d[k]))throw Error('Confira a data informada.');
    if(d.inicio&&d.fim&&d.fim<d.inicio)throw Error('O término deve ser posterior ao início.');
    for(const k of ['estoqueInicial','alertaEstoque'])if(d[k]!==''&&!(Number(d[k])>=0))throw Error('Estoque e limite devem ser positivos ou zero.');
    for(const k of ['consumoPorCiclo','intervaloConsumoDias'])if(d[k]!=null&&d[k]!==''&&!(Number.isFinite(Number(d[k]))&&Number(d[k])>0))throw Error('Informe um consumo e intervalo positivos ou deixe em branco.');
    if(d.intervaloConsumoDias!=null&&d.intervaloConsumoDias!==''&&!Number.isInteger(Number(d.intervaloConsumoDias)))throw Error('O intervalo deve ser informado em dias inteiros. Para uso diário, informe o total por dia.');
    if((t.compras||[]).length||(t.usos||[]).length){if(d.unidade!==t.unidade||String(d.estoqueInicial)!==String(t.estoqueInicial??''))throw Error('Há movimentos registrados: preserve a unidade e o estoque inicial; registre novas compras.');}
    if(novo){E.tratamentos.push({...t,...d});try{salvar()}catch(e){E.tratamentos.pop();throw e}}else tratamentoCommit(t,()=>Object.assign(t,d));
    tratamentoSelecionado=t.id;tratamentoGrupoSelecionado=t.origemTratamentoId||t.id;tratamentoVisao='itens';abaSaude='tratamentos';
  });
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
function quadroItensTratamento(itens,grupo,{selecionarPrimeiro=true}={}){
  const sec=el('<section class="tratamentos-itens"><div class="trat-toolbar"><h2>Medicamentos e cuidados</h2><div class="trat-actions"></div></div><div class="trat-filtros"></div><div class="trat-split"><aside class="trat-lista" aria-label="Itens prescritos do tratamento"></aside><div class="trat-detalhe"></div></div></section>');
  const actions=sec.querySelector('.trat-actions');actions.append(acao('+ Medicamento / cuidado',()=>editarTratamento(null,grupo),'ghost mini'));
  function pintar(){
    const ativos=itens.filter(t=>!['Encerrado','Pausado'].includes(t.status));
    const lista=tratamentoFiltro==='ativos'?ativos:tratamentoFiltro==='compras'?ativos.filter(t=>SaudeTratamentos.controlaEstoque(t)&&['Sem estoque','Comprar mais','Não informado'].includes(SaudeTratamentos.estoque(t))):itens;
    const filtros=sec.querySelector('.trat-filtros');filtros.innerHTML='';[['ativos','Em acompanhamento',ativos.length],['compras','Compras',ativos.filter(t=>SaudeTratamentos.controlaEstoque(t)&&['Sem estoque','Comprar mais','Não informado'].includes(SaudeTratamentos.estoque(t))).length],['todos','Todos',itens.length]].forEach(([k,n,q])=>{const b=acao(n+' · '+q,()=>{tratamentoFiltro=k;pintar()},'ghost mini');b.setAttribute('aria-pressed',String(tratamentoFiltro===k));filtros.append(b)});
    const l=sec.querySelector('.trat-lista'),d=sec.querySelector('.trat-detalhe');l.innerHTML='';d.innerHTML='';
    if(!lista.length){d.append(el('<div class="trat-empty"><h3>Nenhum item neste filtro</h3><p>Adicione os medicamentos e cuidados prescritos para este tratamento.</p></div>'));return}
    const t=lista.find(x=>x.id===tratamentoSelecionado)||(selecionarPrimeiro?lista[0]:null);if(t)tratamentoSelecionado=t.id;
    lista.forEach(x=>{const b=el('<button type="button" class="trat-item"><strong>'+esc(x.oque||'Sem nome')+'</strong><small>'+esc(x.tipo||'Tratamento')+' · '+esc(x.status||'A confirmar')+'</small><span>'+esc(SaudeTratamentos.controlaEstoque(x)?SaudeTratamentos.estoque(x):'Acompanhamento')+'</span></button>');b.setAttribute('aria-pressed',String(x===t));b.onclick=()=>{tratamentoSelecionado=x.id;pintar()};l.append(b)});
    if(!t){d.append(el('<div class="trat-empty"><h3>💊 Escolha um medicamento ou cuidado</h3><p>Selecione um item da lista para consultar a orientação, os documentos e os registros ou informar um uso realizado.</p><p>Nenhum medicamento foi selecionado automaticamente.</p></div>'));return}
    const saldo=SaudeTratamentos.saldo(t),compras=(t.compras||[]).slice().sort((a,b)=>(a.data||'').localeCompare(b.data||'')),previsao=previsaoEstoqueTratamento(t),usos=(t.usos||[]).filter(x=>!x.desfeitoEm),evolucao=t.evolucao||[];
    d.append(el('<header><small>'+esc(t.tipo||'Tratamento')+'</small><h3>'+esc(t.oque||'Tratamento')+'</h3><p>'+esc(t.status||'A confirmar')+(t.inicio?' · início '+fmtDataAno(t.inicio):' · início não confirmado')+'</p></header>'));
    const mostrarUso=id=>{pintar();const linha=[...d.querySelectorAll('[data-uso-id]')].find(r=>r.dataset.usoId===id);if(linha?.closest('details'))linha.closest('details').open=true;const alvo=linha||d.querySelector('.trat-usos-recentes');alvo?.focus({preventScroll:true});alvo?.scrollIntoView({block:'nearest'})};
    const usoDireto=SaudeTratamentos.controlaEstoque(t)||['Medicamento','Suplemento'].includes(t.tipo)?quadroUsoDireto(t,mostrarUso):null;
    const a=el('<div class="trat-actions"></div>');a.append(acao('✏️ Editar',()=>editarTratamento(t),'ghost mini'));if(SaudeTratamentos.controlaEstoque(t))a.append(acao('🛒 Compra',()=>comprarTratamento(t),'ghost mini'));a.append(acao('📈 Evolução',()=>evolucaoTratamento(t),'ghost mini'),acao('📅 Lembrete',()=>agendaTratamento(t),'ghost mini'));d.append(a);if(usoDireto)d.append(usoDireto);
    if(SaudeTratamentos.diario(t)&&!(t.horariosUso?.length>1)){
      const feito=!!SaudeTratamentos.usoHoje(t),configurado=SaudeTratamentos.controlaEstoque(t)&&SaudeTratamentos.numero(t.consumoPorCiclo)>0;
      const bloco=el('<section class="trat-diario"><label><input type="checkbox" data-uso-diario><span></span></label><p></p><p role="status" data-erro-uso-diario></p></section>'),check=bloco.querySelector('input');
      check.checked=feito;check.disabled=feito||!SaudeTratamentos.ativo(t)||!configurado;
      bloco.querySelector('span').textContent=feito?'Uso registrado hoje':'Usei hoje';
      bloco.querySelector('p').textContent=feito?'Confira data, horário e quantidade na linha abaixo.':!SaudeTratamentos.ativo(t)?'Confirme o início em Registrar uso ou confira a situação em Editar.':!configurado?'Em Editar, informe a unidade e a quantidade total diária para usar este check.':'Registra hoje e desconta '+SaudeTratamentos.formatarNumero(t.consumoPorCiclo)+' '+SaudeTratamentos.unidadeExibida(t.unidade)+' do estoque informado.';
      check.onchange=()=>{if(!check.checked)return;try{tratamentoCommit(t,()=>SaudeTratamentos.registrarUsoDiario(t));mostrarUso(t.usos?.at(-1)?.id)}catch(e){check.checked=false;bloco.querySelector('[data-erro-uso-diario]').textContent=e.message}};
      d.append(bloco);
    }
    if(t.horariosUso?.length>1)d.append(el('<p class="trat-uso-nota">Tomadas configuradas: '+esc(t.horariosUso.join(' · '))+'. Registre cada ocorrência na tela Hoje ou selecione o horário no formulário acima.</p>'));
    if(usoDireto||usos.length)d.append(quadroUsosRecentes(t,mostrarUso));
    const resumo=el('<div class="trat-resumo"></div>'),resumoCards=[];
    if(SaudeTratamentos.controlaEstoque(t)&&!usoDireto)resumoCards.push(['Estoque',saldo===null?'Quantidade a confirmar':SaudeTratamentos.formatarNumero(saldo)+' '+SaudeTratamentos.unidadeExibida(t.unidade),saldo===null?'Complete a quantidade em Editar ou Compra.':SaudeTratamentos.estoque(t)]);
    if(compras.at(-1)?.data)resumoCards.push(['Última compra',fmtDataAno(compras.at(-1).data),compras.at(-1).marca||'Marca não informada']);
    if(previsao.data)resumoCards.push(['Previsão de acabar',fmtDataAno(previsao.data),previsao.motivo]);
    if(t.proximaData)resumoCards.push(['Próximo cuidado',fmtDataAno(t.proximaData),t.horario||'Horário a definir']);
    resumoCards.forEach(([titulo,valor,nota])=>resumo.append(el('<div><small>'+esc(titulo)+'</small><b>'+esc(valor)+'</b><span>'+esc(nota)+'</span></div>')));
    if(!SaudeTratamentos.controlaEstoque(t))resumo.append(el('<p class="trat-previsao-pendente">Estoque: Não se aplica · sem controle de material.</p>'));
    if(!previsao.data){const nota=el('<p class="trat-previsao-pendente"></p>');nota.textContent='Previsão de duração: '+previsao.motivo;resumo.append(nota)}
    d.append(resumo);

    d.append(el('<section class="trat-info"><h4>📋 Orientação registrada</h4><p class="trat-texto">'+esc(t.frequencia||'Consulte a receita e registre a orientação.')+'</p>'+(t.obs?'<p class="trat-texto trat-aviso">'+esc(t.obs)+'</p>':'')+'<p class="trat-muted">O estoque considera apenas os usos registrados.</p></section>'));
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
  });
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
  ],m||{data:hoje()},d=>{const dados=validarMedidaTratamento(d);if(m)tratamentoCommit(m,()=>Object.assign(m,dados,{tratamentoId:g.id}));else{E.peso.push({...dados,id:uid(),tratamentoId:g.id});try{salvar()}catch(e){E.peso.pop();throw e}}});
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
  });
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
    const tabs=el('<nav class="trat-subtabs" aria-label="Seções do tratamento"></nav>'),corpo=el('<div class="trat-corpo"></div>'),barra=el('<div class="trat-secoes-barra"></div>');barra.append(tabs,local);conteudo.append(barra,corpo);
    const abrir=v=>{tratamentoVisao=v;pintar()};[['resumo','📊 Visão geral'],['consultas','🩺 Consultas e retornos'],['itens','💊 Itens prescritos'],['evolucao','📈 Evolução'],['documentos','📎 Documentos']].forEach(([k,l])=>{const b=acao(l,()=>abrir(k),'ghost');b.setAttribute('aria-pressed',String(tratamentoVisao===k));tabs.append(b);if(k==='resumo'){
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
