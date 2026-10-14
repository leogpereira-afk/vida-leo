import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {setup} from './helpers/dom.mjs';

const budget={venda:400000,terreno:80000,construcao:160000,documentacaoPct:1,comissaoPct:5,impostoPct:6,outras:12000};
const arquivo=new URL('../publico/fortemais-pdf.js',import.meta.url);
function app(){
  const a=setup();
  if(a.run('typeof fmPdfPrevisao')!=='function')vm.runInContext(readFileSync(arquivo,'utf8'),a.ctx);
  let html='',prints=0,closed=false;
  const janela={get closed(){return closed},close(){closed=true},focus(){},print(){prints++},document:{write:s=>{html=s},close(){},querySelector:()=>({complete:true,naturalWidth:100,addEventListener(){}}),getElementById:()=>({textContent:''})}};
  a.ctx.window.location={href:'https://example.test/central/'};
  a.ctx.window.open=()=>janela;
  a.ctx.fetch=async()=>({ok:true,blob:async()=>new Blob(['logo'])});
  a.ctx.FileReader=class{readAsDataURL(){this.result='data:image/png;base64,bG9nbw==';this.onload()}};
  a.ctx.setTimeout=f=>f();
  a.run(`E=structuredClone(SEED);E.obras=[{id:'o',nome:'Obra sintética',vendaValor:200000,vendaData:'2028-01-01',recebidoEm:'2028-01-01',area:100,lote:'012',quadra:'B',fmPrevisao:{...${JSON.stringify(budget)},investidores:[{id:'socio',nome:'Sócio anterior',pct:100,aporte:300000,roiPrevisto:{aporte:100000,recebimento:120000}}],fluxos:[]}}];E.obraAportes=[{obra:'o',quem:'Sócio sintético',valor:100000,data:'2027-01-01'}];var obra=E.obras[0]`);
  return {...a,html:()=>html,documento:()=>parseHTML(html).document,prints:()=>prints,closed:()=>closed};
}
test('PDF realizado mantém custo desconhecido e impede taxas confirmadas sem resumo',async()=>{
  const a=app();await a.run('fmPdfRealizado(obra,null,[])');
  assert.match(a.html(),/custos.*(?:indisponíveis|desconhecidos)/i);
  assert.doesNotMatch(a.html(),/Custo total<\/span><b[^>]*>R\$\s*0,00/);
  assert.doesNotMatch(a.html(),/>\s*-?0\.0%(?: a\.a\.)?\s*</);
  assert.match(a.html(),/ROI e TIR.*(?:não|pendentes)/i);
});
test('PDF realizado não chama data da venda de recebimento concluído',async()=>{
  const a=app();a.run("delete obra.recebidoEm");await a.run('fmPdfRealizado(obra,{total:100000,centros:{},n:1},[])');
  assert.match(a.html(),/Recebimento pendente/);
  assert.doesNotMatch(a.html(),/Recebimento concluído[^<]*<[^>]*>\s*01\/01\/2028/);
  assert.match(a.html(),/ROI e TIR.*(?:não|pendentes)/i);
});
test('PDF previsão usa um retrato único mesmo com edição enquanto a logo carrega',async()=>{
  const a=app();let liberar;a.ctx.fetch=()=>new Promise(resolve=>liberar=resolve);
  const pendente=a.run('fmPdfPrevisao(obra)');
  a.run('fmPrevGravar(obra,{...obra.fmPrevisao,venda:500000,investidores:[{...obra.fmPrevisao.investidores[0],nome:"Sócio atualizado"}]})');
  liberar({ok:true,blob:async()=>new Blob(['logo'])});await pendente;
  assert.match(a.html(),/Sócio anterior/);assert.doesNotMatch(a.html(),/Sócio atualizado|500\.000,00/);
  assert.match(a.html(),/400\.000,00/);
});
test('PDF previsão conserva os valores próprios da ROI e explicita sua origem',async()=>{
  const a=app();const antes=a.run('JSON.stringify(E)');await a.run('fmPdfPrevisao(obra)');
  assert.match(a.html(),/Valores desta tabela/);assert.match(a.html(),/20%/);
  assert.equal(a.run('JSON.stringify(E)'),antes);assert.equal(a.prints(),1);
});
test('PDF realizado distingue custo zero conhecido de custo desconhecido',async()=>{
  const a=app();await a.run('fmPdfRealizado(obra,{total:0,centros:{},n:0},[])');
  assert.match(a.html(),/200\.0%/);assert.doesNotMatch(a.html(),/custos.*(?:indisponíveis|desconhecidos)/i);
});
test('PDF realizado mantém livro-caixa inteiro, valores e textos escapados',async()=>{
  const a=app();a.ctx.custos=Array.from({length:40},(_,i)=>({data:'2027-01-01',nome:'Item <sintético> '+i,centro:'Material',fornecedor:'Fornecedor de teste',valor:2500}));
  const antes=a.run('JSON.stringify(E)');await a.run('fmPdfRealizado(obra,{total:100000,centros:{Material:{total:100000,n:40}},n:40,de:"2027-01-01",ate:"2027-01-01"},custos)');
  assert.match(a.html(),/Item &lt;sintético&gt; 39/);assert.match(a.html(),/100\.0%/);assert.match(a.html(),/Livro-caixa/);
  assert.equal(a.run('JSON.stringify(E)'),antes);
});
test('PDF documental lista fontes, datas distintas e pendência sem dinheiro nem URLs assinadas',async()=>{
  const a=app();assert.equal(a.run('typeof fmPdfDocumentos'),'function');
  a.ctx.lista=[{id:'doc-a',ref:'obra:o',nome:'Planta.pdf',tipo:'application/pdf',tam:1024,em:'2026-09-03',pendente:true,nuvem:false,origem:'Obra',url:'https://example.test/arquivo?token=credencial-proibida',caminho:'https://example.test/?X-Amz-Signature=segredo',meta:{titulo:'Projeto <sintético>',categoria:'Projeto',revisao:'R02',dataDocumento:'2026-09-01',descricao:'Descrição de teste'}},{id:'doc-b',ref:'obra:o:demanda:d1',nome:'Licença.pdf',tipo:'application/pdf',tam:2048,em:'2026-09-04',nuvem:true,origem:'Demanda: Licenciamento',meta:{categoria:'Licenças'}}];
  const antes=a.run('JSON.stringify(E)');await a.run('fmPdfDocumentos(obra,lista,{nuvemDisponivel:false,escopo:"Documentos em acompanhamento"})');
  assert.match(a.html(),/Projeto &lt;sintético&gt;/);assert.match(a.html(),/01\/09\/2026/);assert.match(a.html(),/03\/09\/2026/);
  assert.match(a.html(),/Data do documento não informada/);assert.match(a.html(),/Demanda: Licenciamento|doc-b/);assert.match(a.html(),/Pendente/);
  assert.doesNotMatch(a.html(),/credencial-proibida|X-Amz-Signature|200\.000,00|400\.000,00|ROI|TIR|Comprador|Venda líquida/);
  assert.equal(a.run('JSON.stringify(E)'),antes);
});
test('PDF documental usa só a lista selecionada e informa ausência de documentos',async()=>{
  const a=app();assert.equal(a.run('typeof fmPdfDocumentos'),'function');
  await a.run('fmPdfDocumentos(obra,[],{escopo:"Documentos arquivados",nuvemDisponivel:true})');
  assert.match(a.html(),/Nenhum documento/);assert.match(a.html(),/Documentos arquivados/);assert.doesNotMatch(a.html(),/Sócio anterior|120\.000,00/);
});
test('PDF realizado congela cadastro, aportes e lançamentos antes de aguardar a logo',async()=>{
  const a=app();let liberar;a.ctx.fetch=()=>new Promise(resolve=>liberar=resolve);
  a.ctx.resumo={total:100000,centros:{Material:{total:100000,n:1}},n:1};
  a.ctx.custos=[{data:'2027-01-01',nome:'Lançamento original',centro:'Material',valor:100000}];
  const pendente=a.run('fmPdfRealizado(obra,resumo,custos)');
  a.run('obra.nome="Obra atualizada";E.obraAportes[0].quem="Sócio atualizado";custos[0].nome="Lançamento atualizado";resumo.total=900000');
  liberar({ok:true,blob:async()=>new Blob(['logo'])});await pendente;
  assert.match(a.html(),/Obra sintética|Sócio sintético|Lançamento original/);
  assert.doesNotMatch(a.html(),/Obra atualizada|Sócio atualizado|Lançamento atualizado|900\.000,00/);
});
test('PDF não busca a logo quando o navegador bloqueia a janela',async()=>{
  const a=app();let consultas=0,aviso='';a.ctx.window.open=()=>null;a.ctx.fetch=async()=>{consultas++;throw Error('não chamar')};a.ctx.alert=s=>aviso=s;
  const antes=a.run('JSON.stringify(E)');assert.equal(await a.run('fmPdfPrevisao(obra)'),false);
  assert.equal(consultas,0);assert.equal(a.html(),'');assert.match(aviso,/pop-up/);assert.equal(a.run('JSON.stringify(E)'),antes);
});
test('PDF comunica falha da logo e fecha a janela sem imprimir relatório incompleto',async()=>{
  const a=app();let aviso='';a.ctx.fetch=async()=>({ok:false});a.ctx.alert=s=>aviso=s;
  assert.equal(await a.run('fmPdfPrevisao(obra)'),false);assert.equal(a.closed(),true);assert.equal(a.prints(),0);assert.equal(a.html(),'');assert.match(aviso,/logo do PDF/);
});
test('PDF documental não exporta links temporários colados nos metadados',async()=>{
  const a=app();a.ctx.lista=[{id:'doc-a',ref:'obra:o',nome:'Arquivo.pdf',origem:'Demanda: https://example.test/?token=segredo-origem',meta:{titulo:'Arquivo https://example.test/?X-Amz-Signature=segredo-titulo',descricao:'https://usuario:senha@example.test/privado'}}];
  await a.run('fmPdfDocumentos(obra,lista)');assert.doesNotMatch(a.html(),/segredo-origem|segredo-titulo|usuario:senha/);assert.match(a.html(),/link temporário omitido/);
});
test('PDF realizado informa falha do livro-caixa sem apagar o resumo conhecido',async()=>{
  const a=app();await a.run('fmPdfRealizado(obra,{total:100000,centros:{Material:{total:100000,n:1}},n:1},null)');
  assert.match(a.html(),/Não foi possível consultar o livro-caixa/);
  assert.doesNotMatch(a.html(),/Livro-caixa - todos os lançamentos|Nenhum lançamento retornado/);
  const custo=[...a.documento().querySelectorAll('.pdf-metrica')].find(x=>x.querySelector('span')?.textContent==='Custo total');
  assert.match(custo.textContent,/100\.000,00/);assert.doesNotMatch(custo.textContent,/Desconhecido/);
});
test('PDF realizado identifica lista vazia confirmada sem avisar falha de consulta',async()=>{
  const a=app();await a.run('fmPdfRealizado(obra,{total:0,centros:{},n:0},[])');
  assert.match(a.html(),/Nenhum lançamento retornado nesta consulta/);
  assert.doesNotMatch(a.html(),/Não foi possível consultar o livro-caixa/);
});
test('PDF documental omite credenciais em fragmentos e nomes de parâmetros codificados',async()=>{
  const a=app();a.ctx.lista=[{id:'doc-a',ref:'obra:o',nome:'Arquivo.pdf',origem:'Obra',meta:{titulo:'https://example.test/arquivo#access_token=credencial-fragmento',descricao:'https://example.test/arquivo?%74oken=credencial-codificada'}}];
  await a.run('fmPdfDocumentos(obra,lista)');
  assert.doesNotMatch(a.html(),/credencial-fragmento|credencial-codificada|#access_token|%74oken/);
  assert.match(a.html(),/link temporário omitido/);
});
test('PDF documental informa consulta local incompleta e ambos os filtros selecionados',async()=>{
  const a=app();await a.run('fmPdfDocumentos(obra,[],{localDisponivel:false,nuvemDisponivel:true,escopo:"Documentos em acompanhamento",categoria:"Projetos",busca:"planta"})');
  assert.match(a.html(),/consulta local.*(?:indisponível|incompleta)/i);
  assert.match(a.html(),/Categoria: Projetos/);assert.match(a.html(),/Busca: planta/);
});
