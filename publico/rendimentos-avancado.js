/* Interface isolada de Rendimentos. Filtros são apenas estado de tela. */
const RendimentosUI=(()=>{
 let estado=null;
 const meses=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
 const cores=['#3840e8','#4159b7','#a64b80','#95621b','#2d79a4','#7651a4','#566b2c'];
 const paleta=new Map();
 const cor=s=>paleta.get(String(s))||cores[[...String(s)].reduce((n,c)=>n+c.charCodeAt(0),0)%cores.length];
 const money=v=>v===null?'Sem informação':brl(v);
 const pct=v=>v===null?'Sem base comparável':(v>0?'+':'')+v.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
 const btn=(t,fn,cl='ghost')=>{const b=el('<button type="button" class="btn '+cl+'"></button>');b.textContent=t;b.onclick=fn;return b};
 const selecionar=(label,valor,opcoes,fn)=>{const l=el('<label class="ra-field"><span></span><select></select></label>');l.firstElementChild.textContent=label;const s=l.querySelector('select');opcoes.forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;o.selected=String(v)===String(valor);s.appendChild(o)});s.onchange=()=>fn(s.value);return l};
 const texto=(label,valor,tipo,fn)=>{const l=el('<label class="ra-field"><span></span><input></label>');l.firstElementChild.textContent=label;const i=l.querySelector('input');i.type=tipo;i.value=valor||'';i.onchange=()=>fn(i.value);return l};
 const card=(titulo,nota='')=>{const c=el('<section class="ra-card"><header><h2></h2><p></p></header><div class="ra-body"></div></section>');c.querySelector('h2').textContent=titulo;c.querySelector('p').textContent=nota;return c};
 function dados(){return RendimentosModelo.construir(E.rendimentos,E.rendHist,hoje())}
 function novo(){modalRendimento({id:uid(),data:hoje(),empresa:estado.empresas[0]||empresasParaLancar()[0]||'Outro',instituicao:'',tipo:'',valor:0,obs:''},true)}
 function render(m){
  const d=dados();d.empresas.forEach((e,i)=>paleta.set(e,cores[i%cores.length]));d.anos.forEach((y,i)=>paleta.set(String(y),cores[i%cores.length]));if(!estado)estado={anos:filtro.rendAno==='todos'?d.anos:[filtro.rendAno||anoHoje],empresas:filtro.rendEmp&&filtro.rendEmp!=='Todas'?[filtro.rendEmp]:[],meses:[],de:'',ate:'',aba:abasFinanceiras.rendimentos||'resumo',grafico:'mensal',busca:'',tipo:'',situacao:'Todos',ordem:'data-desc',grupo:'mes',pagina:1,colunas:['instituicao','tipo','obs'],ocultos:[],rotacao:35,compAnoA:anoHoje,compAnoB:anoHoje-1,compEmpA:'Todas',compEmpB:'Todas',filtrosAbertos:false,resumoExpandido:false,matrizesFechadas:[]};
  m.classList.add('ra-app','financeiro');
  const r=()=>{if(atual==='rendimentos')tela()};
  const mudar=patch=>{Object.assign(estado,patch);estado.pagina=1;r()};
  const top=cab('Rendimentos','Resumo, comparações e lançamentos.');top.appendChild(btn('+ Novo rendimento',novo,''));m.appendChild(top);
  const filtros=el('<section class="ra-filtros" aria-label="Filtros de rendimentos"></section>');
  const avancados=el('<details class="ra-filtros-extra"><summary>Mais filtros</summary><div></div></details>');avancados.open=!!estado.filtrosAbertos;avancados.ontoggle=()=>{estado.filtrosAbertos=avancados.open};const extra=avancados.lastElementChild;
  filtros.appendChild(selecionar('Período',estado.de||estado.ate?'intervalo':estado.anos.length===1?estado.anos[0]:estado.anos.length===d.anos.length?'todos':'selecao',[...d.anos.slice().reverse().map(a=>[a,a]),['todos','Todos os anos'],...(estado.anos.length>1&&estado.anos.length<d.anos.length?[['selecao','Anos selecionados']]:[]),['intervalo','Intervalo personalizado']],v=>v!=='selecao'&&mudar(v==='intervalo'?{de:hoje().slice(0,4)+'-01-01',ate:hoje(),anos:d.anos,meses:[],filtrosAbertos:true}:v==='todos'?{anos:d.anos,de:'',ate:''}:{anos:[+v],de:'',ate:''})));
  const picks=(titulo,lista,selecionados,fn)=>{const det=el('<details class="ra-picks"><summary></summary><div></div></details>');det.querySelector('summary').textContent=titulo;lista.forEach(([v,t])=>{const l=el('<label><input type="checkbox"><span></span></label>');l.querySelector('span').textContent=t;l.querySelector('input').checked=selecionados.includes(v);l.querySelector('input').onchange=e=>fn(v,e.target.checked);det.lastElementChild.appendChild(l)});return det};
  extra.appendChild(picks('Anos selecionados · '+estado.anos.length,d.anos.map(a=>[a,a]),estado.anos,(a,on)=>mudar({anos:on?[...estado.anos,a].sort():estado.anos.filter(y=>y!==a)})));
  filtros.appendChild(picks(estado.empresas.length?estado.empresas.length+' empresa(s)':'Todas as empresas',d.empresas.map(e=>[e,e]),estado.empresas,(e,on)=>mudar({empresas:on?[...estado.empresas,e]:estado.empresas.filter(x=>x!==e)})));
  extra.appendChild(btn('Limpar filtros',()=>mudar({anos:d.anos,empresas:[],meses:[],de:'',ate:'',busca:'',tipo:'',situacao:'Todos'})));
  const ex=el('<details class="ra-export"><summary>Exportar</summary><div></div></details>');ex.lastElementChild.append(btn('CSV do recorte',()=>exportar('csv')),btn('Excel do recorte',()=>exportar('xlsx')),btn('Relatório / PDF',imprimir));filtros.append(avancados,ex);m.appendChild(filtros);
  if(estado.de||estado.ate){const dates=el('<div class="ra-dates"></div>');dates.append(texto('De',estado.de,'date',v=>mudar({de:v})),texto('Até',estado.ate,'date',v=>mudar({ate:v})));extra.appendChild(dates)}
  const chips=el('<nav class="ra-chips" aria-label="Meses do recorte"></nav>');const todos=btn('Ano inteiro',()=>mudar({meses:[],de:'',ate:''}));todos.setAttribute('aria-pressed',String(!estado.meses.length));chips.appendChild(todos);meses.forEach((nome,i)=>{const b=btn(nome,()=>mudar({meses:estado.meses.includes(i+1)?estado.meses.filter(x=>x!==i+1):[...estado.meses,i+1].sort((a,b)=>a-b)}));b.setAttribute('aria-pressed',String(estado.meses.includes(i+1)));chips.appendChild(b)});extra.appendChild(chips);
  const contexto=()=>estado.anos.join(', ')+' · '+(estado.empresas.join(', ')||'Todas as empresas')+' · '+(estado.meses.length?estado.meses.map(i=>meses[i-1]).join(', '):'Ano inteiro')+(estado.de||estado.ate?' · '+(estado.de||'início')+' a '+(estado.ate||'fim'):'');
  m.appendChild(el('<p class="ra-contexto">'+esc(contexto())+' · Data do recebimento'+'</p>'));
  const nav=el('<nav class="finance-tabs" aria-label="Visões financeiras"></nav>');[['resumo','◉ Resumo'],['graficos','▥ Gráficos'],['comparar','⇄ Comparar'],['lancamentos','☷ Lançamentos'],['historico','◷ Histórico']].forEach(([id,t])=>{const b=btn(t,()=>{abasFinanceiras.rendimentos=id;mudar({aba:id})});b.setAttribute('aria-pressed',String(estado.aba===id));nav.appendChild(b)});m.appendChild(nav);

  if(!estado.anos.length){m.appendChild(el('<p class="ra-note">Selecione pelo menos um ano.</p>'));return}
  if(estado.de&&estado.ate&&estado.de>estado.ate){m.appendChild(el('<p role="alert" class="ra-note">A data inicial precisa vir antes da data final.</p>'));return}
  const a=d.analisar(estado.aba==='lancamentos'?estado:{...estado,busca:'',tipo:'',situacao:'Todos'});
  const abrir=(year,emp,month)=>{if(emp?.semEmpresa){mudar({aba:'historico'});return}if(year)estado.anos=[year];if(emp&&!emp.semEmpresa)estado.empresas=[typeof emp==='string'?emp:emp.nome];if(month)estado.meses=[month];mudar({aba:year&&!month&&d.celula(year,estado.empresas).fonte==='Histórico anual'?'historico':'lancamentos',busca:'',tipo:'',situacao:'Todos'})};
  if(estado.aba==='lancamentos'){lancamentos(m,d,a,r,mudar);return}
  if(estado.aba==='comparar'){comparacao(m,d,mudar,abrir);return}
  if(estado.aba==='historico'){historico(m,d,a,abrir);return}
  if(estado.aba==='graficos'){RendimentosDashboards.render(m,{estado,mudar,abrir,legacy:alvo=>graficos(alvo,d,a,mudar,abrir)});return}
  const resumo=el('<section class="ra-resumo" aria-label="Resumo do período"></section>');resumo.dataset.expandido=String(!!estado.resumoExpandido);m.appendChild(resumo);
  const resumoCab=el('<header class="ra-resumo-cab"><h2>Resumo do período</h2></header>');const expandir=btn('',()=>{estado.resumoExpandido=!estado.resumoExpandido;atualizarResumo()});expandir.setAttribute('aria-controls','ra-resumo-detalhes');resumoCab.appendChild(expandir);resumo.appendChild(resumoCab);
  const detalhes=el('<div id="ra-resumo-detalhes" class="ra-resumo-detalhes"></div>');
  function atualizarResumo(){resumo.dataset.expandido=String(!!estado.resumoExpandido);detalhes.hidden=!estado.resumoExpandido;expandir.textContent=estado.resumoExpandido?'Recolher detalhes':'Expandir detalhes';expandir.setAttribute('aria-expanded',String(!!estado.resumoExpandido))}atualizarResumo();
  const grid=el('<div class="ra-kpis"></div>');const k=(rot,val,sub,fn)=>{const c=btn('',fn,'ra-kpi');c.innerHTML='<span>'+esc(rot)+'</span><strong>'+esc(val)+'</strong><small>'+esc(sub)+'</small>';grid.appendChild(c)};
  k('Total registrado',money(a.total),'Base anual sem duplicar lançamentos',()=>mudar({aba:'historico'}));
  k('Média mensal datada',money(a.media),a.nMeses+' meses com informação',()=>mudar({aba:'graficos',grafico:'mensal'}));
  k('Maior fonte',a.rank[0]?.nome||'Sem informação',a.rank[0]?money(a.rank[0].valor):'Cadastre um rendimento',()=>mudar({aba:'graficos',grafico:'empresas'}));
  k('Lançamentos',String(a.linhas.length),a.previstos.length+' com data futura / previstos',()=>mudar({aba:'lancamentos'}));resumo.appendChild(grid);
  detalhes.appendChild(el('<p class="ra-note">'+(a.semMes?'Há totais sem detalhamento mensal. Eles aparecem no anual, mas não são distribuídos pelos meses. ':'')+'Meses vazios significam ausência de informação. Valores futuros ficam separados do total registrado.</p>'));
  matrizEmpresas(resumo,d,abrir);resumo.appendChild(detalhes);
  const pair=el('<div class="ra-grid"></div>');const c=card('Evolução anual','Clique em um ano para conferir a origem.');c.lastElementChild.appendChild(chartBars(a.cells.map(c=>({label:String(c.ano),valor:c.valor,cor:cor(c.ano),fn:()=>abrir(c.ano)}))));pair.appendChild(c);
  const rank=card('Participação por empresa','Valores registrados no recorte.');rank.lastElementChild.appendChild(ranking(a.rank,a.total,abrir));pair.appendChild(rank);detalhes.appendChild(pair);
  const mensal=serieMensal(d,estado.anos,estado.empresas,estado.meses).flatMap(s=>s.pontos.filter(p=>p.valor!==null).map(p=>({...p,ano:s.ano})));
  const max=mensal.slice().sort((a,b)=>b.valor-a.valor)[0],min=mensal.slice().sort((a,b)=>a.valor-b.valor)[0];
  const insights=el('<div class="ra-insights"></div>');for(const [t,p] of [['Maior mês registrado',max],['Menor mês registrado',min]])insights.appendChild(btn(p?t+': '+meses[p.mes-1]+'/'+p.ano+' · '+money(p.valor):t+': sem dados',()=>p&&abrir(p.ano,null,p.mes)));
  const positivos=a.rank.filter(x=>x.valor>0),base=positivos.reduce((s,x)=>s+x.valor,0);insights.appendChild(el('<p>Concentração das 3 maiores fontes: <b>'+(base?((positivos.slice(0,3).reduce((s,x)=>s+x.valor,0)/base)*100).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%':'Sem base positiva')+'</b><br><small>Sobre fontes com saldo positivo; ajustes negativos ficam fora dessa proporção.</small></p>'));detalhes.appendChild(insights);
 }

 function destino(alvo){if(estado&&alvo){estado.aba=alvo==='rd-lanc'?'lancamentos':alvo==='rd-graficos'?'graficos':'historico';estado.anos=filtro.rendAno==='todos'?dados().anos:[filtro.rendAno||anoHoje];estado.empresas=!filtro.rendEmp||filtro.rendEmp==='Todas'?[]:[filtro.rendEmp];estado.meses=[]}}
 function ranking(rows,total,abrir){const out=el('<div class="ra-ranking"></div>'),max=Math.max(1,...rows.map(x=>Math.abs(x.valor)));rows.forEach(x=>{const b=btn('',()=>abrir(null,x));b.innerHTML='<span>'+esc(x.nome)+'</span><b>'+money(x.valor)+'</b><i style="width:'+Math.abs(x.valor)/max*100+'%;background:'+cor(x.nome)+'"></i><small>'+(total>0?(x.valor/total*100).toLocaleString('pt-BR',{maximumFractionDigits:1})+'% do total':'Sem base percentual')+'</small>';out.appendChild(b)});if(!rows.length)out.textContent='Sem informação para este recorte.';return out}
 function chartBars(rows){const box=el('<div class="ra-bars"></div>'),min=Math.min(0,...rows.map(x=>x.valor||0)),max=Math.max(0,...rows.map(x=>x.valor||0)),span=max-min||1,zero=-min/span*100;
 rows.forEach(x=>{const b=btn('',x.fn||(()=>{})),v=x.valor||0,left=(Math.min(0,v)-min)/span*100;b.innerHTML='<span>'+esc(x.label)+'</span><div style="position:relative"><i style="position:absolute;left:'+left+'%;width:'+Math.abs(v)/span*100+'%;background:'+(v<0?'#b94a45':x.cor||cor(x.label))+'"></i>'+(min<0?'<em style="position:absolute;left:'+zero+'%;height:100%;border-left:1px solid var(--tinta)"></em>':'')+'</div><b>'+money(x.valor)+'</b>';box.appendChild(b)});return box}

 function serieMensal(d,anos,emp,selMes=[]){return anos.map(ano=>({ano,label:String(ano),cor:cor(ano),pontos:meses.map((_,i)=>({mes:i+1,valor:selMes.length&&!selMes.includes(i+1)?null:d.celula(ano,emp,[i+1],estado.de,estado.ate).valor}))}))}
 function svgLinhas(series,abrir,acumulado=false){
  const out=el('<div class="ra-chart"></div>');const ss=series.map(s=>{let ac=0;return{...s,pontos:s.pontos.map(p=>{if(p.valor!==null)ac+=p.valor;return{...p,valor:p.valor===null?null:acumulado?ac:p.valor}})}});
  const vals=ss.flatMap(s=>s.pontos.map(p=>p.valor).filter(v=>v!==null));if(!vals.length){out.textContent='Sem lançamentos datados neste recorte.';return out}
  const min=Math.min(0,...vals),max=Math.max(0,...vals),span=max-min||1,y=v=>240-(v-min)/span*200,x=i=>75+i*55;
  let svg='<svg viewBox="0 0 730 290" role="img" aria-label="Evolução mensal, valores disponíveis na tabela abaixo">';[min,(min+max)/2,max].forEach(v=>svg+='<path d="M75 '+y(v)+'H685" class="ra-gridline"/><text x="65" y="'+(y(v)+4)+'" text-anchor="end">'+esc(curtoRendimento(v))+'</text>');
  meses.forEach((m,i)=>svg+='<text x="'+x(i)+'" y="270" text-anchor="middle">'+m+'</text>');
  ss.forEach((s,si)=>{let prev=null;s.pontos.forEach((p,i)=>{if(p.valor===null){prev=null;return}if(prev)svg+='<path d="M'+prev.x+' '+prev.y+'L'+x(i)+' '+y(p.valor)+'" fill="none" stroke="'+s.cor+'" stroke-width="2.5"/>';svg+='<circle role="button" tabindex="0" data-ponto="'+si+':'+i+'" cx="'+x(i)+'" cy="'+y(p.valor)+'" r="6" fill="'+s.cor+'" aria-label="'+esc(s.label+' '+meses[i]+': '+money(p.valor))+'"><title>'+esc(s.label+' '+meses[i]+': '+money(p.valor))+'</title></circle>';prev={x:x(i),y:y(p.valor)}})});out.innerHTML=svg+'</svg>';
  out.querySelectorAll('[data-ponto]').forEach(p=>{const [si,i]=p.dataset.ponto.split(':').map(Number);const fn=()=>abrir(ss[si].ano,null,i+1);p.onclick=fn;p.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn()}}});return out;
 }
 function tabela(headers,rows){const wrap=el('<div class="ra-table-wrap"><table><thead></thead><tbody></tbody></table></div>');wrap.querySelector('thead').innerHTML='<tr>'+headers.map(h=>'<th scope="col">'+esc(h)+'</th>').join('')+'</tr>';rows.forEach(row=>{const tr=document.createElement('tr');row.forEach(v=>{const td=document.createElement('td');if(v&&typeof v==='object'&&v.nodeType)td.appendChild(v);else td.textContent=v??'Sem informação';tr.appendChild(td)});wrap.querySelector('tbody').appendChild(tr)});return wrap}
 function graficos(m,d,a,mudar,abrir){
  const types=[['mensal','Mês a mês'],['anual','Anual'],['acumulado','Acumulado'],['empresas','Empresas'],['composicao','Composição'],['matriz','Mapa de calor'],['dispersao','Volume × crescimento'],['3d','Colunas 3D']];
  m.appendChild(selecionar('Análise visual',estado.grafico,types,v=>mudar({grafico:v,ocultos:[]})));
  const c=card(types.find(x=>x[0]===estado.grafico)?.[1]||'Análise','Selecione um valor para abrir os registros. A tabela mantém os valores exatos.');m.appendChild(c);const body=c.lastElementChild;
  const serie=serieMensal(d,estado.anos,estado.empresas,estado.meses);
  if(['mensal','acumulado'].includes(estado.grafico)){
   const legend=el('<div class="ra-chips"></div>');serie.forEach(s=>{const b=btn(s.label,()=>mudar({ocultos:estado.ocultos.includes(s.ano)?estado.ocultos.filter(a=>a!==s.ano):[...estado.ocultos,s.ano]}));b.style.borderColor=s.cor;b.setAttribute('aria-pressed',String(!estado.ocultos.includes(s.ano)));legend.appendChild(b)});body.appendChild(legend);body.appendChild(svgLinhas(serie.filter(s=>!estado.ocultos.includes(s.ano)),abrir,estado.grafico==='acumulado'));if(estado.grafico==='acumulado')body.appendChild(el('<p class="ra-note">Acumula apenas valores conhecidos. Lacunas continuam sem informação e não comprovam total completo.</p>'));
  }else if(estado.grafico==='anual')body.appendChild(chartBars(a.cells.map(c=>({label:String(c.ano),valor:c.valor,fn:()=>abrir(c.ano)}))));
  else if(estado.grafico==='empresas')body.appendChild(ranking(a.rank,a.total,abrir));
  else if(estado.grafico==='3d')render3D(body,d,mudar,abrir);
  else if(estado.grafico==='composicao'){
   estado.anos.forEach(y=>{const row=el('<div class="ra-stack"><b>'+y+'</b><div></div></div>');const values=(estado.empresas.length?estado.empresas:d.empresas).map(e=>({nome:e,v:d.celula(y,[e],estado.meses,estado.de,estado.ate).valor})).filter(x=>x.v>0),sum=values.reduce((s,x)=>s+x.v,0);values.forEach(x=>{const b=btn(x.nome,()=>abrir(y,x.nome));b.style.flexBasis=x.v/sum*100+'%';b.style.background=cor(x.nome);b.title=x.nome+': '+money(x.v);b.setAttribute('aria-label',b.title);row.lastElementChild.appendChild(b)});body.appendChild(row)});body.appendChild(el('<p class="ra-note">Composição proporcional das entradas positivas. Ajustes negativos aparecem na tabela, sem distorcer a divisão.</p>'));
  }else if(estado.grafico==='dispersao'){
   const years=estado.anos.slice().sort((a,b)=>a-b);if(years.length<2)body.appendChild(el('<p>Selecione pelo menos dois anos para comparar volume e crescimento.</p>'));
   else{const points=(estado.empresas.length?estado.empresas:d.empresas).map(e=>({nome:e,c:d.comparar({ano:years.at(-1),empresas:[e],meses:estado.meses},{ano:years[0],empresas:[e]})})).filter(p=>p.c.percentual!==null);if(!points.length)body.appendChild(el('<p>Sem cobertura comparável suficiente. Consulte Comparar para conferir os períodos.</p>'));else{const minX=Math.min(0,...points.map(p=>p.c.a.valor)),maxX=Math.max(1,...points.map(p=>p.c.a.valor)),lo=Math.min(0,...points.map(p=>p.c.percentual)),hi=Math.max(1,...points.map(p=>p.c.percentual));const svg=el('<div class="ra-chart"></div>');svg.innerHTML='<svg viewBox="0 0 730 290" role="img" aria-label="Volume e crescimento"><path d="M70 20V240H690" class="ra-gridline"/><text x="320" y="280">Volume registrado (R$)</text><text x="10" y="15">Crescimento %</text>'+points.map((p,i)=>'<circle data-scatter="'+i+'" role="button" tabindex="0" cx="'+(70+(p.c.a.valor-minX)/(maxX-minX)*590)+'" cy="'+(240-(p.c.percentual-lo)/(hi-lo)*210)+'" r="8" fill="'+cor(p.nome)+'" aria-label="'+esc(p.nome+' '+money(p.c.a.valor)+' '+pct(p.c.percentual))+'"><title>'+esc(p.nome+' '+money(p.c.a.valor)+' '+pct(p.c.percentual))+'</title></circle>').join('')+'</svg>';svg.querySelectorAll('[data-scatter]').forEach(b=>{b.onclick=()=>abrir(years.at(-1),points[+b.dataset.scatter].nome);b.onkeydown=e=>{if(e.key==='Enter')b.onclick()}});body.appendChild(svg);body.appendChild(tabela(['Empresa',String(years[0]),String(years.at(-1)),'Variação'],points.map(p=>[p.nome,money(p.c.b.valor),money(p.c.a.valor),pct(p.c.percentual)])))}}
  }
  const table=card('Valores por ano e mês','Sem informação é diferente de zero. Histórico sem data mensal fica somente no anual.');const matrix=tabela(['Ano',...meses,'Total anual'],serie.map(s=>[String(s.ano),...s.pontos.map(p=>p.valor===null?'—':btn(money(p.valor),()=>abrir(s.ano,null,p.mes))),money(d.celula(s.ano,estado.empresas,estado.meses,estado.de,estado.ate).valor)]));if(estado.grafico==='matriz'){matrix.classList.add('ra-heat');const max=Math.max(1,...serie.flatMap(s=>s.pontos.map(p=>Math.abs(p.valor||0))));[...matrix.querySelectorAll('tbody tr')].forEach((tr,i)=>[...tr.querySelectorAll('td')].slice(1,13).forEach((td,j)=>{const v=serie[i].pontos[j].valor;if(v!==null){td.style.background='color-mix(in srgb, var(--leo-accent) '+(5+Math.abs(v)/max*22)+'%, var(--card))';td.title=meses[j]+' '+money(v)}}))}table.lastElementChild.appendChild(matrix);m.appendChild(table);
 }
 function render3D(body,d,mudar,abrir){
  const empresas=(estado.empresas.length?estado.empresas:d.empresas).slice(0,8),anos=estado.anos.slice(-6);
  const cells=anos.flatMap((y,j)=>empresas.map((e,i)=>({y,e,i,j,v:d.celula(y,[e],estado.meses,estado.de,estado.ate).valor}))).filter(x=>x.v!==null);
  if(cells.some(c=>c.v<0)){body.appendChild(el('<p class="ra-note">Este recorte contém ajustes negativos. Use as barras 2D e a tabela para comparar entradas e saídas corretamente.</p>'));body.appendChild(chartBars(cells.map(c=>({label:c.e+' · '+c.y,valor:c.v,fn:()=>abrir(c.y,c.e)}))));return}
  if(!cells.length){body.appendChild(el('<p>Sem valores disponíveis para este recorte.</p>'));return}
  body.appendChild(el('<p class="ra-note">Até 8 empresas e 6 anos selecionados. Passe sobre uma coluna para ver o valor; clique para conferir a origem. A tabela abaixo mantém a comparação exata.</p>'));
  const controls=el('<div class="ra-tools"></div>'),slider=texto('Rotação',estado.rotacao,'range',v=>mudar({rotacao:+v}));
  slider.querySelector('input').min='10';slider.querySelector('input').max='65';controls.append(slider,btn('Restaurar posição',()=>mudar({rotacao:35})),btn('Voltar ao 2D',()=>mudar({grafico:'anual'})));body.appendChild(controls);
  const legend=el('<div class="ra-3d-legend"></div>');empresas.forEach((e,i)=>legend.appendChild(el('<span><i style="background:'+cores[i%cores.length]+'"></i>'+esc(e)+'</span>')));body.appendChild(legend);
  const max=Math.max(1,...cells.map(c=>c.v)),theta=estado.rotacao*Math.PI/180;
  const project=(x,z,h)=>[(x-z)*Math.cos(theta)*56,(x+z)*Math.sin(theta)*23-h];
  const point=(x,z,h)=>project(x,z,h).map(n=>n.toFixed(1)).join(',');
  const bounds=cells.flatMap(c=>[project(c.i,c.j,0),project(c.i+1,c.j+1,c.v/max*180)]);
  const minX=Math.min(...bounds.map(p=>p[0]))-90,maxX=Math.max(...bounds.map(p=>p[0]))+30,minY=Math.min(...bounds.map(p=>p[1]))-60,maxY=Math.max(...bounds.map(p=>p[1]))+65;
  const faces=cells.slice().sort((a,b)=>(a.i+a.j)-(b.i+b.j)).map(c=>{const h=c.v/max*180,x=c.i,z=c.j,w=.62;
   const sides=[[[x,z,0],[x+w,z,0],[x+w,z,h],[x,z,h]],[[x+w,z,0],[x+w,z+w,0],[x+w,z+w,h],[x+w,z,h]],[[x,z,h],[x+w,z,h],[x+w,z+w,h],[x,z+w,h]]];
   return '<g data-3d="'+cells.indexOf(c)+'" role="button" tabindex="0" aria-label="'+esc(c.e+' '+c.y+' '+money(c.v))+'"><title>'+esc(c.e+' '+c.y+': '+money(c.v))+'</title>'+sides.map((f,i)=>'<polygon points="'+f.map(p=>point(...p)).join(' ')+'" fill="'+cores[c.i%cores.length]+'" stroke="var(--card)" stroke-width=".7" opacity="'+[1,.72,.88][i]+'"/>').join('')+'</g>';
  }).join('');
  const axis=[0,.5,1].map(n=>{const p=[minX+70,-n*180];return '<text x="'+p[0]+'" y="'+p[1]+'" text-anchor="end">'+esc(curtoRendimento(max*n))+'</text>'}).join('');
  const years=anos.map((y,j)=>{const p=project(-1.7,j,0);return '<text x="'+p[0]+'" y="'+(p[1]+18)+'" text-anchor="end">'+y+'</text>'}).join('');
  const svg=el('<div class="ra-chart ra-3d"></div>');svg.innerHTML='<svg viewBox="'+[minX,minY,maxX-minX,maxY-minY].join(' ')+'" role="img" aria-label="Colunas tridimensionais por empresa e ano">'+faces+axis+years+'</svg>';
  svg.querySelectorAll('[data-3d]').forEach(g=>{g.onclick=()=>abrir(cells[+g.dataset['3d']].y,cells[+g.dataset['3d']].e);g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();g.onclick()}}});body.appendChild(svg);body.appendChild(tabela(['Empresa','Ano','Valor'],cells.map(c=>[c.e,c.y,money(c.v)])));
 }
 function corteComparacao(k){const ano=estado['compAno'+k],atual=estado.compAnoA===+hoje().slice(0,4)||estado.compAnoB===+hoje().slice(0,4);return{ano,empresas:estado['compEmp'+k]==='Todas'?estado.empresas:[estado['compEmp'+k]],meses:estado.meses,de:estado.de?ano+estado.de.slice(4):'',ate:estado.ate?ano+estado.ate.slice(4):atual?ano+hoje().slice(4):''}}
 function compararAtual(d){return d.comparar(corteComparacao('A'),corteComparacao('B'))}
 function comparacao(m,d,mudar,abrir){
  const c=card('Comparar dois cenários','A menos B. Meses selecionados valem para os dois cenários; ano corrente usa o mesmo mês e dia nos dois cenários. Os anos dos cenários prevalecem sobre o filtro geral.');m.appendChild(c);const choices=[['Todas','Todas as empresas'],...d.empresas.map(e=>[e,e])];const grid=el('<div class="ra-compare"></div>');['A','B'].forEach(k=>{const group=el('<fieldset><legend>Cenário '+k+'</legend></fieldset>');group.append(selecionar('Ano '+k,estado['compAno'+k],[...new Set([...d.anos,estado.compAnoA,estado.compAnoB])].sort().map(y=>[y,y]),v=>mudar({['compAno'+k]:+v})),selecionar('Empresa '+k,estado['compEmp'+k],choices,v=>mudar({['compEmp'+k]:v})));grid.appendChild(group)});c.lastElementChild.appendChild(grid);
  const co=compararAtual(d);
  c.lastElementChild.appendChild(chartBars([{label:'A · '+estado.compEmpA+' · '+estado.compAnoA,valor:co.a.valor,fn:()=>abrir(estado.compAnoA,estado.compEmpA==='Todas'?null:estado.compEmpA)},{label:'B · '+estado.compEmpB+' · '+estado.compAnoB,valor:co.b.valor,fn:()=>abrir(estado.compAnoB,estado.compEmpB==='Todas'?null:estado.compEmpB)}]));c.lastElementChild.appendChild(el('<div class="ra-insights"><p>Diferença entre registros<br><b>'+money(co.valor)+'</b></p><p>Variação comparável<br><b>'+pct(co.percentual)+'</b></p></div>'));
  if(!co.comparavel)c.lastElementChild.appendChild(el('<p class="ra-note">Cobertura incompleta ou diferente. A diferença em reais é apenas descritiva; não representa crescimento comprovado.</p>'));
  c.lastElementChild.appendChild(tabela(['Base','Fonte','Meses datados','Cobertura'],[['A',co.a.fonte,co.a.meses.map(i=>meses[i-1]).join(', ')||'Sem detalhe',co.a.parcial?'Parcial':'Conforme cadastro'],['B',co.b.fonte,co.b.meses.map(i=>meses[i-1]).join(', ')||'Sem detalhe',co.b.parcial?'Parcial':'Conforme cadastro']]));
  const rows=meses.map((nome,i)=>{const a=d.celula(estado.compAnoA,estado.compEmpA==='Todas'?estado.empresas:[estado.compEmpA],[i+1],corteComparacao('A').de,corteComparacao('A').ate),b=d.celula(estado.compAnoB,estado.compEmpB==='Todas'?estado.empresas:[estado.compEmpB],[i+1],corteComparacao('B').de,corteComparacao('B').ate);return[nome,money(a.valor),money(b.valor),pct(RendimentosModelo.delta(a.valor,b.valor).percentual)]}).filter((_,i)=>!co.meses.length||co.meses.includes(i+1));c.lastElementChild.appendChild(tabela(['Mês','A','B','Variação descritiva'],rows));
 }
 function historico(m,d,a,abrir){const c=card('Histórico e cobertura','Nos anos com lançamentos, a soma deles substitui o histórico anual, sem somar as duas bases.');c.lastElementChild.appendChild(tabela(['Ano','Total do recorte','Fonte','Meses datados','Registros'],a.cells.map(c=>[btn(String(c.ano),()=>abrir(c.ano)),money(c.valor),c.fonte+(c.parcial?' · parcial':''),c.meses.length+'/12',String(c.itens.length)])));m.appendChild(c);const conc=card('Conferência da base original','Conferência global por ano, sem filtro de empresa. Diferenças pedem revisão, não são corrigidas automaticamente.');conc.lastElementChild.appendChild(tabela(['Ano','Histórico original','Lançamentos','Diferença'],a.conciliacao.map(x=>[x.ano,money(x.base),money(x.atual),money(x.diferenca)])));m.appendChild(conc);if(a.invalidos.length)m.appendChild(el('<p class="ra-note">'+a.invalidos.length+' registros com data ou valor inválido ficaram fora dos cálculos. Corrija os dados na ficha original.</p>'))}
 function matrizEmpresas(m,d,abrir){
  for(const ano of estado.anos.slice().sort((a,b)=>b-a)){
   const es=estado.empresas.length?estado.empresas:d.empresas;
   const rows=es.map(nome=>{const vals=meses.map((_,i)=>estado.meses.length&&!estado.meses.includes(i+1)?null:d.celula(ano,[nome],[i+1],estado.de,estado.ate).valor);const conhecidos=vals.filter(v=>v!==null);return{nome,vals,total:conhecidos.length?conhecidos.reduce((s,v)=>s+v,0):null}}).filter(x=>x.total!==null).sort((a,b)=>b.total-a.total);
   const c=card('Por empresa, mês a mês','O mesmo recorte dos filtros · '+ano);c.classList.add('ra-matriz');c.dataset.bid='rd-mensal';
   const corpo=c.lastElementChild;corpo.id='ra-matriz-'+ano;corpo.hidden=(estado.matrizesFechadas||[]).includes(ano);const collapse=btn('',()=>{corpo.hidden=!corpo.hidden;estado.matrizesFechadas=corpo.hidden?[...(estado.matrizesFechadas||[]),ano]:(estado.matrizesFechadas||[]).filter(y=>y!==ano);atualizarMatriz()});function atualizarMatriz(){collapse.textContent=corpo.hidden?'Expandir':'Recolher';collapse.setAttribute('aria-expanded',String(!corpo.hidden))}atualizarMatriz();collapse.setAttribute('aria-label','Recolher ou expandir empresas de '+ano);collapse.setAttribute('aria-controls',corpo.id);c.querySelector('header').appendChild(collapse);
   if(!rows.length){c.lastElementChild.appendChild(el('<p class="ra-contexto">'+ano+': sem detalhamento mensal neste recorte. '+(d.celula(ano,estado.empresas).fonte==='Histórico anual'?'O total histórico permanece disponível em Histórico.':'')+'</p>'));m.appendChild(c);continue}
   const indices=meses.map((_,i)=>i).filter(i=>rows.some(r=>r.vals[i]!==null));
   const table=tabela(['Empresa',...indices.map(i=>meses[i].toUpperCase()),'Total'],rows.map(row=>{
    const nome=btn('',()=>abrir(ano,row.nome),'ra-empresa');nome.innerHTML=avatar(row.nome,22)+'<b>'+esc(row.nome)+'</b>';
    return[nome,...indices.map(i=>row.vals[i]===null?'—':money(row.vals[i])),money(row.total)]
   }));
   const foot=document.createElement('tfoot'),tr=document.createElement('tr');['Total',...indices.map(i=>money(rows.reduce((s,r)=>s+(r.vals[i]||0),0))),money(rows.reduce((s,r)=>s+r.total,0))].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.appendChild(td)});foot.appendChild(tr);table.querySelector('table').appendChild(foot);c.lastElementChild.appendChild(table);m.appendChild(c);
  }
 }
 function celulaEditavel(x,campo,rotulo,r){
  const td=document.createElement('td');td.className='ra-inline-cell';
  const pinta=()=>{td.replaceChildren();const b=btn(x[campo]||'—',abre,'ra-inline-edit');b.setAttribute('aria-label','Editar '+rotulo+' de '+dadoNome(x)+' em '+fmtDataAno(x.data));b.onclick=e=>{e.stopPropagation();abre()};td.appendChild(b)};
  function dadoNome(x){return x.empresa||'rendimento'}
  function abre(){const base=String(x[campo]||''),input=el('<input>'),erro=el('<small role="alert"></small>');input.value=base;input.setAttribute('aria-label',rotulo);input.setAttribute('list','ra-sug-'+campo);const dl=el('<datalist></datalist>');dl.id='ra-sug-'+campo;maisUsados(E.rendimentos,campo,campo==='instituicao'?CFG('instituicoes'):[]).forEach(v=>{const o=document.createElement('option');o.value=v;dl.appendChild(o)});td.replaceChildren(input,dl,erro);let fechado=false;
   const gravar=()=>{if(fechado)return;const v=input.value.trim();if(v===base){fechado=true;pinta();return}try{if(String(x[campo]||'')!==base)throw Error('Este campo mudou. Abra a ficha para conferir.');financeiroSalvarRegistro(E.rendimentos,x,{[campo]:v},{[campo]:v});fechado=true;r()}catch(e){erro.textContent=e.message}};
   input.onclick=e=>e.stopPropagation();input.onkeydown=e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();gravar()}else if(e.key==='Escape'){fechado=true;pinta()}};input.onblur=gravar;input.focus();input.select?.();
  }pinta();return td;
 }
 function copiarInvestimentos(mes,fontes,r){
  const plano=RendimentosModelo.prepararCopia(fontes,mes,E.rendimentos);
  const nomeMes=iso=>meses[+iso.slice(5,7)-1]+'/'+iso.slice(0,4);
  abrirModal('Copiar investimentos para '+nomeMes(plano.destino),'Confira os investimentos de '+nomeMes(mes)+' e preencha os novos valores.',(c,fechar)=>{
   const form=el('<form class="ra-copia-form"></form>'),campos=[];
   form.appendChild(el('<p class="ff-note">Descrições e datas já estão preenchidas. Nenhum lançamento será criado até confirmar os valores.</p>'));
   if(plano.ignorados.length)form.appendChild(el('<p class="ff-note">'+plano.ignorados.length+' investimento(s) já copiado(s) para este mês. Esses itens foram ignorados.</p>'));
   for(const item of plano.itens){
    const row=el('<div class="ra-copia-item"><div><strong></strong><p></p><small></small></div><label class="ra-field"><span>Novo valor (R$)</span><input type="text" inputmode="decimal" required data-copia-valor placeholder="0,00"></label></div>');
    row.querySelector('strong').textContent=item.registro.empresa||'Sem empresa';
    row.querySelector('p').textContent=[item.registro.instituicao,item.registro.tipo,fmtDataAno(item.registro.data)].filter(Boolean).join(' · ');
    row.querySelector('small').textContent=item.registro.obs;
    const input=row.querySelector('input');input.setAttribute('aria-label','Novo valor de '+(item.registro.empresa||'investimento')+' · '+item.registro.instituicao+' · '+fmtDataAno(item.registro.data));
    campos.push({item,input,base:JSON.stringify(item.origem)});form.appendChild(row);
   }
   const erro=el('<p role="alert" class="form-erro" tabindex="-1"></p>'),actions=el('<div class="ff-actions"></div>'),cancelar=btn('Cancelar',fechar),salvarBt=btn('Confirmar '+plano.itens.length+' investimento(s)','', '');
   cancelar.dataset.copiaCancelar='';actions.appendChild(cancelar);
   if(plano.itens.length){salvarBt.type='submit';actions.appendChild(salvarBt)}else form.appendChild(el('<p class="ff-note">Nenhum investimento novo para copiar neste recorte.</p>'));
   form.append(erro,actions);c.appendChild(form);let concluido=false;
   form.onsubmit=e=>{e.preventDefault();if(concluido||!campos.length)return;
    try{
     const novos=campos.map(({item,input,base})=>{
      if(!input.value.trim())throw Error('Informe o novo valor de '+item.registro.empresa+'.');
      const valor=financeiroNumero(input.value);if(valor===0)throw Error('Informe um valor diferente de zero.');
      const atual=E.rendimentos.find(x=>x.id===item.origem.id);if(!atual||JSON.stringify(atual)!==base)throw Error('Um investimento de origem mudou. Feche e abra a cópia novamente.');
      if(E.rendimentos.some(x=>x.copiadoDeId===item.origem.id&&x.data?.slice(0,7)===plano.destino))throw Error('Este investimento já foi copiado. Feche e abra novamente para conferir.');
      return{...item.registro,id:uid(),valor};
     });
     const tamanho=E.rendimentos.length,mt=E._mt;E.rendimentos.push(...novos);
     try{salvar()}catch(falha){E.rendimentos.splice(tamanho);E._mt=mt;throw falha}
     concluido=true;salvarBt.disabled=true;Object.assign(estado,{anos:[+plano.destino.slice(0,4)],meses:[+plano.destino.slice(5)],de:'',ate:'',busca:'',tipo:'',situacao:'Todos',pagina:1});fechar();
    }catch(falha){erro.textContent=falha.message||'Não foi possível salvar. Tente novamente.';erro.focus?.()}
   };
   campos[0]?.input.focus();
  },r);
 }
 function linhasLancamentos(body,d,list,r){
  const pages=Math.max(1,Math.ceil(list.length/40));estado.pagina=Math.min(estado.pagina,pages);const page=list.slice((estado.pagina-1)*40,estado.pagina*40);
  const grupo=x=>estado.grupo==='mes'?x.data.slice(0,7):estado.grupo==='ano'?x.data.slice(0,4):estado.grupo==='empresa'?d.nome(x):estado.grupo==='tipo'?x.tipo||'Sem tipo':'';
  const cols=estado.colunas,pre=['Data','Empresa',...(cols.includes('instituicao')?['Instituição']:[]),...(cols.includes('tipo')?['Tipo']:[])],headers=[...pre,'Valor','% do mês','% do ano',...(cols.includes('obs')?['Observação']:[]),...(cols.includes('acoes')?['Ações']:[])];
  const wrap=tabela(headers,[]);wrap.classList.add('ra-extrato');const table=wrap.querySelector('table'),tbody=wrap.querySelector('tbody');
  const taxa=(v,base)=>base>0?(v/base*100).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%':'—';
  const total=list.filter(x=>!d.previsto(x)).reduce((s,x)=>s+(+x.valor),0),mesTotal={},anoTotal={};list.filter(x=>!d.previsto(x)).forEach(x=>{const year=x.data.slice(0,4),month=x.data.slice(0,7);anoTotal[year]=(anoTotal[year]||0)+(+x.valor);if(d.mensal(x))mesTotal[month]=(mesTotal[month]||0)+(+x.valor)});
  if(!estado.gruposAbertos)estado.gruposAbertos={};
  [...new Set(page.map(grupo))].forEach((g,gi)=>{
   const items=page.filter(x=>grupo(x)===g),todos=list.filter(x=>grupo(x)===g),valor=todos.reduce((s,x)=>s+(+x.valor),0),key=estado.grupo+':'+g,aberto=estado.gruposAbertos[key]??(gi<2||!!estado.busca);
   const filhas=[];let trigger;
   if(g){const tr=document.createElement('tr'),td=document.createElement('td');tr.className='ra-grupo-mes';td.colSpan=pre.length;
    const rot=estado.grupo==='mes'?meses[+g.slice(5,7)-1].toLowerCase()+' de '+g.slice(0,4):g;
    trigger=btn('',()=>{const on=trigger.getAttribute('aria-expanded')!=='true';estado.gruposAbertos[key]=on;trigger.setAttribute('aria-expanded',String(on));trigger.querySelector('small').textContent=(on?'▾ ':'▸ ')+todos.length+' lançamento(s)'+(todos.length>items.length?' · '+items.length+' nesta página':'');filhas.forEach(tr=>tr.hidden=!on)},'ra-grupo-toggle');trigger.innerHTML='<b>'+esc(rot)+'</b><small>'+(aberto?'▾ ':'▸ ')+todos.length+' lançamento(s)'+(todos.length>items.length?' · '+items.length+' nesta página':'')+'</small>';trigger.setAttribute('aria-expanded',String(aberto));const cab=el('<div class="ra-grupo-cab"></div>');cab.appendChild(trigger);if(estado.grupo==='mes'&&todos.some(RendimentosModelo.investimento)){const copiar=btn('Copiar investimentos → '+meses[(+g.slice(5,7))%12],()=>copiarInvestimentos(g,todos,r),'ghost mini');copiar.dataset.raCopiar=g;cab.appendChild(copiar)}td.appendChild(cab);tr.appendChild(td);
    const reais=todos.filter(x=>!d.previsto(x)).reduce((s,x)=>s+(+x.valor),0),valores=[money(valor),estado.grupo==='mes'&&reais>0?'100%':'—',estado.grupo==='mes'?taxa(reais,anoTotal[g.slice(0,4)]):'—',...(cols.includes('obs')?[todos.some(d.previsto)?'Inclui previstos':'']:[]),...(cols.includes('acoes')?['']:[])];valores.forEach(v=>{const cell=document.createElement('td');cell.textContent=v;tr.appendChild(cell)});tbody.appendChild(tr);
   }
   items.forEach(x=>{const tr=document.createElement('tr');tr.dataset.raLanc=x.id;tr.className='ra-lancamento';tr.hidden=!!g&&!aberto;tr.tabIndex=0;tr.setAttribute('aria-label','Abrir rendimento de '+d.nome(x)+' em '+fmtDataAno(x.data));tr.onclick=()=>modalRendimento(x);tr.onkeydown=e=>{if(e.target===tr&&(e.key==='Enter'||e.key===' ')){e.preventDefault();modalRendimento(x)}};
    const add=(v,cl='')=>{const td=document.createElement('td');td.className=cl;if(v?.nodeType)td.appendChild(v);else td.textContent=v;tr.appendChild(td)};
    add(fmtDataAno(x.data));const emp=el('<span class="ra-empresa"></span>');emp.innerHTML=avatar(d.nome(x),22)+'<b>'+esc(d.nome(x))+'</b>';add(emp);
    if(cols.includes('instituicao'))tr.appendChild(celulaEditavel(x,'instituicao','instituição',r));if(cols.includes('tipo'))tr.appendChild(celulaEditavel(x,'tipo','tipo',r));add(money(+x.valor),'ra-num ra-valor');add(!d.previsto(x)&&d.mensal(x)?taxa(+x.valor,mesTotal[x.data.slice(0,7)]):'—','ra-num');add(!d.previsto(x)?taxa(+x.valor,anoTotal[x.data.slice(0,4)]):'—','ra-num ra-muted');
    if(cols.includes('obs'))add((d.previsto(x)?'Futuro / previsto · ':!d.mensal(x)?'Sem mês real · ':'')+(x.obs||''),'ra-obs');
    if(cols.includes('acoes')){const actions=el('<div class="ra-row-actions"></div>');actions.appendChild(btn('Duplicar',e=>{e?.stopPropagation?.();modalRendimento({...x,id:uid(),_raDuplicado:true},true)}));actions.onclick=e=>e.stopPropagation();add(actions)}tbody.appendChild(tr);filhas.push(tr);
   });
  });
  const foot=document.createElement('tfoot'),tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=pre.length;td.textContent='Total registrado no recorte';tr.appendChild(td);const value=document.createElement('td');value.textContent=money(total);tr.appendChild(value);const rest=document.createElement('td');rest.colSpan=headers.length-pre.length-1;rest.textContent='Previsões separadas';tr.appendChild(rest);foot.appendChild(tr);table.appendChild(foot);body.appendChild(wrap);
  if(!list.length)body.appendChild(el('<p class="ra-note">Nenhum lançamento neste filtro. Totais históricos sem registros individuais podem ser consultados em Histórico.</p>'));
  const pager=el('<div class="ra-tools ra-pager"></div>'),prev=btn('Anterior',()=>{estado.pagina--;r()}),next=btn('Próxima',()=>{estado.pagina++;r()});prev.disabled=estado.pagina<=1;next.disabled=estado.pagina>=pages;pager.append(prev,el('<span>Página '+estado.pagina+' de '+pages+' · até 40 registros</span>'),next);body.appendChild(pager);
 }
 function lancamentos(m,d,a,r,mudar){
  const c=card('Lançamentos'+(estado.anos.length===1?' de '+estado.anos[0]:' de todos os anos selecionados'),'Clique no mês para abrir; em Instituição ou Tipo para corrigir ali mesmo; no resto da linha para abrir a ficha.');c.classList.add('ra-lancamentos-card');c.dataset.bid='rd-lanc';m.appendChild(c);const body=c.lastElementChild;body.appendChild(btn('+ Novo lançamento',novo,''));
  const tools=el('<div class="ra-tools"></div>');const search=texto('Buscar rendimento',estado.busca,'search',v=>mudar({busca:v}));search.querySelector('input').placeholder='Descrição, empresa, instituição ou valor';tools.appendChild(search);tools.append(selecionar('Situação',estado.situacao,['Todos','Registrados','Previstos','Ajustes'].map(x=>[x,x]),v=>mudar({situacao:v})),selecionar('Tipo',estado.tipo,[['','Todos os tipos'],...[...new Set(d.validos.map(x=>x.tipo).filter(Boolean))].sort().map(x=>[x,x])],v=>mudar({tipo:v})),selecionar('Ordenar',estado.ordem,[['data-desc','Mais recentes'],['data-asc','Mais antigos'],['valor-desc','Maior valor'],['valor-asc','Menor valor'],['empresa','Empresa']],v=>mudar({ordem:v})),selecionar('Agrupar',estado.grupo,[['mes','Mês'],['ano','Ano'],['empresa','Empresa'],['tipo','Tipo'],['nenhum','Sem agrupamento']],v=>mudar({grupo:v})));
  const cols=el('<details class="ra-picks"><summary>Colunas</summary><div></div></details>');[['instituicao','Instituição'],['tipo','Tipo'],['obs','Observação'],['acoes','Ações']].forEach(([k,n])=>{const l=el('<label><input type="checkbox"><span>'+n+'</span></label>');l.firstElementChild.checked=estado.colunas.includes(k);l.firstElementChild.onchange=e=>mudar({colunas:e.target.checked?[...estado.colunas,k]:estado.colunas.filter(x=>x!==k)});cols.lastElementChild.appendChild(l)});tools.appendChild(cols);body.appendChild(tools);
  let list=d.recorte(estado);list=list.slice().sort((a,b)=>estado.ordem==='empresa'?d.nome(a).localeCompare(d.nome(b)):estado.ordem.startsWith('valor')?(+a.valor-+b.valor)*(estado.ordem.endsWith('desc')?-1:1):String(a.data).localeCompare(b.data)*(estado.ordem.endsWith('desc')?-1:1));
  const total=list.reduce((s,x)=>s+(+x.valor),0),future=list.filter(d.previsto).reduce((s,x)=>s+(+x.valor),0);body.appendChild(el('<p role="status" class="ra-contexto">'+list.length+' lançamentos · '+money(total-future)+' registrados · '+money(future)+' futuros / previstos</p>'));
  linhasLancamentos(body,d,list,r);
 }

 function edicaoRapida(x,r){abrirModal('Editar classificação','Atualize o tipo e a instituição deste rendimento.',(c,fechar)=>financeiroFormulario(c,[{k:'tipo',t:'Tipo',sugestoes:maisUsados(E.rendimentos,'tipo')},{k:'instituicao',t:'Instituição',sugestoes:maisUsados(E.rendimentos,'instituicao',CFG('instituicoes'))}],x,(v,p)=>financeiroSalvarRegistro(E.rendimentos,x,v,p),fechar),r)}
 function exportData(){if(estado.aba==='graficos'&&!estado.dbBiblioteca)return RendimentosDashboards.exportData();const d=dados(),a=d.analisar(estado.aba==='lancamentos'?estado:{...estado,busca:'',tipo:'',situacao:'Todos'}),compare=estado.aba==='comparar';const rows=[['Rendimentos',hoje()],['Anos',estado.anos.join(', ')],['Empresas',estado.empresas.join(', ')||'Todas'],['Meses',estado.meses.map(m=>meses[m-1]).join(', ')||'Todos'],['Intervalo',estado.de||'',estado.ate||''],['Data usada','Recebimento'],['Busca / tipo / situação',...(estado.aba==='lancamentos'?[estado.busca,estado.tipo,estado.situacao]:['Não se aplica nesta visão'])],[]];
 if(compare){const c=compararAtual(d);rows.push(['Cenário','Empresa','Ano','Total','Fonte'],['A',estado.compEmpA,estado.compAnoA,c.a.valor??'Sem informação',c.a.fonte],['B',estado.compEmpB,estado.compAnoB,c.b.valor??'Sem informação',c.b.fonte],['Diferença',c.valor??'Sem informação'],['Variação %',c.percentual??'Sem base comparável']);}
 else if(estado.aba==='lancamentos')rows.push(['Data','Empresa','Instituição','Tipo','Valor','Observações','Situação'],...d.recorte(estado).map(x=>[x.data,d.nome(x),x.instituicao||'',x.tipo||'',+x.valor,x.obs||'',d.previsto(x)?'Futuro / previsto':'Registrado']));
 else rows.push(['Ano','Total','Fonte','Meses datados'],...a.cells.map(c=>[c.ano,c.valor??'Sem informação',c.fonte,c.meses.join(', ')]),[],['Empresa','Total'],...a.rank.map(x=>[x.nome,x.valor]),[],['Ano',...meses],...serieMensal(d,estado.anos,estado.empresas,estado.meses).map(s=>[s.ano,...s.pontos.map(p=>p.valor??'Sem informação')]));
 rows.push([],['Cobertura','Totais anuais não são distribuídos pelos meses. Futuro / previsto separado do registrado.']);return rows;}
 function exportar(tipo){const rows=exportData();if(tipo==='xlsx')baixarBlob(gerarXlsx([{nome:'Rendimentos',linhas:rows}]),'rendimentos-recorte.xlsx');else{const safe=v=>{const s=String(v??'');return '"'+(/^[=+@\-\t\r]/.test(s)&&typeof v!=='number'?"'"+s:s).replace(/"/g,'""')+'"'};baixarBlob(new Blob(['\ufeff'+rows.map(r=>r.map(safe).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}),'rendimentos-recorte.csv')}}
 function imprimir(){if(estado.aba==='graficos'&&!estado.dbBiblioteca){RendimentosDashboards.imprimir();return}abrirModal('Relatório de rendimentos','Recorte atual. Use Imprimir e escolha Salvar como PDF.',(c)=>{c.classList.add('ra-print-report');const rows=exportData(),t=tabela([],rows);c.appendChild(t);c.appendChild(btn('Imprimir / PDF',()=>window.print(),''))})}
 return{render,destino,exportData,tabela,estado:()=>estado,reset:()=>{estado=null}};
})();
