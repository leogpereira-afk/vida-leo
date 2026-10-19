/* Evolução documental: os pontos vêm dos registros; nenhuma meta ou interpretação clínica. */
var SaudeEvolucaoModelo=(()=>{
  const texto=v=>String(v??'').trim().replace(/\s+/g,' ');
  const medidas=[['peso','Peso','kg'],['cintura','Cintura','cm'],['gordura','Gordura corporal','%'],['massaGorda','Massa de gordura','kg'],['massaMagra','Massa livre de gordura','kg'],['agua','Água corporal','L'],['imcLaudo','IMC do laudo','índice'],['visceral','Gordura visceral','nível'],['basal','Metabolismo basal','kcal'],['idadeMetabolica','Idade metabólica','anos'],['indiceApendicular','Índice apendicular','kg/m²'],['altura','Altura','']];
  const vitais=[['sis','Pressão sistólica','mmHg'],['dia','Pressão diastólica','mmHg'],['fc','Frequência cardíaca','bpm']];
  const dia=d=>typeof SaudePainelModelo!=='undefined'&&SaudePainelModelo.data(d);
  const hojeLocal=()=>typeof hoje==='function'?hoje():(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})();
  const dataTexto=d=>dia(d)?d.slice(8,10)+'/'+d.slice(5,7)+'/'+d.slice(0,4):'Data a confirmar';
  const numero=v=>{if(typeof v==='boolean'||v==null||texto(v)==='')return null;const n=numeroResultadoSaude(v);return Number.isFinite(n)?n:null};
  function metricas(tipo,registros=[]){
    if(tipo==='exames')return [...new Set(registros.map(r=>texto(r.exame)))].sort((a,b)=>a.localeCompare(b,'pt-BR')).map(k=>({chave:k,rotulo:k||'Marcador não informado'}));
    return (tipo==='vitais'?vitais:medidas).filter(([k])=>registros.some(r=>r[k]!==''&&r[k]!=null)).map(([chave,rotulo,unidade])=>({chave,rotulo,unidade}));
  }
  function pontos(tipo,registros,metrica,{de='',ate=''}={}){
    const def=(tipo==='vitais'?vitais:medidas).find(x=>x[0]===metrica);
    return (Array.isArray(registros)?registros:[]).map((r,index)=>({r,index})).filter(({r})=>tipo!=='exames'||texto(r.exame)===metrica).filter(({r})=>!dia(r.data)||(!de||r.data>=de)&&(!ate||r.data<=ate)).map(({r,index})=>{
      const original=tipo==='exames'?r.valor:r[metrica],unidade=tipo==='exames'?texto(r.unidade):texto(r.unidades?.[metrica]||(metrica==='altura'?(r.alturaUnidade||r.unidadeAltura):'')||def?.[2]),fonte=texto(r.fonte),laboratorio=tipo==='exames'?texto(r.laboratorio||r.medico):'',metodo=texto(r.metodo),contexto=texto(r.contexto),tratamento=texto(r.tratamentoId),amostra=texto(r.amostra),material=texto(r.material),valor=numero(original);
      const motivo=!dia(r.data)?'Data ausente ou inválida':r.data>hojeLocal()?'Data futura: conferir realização':tipo==='exames'&&r.resultado==='Aguardando'?'Resultado aguardando':valor===null?(original===''||original==null?'Sem resultado numérico':'Resultado qualitativo ou limitado'):!unidade?'Unidade a confirmar':'';
      const completo=!!unidade&&!!(fonte||laboratorio)&&!!metodo;
      return {registro:r,index,id:texto(r.id),data:r.data||'',hora:texto(r.hora),valor,original,unidade,fonte,laboratorio,metodo,contexto,tratamento,amostra,material,completo,motivo,grafico:!motivo,chave:JSON.stringify([unidade,fonte,laboratorio,metodo,contexto,tratamento,amostra,material])};
    }).sort((a,b)=>String(a.data).localeCompare(String(b.data))||a.hora.localeCompare(b.hora)||a.index-b.index);
  }
  function grupos(ps){
    const gs=new Map();for(const p of ps){if(!gs.has(p.chave))gs.set(p.chave,{chave:p.chave,unidade:p.unidade,fonte:p.fonte,laboratorio:p.laboratorio,metodo:p.metodo,contexto:p.contexto,tratamento:p.tratamento,amostra:p.amostra,material:p.material,completo:p.completo,pontos:[]});gs.get(p.chave).pontos.push(p)}
    return [...gs.values()].map(g=>({...g,rotulo:[g.unidade||'Unidade a confirmar',g.fonte||(!g.laboratorio?'Fonte não informada':''),g.laboratorio,g.metodo?'Método: '+g.metodo:'Método não informado',g.amostra?'Amostra: '+g.amostra:'',g.material?'Material: '+g.material:'',g.contexto?'Contexto: '+g.contexto:'',g.tratamento?'Vínculo: '+g.tratamento:'',!g.completo?'Pontos isolados':''].filter(Boolean).join(' · ')}));
  }
  function resumir(grupo,modo='cronologico'){
    const validos=grupo.pontos.filter(p=>p.grafico),quantidades=new Map();for(const p of grupo.pontos)if(dia(p.data))quantidades.set(p.data,(quantidades.get(p.data)||0)+1);const duplicadas=new Set([...quantidades].filter(([,n])=>n>1).map(([data])=>data));
    if(modo==='cronologico'||!grupo.completo)return validos.map(p=>({...p,ambiguo:duplicadas.has(p.data),periodo:modo==='anual'?p.data.slice(0,4):p.data.slice(0,7)}));
    const porPeriodo=new Map();for(const p of validos){const k=modo==='anual'?p.data.slice(0,4):p.data.slice(0,7);if(!porPeriodo.has(k))porPeriodo.set(k,[]);porPeriodo.get(k).push(p)}
    return [...porPeriodo.entries()].flatMap(([periodo,ps])=>{const ultima=ps.at(-1).data,ultimos=ps.filter(p=>p.data===ultima);return ultimos.map(p=>({...p,periodo,ambiguo:duplicadas.has(p.data),registrosNoPeriodo:ps.length}))});
  }
  const mesIndice=d=>+d.slice(0,4)*12+ +d.slice(5,7)-1;
  function segmentos(grupo,ps,modo='cronologico'){
    const segmentos=[],invalidas=grupo.pontos.filter(q=>dia(q.data)&&!q.grafico).map(q=>q.data).sort();let atual=[],indiceInvalido=0;
    const quebrar=()=>{if(atual.length>1)segmentos.push(atual);atual=[]};
    for(const p of ps){
      if(!grupo.completo||p.ambiguo){quebrar();continue}
      const a=atual.at(-1),adjacente=!a||(modo==='anual'?+p.data.slice(0,4)- +a.data.slice(0,4)===1:p.data.slice(0,4)===a.data.slice(0,4)&&mesIndice(p.data)-mesIndice(a.data)<=1);if(a)while(indiceInvalido<invalidas.length&&invalidas[indiceInvalido]<=a.data)indiceInvalido++;const interrompido=a&&indiceInvalido<invalidas.length&&invalidas[indiceInvalido]<p.data;
      if(!adjacente||interrompido)quebrar();atual.push(p);
    }quebrar();return segmentos;
  }
  function preparar(tipo,registros,{metrica,contexto,modo='cronologico',de='',ate=''}={}){
    const ms=metricas(tipo,registros),m=ms.find(x=>x.chave===metrica)||ms.find(x=>pontos(tipo,registros,x.chave,{de,ate}).filter(p=>p.grafico).length>1)||ms[0],ps=m?pontos(tipo,registros,m.chave,{de,ate}):[],gs=grupos(ps),g=gs.find(x=>x.chave===contexto)||gs.slice().sort((a,b)=>b.pontos.filter(x=>x.grafico).length-a.pontos.filter(x=>x.grafico).length)[0],resumo=g?resumir(g,modo):[];
    return {metricas:ms,metrica:m,grupos:gs,grupo:g,pontos:resumo,todos:g?.pontos||[],segmentos:g?segmentos(g,resumo,modo):[],anos:[...new Set(resumo.map(x=>x.data.slice(0,4)))].sort(),modo,de,ate};
  }
  return {metricas,pontos,grupos,resumir,segmentos,preparar,dataTexto};
})();
var _saudeEvolucaoEstado={};
function saudeDashboardEvolucao(tipo,registros,{de='',ate=''}={}){
  const estado=_saudeEvolucaoEstado[tipo]||(_saudeEvolucaoEstado[tipo]={modo:'cronologico',metrica:'',contexto:''}),box=el('<section class="sui-evolucao" data-saude-evolucao="'+esc(tipo)+'"><header class="sui-evolucao-head"><div><h3>📈 Evolução '+(tipo==='exames'?'dos exames':tipo==='vitais'?'dos sinais vitais':'das medidas')+'</h3><p>Valores registrados, com a data e o contexto de cada coleta.</p></div></header><div class="sui-evolucao-controles"></div><div class="sui-evolucao-conteudo"></div></section>');
  const controles=box.querySelector('.sui-evolucao-controles'),conteudo=box.querySelector('.sui-evolucao-conteudo'),cores=['#276a5a','#6943a0','#1e6c9d','#a64d1b','#9c3e72','#59671d'];
  const corAno=ano=>cores[Number(ano)%cores.length];
  const numero=v=>Number(v).toLocaleString('pt-BR',{maximumFractionDigits:10}),valor=p=>p.original==null||p.original===''?'Não informado':String(p.original),fmt=SaudeEvolucaoModelo.dataTexto;
  const selecionar=(nome,opcoes,atual,mudar)=>{const l=el('<label>'+esc(nome)+'<select aria-label="'+esc(nome)+'">'+opcoes.map(([v,t])=>'<option value="'+esc(v)+'"'+(v===atual?' selected':'')+'>'+esc(t)+'</option>').join('')+'</select></label>');l.querySelector('select').onchange=e=>mudar(e.target.value);controles.append(l)};
  function pintar(){
    const d=SaudeEvolucaoModelo.preparar(tipo,registros,{...estado,de,ate});estado.metrica=d.metrica?.chave||'';estado.contexto=d.grupo?.chave||'';controles.innerHTML='';conteudo.innerHTML='';
    if(!d.metrica){conteudo.append(el('<p class="sui-evolucao-vazio">'+(registros.length?'Nenhum indicador com valor informado neste cadastro.':'Adicione registros para visualizar a evolução.')+'</p>'));return}
    selecionar(tipo==='exames'?'Marcador da evolução':'Indicador da evolução',d.metricas.map(m=>[m.chave,m.rotulo]),estado.metrica,v=>{estado.metrica=v;estado.contexto='';pintar()});
    selecionar('Visualização da evolução',[['cronologico','Datas das coletas'],['mensal','Mês a mês · comparar anos'],['anual','Ano a ano']],estado.modo,v=>{estado.modo=v;pintar()});
    if(d.grupos.length)selecionar('Contexto da evolução',d.grupos.map(g=>[g.chave,g.rotulo+' · '+g.pontos.length+' registro(s)']),estado.contexto,v=>{estado.contexto=v;pintar()});
    const notas={cronologico:'Datas reais no eixo horizontal. Lacunas e contextos incompletos ficam sem ligação.',mensal:'Janeiro a dezembro, uma cor por ano. Em cada mês, o último resultado numérico válido do mesmo contexto; todas as coletas ficam na tabela.',anual:'Último resultado numérico válido de cada ano no mesmo contexto, com a data da coleta. Sem soma nem média de resultados.'};
    conteudo.append(el('<p class="sui-evolucao-nota">'+esc(notas[estado.modo])+(!d.grupo?.completo&&d.grupo?' Contexto incompleto: exibimos as coletas como pontos isolados, sem escolher um valor representativo.':'')+'</p>'));
    if(!d.grupo){conteudo.append(el('<p class="sui-evolucao-vazio">Nenhuma coleta neste período.</p>'));return}
    const ambiguos=d.pontos.filter(p=>p.ambiguo).length,fora=d.todos.filter(p=>!p.grafico).length;
    conteudo.append(el('<div class="sui-evolucao-resumo"><b>'+esc(d.metrica.rotulo)+'</b><span>'+d.todos.length+' registro(s) · '+d.pontos.length+' ponto(s) no gráfico'+(fora?' · '+fora+' sem ponto numérico':'')+(ambiguos?' · '+ambiguos+' em datas com múltiplas amostras':'')+'</span></div>'));
    if(d.pontos.length)desenhar(d);else conteudo.append(el('<p class="sui-evolucao-vazio">Não há resultados numéricos com data e unidade confirmadas neste contexto. Confira os valores originais abaixo.</p>'));
    const detalhes=el('<details class="sui-evolucao-dados"><summary>📋 Todos os valores por data · '+d.todos.length+' registro(s)</summary><div class="sui-evolucao-tabela" tabindex="0" role="region" aria-label="Valores originais da evolução"><table><thead><tr><th scope="col">Coleta</th><th scope="col">Valor original</th><th scope="col">Unidade</th><th scope="col">Fonte / método</th><th scope="col">Gráfico / conferência</th><th scope="col">Registro</th></tr></thead><tbody></tbody></table></div></details>');
    const representados=new Set(d.pontos.map(p=>p.index));d.todos.slice().reverse().forEach(p=>{const tr=document.createElement('tr');tr.innerHTML='<td>'+esc(fmt(p.data))+(p.hora?'<small>'+esc(p.hora)+'</small>':'')+'</td><td>'+esc(valor(p))+'</td><td>'+esc(p.unidade||(tipo==='peso'&&d.metrica.chave==='altura'?'m ou cm — conferir':'Não informada'))+'</td><td>'+esc([p.fonte||'Fonte não informada',p.laboratorio,p.metodo||'Método não informado',p.amostra?'Amostra: '+p.amostra:'',p.material?'Material: '+p.material:'',p.contexto,p.tratamento?'Vínculo: '+p.tratamento:''].filter(Boolean).join(' · '))+'</td><td>'+esc(p.motivo||(!representados.has(p.index)?'Outra coleta no período; preservada':d.pontos.some(q=>q.index===p.index&&q.ambiguo)?'Mais de uma amostra nesta data; sem ligação':!p.completo?'Ponto isolado: contexto incompleto':'No gráfico'))+'</td><td></td>';tr.lastElementChild.append(acao('Abrir',()=>saudeEditarRegistro(tipo,p.registro),'ghost mini'));detalhes.querySelector('tbody').append(tr)});conteudo.append(detalhes);
  }
  function desenhar(d){
    const largura=900,altura=258,esq=66,dir=30,topo=20,baixo=50,w=largura-esq-dir,h=altura-topo-baixo,valores=d.pontos.map(p=>p.valor),min=Math.min(...valores),max=Math.max(...valores),folga=max===min?Math.max(Math.abs(max)*.05,1):(max-min)*.1,ymin=min-folga,ymax=max+folga;
    const anos=d.anos,cor=p=>corAno(p.data.slice(0,4)),datas=d.pontos.map(p=>Date.parse(p.data+'T12:00:00Z')),inicio=Math.min(...datas),fim=Math.max(...datas),x=p=>esq+(estado.modo==='mensal'?(+p.data.slice(5,7)-1)/11:estado.modo==='anual'?(anos.length>1?(+p.data.slice(0,4)- +anos[0])/(+anos.at(-1)- +anos[0]):.5):fim>inicio?(Date.parse(p.data+'T12:00:00Z')-inicio)/(fim-inicio):.5)*w,y=p=>topo+(ymax-p.valor)/(ymax-ymin)*h;
    let svg='<svg viewBox="0 0 '+largura+' '+altura+'" role="img" aria-label="'+esc(d.metrica.rotulo+' em '+(d.grupo.unidade||'unidade não informada')+' — '+({mensal:'comparação mês a mês',anual:'comparação ano a ano',cronologico:'datas reais das coletas'}[estado.modo]))+'"><title>'+esc(d.metrica.rotulo+' · '+d.grupo.unidade)+'</title><desc>'+d.pontos.length+' pontos. As datas e os valores originais estão disponíveis na tabela abaixo. Cores identificam os anos; não representam avaliação clínica.</desc>';
    for(let i=0;i<4;i++){const v=ymin+(ymax-ymin)*i/3,py=topo+h-h*i/3;svg+='<line class="sui-evolucao-grade" x1="'+esq+'" x2="'+(largura-dir)+'" y1="'+py+'" y2="'+py+'"/><text class="sui-evolucao-eixo" text-anchor="end" x="'+(esq-8)+'" y="'+(py+4)+'">'+esc(numero(v))+'</text>'}
    const rotulos=estado.modo==='mensal'?['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((t,i)=>({t,x:esq+i*w/11})):estado.modo==='anual'?anos.map(a=>({t:a,x:x({data:a+'-01-01'})})): [...new Set(d.pontos.map(p=>p.data))].filter((_,i,a)=>a.length<=6||i===0||i===a.length-1||i%Math.ceil(a.length/5)===0).map(data=>({t:fmt(data),x:x({data})}));
    rotulos.forEach(r=>{svg+='<text class="sui-evolucao-eixo" text-anchor="middle" x="'+r.x+'" y="'+(altura-20)+'">'+esc(r.t)+'</text>'});
    d.segmentos.forEach(ps=>{svg+='<polyline class="sui-evolucao-linha" fill="none" stroke="'+cor(ps[0])+'" stroke-width="2" points="'+ps.map(p=>x(p)+','+y(p)).join(' ')+'"/>'});
    d.pontos.forEach(p=>{const titulo=fmt(p.data)+(p.hora?' '+p.hora:'')+' · '+valor(p)+' '+p.unidade+(p.ambiguo?' · múltiplas amostras nesta data':'');svg+='<circle class="sui-evolucao-ponto" data-index="'+p.index+'" tabindex="0" role="button" aria-label="'+esc('Abrir registro de '+titulo)+'" cx="'+x(p)+'" cy="'+y(p)+'" r="'+(p.ambiguo?5:4)+'" fill="'+cor(p)+'"'+(p.ambiguo?' fill-opacity=".6" stroke="'+cor(p)+'"':'')+'><title>'+esc(titulo)+'</title></circle>'});svg+='</svg>';
    const grafico=el('<div class="sui-evolucao-grafico">'+svg+'</div>');grafico.querySelectorAll('[data-index]').forEach(ponto=>{const p=d.pontos.find(p=>String(p.index)===ponto.dataset.index);ponto.onclick=()=>saudeEditarRegistro(tipo,p.registro);ponto.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();ponto.onclick()}}});conteudo.append(grafico);conteudo.append(el('<div class="sui-evolucao-legenda" aria-label="Anos das coletas">'+anos.map(a=>'<span><i aria-hidden="true" style="background:'+corAno(a)+'"></i>'+a+'</span>').join('')+'</div>'));
  }
  pintar();return box;
}
