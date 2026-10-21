/* Resumos somente de leitura. Dados privados ficam na memória desta aba,
   nunca no backup da Central, localStorage ou arquivos do site. */
const InicioGoogle = (() => {
  const FUSO='America/Sao_Paulo', LIMITE=4, CACHE_MS=60000;
  const nomes={agenda:'Google Agenda',gmail:'E-mails recentes',drive:'Atalhos do Drive'};
  const dicas={agenda:'Agenda principal · próximos 30 dias',gmail:'Caixa de entrada · mais recentes',drive:'Pastas do Meu Drive · A a Z'};
  const icones={agenda:'📅',gmail:'✉️',drive:'📁'};
  const criarEl=(tag,classe,texto)=>{const e=document.createElement(tag);if(classe)e.className=classe;if(texto!=null)e.textContent=texto;return e};
  const dataBR=(d,op={})=>new Intl.DateTimeFormat('pt-BR',{timeZone:FUSO,...op}).format(d);
  const diaISO=d=>new Intl.DateTimeFormat('en-CA',{timeZone:FUSO,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  function dataValida(t){const d=new Date(t);return Number.isFinite(d.getTime())?d:null}
  function linkGoogle(valor,host){try{const u=new URL(valor);return u.protocol==='https:'&&!u.username&&!u.password&&u.hostname===host?u.href:''}catch{return ''}}
  function quandoEvento(e,agora){
    if(e.start?.date){const d=dataValida(e.start.date+'T12:00:00-03:00');return d?(e.start.date===diaISO(agora)?'Hoje':dataBR(d,{day:'2-digit',month:'2-digit'}))+' · Dia inteiro':'Data não informada'}
    const d=dataValida(e.start?.dateTime);if(!d)return 'Data não informada';
    return (diaISO(d)===diaISO(agora)?'Hoje':dataBR(d,{day:'2-digit',month:'2-digit'}))+' · '+dataBR(d,{hour:'2-digit',minute:'2-digit'});
  }
  function eventosAtivos(items,agora){
    const inicio=e=>Date.parse(e.start.dateTime||(e.start.date+'T00:00:00-03:00'));
    const vistos=new Set();return items.filter(e=>{
      if(!e.id||vistos.has(e.id)||e.status==='cancelled'||e.attendees?.some(a=>a.self&&a.responseStatus==='declined'))return false;
      const inicio=e.start?.dateTime?dataValida(e.start.dateTime):dataValida((e.start?.date||'')+'T12:00:00-03:00');
      if(!inicio)return false;
      const terminou=e.end?.date?e.end.date<=diaISO(agora):e.end?.dateTime?(!dataValida(e.end.dateTime)||dataValida(e.end.dateTime)<=agora):inicio<agora;
      if(terminou)return false;vistos.add(e.id);return true;
    }).sort((a,b)=>inicio(a)-inicio(b));
  }
  function criar({ler,conectado,renovar,conexoes,abrirDrive}){
    let geracao=0;const cache=new Map(),pedidos=new Map(),montagens=new Set();
    function limpar(){geracao++;cache.clear();pedidos.clear();for(const m of montagens){if(m.raiz.isConnected)m.apagar();else montagens.delete(m)}}
    async function consultar(servico){
      if(servico==='agenda'){
        const agora=new Date(),fim=new Date(agora.getTime()+30*86400000);let token='',paginas=0,items=[];
        const calendario=ler('agenda','calendars/primary?fields=id').catch(()=>({}));
        do{const q=new URLSearchParams({singleEvents:'true',orderBy:'startTime',showDeleted:'false',maxResults:'20',timeMin:agora.toISOString(),timeMax:fim.toISOString(),timeZone:FUSO,fields:'nextPageToken,items(id,status,summary,start,end,htmlLink,attendees(self,responseStatus))'});
          if(token)q.set('pageToken',token);const r=await ler('agenda','calendars/primary/events?'+q);items.push(...(r.items||[]));token=r.nextPageToken||'';
        }while(token&&++paginas<3&&eventosAtivos(items,agora).length<LIMITE);
        const ativos=eventosAtivos(items,agora);return{items:ativos.slice(0,LIMITE),conta:(await calendario).id||'',parcial:!!token&&ativos.length<LIMITE};
      }
      if(servico==='gmail'){
        const lista=await ler('gmail','messages?'+new URLSearchParams({maxResults:String(LIMITE),q:'in:inbox',fields:'messages(id),nextPageToken'}));
        const [perfil,respostas]=await Promise.all([
          ler('gmail','profile?fields=emailAddress').catch(()=>({})),
          Promise.allSettled((lista.messages||[]).map(m=>{
            const q=new URLSearchParams({format:'metadata',fields:'id,threadId,internalDate,labelIds,payload(headers)'});
            for(const nome of ['Subject','From','Date'])q.append('metadataHeaders',nome);
            return ler('gmail','messages/'+encodeURIComponent(m.id)+'?'+q);
          }))
        ]);
        const items=respostas.filter(r=>r.status==='fulfilled').map(r=>r.value).sort((a,b)=>(+b.internalDate||0)-(+a.internalDate||0));
        if(respostas.length&&!items.length)throw Error('Não foi possível carregar os e-mails. Tente atualizar.');
        return{items,conta:perfil.emailAddress||'',parcial:items.length<respostas.length};
      }
      const items=[];let token='',paginas=0;
      do{const q=new URLSearchParams({q:"'root' in parents and trashed=false and mimeType='application/vnd.google-apps.folder'",orderBy:'name',pageSize:String(LIMITE),fields:'nextPageToken,files(id,name)'});
        if(token)q.set('pageToken',token);const r=await ler('drive','files?'+q);items.push(...(r.files||[]));token=r.nextPageToken||'';
      }while(token&&++paginas<3&&items.length<LIMITE);
      return{items:items.filter(f=>f.id).slice(0,LIMITE),parcial:!!token&&items.length<LIMITE};
    }
    async function dados(servico,forcar){
      if(!conectado(servico)){cache.delete(servico);return null}
      const salvo=cache.get(servico);if(!forcar&&salvo&&Date.now()-salvo.em<CACHE_MS)return salvo;
      if(pedidos.has(servico))return pedidos.get(servico);
      const g=geracao;
      const p=consultar(servico).then(r=>{if(g!==geracao||!conectado(servico))return null;const novo={...r,em:Date.now()};cache.set(servico,novo);return novo}).finally(()=>{if(pedidos.get(servico)===p)pedidos.delete(servico)});
      pedidos.set(servico,p);return p;
    }
    function montar(){
      const raiz=criarEl('section','inicio-google');raiz.setAttribute('aria-label','Google no seu dia');
      const topo=criarEl('div','ig-topo');topo.append(criarEl('h2','', 'Google no seu dia'));
      const conexao=criarEl('button','btn ghost','Conexões');conexao.type='button';conexao.onclick=conexoes;topo.append(conexao);raiz.append(topo);
      const grade=criarEl('div','ig-grade');raiz.append(grade);
      const apaga=[];
      const montagem={raiz,apagar:()=>apaga.forEach(f=>f())};
      for(const m of montagens)if(!m.raiz.isConnected)montagens.delete(m);
      montagens.add(montagem);
      for(const servico of ['agenda','gmail','drive']){
        const card=criarEl('article','ig-card');card.dataset.servico=servico;
        const header=criarEl('header','ig-cab');const ic=criarEl('span','ig-icone',icones[servico]);ic.setAttribute('aria-hidden','true');
        const nome=criarEl('div');nome.append(criarEl('h3','',nomes[servico]),criarEl('p','ig-meta',dicas[servico]));
        const atualizar=criarEl('button','ig-atualizar','↻');atualizar.type='button';atualizar.dataset.atualizar='';atualizar.setAttribute('aria-label','Atualizar '+nomes[servico]);
        header.append(ic,nome,atualizar);card.append(header);
        const status=criarEl('p','ig-status','');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
        const lista=criarEl('div','ig-lista');const rodape=criarEl('footer','ig-rodape');card.append(lista,status,rodape);grade.append(card);
        const conectar=()=>{lista.replaceChildren(criarEl('p','ig-vazio','Conecte para ver seu resumo.'));status.textContent='';rodape.replaceChildren();const b=criarEl('button','btn ghost','Conectar Google');b.type='button';b.dataset.conectar='';b.onclick=conexoes;rodape.append(b)};
        apaga.push(()=>{lista.replaceChildren();rodape.replaceChildren();status.textContent='Conexão atualizada. Use ↻ para consultar.'});
        const link=(url,texto,classe)=>{const a=criarEl('a',classe,texto);a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label',texto+' (abre no Google em outra aba)');return a};
        function pintar(r){
          lista.replaceChildren();rodape.replaceChildren();
          for(const item of r.items){
            let linha,titulo,meta,selo='';
            if(servico==='agenda'){
              let url=linkGoogle(item.htmlLink,'calendar.google.com')||linkGoogle(item.htmlLink,'www.google.com');
              if(url&&!new URL(url).pathname.startsWith('/calendar'))url='';
              if(url&&r.conta){const destino=new URL(url);destino.searchParams.set('authuser',r.conta);url=destino.href}
              titulo=item.summary||'Sem título';meta=quandoEvento(item,new Date());linha=url?link(url,'','ig-item'):criarEl('div','ig-item');
            }else if(servico==='gmail'){
              const h=n=>(item.payload?.headers||[]).find(x=>x.name.toLowerCase()===n.toLowerCase())?.value||'';
              titulo=h('Subject')||'(sem assunto)';const d=dataValida(+item.internalDate);
              meta=(h('From').replace(/\s*<[^>]+>\s*$/,'').replace(/^"|"$/g,'')||h('From')||'Remetente não informado')+(d?' · '+dataBR(d,{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'');
              const alvo=encodeURIComponent(item.threadId||item.id||'');linha=r.conta&&alvo?link('https://mail.google.com/mail/?authuser='+encodeURIComponent(r.conta)+'#inbox/'+alvo,'','ig-item'):criarEl('div','ig-item');
              if(item.labelIds?.includes('UNREAD'))selo='Não lido';
            }else{
              titulo=item.name||'Pasta sem nome';meta='Abrir pasta na Central';linha=criarEl('button','ig-item');linha.type='button';linha.onclick=()=>abrirDrive({id:item.id,name:item.name||'Pasta'});
            }
            const texto=criarEl('span','ig-texto');texto.append(criarEl('strong','',titulo),criarEl('small','',meta));linha.append(texto);
            if(selo)linha.append(criarEl('span','ig-selo',selo));
            linha.title=titulo;if(linha.tagName==='A')linha.setAttribute('aria-label',titulo+' (abre no Google em outra aba)');lista.append(linha);
          }
          if(!r.items.length)lista.append(criarEl('p','ig-vazio',r.parcial?'Consulta parcial. Atualize ou abra o serviço para conferir.':servico==='agenda'?'Nenhum compromisso nos próximos 30 dias.':servico==='gmail'?'Caixa de entrada vazia.':'Nenhuma pasta na raiz do Meu Drive.'));
          status.textContent=(r.parcial?'Consulta parcial · ':'')+'Atualizado às '+dataBR(new Date(r.em),{hour:'2-digit',minute:'2-digit'});
          if(servico==='drive'){const b=criarEl('button','btn ghost','Ver todo o Drive');b.type='button';b.onclick=()=>abrirDrive();rodape.append(b)}
          else if(servico==='agenda')rodape.append(link('https://calendar.google.com/calendar/'+(r.conta?'?authuser='+encodeURIComponent(r.conta):''),'Abrir Google Agenda ↗','btn ghost'));
          else if(r.conta)rodape.append(link('https://mail.google.com/mail/?authuser='+encodeURIComponent(r.conta)+'#inbox','Abrir Gmail ↗','btn ghost'));
          else rodape.append(criarEl('span','ig-meta','Conta não identificada. Atualize para abrir o Gmail.'));
        }
        async function carregar(forcar=false){
          atualizar.disabled=true;card.setAttribute('aria-busy','true');status.textContent='Consultando…';
          try{
            if(forcar&&!conectado(servico))await renovar();
            if(!conectado(servico)){conectar();return}
            if(!lista.childNodes.length)lista.append(criarEl('p','ig-vazio','Carregando…'));
            const r=await dados(servico,forcar);
            if(!raiz.isConnected)return;
            if(!r||!conectado(servico)){conectar();return}pintar(r);
          }catch(e){
            if(!raiz.isConnected)return;lista.replaceChildren();rodape.replaceChildren();status.textContent=e.message||'Não foi possível consultar. Tente atualizar.';
            const b=criarEl('button','btn ghost','Ver conexão');b.type='button';b.onclick=conexoes;rodape.append(b);
          }finally{atualizar.disabled=false;card.setAttribute('aria-busy','false')}
        }
        atualizar.onclick=()=>carregar(true);carregar();
      }
      return raiz;
    }
    return{montar,limpar};
  }
  return{criar};
})();
