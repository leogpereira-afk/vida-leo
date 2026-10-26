/* Datas derivadas dos documentos privados. Não cria cópias em E.agenda. */
const DocumentosAgenda = (() => {
  const avisosValidade = [60,30,7], avisosRenovacao = [30,7,1];
  const dataValida = v => typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(+new Date(v+'T12:00:00Z')) && new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
  const dataUTC = v => new Date(v+'T12:00:00Z');
  const diasEntre = (a,b) => dataValida(a)&&dataValida(b)?Math.round((dataUTC(b)-dataUTC(a))/864e5):null;
  function deslocar(data,dias){if(!dataValida(data))return '';const d=dataUTC(data);d.setUTCDate(d.getUTCDate()+dias);const iso=d.toISOString().slice(0,10);return dataValida(iso)?iso:''}
  const formatar = data => dataValida(data)?data.slice(8)+'/'+data.slice(5,7)+'/'+data.slice(0,4):'Data a confirmar';
  const titular = d => 'de '+(d.dono||'Léo');
  const nomeComTitular = d => (d.nome||'Documento')+' · '+titular(d);
  const historico = d => d?.grupo==='armas' && d.tipoRegistro==='guia' && d.classificacao==='historico';
  const acompanhado = d => d?.grupo==='armas' && ['arma','cr','clube','guia'].includes(d.tipoRegistro) && !historico(d);
  function proximaRenovacao(d,referencia){
    if(!acompanhado(d)||d.tipoRegistro!=='clube'||!dataValida(referencia))return '';
    const dia=String(d.renovacaoDia??'').trim(),mes=String(d.renovacaoMes??'').trim();
    if(!/^\d{1,2}$/.test(dia)||!/^\d{1,2}$/.test(mes))return '';
    const sufixo=mes.padStart(2,'0')+'-'+dia.padStart(2,'0');
    if(!dataValida('2000-'+sufixo))return '';
    const ano=+referencia.slice(0,4);
    for(let y=ano;y<=Math.min(ano+8,9999);y++){const data=String(y).padStart(4,'0')+'-'+sufixo;if(data>=referencia&&dataValida(data))return data}
    return '';
  }
  function eventos(documentos,referencia){
    if(!Array.isArray(documentos)||!dataValida(referencia))return [];
    const saida=[],vistos=new Set();
    const adicionar=(d,data,tipo)=>{
      const renovacao=tipo==='renovacao',identidade=d.id||'sem-id-'+documentos.indexOf(d),chave=[tipo,identidade,data].join(':'),titulo=(d.nome||'Documento')+(renovacao?' · renovação anual':' · vencimento');
      if(vistos.has(chave))return;vistos.add(chave);
      const base={id:renovacao?'renovacao-clube:'+identidade:'validade-documento:'+identidade+':'+data,ocorrenciaId:chave,data,hora:'',titulo,
        sub:[titular(d),!acompanhado(d)&&d.numero?d.numero:'',renovacao?'Data anual de acompanhamento da filiação':'Validade informada no documento · situação atual a conferir no emissor'].filter(Boolean).join(' · '),
        fonte:'documentos',ic:renovacao?'🏅':'🪪',ir:'documentos',col:'documentos',ref:d,tipoDocumentoAgenda:tipo,dataAlvo:data};
      saida.push(base);
      if(!acompanhado(d)||!d.id)return;
      for(const antes of renovacao?avisosRenovacao:avisosValidade){
        const dataAviso=deslocar(data,-antes);if(!dataAviso)continue;
        saida.push({...base,id:'aviso-documento:'+chave+':'+antes,ocorrenciaId:'aviso:'+chave+':'+antes,data:dataAviso,
          titulo:(renovacao?'Renovação':'Vencimento')+' em '+antes+' dias · '+(d.nome||'Documento'),
          sub:titular(d)+' · Aviso na Central · '+(renovacao?'renovação':'validade informada')+' em '+formatar(data),ic:'🔔',avisoDocumento:true,diasAntes:antes});
      }
    };
    for(const d of documentos){if(!d||historico(d))continue;if(dataValida(d.validade))adicionar(d,d.validade,'validade');const anual=proximaRenovacao(d,referencia);if(anual)adicionar(d,anual,'renovacao')}
    return saida.sort((a,b)=>a.data.localeCompare(b.data)||a.id.localeCompare(b.id));
  }
  function prazos(documentos,referencia){return eventos(documentos,referencia).filter(e=>!e.avisoDocumento&&acompanhado(e.ref))}
  function alertas(documentos,referencia){
    return prazos(documentos,referencia).flatMap(e=>{
      const dias=diasEntre(referencia,e.data),renovacao=e.tipoDocumentoAgenda==='renovacao',limite=renovacao?30:60;
      if(dias===null||dias>limite)return [];
      const prazo=dias<0?'Prazo impresso ultrapassado':renovacao?'Renovação do clube':'Validade informada';
      return [{g:dias<0?0:1,ic:e.ic,txt:prazo+' · '+nomeComTitular(e.ref)+' · '+formatar(e.data),quando:dias,secao:'documentos',col:'documentos',ref:e.ref,id:e.id}];
    });
  }
  function eventosVisitas(visitas){
    const saida=[],vistos=new Set();
    for(const e of Array.isArray(visitas)?visitas:[]){
      if(!e?.id||!dataValida(e.data)||e.status!=='planejada'||vistos.has(e.id))continue;
      vistos.add(e.id);saida.push(e);
      for(const antes of [7,1]){const data=deslocar(e.data,-antes);if(data)saida.push({...e,id:'aviso:'+e.id+':'+e.data+':'+antes,data,dataAlvo:e.data,hora:'',ic:'🔔',avisoDocumento:true,diasAntes:antes,titulo:'Visita ao clube em '+antes+' dia(s) · '+(e.ref?.nome||'Documento'),sub:'Aviso na Central · presença planejada para '+formatar(e.data)})}
    }
    return saida;
  }
  function alertasVisitas(visitas,referencia){
    if(!dataValida(referencia))return [];
    return eventosVisitas(visitas).filter(e=>!e.avisoDocumento).flatMap(e=>{
      const dias=diasEntre(referencia,e.data);if(dias===null||dias>7)return [];
      return [{g:dias<0?1:2,ic:'🏅',txt:(dias<0?'Presença a confirmar':'Visita ao clube')+' · '+(e.ref?.nome||'Documento')+' · '+formatar(e.data)+(e.hora?' às '+e.hora:''),quando:dias,secao:'documentos',col:'documentos',ref:e.ref,id:e.id}];
    });
  }
  function painel(documentos,referencia,abrir){
    const lista=prazos(documentos,referencia);if(!lista.length)return null;
    const raiz=document.createElement('section');raiz.className='documentos-agenda';raiz.setAttribute('aria-label','Carteirinhas e clube na agenda');
    const titulo=document.createElement('h2');titulo.textContent='🪪 Carteirinhas e clube';raiz.appendChild(titulo);
    const texto=document.createElement('p');texto.textContent='Validades: avisos 60, 30 e 7 dias antes. Renovação anual: 30, 7 e 1 dia antes. Avisos na Agenda e no Radar da Central.';raiz.appendChild(texto);
    const grade=document.createElement('div');grade.className='documentos-agenda-grade';
    for(const e of lista){
      const b=document.createElement('button');b.type='button';b.className='documentos-agenda-prazo';
      const dias=diasEntre(referencia,e.data),renovacao=e.tipoDocumentoAgenda==='renovacao';
      if(dias<0)b.classList.add('documentos-agenda-atrasado');else if(dias<=(renovacao?30:60))b.classList.add('documentos-agenda-proximo');
      const nome=document.createElement('strong');nome.textContent=nomeComTitular(e.ref);b.appendChild(nome);
      const rotulo=document.createElement('span');rotulo.textContent=renovacao?'Renovação anual':'Validade impressa';b.appendChild(rotulo);
      const data=document.createElement('time');data.dateTime=e.data;data.textContent=formatar(e.data);b.appendChild(data);
      const proximo=(renovacao?avisosRenovacao:avisosValidade).map(n=>deslocar(e.data,-n)).find(d=>d>=referencia);
      const aviso=document.createElement('small');aviso.textContent=dias<0?'Prazo impresso ultrapassado · conferir':dias===0?'É hoje · conferir o registro':dias<=(renovacao?30:60)?'Aviso ativo · faltam '+dias+' dia(s)':proximo?'Primeiro aviso: '+formatar(proximo):'Abra para conferir';b.appendChild(aviso);
      b.onclick=()=>{if(typeof abrir==='function')abrir(e)};b.setAttribute('aria-label',nomeComTitular(e.ref)+' · '+rotulo.textContent+' '+formatar(e.data)+' · abrir ficha');grade.appendChild(b);
    }
    raiz.appendChild(grade);
    const nota=document.createElement('small');nota.className='documentos-agenda-nota';nota.textContent='As datas acompanham as fichas, sem duplicar compromissos. Documentos históricos ficam fora dos avisos. A situação atual deve ser conferida no emissor.';raiz.appendChild(nota);
    return raiz;
  }
  return {dataValida,deslocar,diasEntre,proximaRenovacao,eventos,prazos,alertas,eventosVisitas,alertasVisitas,painel,acompanhado};
})();
