(function(root){
  'use strict';
  const EMPRESAS=[['fortemais','Fortemais'],['impresilk','Impresilk'],['domo','Domo'],['minaslab','MinasLab'],['diamond','Diamond'],['bosques','Portal dos Bosques']];
  const FONTES={site:{nome:'Site · Google Analytics',icone:'◉',metricas:[['usuarios','Visitantes ativos'],['sessoes','Visitas (sessões)'],['visualizacoes','Páginas vistas'],['eventos_chave','Eventos-chave']]},google:{nome:'Google Meu Negócio',icone:'⌖',metricas:[['impressoes','Exibições na busca e Maps'],['cliques_site','Cliques no site'],['ligacoes','Cliques para ligar'],['rotas','Pedidos de rota']]},instagram:{nome:'Instagram',icone:'◎',metricas:[['alcance','Contas alcançadas'],['visualizacoes','Visualizações'],['interacoes','Interações'],['toques_links','Toques nos links']]}};
  const ESTADOS={ok:'Leitura confirmada',parcial:'Leitura parcial',falta_conectar:'Conexão pendente',falta_configurar:'Configuração pendente',reconectar:'Reconectar',aguardando_aprovacao:'Aguardando aprovação',erro:'Falha na leitura',vinculo_divergente:'Revisar empresa'};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('pt-BR'):'—';
  const data=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v.split('-').reverse().join('/'):'—';
  const mais=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
  const hora=v=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'Sem leitura confirmada';
  function variacao(a,b){if(typeof a!=='number'||typeof b!=='number'||!Number.isFinite(a)||!Number.isFinite(b)||b===0)return null;return (a-b)/b*100}
  function semanas(d){return [...new Set((d?.fontes||[]).flatMap(f=>f.semanas.map(s=>s.semana)))].sort().reverse()}
  function comparar(f,semana,k){const anterior=mais(semana,-7),a=f.semanas.find(s=>s.semana===semana),b=f.semanas.find(s=>s.semana===anterior);return {valor:a?.[k]??null,variacao:f.estado==='ok'&&!f.atrasado?variacao(a?.[k],b?.[k]):null}}
  function analise(d,semana){
    const itens=[];
    for(const f of d.fontes){const nome=FONTES[f.id].nome;
      if(f.estado!=='ok'){itens.push(`${nome}: ${f.motivo||ESTADOS[f.estado]||'verifique a conexão'}`);continue}
      if(f.atrasado){itens.push(`${nome}: última leitura há mais de 48 horas; atualize a coleta antes de decidir.`);continue}
      if(!semana)continue;
      const [k,rotulo]=FONTES[f.id].metricas[0],c=comparar(f,semana,k);
      if(c.variacao!==null)itens.push(`${rotulo}: ${c.variacao>=0?'alta':'queda'} de ${Math.abs(c.variacao).toLocaleString('pt-BR',{maximumFractionDigits:1})}% frente à semana anterior. Compare as campanhas e publicações do período antes de atribuir a causa.`);
      else itens.push(`${nome}: sem duas semanas completas e comparáveis para indicar tendência.`);
    }
    return itens;
  }
  function grafico(f,semana){
    const [k,label]=FONTES[f.id].metricas[0],linhas=f.semanas.filter(r=>r.semana<=semana).slice(-8),max=Math.max(1,...linhas.map(r=>r[k]||0));
    if(!linhas.some(r=>r[k]!==null))return '<p class="mkt-vazio">O gráfico aparece após a leitura dos indicadores.</p>';
    return `<div class="mkt-barras" role="img" aria-label="${esc(label)} por semana">${linhas.map(r=>`<div class="mkt-barra"><span>${num(r[k])}</span><div class="mkt-trilho"><i style="height:${r[k]===null?0:Math.max(1,r[k]/max*100)}%"></i></div><small>${data(r.semana).slice(0,5)}</small></div>`).join('')}</div><details><summary>Ver valores do gráfico</summary><table><thead><tr><th>Semana</th><th>${esc(label)}</th></tr></thead><tbody>${linhas.map(r=>`<tr><td>${data(r.semana)}</td><td>${num(r[k])}</td></tr>`).join('')}</tbody></table></details>`;
  }
  function guia(empresa,tipo){
    const marca=EMPRESAS.find(e=>e[0]===empresa)?.[1]||empresa;
    const textos={site:`Autorize uma conta Google com leitura da propriedade GA4 do site da ${marca}. O número da propriedade e o domínio precisam ser conferidos antes da vinculação.`,google:`Autorize a conta que administra o Perfil da Empresa da ${marca}. A API precisa estar aprovada pelo Google; ter acesso ao perfil no navegador não garante acesso à API.`,instagram:`Autorize a conta profissional da ${marca}${empresa==='fortemais'?' (@fortemais)':''} na Meta com permissão para consultar insights. O vínculo com a empresa precisa ser confirmado.`};
    return `<details class="mkt-guia"><summary>Como conectar esta fonte</summary><p>${esc(textos[tipo])}</p><p>A conexão desta empresa ainda não está habilitada nesta Central. A autorização deve ser concluída no provedor; não cole senhas ou tokens aqui.</p></details>`;
  }
  function card(f,semana,empresa){
    const def=FONTES[f.id];
    return `<section class="mkt-fonte"><header><h2><span aria-hidden="true">${def.icone}</span> ${def.nome}</h2><span class="mkt-chip ${f.estado==='ok'&&!f.atrasado?'bom':'pendente'}">${esc(f.atrasado?'Dados antigos':ESTADOS[f.estado]||'Estado desconhecido')}</span></header>
      <p class="mkt-origem">${esc(f.identidade||'Conta ainda não validada')} · ${esc(hora(f.coletadoEm))}</p>
      ${f.motivo?`<p class="mkt-alerta">${esc(f.motivo)}</p>`:''}
      ${f.semanas.find(r=>r.semana===semana)?.pronta===false?'<p class="mkt-alerta">A fonte ainda está consolidando esta semana. Selecione uma semana anterior para consultar os números fechados.</p>':''}
      <div class="mkt-numeros">${def.metricas.map(([k,label])=>{const c=semana?comparar(f,semana,k):{valor:null,variacao:null};return `<div><span>${label}</span><strong>${num(c.valor)}</strong><small>${c.variacao===null?(c.valor===null?'Sem dado confirmado':'Sem base comparável'):`${c.variacao>=0?'+':''}${c.variacao.toLocaleString('pt-BR',{maximumFractionDigits:1})}% vs. semana anterior`}</small></div>`}).join('')}</div>
      ${semana?grafico(f,semana):'<p class="mkt-vazio">Conecte a fonte para acompanhar a evolução semanal.</p>'}
      ${f.avisos.map(a=>`<p class="mkt-nota">${esc(a)}</p>`).join('')}
      ${f.estado==='falta_conectar'||f.estado==='falta_configurar'?guia(empresa,f.id):''}</section>`;
  }
  function tabela(titulo,linhas,coluna){return `<section class="mkt-fonte"><h2>${titulo}</h2>${linhas.length?`<table><thead><tr><th>Origem</th><th>${coluna}</th></tr></thead><tbody>${linhas.map(x=>`<tr><td>${esc(x.nome)}</td><td>${num(x.valor)}</td></tr>`).join('')}</tbody></table>`:'<p class="mkt-vazio">Sem dados confirmados para este recorte.</p>'}</section>`}
  function montar(container,{api,empresa='fortemais'}={}){
    const retornoEmpresa=root.location?new URLSearchParams(root.location.search).get('mkt'):null;
    let marca=EMPRESAS.some(e=>e[0]===retornoEmpresa)?retornoEmpresa:EMPRESAS.some(e=>e[0]===empresa)?empresa:'fortemais',semana='',resposta=null,erro='',ocupado=false,sequencia=0,controleForte=null;
    const doc=container.ownerDocument;
    container.innerHTML='<section class="mkt-painel"></section>';const area=container.firstElementChild;
    function desenhar(){
      const ss=semanas(resposta);if(!ss.includes(semana))semana=ss[0]||'';
      if(['fortemais','domo'].includes(marca)&&resposta?.detalhe&&root.LeoFortemaisMarketing){
        area.innerHTML=`<header class="mkt-cab"><div><span class="mkt-sobre">${marca==='domo'?'DOMO':'FORTEMAIS'} · MARKETING E ADMINISTRAÇÃO</span><h1>Presença digital</h1><p>${marca==='domo'?'Indicadores, contas e oportunidades comerciais da Domo.':'Indicadores, contas e oportunidades das casas prontas da Fortemais.'}</p></div><button type="button" data-atualizar ${ocupado?'disabled':''}>${ocupado?'Consultando…':'Atualizar leitura'}</button></header><div class="mkt-filtros"><label>Empresa<select data-empresa>${EMPRESAS.map(([id,nome])=>`<option value="${id}" ${id===marca?'selected':''}>${nome}</option>`).join('')}</select></label><span class="mkt-chip">Indicadores somente leitura</span></div><div role="status" aria-live="polite">${erro?esc(erro):ocupado?'Consultando fontes…':''}</div><div data-forte></div><p class="mkt-nota">Consulta à Central: ${esc(hora(resposta.lidoEm))}. Atualizar leitura relê os dados recebidos; não inicia coleta nos provedores.</p>`;
        controleForte=root.LeoFortemaisMarketing.montar(area.querySelector('[data-forte]'),{detalhe:resposta.detalhe,api,empresa:marca});
        area.querySelector('[data-empresa]').onchange=e=>{if(controleForte&&!controleForte.podeAtualizar()){e.target.value=marca;area.querySelector('[role=status]').textContent='Salve ou cancele o cadastro antes de trocar de empresa.';return}marca=e.target.value;semana='';resposta=null;controleForte=null;carregar()};
        area.querySelector('[data-atualizar]').onclick=()=>{if(controleForte&&!controleForte.podeAtualizar()){area.querySelector('[role=status]').textContent='Salve ou cancele o cadastro antes de atualizar.';return}carregar()};
        return;
      }
      area.innerHTML=`<header class="mkt-cab"><div><span class="mkt-sobre">PRESENÇA DIGITAL</span><h1>Marketing</h1><p>Entenda como encontram e interagem com cada empresa.</p></div><button type="button" data-atualizar ${ocupado?'disabled':''}>${ocupado?'Consultando…':'Atualizar leitura'}</button></header>
      <div class="mkt-filtros"><label>Empresa<select data-empresa>${EMPRESAS.map(([id,nome])=>`<option value="${id}" ${id===marca?'selected':''}>${nome}</option>`).join('')}</select></label><label>Semana<select data-semana ${ss.length?'':'disabled'}>${ss.length?ss.map(s=>`<option value="${s}" ${s===semana?'selected':''}>${data(s)} a ${data(mais(s,6))}</option>`).join(''):'<option>Aguardando indicadores</option>'}</select></label><span class="mkt-chip">Somente leitura</span></div>
      <div role="status" aria-live="polite">${ocupado?'<p>Consultando as fontes desta empresa…</p>':''}${erro?`<p class="mkt-alerta" role="alert">${esc(erro)}</p>`:''}</div>
      ${resposta?`<div class="mkt-conexoes" aria-label="Fontes">${resposta.fontes.map(f=>`<span class="mkt-chip">${FONTES[f.id].nome}: ${esc(f.atrasado?'dados antigos':ESTADOS[f.estado]||'sem confirmação')}</span>`).join('')}</div><div class="mkt-grade">${resposta.fontes.map(f=>card(f,semana,marca)).join('')}</div>
      <section class="mkt-analise"><div><span class="mkt-sobre">PRÓXIMOS PASSOS</span><h2>Leitura dos indicadores</h2><p>Comparação automática dos dados disponíveis.</p></div><ul>${analise(resposta,semana).map(t=>`<li>${esc(t)}</li>`).join('')}</ul><button type="button" data-resumo>Preparar resumo para Aurora</button><div data-resumo-area></div></section>
      <details class="mkt-detalhes"><summary>Origens de visitas e páginas mais vistas</summary><div data-tabelas class="mkt-grade-dupla"></div></details><p class="mkt-nota">Consulta à Central: ${esc(hora(resposta.lidoEm))}. “Atualizar leitura” relê a última coleta disponível; não inicia uma nova coleta nos provedores. Métricas de fontes diferentes não são somadas.</p>`:''}`;
      area.querySelector('[data-empresa]').onchange=e=>{marca=e.target.value;semana='';resposta=null;carregar()};
      area.querySelector('[data-semana]').onchange=e=>{semana=e.target.value;desenhar()};
      area.querySelector('[data-atualizar]').onclick=carregar;
      if(resposta){
        const s=resposta.fontes.find(f=>f.id==='site');
        area.querySelector('[data-tabelas]').innerHTML=tabela('Canais · semana selecionada',s.origens.filter(x=>x.semana===semana).map(x=>({nome:x.nome,valor:x.sessoes})),'Sessões')+
          tabela(`Páginas · ${data(s.periodo?.inicio)} a ${data(s.periodo?.fim)}`,s.paginas.map(x=>({nome:x.nome,valor:x.visualizacoes})),'Visualizações');
        area.querySelector('[data-resumo]').onclick=()=>{
          const destino=area.querySelector('[data-resumo-area]');destino.innerHTML='<label>Resumo pronto para copiar e enviar ao agente<textarea readonly rows="9"></textarea></label><p class="mkt-nota">Preparar o resumo não envia uma mensagem ao agente.</p>';
          destino.querySelector('textarea').value=resumoTexto(resposta,semana);destino.querySelector('textarea').focus();destino.querySelector('textarea').select?.();
        };
      }
    }
    async function carregar(){const id=++sequencia;ocupado=true;erro='';desenhar();try{
      const d=await api('POST',{acao:'marketingPainel',empresa:marca});
      if(id!==sequencia||!area.isConnected)return;
      if(d?.ok!==true||d.empresa?.id!==marca||!Array.isArray(d.fontes)||d.fontes.length!==3||['site','google','instagram'].some(k=>!d.fontes.some(f=>f.id===k&&Array.isArray(f.semanas)&&Array.isArray(f.avisos))))throw Error('Resposta inválida');
      resposta=d;
    }catch{if(id===sequencia){resposta=null;erro='Não foi possível consultar os indicadores desta empresa. Tente atualizar a leitura.'}}
    finally{if(id===sequencia&&area.isConnected){ocupado=false;desenhar()}}}
    desenhar();carregar();
    return {atualizar:carregar};
  }
  function resumoTexto(d,semana){return `Marketing · ${d.empresa.nome}\nSemana: ${semana?data(semana)+' a '+data(mais(semana,6)):'sem indicadores'}\n`+d.fontes.map(f=>`${FONTES[f.id].nome} — ${ESTADOS[f.estado]||'sem confirmação'}${f.atrasado?' (dados antigos)':''}\nFonte: ${f.identidade||'não validada'}; leitura: ${hora(f.coletadoEm)}\n`+FONTES[f.id].metricas.map(([k,n])=>`${n}: ${num(semana?comparar(f,semana,k).valor:null)}`).join('; ')).join('\n\n')+'\n\n'+analise(d,semana).join('\n')+'\n\nAurora: analise oportunidades com base nestes dados, sem presumir causas ou inventar indicadores.'}
  root.LeoMarketing={montar,variacao,analise,resumoTexto};
})(globalThis);
