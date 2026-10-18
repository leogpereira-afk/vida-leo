/* Projeções de Saúde: dados declarados, sem interpretação clínica. */
var SaudePainelModelo=(()=>{
  const lista=(E,k)=>Array.isArray(E?.[k])?E[k]:[];
  const numero=v=>v!==''&&v!=null&&Number.isFinite(Number(v))?Number(v):null;
  const data=v=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(v||'')))return false;const d=new Date(v+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v};
  const hora=v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v||''));
  const ativo=t=>['Em andamento','Contínuo'].includes(t.status);
  const dia=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  const distancia=(a,b)=>Math.round((Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/864e5);
  const nome=(x,tipo)=>x.oque||x.exame||x.vacina||x.profissional||x.parente||tipo;
  function saldo(t){if((numero(t.estoqueInicial)===null&&!lista(t,'compras').length)||lista(t,'compras').some(c=>numero(c.quantidade)===null))return null;return +(Number(t.estoqueInicial||0)+lista(t,'compras').reduce((a,c)=>a+Number(c.quantidade||0),0)-lista(t,'usos').filter(u=>!u.desfeitoEm).reduce((a,u)=>a+Number(u.quantidade||0),0)).toFixed(4)}
  function ocorrencias(t,d=dia()){
    if(!data(d)||!ativo(t)||t.inicio&&d<t.inicio||t.fim&&d>t.fim)return[];
    const diario=t.usoDiario===true||(t.usoDiario!==false&&numero(t.intervaloConsumoDias)===1);
    const ciclo=numero(t.intervaloConsumoDias);
    if(!diario&&!(data(t.proximaData)&&d>=t.proximaData&&(d===t.proximaData||ciclo>0&&Number.isInteger(ciclo)&&distancia(d,t.proximaData)%ciclo===0)))return[];
    const horarios=[...new Set(lista(t,'horariosUso').filter(hora))].sort();
    const slots=horarios.length?horarios:[hora(t.horario)?t.horario:'dia'];
    return slots.map(h=>{
      const id=t.id+'|'+d+'|'+h,evento=lista(t,'ocorrencias').filter(x=>x.ocorrenciaId===id&&!x.desfeitoEm&&(!x.usoId||!lista(t,'usos').find(u=>u.id===x.usoId)?.desfeitoEm)).at(-1);
      const legado=slots.length===1&&lista(t,'usos').find(u=>u.data===d&&!u.desfeitoEm);
      return{id,data:d,hora:h,registroId:t.id,titulo:t.oque||'Cuidado',quantidade:numero(t.consumoPorCiclo),unidade:t.unidade||'',estado:evento?.estado||(legado?'Registrado':'Sem registro'),adiadoPara:evento?.adiadoPara||'',evento};
    });
  }
  function registrarOcorrencia(t,d,consumir){
    const o=ocorrencias(t,d.data).find(x=>x.id===d.ocorrenciaId);
    if(!o)throw Error('Ocorrência não encontrada no planejamento confirmado.');
    if(['Registrado','Não utilizado'].includes(o.estado))throw Error('Já existe um registro para esta ocorrência. Confira o histórico.');
    if(!['Registrado','Não utilizado','Adiado'].includes(d.estado))throw Error('Escolha a situação do registro.');
    if(d.estado==='Adiado'&&!hora(d.adiadoPara))throw Error('Informe o novo horário para hoje.');
    if(d.estado==='Registrado'){
      if(!(numero(d.quantidade)>0)||typeof consumir!=='function')throw Error('Informe a quantidade e confirme o uso.');
      consumir({data:d.data,hora:d.hora,quantidade:numero(d.quantidade),obs:d.obs||'',ocorrenciaId:o.id});
    }
    const evento={id:o.id+'|'+Date.now()+'|'+lista(t,'ocorrencias').length,ocorrenciaId:o.id,data:d.data,horaPrevista:o.hora,estado:d.estado,quantidade:d.estado==='Registrado'?numero(d.quantidade):null,usoId:d.estado==='Registrado'?lista(t,'usos').at(-1)?.id||'':'',adiadoPara:d.estado==='Adiado'?d.adiadoPara:'',obs:d.obs||'',registradoEm:new Date().toISOString()};
    t.ocorrencias=[...lista(t,'ocorrencias'),evento];return evento;
  }
  function indicadores(E,d=dia()){
    const recentes=k=>lista(E,k).filter(x=>data(x.data)&&x.data<=d).slice().sort((a,b)=>a.data.localeCompare(b.data));
    const p=recentes('peso').filter(x=>numero(x.peso)>0).at(-1),v=recentes('vitais').filter(x=>numero(x.sis)>0&&numero(x.dia)>0).at(-1),fc=recentes('vitais').filter(x=>numero(x.fc)>0).at(-1);
    const alt=numero(p?.altura),a=alt>3?alt/100:alt;
    return{peso:{valor:numero(p?.peso),unidade:'kg',data:p?.data||'',id:p?.id},imc:{valor:p&&a>0?+(p.peso/(a*a)).toFixed(1):null,unidade:'kg/m²',data:p&&a>0?p.data:'',formula:'Peso dividido pela altura ao quadrado, na mesma medição.'},pressao:{valor:v?v.sis+'/'+v.dia:null,unidade:'mmHg',data:v?.data||'',id:v?.id},pulso:{valor:numero(fc?.fc),unidade:'bpm',data:fc?.data||'',id:fc?.id}};
  }
  function qualidade(E,d=dia()){
    const a=[],add=(tipo,r,motivo,nivel='Conferir')=>a.push({id:tipo+'|'+r.id+'|'+motivo,tipo,registroId:r.id,titulo:nome(r,tipo),motivo,nivel});
    for(const tipo of ['exames','peso','vitais','vacinas','queixas','consultas','fisio'])for(const r of lista(E,tipo)){
      if(!data(r.data))add(tipo,r,'Data ausente ou inválida');
      else if(r.data>d&&!(['consultas','vacinas'].includes(tipo)&&r.situacao==='Agendada'))add(tipo,r,'Data futura: confirme se é planejamento ou registro realizado');
      if(tipo==='exames'){if(!r.exame)add(tipo,r,'Nome do marcador ausente');if(r.valor===''||r.valor==null||r.resultado==='Aguardando')add(tipo,r,'Resultado não disponível');if(!r.unidade&&numero(r.valor)!==null)add(tipo,r,'Unidade conforme o laudo ausente');if(!r.referenciaLaudo)add(tipo,r,'Referência do próprio laudo não transcrita')}
      if(tipo==='peso'){if(!r.fonte)add(tipo,r,'Fonte da medição não informada');if(!(numero(r.peso)>0))add(tipo,r,'Peso a confirmar')}
      if(tipo==='vitais'&&(numero(r.sis)===null)!==(numero(r.dia)===null))add(tipo,r,'Pressão incompleta: confira sistólica e diastólica');
      if(tipo==='vacinas'&&!r.comprovante&&!r.documentoId)add(tipo,r,'Comprovante ainda não vinculado');
      if(tipo==='queixas'&&numero(r.intensidade)!==null&&(r.intensidade<0||r.intensidade>10))add(tipo,r,'Intensidade fora da escala de 0 a 10');
      if(tipo==='fisio'){for(const c of ['dorAntes','dorDepois'])if(numero(r[c])!==null&&(r[c]<0||r[c]>10))add(tipo,r,'Dor fora da escala de 0 a 10');if(r.queixaId&&!lista(E,'queixas').some(q=>q.id===r.queixaId))add(tipo,r,'Queixa vinculada não encontrada')}
      if(r.tratamentoId&&!lista(E,'tratamentos').some(t=>t.id===r.tratamentoId))add(tipo,r,'Tratamento vinculado não encontrado');
    }
    for(const r of lista(E,'histFamiliar')){if(!r.parente||!r.doenca)add('histFamiliar',r,'Parente ou condição declarada ainda não informados');if(!r.fonte)add('histFamiliar',r,'Origem da informação não registrada')}
    for(const t of lista(E,'tratamentos')){
      if(t.origemTratamentoId&&!lista(E,'tratamentos').some(x=>x.id===t.origemTratamentoId))add('tratamentos',t,'Plano de origem não encontrado');
      if(['Medicamento','Suplemento'].includes(t.tipo)){
        if(!t.frequencia)add('tratamentos',t,'Orientação original não registrada');
        if(!ativo(t)&&!['Pausado','Encerrado'].includes(t.status))add('tratamentos',t,'Início do uso ainda não confirmado');
        if(!t.unidade||saldo(t)===null)add('tratamentos',t,'Unidade ou quantidade disponível a confirmar');
      }
    }
    for(const [id,r]of Object.entries(E.saudeDocumentos||{}).filter(([,r])=>r&&typeof r==='object'&&!Array.isArray(r)))if(r.cobertura!=='completa'||r.naoReconhecidos||lista(r,'itens').some(i=>!i||i.estado!=='confirmado'))add('saudeDocumentos',{...r,id:r.id||id,oque:r.titulo||'Documento'},'Conferência documental pendente');
    for(const tipo of ['exames','peso','vitais','vacinas']){const vistos=new Set();for(const r of lista(E,tipo)){const chave=[r.data,r.exame||r.vacina||'',r.unidade||'',r.laboratorio||r.medico||'',r.valor??r.peso??r.sis??''].join('|');if(vistos.has(chave))add(tipo,r,'Possível repetição: revisar sem apagar automaticamente');vistos.add(chave)}}
    return a;
  }
  function hoje(E,d=dia()){
    const a=[];
    lista(E,'tratamentos').forEach(t=>{
      ocorrencias(t,d).filter(o=>!['Registrado','Não utilizado'].includes(o.estado)).forEach(o=>a.push({...o,tipo:'uso',area:'tratamentos',motivo:o.hora==='dia'?'Uso diário configurado, horário livre':'Horário configurado pelo usuário',prioridade:0}));
      const n=saldo(t),q=numero(t.consumoPorCiclo),limite=numero(t.alertaEstoque);
      if(ativo(t)&&t.unidade&&n!==null&&(n<=0||(limite!==null?n<=limite:q>0&&Math.floor(n/q)<=3)))a.push({id:'repor|'+t.id,tipo:'reposicao',registroId:t.id,titulo:t.oque,data:d,area:'tratamentos',motivo:n+' '+t.unidade+' disponíveis',prioridade:1});
      if(ativo(t)&&data(t.proximaData)&&t.proximaData>=d&&distancia(t.proximaData,d)<=7&&!ocorrencias(t,t.proximaData).length)a.push({id:'cuidado|'+t.id,tipo:'cuidado',registroId:t.id,titulo:t.oque,data:t.proximaData,area:'tratamentos',motivo:'Próxima data informada',prioridade:2});
    });
    for(const c of lista(E,'consultas')){
      if(c.situacao==='Cancelada')continue;
      if(data(c.data)&&c.data>=d&&distancia(c.data,d)<=7&&c.situacao!=='Realizada')a.push({id:'consulta|'+c.id,tipo:'consulta',registroId:c.id,titulo:c.profissional||c.especialidade||'Consulta',data:c.data,area:'queixas',motivo:c.situacao||'Situação a confirmar',prioridade:2});
      if(data(c.retorno)&&!c.retornoConcluidoEm&&distancia(c.retorno,d)<=7)a.push({id:'retorno|'+c.id,tipo:'retorno',registroId:c.id,titulo:c.profissional||c.especialidade||'Retorno',data:c.retorno,area:'queixas',motivo:c.retorno<d?'Data informada já passou; conferir situação':'Retorno combinado',prioridade:c.retorno<d?1:2});
    }
    for(const [k,campo]of[['exames','proximo'],['vacinas','proxima']])for(const r of lista(E,k))if(data(r[campo])&&distancia(r[campo],d)<=7&&!r.proximoConcluidoEm)a.push({id:k+'|'+r.id,tipo:k,registroId:r.id,titulo:nome(r,k),data:r[campo],area:k==='exames'?'exames':'cuidados',motivo:r[campo]<d?'Data cadastrada já passou; conferir':'Próxima data cadastrada',prioridade:r[campo]<d?1:2});
    for(const r of lista(E,'rastreios'))if(r.situacao==='Confirmado'&&data(r.proxima)&&distancia(r.proxima,d)<=7)a.push({id:'prevencao|'+r.id,tipo:'rastreios',registroId:r.id,titulo:nome(r,'Prevenção'),data:r.proxima,area:'cuidados',motivo:r.proxima<d?'Prazo confirmado já passou; conferir':'Prazo confirmado em orientação registrada',prioridade:r.proxima<d?1:2});
    return a.sort((a,b)=>a.prioridade-b.prioridade||a.data.localeCompare(b.data)||a.titulo.localeCompare(b.titulo));
  }
  function episodios(E){return lista(E,'queixas').map(q=>({...q,consultas:lista(E,'consultas').filter(c=>c.queixaId===q.id),sessoes:lista(E,'fisio').filter(c=>c.queixaId===q.id)}))}
  function resumoConsulta(E,{de='',ate='9999-12-31',tipos=['exames','peso','vitais','queixas','consultas','fisio','vacinas','tratamentos'],...f}={}){
    const fonte=tipo=>tipo==='usos'?lista(E,'tratamentos').flatMap(t=>[...lista(t,'usos').filter(u=>!u.desfeitoEm).map(u=>({...u,oque:t.oque,unidade:t.unidade,situacao:'Uso registrado'})),...lista(t,'ocorrencias').filter(u=>!u.desfeitoEm&&u.estado!=='Registrado').map(u=>({...u,oque:t.oque,unidade:t.unidade,situacao:u.estado}))]):tipo==='planos'?lista(E,'planos').filter(p=>p.status!=='Cancelado'):tipo==='estoque'?lista(E,'tratamentos').filter(t=>t.unidade).map(t=>({id:t.id,oque:t.oque,unidade:t.unidade,status:t.status,saldo:saldo(t),consumoPorCiclo:t.consumoPorCiclo,alertaEstoque:t.alertaEstoque})):lista(E,tipo);
    const secoes=tipos.flatMap(tipo=>{
      const registros=fonte(tipo).filter(r=>['estoque','histFamiliar','planos'].includes(tipo)?true:tipo==='tratamentos'?ativo(r)&&['Medicamento','Suplemento'].includes(r.tipo):data(r.data)&&r.data>=de&&r.data<=ate).map(r=>structuredClone(r));
      const principal={tipo,registros};
      return tipo==='tratamentos'?[principal,{tipo:'tratamentosConferencia',registros:lista(E,'tratamentos').filter(r=>ativo(r)&&!r.tipo).map(r=>structuredClone(r))}]:[principal];
    });
    return{de,ate,geradoEm:new Date().toISOString(),perguntas:f.perguntas||'',secoes};
  }
  function documentosRefs(E){
    const refs=[{ref:'saude:documentos',tipo:'Geral',titulo:'Biblioteca de Saúde'}],br=d=>data(d)?d.slice(8,10)+'/'+d.slice(5,7)+'/'+d.slice(0,4):'Data a confirmar';
    for(const [k,prefixo]of[['tratamentos','tratamento'],['exames','exame'],['consultas','consulta'],['peso','peso'],['vitais','vitais'],['queixas','queixa'],['fisio','fisio'],['vacinas','vacina'],['histFamiliar','histFamiliar'],['rastreios','rastreios']])for(const x of lista(E,k))if(x.id){
      const valor=k==='peso'&&numero(x.peso)!==null?x.peso+' kg':k==='vitais'?[x.sis&&x.dia?x.sis+'/'+x.dia+' mmHg':'',x.fc?x.fc+' bpm':''].filter(Boolean).join(' · '):nome(x,k),d=x.data||x.inicio||'';
      const origem={tipo:k,registroId:x.id,titulo:(k==='peso'?'Peso · ':k==='vitais'?'Sinais vitais · ':'')+valor+(d?' · '+br(d):''),data:d};
      refs.push({...origem,ref:prefixo+':'+x.id});
      if(k==='peso')refs.push({...origem,ref:'medida:'+x.id,titulo:origem.titulo+' · fotos da medição'});
      if(k==='tratamentos')refs.push({...origem,ref:'evolucao-tratamento:'+x.id,titulo:origem.titulo+' · fotos da evolução'});
    }return refs.filter((x,i,a)=>a.findIndex(y=>y.ref===x.ref)===i);
  }
  function seriesPeso(pontos){
    const series=[];
    for(const r of pontos){
      const fonte=String(r.fonte||'').trim(),metodo=String(r.metodo||'').trim(),contexto=String(r.tratamentoId||'');
      const declarados=!!fonte&&!!metodo,chave=JSON.stringify([fonte,metodo,contexto]),anterior=series.at(-1);
      // Uma fonte desconhecida não comprova equivalência entre avaliações.
      if(declarados&&anterior?.declarados&&anterior.chave===chave&&!anterior.pontos.some(p=>p.data===r.data))anterior.pontos.push(r);
      else series.push({chave,fonte,metodo,contexto,declarados,pontos:[r]});
    }
    return series;
  }
  function validarMetadados(m){
    if(!m||typeof m!=='object'||Array.isArray(m))throw Error('Metadados de documentos inválidos.');
    for(const [id,r] of Object.entries(m)){
      if(!id||['__proto__','constructor','prototype'].includes(id)||!r||typeof r!=='object'||Array.isArray(r))throw Error('Metadados de documento inválidos.');
      if(r.itens!==undefined&&(!Array.isArray(r.itens)||r.itens.some(i=>!i||typeof i!=='object'||Array.isArray(i))))throw Error('Item de documento inválido.');
      for(const k of ['titulo','dataDocumento','textoOriginal','paginasRevisadas','cobertura','naoReconhecidos','atualizadoEm'])if(r[k]!=null&&typeof r[k]!=='string')throw Error('Campo de documento inválido: '+k);
      if(r.origem!==undefined&&(!r.origem||typeof r.origem!=='object'||Array.isArray(r.origem)))throw Error('Origem do documento inválida.');
    }return m;
  }
  return{numero,data,hora,ativo,saldo,ocorrencias,registrarOcorrencia,indicadores,qualidade,hoje,episodios,resumoConsulta,documentosRefs,seriesPeso,validarMetadados};
})();
