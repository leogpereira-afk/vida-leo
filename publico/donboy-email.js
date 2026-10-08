// Private, ephemeral UI: no email content enters localStorage or Central backups.
const dbEmail={dados:null,erro:'',ocupado:false,carregado:false,conflitos:{}};
async function dbEmailAtualizar(){
 try{const d=await apiSync('POST',{acao:'donboy_email_status'});if(!d||d.aprovacaoObrigatoria!==true||!Array.isArray(d.sugestoes))throw Error();dbEmail.dados=d;dbEmail.erro=''}
 catch{dbEmail.erro='Não consegui consultar a rotina. Isso não significa que a caixa está vazia.'}finally{dbEmail.carregado=true}
}
function donboyEmailCard(redesenhar){
 const s=dbEmail,d=s.dados,tipos={recado:'Recado',compromisso:'Compromisso',pagamento_recebido:'Pagamento recebido · conferir',pagamento_a_vencer:'Vencimento · conferir'};
 const status={pendente:'Aprovar',criando:'Aguardando confirmação',confirmado:'Criado na agenda',incerto:'Resultado a conferir',descartado:'Descartado'};
 const caixas=(d?.caixas||[]).map(c=>`<li><strong>${esc(c.caixa)}</strong> · ${c.ativa?'Ativa':'Pausada'}<br><small>${c.ultima_leitura?'Última coleta: '+esc(donboyData(c.ultima_leitura)):'Primeira coleta ainda não confirmada'}${c.parcial?' · Leitura parcial: limite atingido. Revisão necessária.':''}</small></li>`).join('');
 const lista=(d?.sugestoes||[]).map(x=>{
  const f=x.donboy_email_fila||{},v=x.dados||{},pendente=x.estado==='pendente',incerto=['incerto','criando'].includes(x.estado);
  const conflitos=s.conflitos[x.id];
  const campos=pendente?`<label>Título<input name="titulo" maxlength="200" value="${esc(v.titulo||'')}" required></label><div class="db-email-data"><label>Data<input name="data" type="date" value="${esc(v.data||'')}" required></label><label>Horário<input name="hora" type="time" value="${esc(v.hora||'')}" required></label><label>Duração (min)<input name="duracaoMin" type="number" min="5" max="480" value="${esc(v.duracaoMin||60)}" required></label></div><label>Local<input name="local" maxlength="300" value="${esc(v.local||'')}"></label>`:'';
  return `<form class="db-email-item" data-db-email-id="${esc(x.id)}"><div class="db-conexao-topo"><strong>${esc(tipos[x.tipo]||'Sugestão')}</strong><span class="db-tag neutro">${esc(status[x.estado]||x.estado)}</span></div><p>${esc(v.titulo||'')}</p><p class="db-micro">${esc(f.caixa||'')} · ${esc(f.remetente||'')}<br>${esc(f.assunto||'')} · ${esc(donboyData(f.recebido_em))}</p><blockquote>${esc(v.evidencia||'')}</blockquote>${v.observacao?'<p class="db-aviso">'+esc(v.observacao)+'</p>':''}${x.tipo==='pagamento_recebido'?'<p class="db-micro">Este e-mail informa um recebimento. O lembrete é para conferir; não confirma o crédito no banco.</p>':''}${campos}${conflitos?'<div class="db-aviso">Conflitos encontrados:<ul>'+conflitos.map(c=>'<li>'+esc(c.titulo)+' · '+esc(donboyData(c.inicio))+'</li>').join('')+'</ul><label><input type="checkbox" name="aceitarConflitos"> Quero criar mesmo com esses conflitos</label></div>':''}${x.erro?'<p class="db-falha">'+esc(x.erro)+'</p>':''}<div class="db-teste-acoes">${pendente?'<button type="submit" class="btn" '+(s.ocupado?'disabled':'')+'>Colocar na agenda</button><button type="button" class="btn ghost" data-db-email-descartar '+(s.ocupado?'disabled':'')+'>Não colocar na agenda</button>':''}${incerto?'<button type="button" class="btn ghost" data-db-email-conferir '+(s.ocupado?'disabled':'')+'>Conferir resultado</button>':''}</div></form>`;
 }).join('');
 const card=el(donboyCard('E-mails · revisão diária','Gmail pessoal e Leonardo Impresilk · dia anterior · resumo às 6h, horário de Brasília.',`<p>Todas as sugestões precisam da sua aprovação. Nenhum convite é aceito e nenhum evento é criado durante a leitura. A análise usa o texto dos e-mails; não abre anexos automaticamente.</p>${s.erro?'<p class="db-falha" role="alert">'+esc(s.erro)+'</p>':''}<ul class="db-email-caixas">${caixas}</ul>${d?'<p class="db-micro">'+esc(d.fila)+' e-mail(s) aguardando conclusão da análise; '+esc(d.falhas)+' com falha registrada. Exibindo até '+esc(d.limiteExibicao)+' sugestões pendentes, das mais antigas para as novas, e 20 decisões recentes.</p>':''}<div class="db-teste-acoes"><button class="btn ghost" data-db-email-atualizar ${s.ocupado?'disabled':''}>Atualizar fila</button>${d?'<button class="btn ghost" data-db-email-pausa '+(s.ocupado?'disabled':'')+'>'+(d.caixas.some(c=>c.ativa)?'Pausar rotina':'Retomar rotina')+'</button>':''}</div><div>${lista||'<p class="db-vazio">'+(d?'Nenhuma sugestão nesta consulta. Confira acima se a coleta e a análise já terminaram.':'Consultando a rotina…')+'</p>'}</div>`,'db-email'));
 const agir=async(payload)=>{if(s.ocupado)return;s.ocupado=true;s.erro='';card.querySelectorAll('button').forEach(b=>b.disabled=true);try{const r=await apiSync('POST',payload);if(r.estado==='conflito'){s.conflitos[payload.id]=r.conflitos||[];s.erro='Confira os conflitos antes de aprovar.'}else{if(r.erro)s.erro=r.erro;await dbEmailAtualizar()}}catch{s.erro='Resultado não confirmado. Atualize a fila antes de tentar novamente.'}finally{s.ocupado=false;redesenhar()}};
 card.querySelector('[data-db-email-atualizar]').onclick=async()=>{if(s.ocupado)return;s.ocupado=true;await dbEmailAtualizar();s.ocupado=false;redesenhar()};
 const pausa=card.querySelector('[data-db-email-pausa]');if(pausa)pausa.onclick=()=>agir({acao:'donboy_email_config',ativa:!d.caixas.some(c=>c.ativa)});
 card.querySelectorAll('[data-db-email-id]').forEach(form=>{
  const id=form.dataset.dbEmailId;
  form.onsubmit=e=>{e.preventDefault();const fd=new FormData(form);const dados={titulo:fd.get('titulo'),data:fd.get('data'),hora:fd.get('hora'),duracaoMin:Number(fd.get('duracaoMin')),local:fd.get('local')};
   // Retain edits when the server returns a conflict for review.
   const item=d.sugestoes.find(x=>x.id===id);if(item)item.dados={...item.dados,...dados};
   agir({acao:'donboy_email_decidir',id,decisao:'aprovar',dados,aceitarConflitos:fd.get('aceitarConflitos')==='on'})};
  const desc=form.querySelector('[data-db-email-descartar]');if(desc)desc.onclick=()=>agir({acao:'donboy_email_decidir',id,decisao:'descartar'});
  const conf=form.querySelector('[data-db-email-conferir]');if(conf)conf.onclick=()=>agir({acao:'donboy_email_decidir',id,decisao:'conferir'});
 });
 if(!s.carregado&&!s.ocupado){s.ocupado=true;dbEmailAtualizar().then(()=>{s.ocupado=false;redesenhar()})}
 return card;
}
