/* Vínculo único entre pagamentos dos imóveis, avião e viagens e o livro de Gastos.
   Consultar ou cadastrar um bem não importa pagamentos antigos. */
function gastoVinculado(g) {
  return Boolean(g && ((g.holdingImovelId && (g.holdingParcelaId || g.holdingPagamentoId || g.holdingDespesaId)) || (g.aviaoTipo && g.aviaoRegistroId) || (g.viagemId && g.viagemCustoId)));
}
function aviaoRefPagamento(tipo,id) {
  if (!['aportes','mensalidades','despesas'].includes(tipo) || typeof id!=='string' || !id.trim()) throw Error('Registro do avião inválido.');
  return 'aviao:principal:'+tipo+':'+encodeURIComponent(id);
}
function gastoReferenciaOrigem(g) {
  if (!gastoVinculado(g)) return null;
  if (g.aviaoTipo) return aviaoRefPagamento(g.aviaoTipo,g.aviaoRegistroId);
  if (g.viagemId&&g.viagemCustoId) return viagemRefCusto(g.viagemId,g.viagemCustoId);
  const tipo=g.holdingParcelaId?'parcela':g.holdingDespesaId?'despesa':'pagamento';
  return HoldingUI.refAnexos(g.holdingImovelId,tipo,g.holdingParcelaId||g.holdingDespesaId||g.holdingPagamentoId);
}
function pagamentoReferenciaCompartilhada(ref) {
  const gasto=ref.startsWith('gasto:') && (E.gastos||[]).find(g=>'gasto:'+g.id===ref);
  if (gastoVinculado(gasto)) return gastoReferenciaOrigem(gasto);
  // Uma operação conciliada pode aparecer na aquisição e nas despesas.
  // Os vínculos explícitos apontam para o mesmo gasto e o mesmo comprovante.
  for(const g of E.gastos||[]) {
    if(!g.holdingImovelId)continue;
    const vinculos=[['parcela',g.holdingParcelaId],['despesa',g.holdingDespesaId],['pagamento',g.holdingPagamentoId]];
    if(vinculos.some(([tipo,id])=>id && HoldingUI.refAnexos(g.holdingImovelId,tipo,id)===ref))return gastoReferenciaOrigem(g);
  }
  for(const v of E.viagens||[])if((v.custos||[]).some(c=>c.id&&viagemRefCusto(v.id,c.id)===ref))return ref;
  for (const i of E.holdingImoveis||[]) {
    for (const [chave,tipo] of [['parcelas','parcela'],['pagamentos','pagamento'],['despesas','despesa']]) {
      if ((i[chave]||[]).some(p=>HoldingUI.refAnexos(i.id,tipo,p.id)===ref)) return ref;
    }
  }
  for (const tipo of ['aportes','mensalidades','despesas']) if ((E.aviao?.[tipo]||[]).some(p=>aviaoRefPagamento(tipo,p.id)===ref)) return ref;
  return null;
}
function pagamentoEmpresa(id) {
  if (!id) return {empresaId:'',empresa:''};
  const e=(E.empresasPJ||[]).find(e=>e.id===id);
  if (!e) throw Error('Confira a empresa vinculada antes de registrar o pagamento.');
  return {empresaId:e.id,empresa:e.nome};
}
function prepararGastoAutomatico(vinculo,ref,campos) {
  const gastos=E.gastos||[],mesmo=g=>Object.entries(vinculo).every(([k,v])=>g[k]===v);
  const encontrados=gastos.filter(mesmo);
  if(encontrados.length>1) throw Error('Há mais de um gasto vinculado a este pagamento. Confira os lançamentos.');
  const anterior=encontrados[0];
  if (!campos) return {gastos:anterior?gastos.filter(g=>g!==anterior):gastos,anterior,conferir:lista=>!lista.some(mesmo)};
  if (!dataISOValida(campos.pagoEm) || !(campos.valor>0) || !Number.isSafeInteger(Math.round(campos.valor*100))) throw Error('Informe o valor pago e a data do pagamento.');
  const id=anterior?.id || 'gasto:'+ref;
  if(!anterior && gastos.some(g=>g.id===id)) throw Error('O identificador do gasto já está em uso.');
  const esperado={...anterior,...campos,...vinculo,id,
    oque:anterior?.oque || campos.oque,classe:anterior?.classe || campos.classe || 'Outros',
    situacao:'Pago',data:campos.pagoEm,mes:campos.pagoEm.slice(0,7)};
  const conferir=lista=>{const itens=lista.filter(mesmo);return itens.length===1&&holdingMesmosDados(itens[0],esperado);};
  return {gastos:holdingMesmosDados(anterior,esperado)?gastos:anterior?gastos.map(g=>g===anterior?esperado:g):[...gastos,esperado],anterior,conferir};
}
async function aviaoMarcarPago(tipo,baseItem,data=hoje()) {
  if(!['mensalidades','despesas'].includes(tipo)||!baseItem?.id)throw Error('Escolha uma conta da aeronave.');
  if(baseItem.status==='Cancelado')throw Error('Este lançamento está cancelado.');
  if(baseItem.status==='Pago')throw Error('Este lançamento já está pago.');
  return aviaoGravarRegistro(tipo,{...baseItem,status:'Pago',pagoEm:data},baseItem);
}
async function aviaoGravarRegistro(tipo,dados,baseItem=null,{excluir=false,viagemObrigatoria=false}={}) {
  aviaoRefPagamento(tipo,dados.id);
  await holdingConferirBase();
  if(viagemObrigatoria && !(E.viagens||[]).some(v=>v.id===dados.viagemId&&v.aviaoId==='principal'&&v.status!=='Cancelado'))throw Error('A viagem mudou ou não está mais disponível neste avião. Confira a viagem antes de salvar.');
  const a=E.aviao,lista=a[tipo]||[],atual=lista.find(x=>x.id===dados.id);
  if (lista.filter(x=>x.id===dados.id).length>1) throw Error('Identificador repetido no avião.');
  if (baseItem && (!atual || baseItem.id!==dados.id)) holdingConflito();
  if (!holdingMesmosDados(atual,baseItem) && !holdingMesmosDados(atual,{...dados,editadoManual:true})) holdingConflito();
  const registro={...dados,editadoManual:true};
  const aporte=tipo==='aportes',mensal=tipo==='mensalidades';
  if(!excluir) {
    const datas=aporte?['data']:mensal?['competencia','vencimento']:['data'];
    if(datas.some(k=>!dataISOValida(registro[k]))) throw Error('Confira as datas.');
    if(!aporte && !['Pago','Cancelado',mensal?'A Vencer':'Pendente'].includes(registro.status)) throw Error('Confira a situação do pagamento.');
    if(!aporte && registro.pagoEm && !dataISOValida(registro.pagoEm)) throw Error('Confira a data do pagamento.');
    if(!aporte && !mensal && !registro.descricao?.trim()) throw Error('Informe a descrição.');
    const valor=aporte?registro.valor:registro.minhaCota;
    if(!Number.isFinite(valor)||valor<0) throw Error('Confira o valor da sua parte.');
  }
  const pago=!excluir&&(aporte||registro.status==='Pago');
  const vinculo={aviaoTipo:tipo,aviaoRegistroId:registro.id};
  const integrado=prepararGastoAutomatico(vinculo,aviaoRefPagamento(tipo,registro.id),pago?{
    oque:(a.nome||'Avião')+' · '+(aporte?'Aquisição da cota':mensal?'Mensalidade '+registro.competencia.slice(0,7):registro.descricao),
    valor:Math.round((aporte?registro.valor:registro.minhaCota)*100)/100,
    pagoEm:aporte?registro.data:registro.pagoEm,vencimento:mensal?registro.vencimento:'',
    ...pagamentoEmpresa(a.gastosEmpresaId)
  }:null);
  if(!pago && integrado.anterior && !excluir) registro.historicoGastos=[...(atual?.historicoGastos||[]),{em:new Date().toISOString(),gasto:integrado.anterior}];
  let viagens=E.viagens;
  if(!excluir && tipo==='despesas' && registro.viagemId) {
    if(!viagens.some(v=>v.id===registro.viagemId)) throw Error('A viagem vinculada não existe mais.');
    viagens=viagens.map(v=>v.id===registro.viagemId?{...v,aviaoId:'principal',transporte:v.transporte||'Avião próprio'}:v);
  }
  const proximo={...a,[tipo]:excluir?lista.filter(x=>x.id!==registro.id):atual?lista.map(x=>x.id===registro.id?registro:x):[...lista,registro]};
  if(excluir && atual) proximo.registrosExcluidos=[...(a.registrosExcluidos||[]),{em:new Date().toISOString(),tipo,registro:atual,gasto:integrado.anterior||null}];
  const antes={aviao:E.aviao,gastos:E.gastos,viagens:E.viagens,mt:E._mt};
  E.aviao=proximo;E.gastos=integrado.gastos;E.viagens=viagens;
  try {salvar();} catch(erro) {E.aviao=antes.aviao;E.gastos=antes.gastos;E.viagens=antes.viagens;E._mt=antes.mt;falhaSync(erro);throw Error('Não foi possível salvar neste dispositivo. Confira o armazenamento e tente novamente.');}
  if(holdingLocal()) return 'Salvo neste dispositivo de prévia.';
  const confirmado=await enviarNuvem();
  const presente=estado=>holdingMesmosDados(estado.aviao?.[tipo]?.find(x=>x.id===registro.id),excluir?null:registro)&&integrado.conferir(estado.gastos||[])&&(!excluir||!atual||(estado.aviao?.registrosExcluidos||[]).some(h=>h.tipo===tipo&&holdingMesmosDados(h.registro,atual)&&holdingMesmosDados(h.gasto,integrado.anterior)));
  if(!presente(E)) holdingConflito();
  const remoto=!confirmado&&_tabConteudo?JSON.parse(_tabConteudo):null;
  return confirmado||(remoto&&presente(remoto))?'Salvo e sincronizado.':'Salvo neste dispositivo. Sincronização pendente.';
}
function aviaoHistoricoRegistros() {
  const historico=E.aviao?.registrosExcluidos||[];
  if(!historico.length)return null;
  const area=el('<details class="ff-attachments"><summary>Histórico de registros removidos</summary></details>');
  for(const h of [...historico].reverse()) {
    const registro=h.registro,linha=el('<details><summary></summary></details>');
    linha.querySelector('summary').textContent=(registro.descricao||registro.competencia||registro.data||'Pagamento')+' · '+brl(registro.valor??registro.minhaCota)+' · removido em '+fmtDataAno(h.em.slice(0,10));
    linha.appendChild(areaArquivos(aviaoRefPagamento(h.tipo,registro.id),'Comprovantes preservados',true));area.appendChild(linha);
  }
  return area;
}

/* O indicador é derivado dos arquivos: anexar não altera nem cria pagamentos. */
function pagamentoComprovante(ref,rotulo,botaoExistente=null) {
  const area=el('<div class="pagamento-comprovante"><span class="pagamento-comprovante-status" role="status">Conferindo anexos…</span></div>');
  area.dataset.comprovanteRef=ref;
  const status=area.firstElementChild;
  const botao=botaoExistente||acao('Anexar comprovante',()=>{
    let arquivos;
    abrirModal('Comprovante do pagamento',esc(rotulo),corpo=>{
      corpo.appendChild(el('<p class="ff-note">O mesmo arquivo fica disponível no pagamento e em Gastos quando vinculados. Anexar aqui não cria outro lançamento.</p>'));
      arquivos=areaArquivos(ref,'Anexar comprovante');corpo.appendChild(arquivos);
    },null,{recarregar:false,antesFechar:()=>!arquivos?.querySelector('.solta[aria-busy="true"]')});
  },'ghost');
  area.appendChild(botao);
  let geracao=0;
  area.atualizarComprovante=async()=>{
    const versao=++geracao;
    try {
      const [arquivos,indice]=await Promise.all([arqPor(ref),arqIndice()]);
      if(versao!==geracao)return;
      const indisponivel=naNuvem()&&!indice;
      const pendente=naNuvem()&&arquivos.some(a=>a.pendente);
      area.dataset.estadoComprovante=indisponivel?'indisponivel':arquivos.length?'anexado':'ausente';
      status.textContent=indisponivel?'Não foi possível conferir os anexos':arquivos.length?`${arquivos.length} ${arquivos.length===1?'arquivo anexado':'arquivos anexados'}${pendente?' · sincronização pendente':''}`:'Sem comprovante';
      botao.textContent=arquivos.length?'Ver / anexar comprovante':'Anexar comprovante';
      botao.setAttribute('aria-label',botao.textContent+': '+rotulo);
    } catch(erro) {
      if(versao!==geracao)return;
      area.dataset.estadoComprovante='indisponivel';status.textContent='Não foi possível conferir os anexos';
      botao.textContent='Ver / anexar comprovante';botao.setAttribute('aria-label',botao.textContent+': '+rotulo);
    }
  };
  area.atualizarComprovante();return area;
}
function pagamentoAtualizarComprovantes(ref) {
  const canonico=r=>pagamentoReferenciaCompartilhada(r)||r;
  const origem=ref&&canonico(ref);
  return Promise.all([...document.querySelectorAll('[data-comprovante-ref]')]
    .filter(n=>!origem||canonico(n.dataset.comprovanteRef)===origem)
    .map(n=>n.atualizarComprovante?.()||n.atualizarArquivos?.()));
}

function aviaoCategoriasCustos() {
  return ['Mensalidade','Internet / Comunicação','Manutenção Extra','Taxas / Hangaragem','Combustível','Seguro','Licenças / Documentação','Equipamentos','Outro'];
}
function aviaoLinhasCustos(a) {
  return [...(a.mensalidades||[]).map(x=>({...x,colecao:'mensalidades',categoria:x.categoria||'Mensalidade',descricao:x.descricao||'Mensalidade da aeronave',dataVencimento:x.vencimento})),
    ...(a.despesas||[]).map(x=>({...x,colecao:'despesas',categoria:x.categoria||'Outro',dataVencimento:x.vencimento||x.data}))];
}
function aviaoResumoCustos(a,mes='',categoria='') {
  const linhas=aviaoLinhasCustos(a).filter(x=>(!categoria||x.categoria===categoria)&&(!mes||(x.status==='Pago'?x.pagoEm:x.dataVencimento)?.startsWith(mes)));
  const ativos=linhas.filter(x=>x.status!=='Cancelado');
  const soma=xs=>xs.reduce((s,x)=>s+Math.round((+x.minhaCota||0)*100),0)/100;
  const categorias=[...new Set([...aviaoCategoriasCustos(),...aviaoLinhasCustos(a).map(x=>x.categoria)])];
  return {linhas,total:soma(ativos),pago:soma(ativos.filter(x=>x.status==='Pago')),aberto:soma(ativos.filter(x=>x.status!=='Pago')),
    categorias:categorias.filter(c=>!categoria||c===categoria).map(nome=>({nome,pago:soma(ativos.filter(x=>x.categoria===nome&&x.status==='Pago')),aberto:soma(ativos.filter(x=>x.categoria===nome&&x.status!=='Pago'))}))};
}
function aviaoCriarSerieCustos(tipo,dados,quantidade,intervalo=1) {
  if(!['despesas','mensalidades'].includes(tipo))throw Error('Escolha um custo da aeronave.');
  aviaoRefPagamento(tipo,dados.id);
  if(!Number.isInteger(quantidade)||quantidade<1||quantidade>360||![1,2,3,6,12].includes(intervalo))throw Error('Informe de 1 a 360 lançamentos e uma frequência válida.');
  if(dados.status==='Pago'||dados.status==='Cancelado')throw Error('Crie a recorrência em aberto e registre cada pagamento separadamente.');
  if(!Number.isFinite(dados.minhaCota)||dados.minhaCota<=0||!Number.isSafeInteger(Math.round(dados.minhaCota*100)))throw Error('Informe o valor da sua parte.');
  if(tipo==='despesas'&&!dados.descricao?.trim())throw Error('Informe a descrição.');
  const inicio=tipo==='mensalidades'?dados.vencimento:dados.data;
  if(!dataISOValida(inicio))throw Error('Informe o primeiro vencimento.');
  return Array.from({length:quantidade},(_,i)=>{
    const data=HoldingModelo.vencimentoDoMes(inicio,i*intervalo);
    return {...dados,id:dados.id+':recorrencia:'+i,grupoId:dados.id,numero:i+1,quantidade,intervaloMeses:intervalo,
      ...(tipo==='mensalidades'?{vencimento:data,competencia:data.slice(0,7)+'-01'}:{data}),
      minhaCota:Math.round(dados.minhaCota*100)/100,pagoEm:'',status:tipo==='mensalidades'?'A Vencer':'Pendente',editadoManual:true};
  });
}
async function aviaoGravarSerieCustos(tipo,dados,quantidade,intervalo=1) {
  const novos=aviaoCriarSerieCustos(tipo,dados,quantidade,intervalo);
  await holdingConferirBase();
  const a=E.aviao,lista=a[tipo]||[];
  const ids=new Set(novos.map(x=>x.id));
  if(lista.some(x=>ids.has(x.id))) {
    if(novos.every(x=>lista.filter(y=>y.id===x.id).length===1&&holdingMesmosDados(lista.find(y=>y.id===x.id),x)))return 'Recorrência já cadastrada.';
    throw Error('Esta recorrência já existe ou foi alterada. Confira os lançamentos.');
  }
  if(dados.viagemId)throw Error('Cadastre custos de viagem individualmente.');
  const antes={aviao:a,mt:E._mt};
  E.aviao={...a,[tipo]:[...lista,...novos]};
  try{salvar();}catch(erro){E.aviao=antes.aviao;E._mt=antes.mt;falhaSync(erro);throw Error('Não foi possível salvar a recorrência neste dispositivo.');}
  if(holdingLocal())return 'Recorrência salva neste dispositivo de prévia.';
  const confirmado=await enviarNuvem();
  const presente=estado=>novos.every(x=>holdingMesmosDados(estado.aviao?.[tipo]?.find(y=>y.id===x.id),x));
  if(!presente(E))holdingConflito();
  const remoto=!confirmado&&_tabConteudo?JSON.parse(_tabConteudo):null;
  return confirmado||(remoto&&presente(remoto))?'Salvo e sincronizado.':'Salvo neste dispositivo. Sincronização pendente.';
}

function viagemRefCusto(viagemId,custoId) {
  if([viagemId,custoId].some(id=>typeof id!=='string'||!id.trim()))throw Error('Gasto da viagem sem identificador.');
  return 'viagem:'+encodeURIComponent(viagemId)+':custo:'+encodeURIComponent(custoId);
}
async function viagemGravarCusto(viagemId,dados,baseItem=null,{excluir=false}={}) {
  const ref=viagemRefCusto(viagemId,dados.id);
  await holdingConferirBase();
  const viagem=E.viagens.find(v=>v.id===viagemId);
  if(!viagem)throw Error('A viagem não existe mais.');
  const lista=viagem.custos||[],atual=lista.find(x=>x.id===dados.id),registro={...dados,editadoManual:true};
  if(lista.filter(x=>x.id===dados.id).length>1)throw Error('Identificador repetido nos gastos da viagem.');
  if(baseItem&&(!atual||baseItem.id!==dados.id))holdingConflito();
  if(!holdingMesmosDados(atual,baseItem)&&!holdingMesmosDados(atual,registro))holdingConflito();
  if(!excluir){
    if(!Number.isFinite(registro.valor)||registro.valor<=0||!Number.isSafeInteger(Math.round(registro.valor*100)))throw Error('Informe um valor maior que zero.');
    if(!registro.descricao?.trim()&&!registro.categoria?.trim())throw Error('Informe a descrição ou a categoria.');
    if(!['Pago','Pendente','Não informado'].includes(registro.situacao||'Não informado'))throw Error('Confira a situação do pagamento.');
    if(registro.data&&!dataISOValida(registro.data))throw Error('Confira a data da despesa.');
    if(registro.pagoEm&&(registro.situacao!=='Pago'||!dataISOValida(registro.pagoEm)))throw Error('Confira a data e a situação do pagamento.');
  }
  const integrado=prepararGastoAutomatico({viagemId,viagemCustoId:registro.id},ref,!excluir&&registro.situacao==='Pago'?{
    oque:(viagem.evento||viagem.cidade||'Viagem')+' · '+(registro.descricao||registro.categoria),
    valor:Math.round(registro.valor*100)/100,pagoEm:registro.pagoEm,...pagamentoEmpresa(viagem.gastosEmpresaId)
  }:null);
  if(!excluir&&registro.situacao!=='Pago'&&integrado.anterior)registro.historicoGastos=[...(atual?.historicoGastos||[]),{em:new Date().toISOString(),gasto:integrado.anterior}];
  const proxima={...viagem,custos:excluir?lista.filter(x=>x.id!==registro.id):atual?lista.map(x=>x.id===registro.id?registro:x):[...lista,registro]};
  if(excluir&&atual)proxima.custosExcluidos=[...(viagem.custosExcluidos||[]),{em:new Date().toISOString(),registro:atual,gasto:integrado.anterior||null}];
  const antes={viagens:E.viagens,gastos:E.gastos,mt:E._mt};
  E.viagens=E.viagens.map(v=>v.id===viagemId?proxima:v);E.gastos=integrado.gastos;
  try{salvar();}catch(e){E.viagens=antes.viagens;E.gastos=antes.gastos;E._mt=antes.mt;falhaSync(e);throw Error('Não foi possível salvar neste dispositivo.');}
  if(holdingLocal())return 'Salvo neste dispositivo de prévia.';
  const confirmado=await enviarNuvem();
  const presente=estado=>{const v=estado.viagens?.find(v=>v.id===viagemId);return Boolean(v)&&holdingMesmosDados(v.custos?.find(x=>x.id===registro.id),excluir?null:registro)&&integrado.conferir(estado.gastos||[])&&(!excluir||!atual||(v.custosExcluidos||[]).some(h=>holdingMesmosDados(h.registro,atual)&&holdingMesmosDados(h.gasto,integrado.anterior)));};
  if(!presente(E))holdingConflito();
  const remoto=!confirmado&&_tabConteudo?JSON.parse(_tabConteudo):null;
  return confirmado||(remoto&&presente(remoto))?'Salvo e sincronizado.':'Salvo neste dispositivo. Sincronização pendente.';
}
function viagemLinhasGastos(viagem) {
  return [...(viagem.custos||[]).map(item=>({item,origem:'viagem',valor:Math.round((+item.valor||0)*100)/100,descricao:item.descricao||item.categoria||'Gasto da viagem',categoria:item.categoria||'Outros',data:item.pagoEm||item.data||'',situacao:item.situacao||'Não informado',ref:item.id?viagemRefCusto(viagem.id,item.id):null})),
    ...despesasDoAviaoNaViagem(viagem).map(item=>({item,origem:'aviao',valor:Math.round((+item.minhaCota||0)*100)/100,descricao:item.descricao||item.categoria||'Custo da aeronave',categoria:item.categoria||'Outros',data:item.pagoEm||item.data||'',situacao:item.status||'Pendente',ref:item.id?aviaoRefPagamento('despesas',item.id):null}))];
}
