/* Comparação documental: valores e unidades, sem inferir melhora clínica. */
function abrirExameComparacao(x){return typeof saudeEditarRegistro==='function'?saudeEditarRegistro('exames',x):modalExame(x)}
const SaudeComparacao=(()=>{
  const unidade=x=>String(x.unidade||'').trim().replace(/\s+/g,' ');
  const metodo=x=>String(x.metodo||'').trim().toLocaleLowerCase('pt-BR');
  const compativel=(a,b)=>unidade(a)===unidade(b)&&metodo(a)===metodo(b);
  const chave=x=>normaliza(String(x.exame||'').trim());
  const valido=x=>chave(x)&&resultadoSaudeRegistrado(x);
  function linhas(lista,ate,base){
    const grupos=new Map();lista.filter(x=>valido(x)&&x.data<=ate).forEach(x=>{const k=chave(x);if(!grupos.has(k))grupos.set(k,[]);grupos.get(k).push(x)});
    return [...grupos.values()].map(itens=>{
      itens=itens.slice().sort((a,b)=>a.data.localeCompare(b.data));const atual=itens.at(-1),anteriores=itens.filter(x=>x.data<=base),anterior=anteriores.at(-1);
      let motivo='',diferenca=null,percentual=null;
      if(itens.filter(x=>x.data===atual.data).length>1)motivo='Mais de um resultado na última data';
      else if(!anterior||anterior.data===atual.data)motivo='Sem coleta anterior neste recorte';
      else if(anteriores.filter(x=>x.data===anterior.data).length>1)motivo='Mais de um resultado na data de comparação';
      else if(!unidade(atual)||!unidade(anterior))motivo='Conferir unidade no laudo';
      else if(unidade(atual)!==unidade(anterior))motivo='Unidades diferentes';
      else if(metodo(atual)!==metodo(anterior))motivo='Métodos diferentes ou não informados em uma das coletas';
      else if(!Number.isFinite(numeroResultadoSaude(atual.valor))||!Number.isFinite(numeroResultadoSaude(anterior.valor)))motivo='Resultado não numérico';
      else{const a=numeroResultadoSaude(anterior.valor),b=numeroResultadoSaude(atual.valor);diferenca=b-a;percentual=a===0?null:100*(b-a)/Math.abs(a)}
      return {nome:atual.exame,atual,anterior,itens,motivo,diferenca,percentual};
    }).sort((a,b)=>a.nome.localeCompare(b.nome));
  }
  function auditoria(){
    const avisos=[],add=(tipo,descricao,registro,acao)=>avisos.push({tipo,descricao,registro,acao});
    const vistos=new Set();
    for(const x of E.exames){
      if(!String(x.exame||'').trim())add('Exames','Nome do marcador ausente',x,()=>abrirExameComparacao(x));
      if(!dataISOValida(x.data)||x.data>hoje())add('Exames','Data ausente, inválida ou futura',x,()=>abrirExameComparacao(x));
      if(!resultadoSaudeRegistrado(x))add('Exames','Resultado ainda não disponível',x,()=>abrirExameComparacao(x));
      if(!unidade(x)&&Number.isFinite(numeroResultadoSaude(x.valor)))add('Exames','Unidade do resultado não registrada no laudo',x,()=>abrirExameComparacao(x));
      if(!x.referenciaLaudo)add('Exames','Referência do próprio laudo não transcrita',x,()=>abrirExameComparacao(x));
      const k=chave(x)+'|'+x.data+'|'+unidade(x);if(vistos.has(k))add('Exames','Possível repetição de marcador, data e unidade',x,()=>abrirExameComparacao(x));vistos.add(k);
    }
    for(const m of E.peso){
      const grupo=E.tratamentos.find(t=>t.id===m.tratamentoId),acao=grupo?()=>editarMedidaTratamento(grupo,m):null;
      if(!dataISOValida(m.data)||m.data>hoje())add('Medidas','Data ausente, inválida ou futura',m,acao);
      if(!m.fonte)add('Medidas','Fonte da avaliação não informada',m,acao);
      if(m.tratamentoId&&!grupo)add('Medidas','Tratamento vinculado não encontrado',m,null);
      const p=SaudeTratamentos.numero(m.peso),g=SaudeTratamentos.numero(m.massaGorda),l=SaudeTratamentos.numero(m.massaMagra);
      if(p!==null&&g!==null&&l!==null&&Math.abs(p-g-l)>1)add('Medidas','Peso e soma das massas diferem; conferir os rótulos no laudo original',m,acao);
    }
    const ids=new Set(E.tratamentos.map(t=>t.id));
    for(const t of E.tratamentos){
      if(t.origemTratamentoId&&!ids.has(t.origemTratamentoId))add('Tratamentos','Tratamento de origem não encontrado',t,()=>editarTratamento(t));
      for(const c of t.compras||[]){if(SaudeTratamentos.numero(c.quantidade)===null)add('Compras','Quantidade recebida não informada',c,()=>comprarTratamento(t,c));if(valorSaude('saude:compra:'+c.id,c)===null)add('Compras','Valor da compra não informado',c,()=>comprarTratamento(t,c))}
    }
    for(const c of E.consultas){const g=E.tratamentos.find(t=>t.id===c.tratamentoId);if(g&&valorSaude('saude:consulta:'+c.id,c)===null)add('Consultas','Valor da consulta não informado',c,()=>editarConsultaTratamento(g,c))}
    return avisos;
  }
  return {linhas,auditoria,unidade,valido,compativel};
})();
function auditoriaSaude(){
  abrirModal('🔎 Qualidade dos dados da Saúde','Pendências de cadastro e consistência documental. Os registros originais são preservados.',(c,fechar)=>{
    const avisos=SaudeComparacao.auditoria();c.append(el('<p>'+avisos.length+' verificações pedem conferência. Uma mesma ficha pode ter mais de uma pendência.</p>'));
    if(!avisos.length)c.append(el('<p>Nenhuma pendência detectada nas regras verificadas. Isso não confirma a interpretação clínica dos resultados.</p>'));
    for(const a of avisos){const r=el('<article class="trat-historico"><b>'+esc(a.tipo)+'</b><p>'+esc(a.descricao)+'</p><small>'+esc([a.registro.exame||a.registro.oque||a.registro.marca||a.registro.profissional,a.registro.data].filter(Boolean).join(' · '))+'</small></article>');if(a.acao)r.append(acao('Conferir registro',()=>{fechar();a.acao()},'ghost mini'));c.append(r)}
  });
}
let examesComparacaoAte='',examesComparacaoBase='',examesComparacaoBusca='',examesComparacaoFiltro='todos',examesComparacaoMarcador='';
function dashboardExamesSaude(opcoes={}){
  const registros=Array.isArray(opcoes.registros)?opcoes.registros:E.exames;
  const box=el('<section data-bid="sa-ex-dash" class="exames-dashboard trat-card"><div class="trat-toolbar"><div><small>HISTÓRICO DE RESULTADOS</small><h2>🧪 Comparação de exames</h2></div><div class="trat-actions"></div></div><div class="exames-controles"></div><div class="trat-kpis exames-kpis"></div><div class="trat-filtros exames-filtros"></div><div class="exames-quadro"></div><div class="exames-tendencia"></div></section>');
  box.querySelector('.trat-actions').append(acao('+ Exame',()=>novoExameRotina(),'mini'),acao('📄 Importar resultados',importarExamesRotina,'ghost mini'),acao('🔎 Conferir dados',auditoriaSaude,'ghost mini'));
  const datas=[...new Set(registros.filter(SaudeComparacao.valido).map(x=>x.data))].sort();
  if(!datas.includes(examesComparacaoAte))examesComparacaoAte=datas.at(-1)||'';
  if(!datas.includes(examesComparacaoBase)||examesComparacaoBase>=examesComparacaoAte)examesComparacaoBase=datas.filter(d=>d<examesComparacaoAte).at(-1)||'';
  const controls=box.querySelector('.exames-controles');
  const sel=(label,value,opcoes)=>{const l=el('<label>'+label+'<select aria-label="'+label+'">'+opcoes.map(([v,t])=>'<option value="'+esc(v)+'">'+esc(t)+'</option>').join('')+'</select></label>');l.querySelector('select').value=value;controls.append(l);return l.querySelector('select')};
  const ate=sel('Resultados até',examesComparacaoAte,datas.map(d=>[d,fmtDataAno(d)])),base=sel('Comparar com',examesComparacaoBase,[['','Sem coleta anterior'],...datas.filter(d=>d<examesComparacaoAte).map(d=>[d,fmtDataAno(d)])]);
  const busca=el('<label>Buscar marcador<input type="search" aria-label="Buscar marcador" placeholder="Nome do exame"></label>');controls.append(busca);busca.querySelector('input').value=examesComparacaoBusca;
  function pintar(){
    const todos=SaudeComparacao.linhas(registros,examesComparacaoAte,examesComparacaoBase),linhas=todos.filter(x=>(examesComparacaoFiltro!=='comparaveis'||x.diferenca!==null)&&(examesComparacaoFiltro!=='conferir'||x.motivo)&&normaliza(x.nome).includes(normaliza(examesComparacaoBusca)));
    box.querySelector('.exames-kpis').innerHTML=[['Marcadores',todos.length],['Comparações disponíveis',todos.filter(x=>x.diferenca!==null).length],['Sem comparação',todos.filter(x=>x.diferenca===null).length],['Coletas registradas',datas.length]].map(([l,v])=>'<article class="trat-kpi"><small>'+l+'</small><b>'+v+'</b></article>').join('');
    const chips=box.querySelector('.exames-filtros');chips.innerHTML='';[['todos','Todos'],['comparaveis','Comparáveis'],['conferir','A conferir']].forEach(([k,l])=>{const b=acao(l,()=>{examesComparacaoFiltro=k;pintar()},'ghost mini');b.setAttribute('aria-pressed',String(k===examesComparacaoFiltro));chips.append(b)});
    const quadro=box.querySelector('.exames-quadro');quadro.innerHTML='';
    quadro.append(el('<p class="trat-muted">Último resultado disponível até cada data, com a coleta indicada em cada linha. A variação numérica não determina melhora ou piora clínica.</p>'));
    if(!linhas.length){quadro.append(el('<div class="trat-baseline"><span>🧪</span><div><b>'+(!datas.length?'Seus exames, lado a lado':'Nenhum marcador neste filtro')+'</b><p>'+(!datas.length?'Adicione resultados de pelo menos duas coletas para comparar. Fotos e PDFs podem ser anexados à ficha do exame.':'Revise a busca e as datas selecionadas.')+'</p></div></div>'));box.querySelector('.exames-tendencia').innerHTML='';return}
    const rol=el('<div class="saude-matriz-scroll" tabindex="0" role="region" aria-label="Comparativo de exames"><table class="saude-matriz"><thead><tr><th>Exame / unidade</th><th>Anterior</th><th>Atual</th><th>Variação</th><th>Referência do laudo</th><th>Detalhes</th></tr></thead><tbody></tbody></table></div>');
    linhas.forEach(x=>{const tr=document.createElement('tr'),valor=r=>r?esc(r.valor==null||r.valor===''?'—':r.valor)+'<small>'+fmtDataAno(r.data)+'</small>':'Não informado';tr.innerHTML='<th scope="row">'+esc(x.nome)+'<small>'+esc(SaudeComparacao.unidade(x.atual)||'Unidade a conferir')+'</small></th><td>'+valor(x.anterior)+'</td><td>'+valor(x.atual)+'</td><td>'+esc(x.diferenca===null?x.motivo:(x.diferenca>0?'↑ +':x.diferenca<0?'↓ ':'= ')+x.diferenca.toLocaleString('pt-BR',{maximumFractionDigits:3})+' '+SaudeComparacao.unidade(x.atual))+(x.percentual!==null?'<small>'+esc((x.percentual>0?'+':'')+x.percentual.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%')+'</small>':'')+'</td><td>'+esc(x.atual.referenciaLaudo||'Consultar laudo original')+'<small>'+esc(x.atual.resultado||'Sem avaliação registrada')+'</small></td><td></td>';tr.lastElementChild.append(acao('Ver gráfico',()=>{examesComparacaoMarcador=x.nome;grafico(todos)},'ghost mini'),acao('Abrir exame',()=>abrirExameComparacao(x.atual),'ghost mini'));rol.querySelector('tbody').append(tr)});quadro.append(rol);
    const cards=el('<div class="exames-cards-mobile"></div>');linhas.forEach(x=>{const c=el('<article class="sui-card"><h3>'+esc(x.nome)+'</h3><p>Atual: <b>'+esc(x.atual.valor)+' '+esc(SaudeComparacao.unidade(x.atual))+'</b> · '+fmtDataAno(x.atual.data)+'</p><p>Anterior: '+esc(x.anterior?x.anterior.valor:'Não informado')+(x.anterior?' · '+fmtDataAno(x.anterior.data):'')+'</p><p>'+esc(x.diferenca===null?x.motivo:'Variação: '+x.diferenca.toLocaleString('pt-BR')+' '+SaudeComparacao.unidade(x.atual))+'</p></article>');c.append(acao('Abrir exame',()=>abrirExameComparacao(x.atual),'ghost'));cards.append(c)});quadro.append(cards);
    grafico(todos);
  }
  function grafico(linhas){const area=box.querySelector('.exames-tendencia');area.innerHTML='';const x=linhas.find(x=>x.nome===examesComparacaoMarcador)||linhas.find(x=>x.diferenca!==null)||linhas[0];if(!x)return;
    const validos=x.itens.filter(r=>SaudeComparacao.unidade(r)&&SaudeComparacao.compativel(r,x.atual)&&Number.isFinite(numeroResultadoSaude(r.valor))&&x.itens.filter(y=>y.data===r.data).length===1);
    area.append(el('<header><h3>📈 '+esc(x.nome)+'</h3><p class="trat-muted">'+esc(SaudeComparacao.unidade(x.atual)||'Unidade a informar')+' · resultados registrados, sem projeção. Método: '+esc(x.atual.metodo||'não informado')+'.</p></header>'));
    if(validos.length<2)area.append(el('<p>São necessárias duas coletas numéricas, com a mesma unidade e sem duplicidade, para traçar a evolução.</p>'));
    else area.append(el('<div class="grafico">'+gLinha(validos.map(r=>({r:fmtDataAno(r.data),v:numeroResultadoSaude(r.valor)})),{fmt:v=>v.toLocaleString('pt-BR')})+'</div>'));
  }
  if(typeof saudeRevisarRelatorio==='function')box.querySelector('.trat-actions').append(acao('PDF do comparativo',()=>{const rs=SaudeComparacao.linhas(registros,examesComparacaoAte,examesComparacaoBase).filter(x=>(examesComparacaoFiltro!=='comparaveis'||x.diferenca!==null)&&(examesComparacaoFiltro!=='conferir'||x.motivo)&&normaliza(x.nome).includes(normaliza(examesComparacaoBusca))).map(x=>({oque:x.nome,data:x.atual.data,valor:x.atual.valor,unidade:SaudeComparacao.unidade(x.atual),anterior:x.anterior?x.anterior.valor+' · '+fmtDataAno(x.anterior.data):'Não informado',variacao:x.diferenca===null?x.motivo:x.diferenca.toLocaleString('pt-BR')+' '+SaudeComparacao.unidade(x.atual),referenciaLaudo:x.atual.referenciaLaudo,metodo:x.atual.metodo}));saudeRevisarRelatorio({de:examesComparacaoBase,ate:examesComparacaoAte,geradoEm:new Date().toISOString(),secoes:[{tipo:'comparacao',registros:rs}]})},'ghost'));
  ate.onchange=()=>{examesComparacaoAte=ate.value;const ds=datas.filter(d=>d<ate.value);if(!ds.includes(examesComparacaoBase))examesComparacaoBase=ds.at(-1)||'';base.innerHTML='<option value="">Sem coleta anterior</option>'+ds.map(d=>'<option value="'+d+'">'+fmtDataAno(d)+'</option>').join('');base.value=examesComparacaoBase;pintar()};base.onchange=()=>{examesComparacaoBase=base.value;pintar()};busca.querySelector('input').oninput=e=>{examesComparacaoBusca=e.target.value;pintar()};pintar();return box;
}
function fotosEvolucaoTratamento(g,m){
  abrirModal(m?'📷 Fotos da medição de '+fmtDataAno(m.data):'📷 Fotos da evolução','Fotos ficam vinculadas a este tratamento e podem ser consultadas no acompanhamento.',c=>{c.append(areaArquivos(m?'medida:'+m.id:'evolucao-tratamento:'+g.id,'Adicionar foto da evolução'));});
}
function tabelaCompletaEvolucao(g){
  const ms=medidasTratamento(g),defs=[...METRICAS_TRATAMENTO,['altura','Altura','m'],['cintura','Cintura','cm']],box=el('<section class="trat-card evolucao-matriz"><div class="trat-toolbar"><div><h3>📋 Todas as medidas por data</h3><p class="trat-muted">Uma linha por avaliação. Deslize a tabela para ver todos os indicadores.</p></div><div class="trat-actions"></div></div><div class="saude-matriz-scroll" tabindex="0" role="region" aria-label="Todas as medidas da evolução"><table class="saude-matriz"><thead><tr><th>Data</th>'+defs.map(([,l,u])=>'<th>'+l+'<small>'+u+'</small></th>').join('')+'<th>Fonte</th><th>Fotos / ações</th></tr></thead><tbody></tbody></table></div></section>');
  box.querySelector('.trat-actions').append(acao('+ Medição',()=>editarMedidaTratamento(g),'mini'),acao('📷 Fotos da evolução',()=>fotosEvolucaoTratamento(g),'ghost mini'));
  const tb=box.querySelector('tbody');if(!ms.length){const tr=document.createElement('tr');tr.innerHTML='<td colspan="15">Nenhuma avaliação vinculada. Adicione ou vincule uma medição existente.</td>';tb.append(tr)}
  ms.slice().reverse().forEach(m=>{const tr=document.createElement('tr');tr.innerHTML='<th scope="row">'+fmtDataAno(m.data)+'</th>'+defs.map(([k])=>'<td>'+esc(SaudeTratamentos.numero(m[k])===null?'—':Number(m[k]).toLocaleString('pt-BR'))+'</td>').join('')+'<td>'+esc(m.fonte||'Fonte a informar')+'</td><td></td>';tr.lastElementChild.append(acao('📷 Fotos',()=>fotosEvolucaoTratamento(g,m),'ghost mini'),acao('Editar',()=>editarMedidaTratamento(g,m),'ghost mini'));tb.append(tr)});return box;
}
function previsaoEstoqueTratamento(t){
  const saldo=SaudeTratamentos.saldo(t),q=SaudeTratamentos.numero(t.consumoPorCiclo),dias=SaudeTratamentos.numero(t.intervaloConsumoDias);
  const nao=motivo=>({data:null,motivo});
  if(!SaudeTratamentos.controlaEstoque(t))return nao('Defina a unidade do estoque');
  if(saldo===null)return nao('Confirme a quantidade disponível');
  if(saldo<=0)return nao('Sem estoque disponível');
  if(!SaudeTratamentos.ativo(t))return nao('Início do uso não confirmado');
  if(!(q>0)||!(dias>=1)||!Number.isInteger(dias))return nao('Informe o consumo e o intervalo confirmados');
  if(!dataISOValida(t.proximaData)||t.proximaData<hoje())return nao('Atualize a próxima data confirmada');
  if((t.usos||[]).some(u=>!u.desfeitoEm&&u.data>=t.proximaData))return nao('Há uso registrado nesta data; confirme a próxima ocorrência');
  if(t.inicio&&(!dataISOValida(t.inicio)||t.inicio>t.proximaData))return nao('Confirme a próxima data em relação ao início do tratamento');
  if((t.ocorrencias||[]).some(o=>!o.desfeitoEm&&o.data>=t.proximaData))return nao('Há situação registrada no planejamento; confirme a próxima ocorrência');
  if(t.horariosUso!=null&&!Array.isArray(t.horariosUso))return nao('Confira os horários das tomadas antes de estimar');
  const n=Math.floor(saldo/q);if(n<1)return nao('Estoque insuficiente para o próximo uso');
  const configurados=Array.isArray(t.horariosUso)?t.horariosUso:[];
  if(configurados.some(h=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(h)))return nao('Confira os horários das tomadas antes de estimar');
  const tomadas=new Set(configurados).size||1;
  if(SaudeTratamentos.diario(t)&&dias!==1)return nao('Confirme o intervalo e o planejamento diário antes de estimar');
  const data=new Date(t.proximaData+'T12:00:00Z');data.setUTCDate(data.getUTCDate()+Math.floor((n-1)/tomadas)*dias);if(!Number.isFinite(data.getTime()))return nao('Revise os valores do consumo');const fim=data.toISOString().slice(0,10);
  if(t.fim&&dataISOValida(t.fim)&&t.fim<fim)return nao('Término do tratamento anterior ao fim estimado do estoque');
  return {data:fim,motivo:'Último uso estimado com o saldo atual; '+tomadas+' tomada(s) por data planejada, '+q+' '+t.unidade+' por tomada, intervalo de '+dias+' dia(s). Depende do consumo registrado.',usos:n};
}
