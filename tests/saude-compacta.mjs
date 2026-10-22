/* Regressões da leitura em linhas: uma ficha por avaliação, com os mesmos
 * vínculos e ações. Todos os registros abaixo são fictícios. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './helpers/dom.mjs';
const fonte=nome=>readFileSync(new URL('../publico/'+nome,import.meta.url),'utf8');
function app(){
  const a=setup();
  const proto=Object.getPrototypeOf(a.document.createElement('select'));
  Object.defineProperty(proto,'value',{configurable:true,get(){return [...this.options].find(o=>o.selected)?.value||this.options[0]?.value||''},set(v){for(const o of this.options)o.removeAttribute('selected');[...this.options].find(o=>o.value===String(v))?.setAttribute('selected','')}});
  a.run(fonte('saude-modelo.js'));a.run(fonte('saude-painel.js'));
  a.run("atual='saude';tela=()=>{};for(const k of ['exames','peso','vitais','consultas','tratamentos','queixas','fisio','histFamiliar','rastreios','vacinas','planos'])E[k]=[];SaudeUI.de='';SaudeUI.ate='';SaudeUI.filtros={}");
  return a;
}
function lista(a,tipo,registros){a.run('E['+JSON.stringify(tipo)+']='+JSON.stringify(registros));return a.run('saudeLista('+JSON.stringify(tipo)+',E['+JSON.stringify(tipo)+'])')}
const textos=nodes=>[...nodes].map(n=>n.textContent.trim());
const botao=(no,texto)=>[...no.querySelectorAll('button')].find(b=>b.textContent.includes(texto));
const fixtures={
  exames:{id:'e',data:'2026-09-15',exame:'Marcador fictício',valor:'< 5',unidade:'mg/L',resultado:'Normal',medico:'Laboratório Exemplo',obs:'Detalhe documental fictício'},
  peso:{id:'p',data:'2026-09-15',hora:'08:30',peso:82,cintura:92,gordura:21,massaGorda:17.2,massaMagra:64.8,altura:1.78,fonte:'Balança exemplo'},
  vitais:{id:'v',data:'2026-09-15',hora:'09:00',sis:121,dia:79,fc:68,fonte:'Aparelho exemplo'},
  consultas:{id:'c',data:'2026-09-15',hora:'14:30',profissional:'Profissional Exemplo',especialidade:'Especialidade exemplo',situacao:'Agendada',local:'Clínica exemplo',retorno:'2026-10-15',conduta:'Orientação fictícia preservada'},
  queixas:{id:'q',data:'2026-09-15',oque:'Sintoma fictício',onde:'Região exemplo',intensidade:3,situacao:'Melhorando',fatores:'Relato extenso fictício'},
  fisio:{id:'f',data:'2026-09-15',oque:'Objetivo fictício',sessao:2,total:8,dorAntes:4,dorDepois:2,profissional:'Profissional Exemplo',funcional:'Evolução relatada fictícia'}
};
for(const [tipo,registro] of Object.entries(fixtures))test(tipo+': um registro ocupa uma linha com ações acessíveis',()=>{
  const a=app(),box=lista(a,tipo,[registro]);
  assert.ok(box.querySelector('table'),'a lista deve usar uma tabela');
  assert.ok(box.querySelector('thead th'),'cabeçalhos precisam estar presentes');
  assert.equal(box.querySelectorAll('tbody > tr').length,1,'uma avaliação não deve ser fragmentada em vários registros');
  assert.equal(box.querySelectorAll('article.sui-card').length,0,'cartões grandes não devem substituir as linhas');
  assert.ok(botao(box,'Documentos'),'o vínculo documental deve continuar na linha');
  assert.ok(botao(box,tipo==='consultas'?'Abrir consulta':'editar'),'edição deve continuar acessível');
});
test('exames: cabeçalhos separam resultado, unidade e situação e preservam o resultado original',()=>{
  const a=app(),box=lista(a,'exames',[fixtures.exames,{id:'e2',data:'2026-09-14',exame:'Qualitativo fictício',valor:'Não reagente',unidade:'',resultado:'Normal'},{id:'e3',data:'2026-09-13',exame:'Outro marcador',valor:'> 100',unidade:'U/L'}]);
  const th=textos(box.querySelectorAll('thead th')).join(' | ');
  for(const campo of ['Data','Exame','Resultado','Unidade','Situação','Ações'])assert.ok(th.includes(campo),'falta a coluna '+campo);
  assert.match(th,/Laboratório|fonte/i);
  const texto=box.querySelector('tbody').textContent;
  for(const valor of ['< 5','> 100','Não reagente','mg/L','Laboratório Exemplo','Normal'])assert.ok(texto.includes(valor),'resultado visível ausente: '+valor);
  assert.equal(box.querySelector('tbody script'),null);
});
test('exames: busca alcança laboratório e unidade e situação usa o campo resultado do laudo',()=>{
  const a=app(),box=lista(a,'exames',[fixtures.exames,{id:'e2',data:'2026-09-14',exame:'Beta fictício',valor:7,unidade:'U/L',resultado:'Alterado',medico:'Outro laboratório'}]),busca=box.querySelector('input[type=search]'),situacao=box.querySelector('select');
  assert.ok([...situacao.options].some(o=>o.textContent==='Alterado'),'situação documental precisa ser oferecida no filtro');
  // LinkeDOM não reproduz o fallback nativo de option.value para seu texto.
  for(const o of situacao.options)if(!o.hasAttribute('value'))o.setAttribute('value',o.textContent);
  busca.value='Laboratório Exemplo';busca.oninput();assert.equal(box.querySelectorAll('tbody > tr').length,1);assert.match(box.querySelector('tbody').textContent,/Marcador fictício/);
  busca.value='U/L';busca.oninput();assert.equal(box.querySelectorAll('tbody > tr').length,1);assert.match(box.querySelector('tbody').textContent,/Beta fictício/);
  busca.value='';busca.oninput();situacao.value='Normal';situacao.onchange();assert.equal(box.querySelectorAll('tbody > tr').length,1);assert.match(box.querySelector('tbody').textContent,/Marcador fictício/);
});
test('linhas: ações preservam o tipo e a identidade da ficha, sem gravar dados ao consultar',()=>{
  const a=app();a.run("var chamadasCompactas=[];saudeEditarRegistro=(tipo,r)=>chamadasCompactas.push(['editar',tipo,r.id]);saudeDocumentosRegistro=(tipo,r)=>chamadasCompactas.push(['documentos',tipo,r.id]);saudePrepararConsulta=r=>chamadasCompactas.push(['preparar','consultas',r.id]);saudeEpisodio=r=>chamadasCompactas.push(['episodio','queixas',r.id])");
  for(const tipo of ['exames','peso','vitais','consultas','queixas','fisio']){
    const box=lista(a,tipo,[fixtures[tipo]]);botao(box,tipo==='consultas'?'Abrir consulta':'editar').onclick();botao(box,'Documentos').onclick();
    if(tipo==='consultas')botao(box,'Preparar consulta').onclick();
    if(tipo==='queixas')botao(box,'Ver episódio').onclick();
  }
  const chamadas=JSON.parse(a.run('JSON.stringify(chamadasCompactas)'));
  for(const tipo of Object.keys(fixtures)){assert.ok(chamadas.some(c=>c[0]==='editar'&&c[1]===tipo&&c[2]===fixtures[tipo].id));assert.ok(chamadas.some(c=>c[0]==='documentos'&&c[1]===tipo&&c[2]===fixtures[tipo].id))}
  assert.ok(chamadas.some(c=>c[0]==='preparar'&&c[2]==='c'));assert.ok(chamadas.some(c=>c[0]==='episodio'&&c[2]==='q'));
  assert.equal(a.run('E.exames[0].valor'),'< 5');
});
test('medidas: a avaliação conserva peso, cintura, gordura, massas, altura e demais indicadores',()=>{
  const a=app(),r={...fixtures.peso,agua:44.2,imcLaudo:25.9,visceral:7,basal:1710,idadeMetabolica:39,indiceApendicular:8.3},box=lista(a,'peso',[r]),linha=box.querySelector('tbody > tr');
  assert.ok(linha);const texto=linha.textContent;
  for(const valor of ['82','92','21','17,2','64,8','1,78','44,2','25,9','1.710','39','8,3','Balança exemplo'])assert.ok(texto.includes(valor),'não sumir com o indicador '+valor);
  const cab=textos(box.querySelectorAll('thead th')).join(' | ');for(const nome of ['Peso','Cintura','Gordura','Altura'])assert.ok(cab.includes(nome));
});
test('vitais: uma medição mostra pressão e pulso, com ausência preservada em vez de zero',()=>{
  const a=app(),box=lista(a,'vitais',[fixtures.vitais,{id:'v2',data:'2026-09-14',hora:'07:45',fc:66}]),linhas=box.querySelectorAll('tbody > tr');assert.equal(linhas.length,2);
  for(const valor of ['121','79','68','09:00','Aparelho exemplo'])assert.ok(linhas[0].textContent.includes(valor));
  assert.ok(linhas[1].textContent.includes('66'));assert.doesNotMatch(linhas[1].textContent,/0\/0/);
});
test('consultas: linha traz horário, profissional, especialidade, situação, local e retorno; texto extenso fica recolhido',()=>{
  const a=app(),box=lista(a,'consultas',[fixtures.consultas]),linha=box.querySelector('tbody > tr');assert.ok(linha);
  for(const texto of ['14:30','Profissional Exemplo','Especialidade exemplo','Agendada','Clínica exemplo','15/10/2026'])assert.ok(linha.textContent.includes(texto),'falta o campo '+texto);
  const detalhe=[...linha.querySelectorAll('details')].find(d=>d.textContent.includes('Orientação fictícia preservada'));assert.ok(detalhe,'conduta não deve ser perdida ao compactar');assert.equal(detalhe.hasAttribute('open'),false);
});
test('detalhes: frequência e situação legadas continuam consultáveis nas linhas compactas',()=>{
  const a=app();
  for(const tipo of ['peso','vitais','fisio']){
    const box=lista(a,tipo,[{...fixtures[tipo],situacao:'Conferência fictícia',frequencia:'Periodicidade documental fictícia'}]),linha=box.querySelector('tbody > tr');
    assert.match(linha.textContent,/Conferência fictícia/);assert.match(linha.textContent,/Periodicidade documental fictícia/);
    for(const detalhe of linha.querySelectorAll('details'))assert.equal(detalhe.hasAttribute('open'),false);
  }
});
test('linhas: período e busca combinam sem alterar ordem dos cadastros ou perder filtro ao reabrir',()=>{
  const a=app();a.run("SaudeUI.de='2026-09-01';SaudeUI.ate='2026-09-30'");
  const rs=[{id:'a',data:'2026-09-01',exame:'Alvo antigo',valor:1},{id:'b',data:'2026-10-01',exame:'Alvo fora',valor:2},{id:'c',data:'2026-09-30',exame:'Alvo recente',valor:3}];
  const box=lista(a,'exames',rs),busca=box.querySelector('input[type=search]');busca.value='Alvo';busca.oninput();
  const linhas=box.querySelectorAll('tbody > tr');assert.equal(linhas.length,2);assert.match(linhas[0].textContent,/Alvo recente/);assert.match(linhas[1].textContent,/Alvo antigo/);
  assert.equal(a.run("E.exames.map(x=>x.id).join(',')"),'a,b,c');
  const outra=a.run("saudeLista('exames',E.exames)");assert.equal(outra.querySelector('input[type=search]').value,'Alvo');assert.equal(a.run("saudeLista('peso',[])").querySelector('input[type=search]').value,'');
});
test('abas: emojis identificam as áreas sem trocar identificadores e navegação',()=>{
  const a=app();a.run("saudePainel(document.getElementById('main'))");
  const areas=JSON.parse(a.run('JSON.stringify(SAUDE_AREAS)'));assert.deepEqual(areas.map(x=>x[0]),['resumo','exames','medidas','queixas','tratamentos','cuidados','documentos']);
  for(const [id,label] of areas)assert.match(label,/\p{Extended_Pictographic}/u,'a aba '+id+' precisa de identificação visual');
  const exame=[...a.document.querySelectorAll('[aria-controls=sui-area]')].find(b=>b.textContent.includes('Exames'));assert.ok(exame);exame.onclick();assert.equal(a.run('SaudeUI.area'),'exames');
});
test('exames e medidas: dashboard de evolução é embutido quando disponível e listas permanecem acessíveis',()=>{
  const a=app();a.run("var chamadasEvolucao=[];saudeDashboardEvolucao=(...args)=>{chamadasEvolucao.push(args);return el('<section data-evolucao-ficticia>Dashboard de evolução fictício</section>')}");
  a.run('E.exames='+JSON.stringify([fixtures.exames])+';E.peso='+JSON.stringify([fixtures.peso])+';E.vitais='+JSON.stringify([fixtures.vitais]));
  const ex=a.run('saudeExames()'),med=a.run('saudeMedidas()');assert.ok(ex.querySelector('[data-evolucao-ficticia]'),'dashboard deve aparecer na própria aba de exames');assert.ok(med.querySelector('[data-evolucao-ficticia]'),'dashboard deve aparecer na própria aba de medidas');
  assert.ok(ex.querySelector('table'));assert.equal(med.querySelectorAll('.sui-lista table').length,2);assert.ok(a.run('chamadasEvolucao.length')>=2);
});
test('dashboard opcional: sem o novo recurso, exames e medidas ainda abrem com suas linhas e ações',()=>{
  const a=app();a.run("saudeDashboardEvolucao=undefined");lista(a,'exames',[fixtures.exames]);lista(a,'peso',[fixtures.peso]);
  const ex=a.run('saudeExames()'),med=a.run('saudeMedidas()');assert.ok(ex.querySelector('table'));assert.ok(med.querySelector('table'));assert.ok(botao(ex,'Comparar coletas'));assert.ok(botao(med,'Medição'));
});

test('acabamento global mantém tabelas da Saúde em linhas no celular, sem conversão para cartões',()=>{
  const a=app();a.run("var p=document.createElement('div');p.dataset.saudeWorkbench='1';p.append(saudeLista('exames',[{id:'e',data:'2025-01-01',exame:'Marcador fictício',valor:'10',unidade:'U/L'}]));document.body.append(p);prepararTabelas(p)");
  assert.equal(a.document.querySelector('.sui-tabela').classList.contains('tabela-adaptavel'),false);
  a.run("p.append(el('<div class=\"sui-evolucao-tabela\"><table><thead><tr><th>Data</th><th>Valor</th></tr></thead><tbody><tr><td>01/01/2025</td><td>10</td></tr></tbody></table></div>'));prepararTabelas(p)");
  assert.equal(a.document.querySelector('.sui-evolucao-tabela table').classList.contains('tabela-adaptavel'),false);
});

test('abertura em linhas e alternância de evolução preservam filtros, gráfico e cadastros',()=>{
  const a=app();a.run("saudeDashboardEvolucao=()=>el('<section data-painel-teste>Gráfico de teste</section>');E.exames=[{id:'e',exame:'Marcador fictício',data:'2025-01-01',valor:'10',unidade:'U/L'}]");
  const antes=a.run('JSON.stringify(E)'),box=a.run('saudeExames()'),linhas=box.querySelector('.sui-visoes-linhas'),grafico=box.querySelector('.sui-visoes-evolucao');
  assert.equal(linhas.hidden,false);assert.equal(grafico.hidden,true);
  box.querySelector('input[type=search]').value='Marcador';box.querySelector('input[type=search]').oninput();
  box.querySelector('[data-saude-visao=evolucao]').onclick();assert.equal(linhas.hidden,true);assert.equal(grafico.hidden,false);
  box.querySelector('[data-saude-visao=juntos]').onclick();assert.equal(linhas.hidden,false);assert.equal(grafico.hidden,false);
  box.querySelector('[data-saude-visao=linhas]').onclick();assert.equal(grafico.hidden,true);assert.equal(box.querySelector('input[type=search]').value,'Marcador');
  assert.equal(a.run('JSON.stringify(E)'),antes,'trocar visualização não grava preferências nem cadastros');
});

test('seletor móvel oferece as sete áreas e usa a mesma navegação sem gravar registros',()=>{
  const a=app();a.run("var navegacoes=[];saudeIr=id=>navegacoes.push(id);tratamentoAbrirVisaoGeral=()=>navegacoes.push('tratamentos');saudePainel(document.getElementById('main'))");
  const select=a.document.querySelector('[aria-label="Área da Saúde"]');
  assert.deepEqual([...select.options].map(o=>o.value),['resumo','exames','medidas','queixas','tratamentos','cuidados','documentos']);
  const antes=a.run('JSON.stringify(E)');for(const id of ['resumo','exames','medidas','queixas','tratamentos','cuidados','documentos']){select.value=id;select.onchange()}
  assert.deepEqual(JSON.parse(a.run('JSON.stringify(navegacoes)')),['resumo','exames','medidas','queixas','tratamentos','cuidados','documentos']);assert.equal(a.run('JSON.stringify(E)'),antes);
});
test('abertura pelo valor ou nome conserva identidade e edição em todos os históricos',()=>{
  const a=app();a.run("var abertos=[];saudeEditarRegistro=(tipo,r)=>abertos.push([tipo,r.id])");
  for(const [tipo,r]of Object.entries(fixtures)){const box=lista(a,tipo,[r]),b=box.querySelector('.sui-abrir-registro');assert.ok(b);assert.ok(b.closest('td').dataset.coluna);assert.match(b.getAttribute('aria-label'),/Abrir registro/);b.onclick();assert.equal(box.querySelectorAll('tbody>tr').length,1)}
  assert.deepEqual(JSON.parse(a.run('JSON.stringify(abertos)')),Object.keys(fixtures).map(k=>[k,fixtures[k].id]));
});
test('todos os lançamentos simples mantêm campos originais e obrigatórios fora dos detalhes',()=>{
  for(const tipo of ['peso','vitais','exames','consultas','queixas','fisio','vacinas','histFamiliar','rastreios']){const a=app();a.run('saudeEditarRegistro('+JSON.stringify(tipo)+')');const f=a.document.querySelector('[data-saude-form]');assert.ok(f.querySelector('details'));assert.equal(f.querySelectorAll('[name]').length,a.run('saudeCampos('+JSON.stringify(tipo)+').length'));for(const i of f.querySelectorAll('[required]'))assert.equal(i.closest('details'),null,tipo+' obrigatório recolhido');}
});
test('escolher lançamento fecha o seletor e cancelar devolve a página sem modal acumulado',()=>{
  const a=app();a.run('saudeAdicionar()');botao(a.document,'Peso e medidas').onclick();assert.equal(a.document.querySelectorAll('[role=dialog]').length,1);assert.ok(a.document.querySelector('[data-saude-form]'));botao(a.document,'Cancelar').onclick();assert.equal(a.document.querySelector('[role=dialog]'),null);assert.equal(a.run('E.peso.length'),0);
});
