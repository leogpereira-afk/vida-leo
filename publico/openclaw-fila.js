// Fila efêmera: dados pessoais não são copiados para localStorage nem backups.
const ocFila={dados:null,erro:'',ocupado:false};
async function openclawFilaAtualizar(){
 try{const d=await apiSync('POST',{acao:'openclaw_propostas_listar'});if(d?.ok!==true||!Array.isArray(d.propostas))throw Error();ocFila.dados=d;ocFila.erro=''}
 catch{ocFila.erro='Não consegui consultar as propostas do OpenClaw. Isso não significa que a fila está vazia.'}
}
function openclawFilaCard(redesenhar){
 const labels={pendente:'Sua aprovação',executando:'Em processamento',confirmado:'Confirmado',incerto:'Conferir resultado',reprovado:'Reprovado'},s=ocFila;
 const c=el(`<section class="oc-fila" aria-label="Propostas pessoais do OpenClaw"><div class="ag-acoes"><h3>Propostas pessoais</h3><button class="btn ghost" data-oc-atualizar ${s.ocupado?'disabled':''}>Atualizar</button></div><p>Confira o destino e os dados antes de aprovar. Os registros das empresas ficam fora desta fila.</p>${s.erro?'<p role="alert" class="db-falha">'+esc(s.erro)+'</p>':''}<div role="status">${s.dados?'Consultado em '+esc(donboyData(s.dados.consultadoEm)):'Consulte a fila para ver as propostas do chat.'}</div>${s.dados?.parcial?'<p class="db-aviso">Exibindo as 100 propostas mais recentes. Consulte o chat para itens anteriores.</p>':''}<div data-oc-lista></div></section>`);
 const desenhar=()=>{if(c.isConnected)redesenhar()};
 c.querySelector('[data-oc-atualizar]').onclick=async()=>{if(s.ocupado)return;s.ocupado=true;await openclawFilaAtualizar();s.ocupado=false;desenhar()};
 const lista=c.querySelector('[data-oc-lista]');
 for(const q of s.dados?.propostas||[]){
  const card=el(`<article class="oc-proposta"><div class="ag-acoes"><strong>${esc(labels[q.estado]||'Estado a conferir')}</strong><small>${esc(donboyData(q.criadoEm))}</small></div><p class="oc-previa">${esc(q.previa||'Prévia não informada')}</p>${q.expirada?'<p class="db-aviso">Prévia expirada. Peça uma nova conferência no chat.</p>':''}${q.erro?'<p class="db-aviso">'+esc(q.erro)+'</p>':''}<small>Referência: ${esc(q.id)}</small><div class="ag-acoes" data-oc-acoes></div>${q.estado==='confirmado'?'<p>Registro confirmado na Central. Atualize a área correspondente para conferir os dados.</p>':''}</article>`);
  const acoes=card.querySelector('[data-oc-acoes]');
  const agir=async decisao=>{
   if(s.ocupado)return;s.ocupado=true;card.querySelectorAll('button').forEach(b=>b.disabled=true);
   try{const r=await apiSync('POST',{acao:'openclaw_propostas_decidir',id:q.id,decisao});if(r?.ok!==true||!r.proposta)throw Error();await openclawFilaAtualizar()}
   catch{s.erro='Decisão sem confirmação. Atualize a fila e confira o resultado antes de repetir.'}
   finally{s.ocupado=false;desenhar()}
  };
  const botao=(titulo,decisao)=>{const b=el('<button class="btn ghost" type="button"></button>');b.textContent=titulo;b.disabled=s.ocupado;b.onclick=()=>agir(decisao);acoes.appendChild(b)};
  if(q.estado==='pendente'){if(!q.expirada)botao('Aprovar este registro','aprovar');botao('Reprovar','reprovar')}
  if(['incerto','executando'].includes(q.estado))botao('Conferir resultado','conferir');
  lista.appendChild(card);
 }
 if(s.dados&&!s.dados.propostas.length)lista.appendChild(el('<p class="db-vazio">Nenhuma proposta nesta consulta.</p>'));
 return c;
}
