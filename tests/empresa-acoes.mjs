import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

const LOGO='data:image/png;base64,aW1hZ2Vt';
function app(options){
  const a=setup(options);
  a.run("E=structuredClone(SEED);E.empresasPJ=[{id:'pj-1',nome:'Ágata Exemplo',status:'Ativa',documentosEmpresa:[],obrigacoesEmpresa:[]}];globalThis.emp=E.empresasPJ[0];E.config.empresas=['Ágata Exemplo','Outra'];E.marcas={'Ágata Exemplo':{cor:'#123456',encerrada:{em:'2025-01-01',motivo:'Vendida'}}};atual='empresas';filtro.empresaId=emp.id");
  return a;
}
const snapshot=a=>a.run('JSON.stringify(E)');
const button=(a,label)=>[...a.document.querySelectorAll('#modais button')].find(b=>b.textContent===label);
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve()};
function storage(a,{local=[],cloud=[],localError=false,cloudError=false}={}){
  a.ctx.mockCloud=new Map(cloud);
  a.run(`arqIndice=async()=>${cloudError?'null':'mockCloud'}`);
  a.ctx.mockDb=async()=>({transaction(){
    const t={objectStore:()=>({openCursor(){
      const req={};let i=0;
      const next=()=>queueMicrotask(()=>{
        if(localError){req.onerror?.();return}
        req.result=i<local.length?{value:local[i++],continue:next}:null;
        req.onsuccess?.();
      });next();return req;
    }})};return t;
  }});
  a.run('db=mockDb');
}
function imageMock(a,{width=1200,height=300,error='',defer=false}={}){
  const calls=[];
  const create=a.document.createElement.bind(a.document);
  a.document.createElement=(name,...rest)=>{
    if(name!=='canvas')return create(name,...rest);
    return {width:0,height:0,getContext:()=>({fillRect(...args){calls.push(['fill',...args])},drawImage(...args){calls.push(['draw',...args])}}),toDataURL:()=>LOGO};
  };
  a.ctx.FileReader=class{readAsDataURL(){if(error==='file')this.onerror();else{this.result='data:image/png;base64,c291cmNl';this.onload()}}};
  let pending;
  a.ctx.Image=class{constructor(){this.width=width;this.height=height}set src(value){pending=()=>error==='image'?this.onerror():this.onload();if(!defer)pending()}};
  return {calls,finish:()=>pending?.()};
}

test('Excluir ficha sem vínculos remove somente empresa, opção e marca; carregar não recria a ficha',async()=>{
  const a=app();storage(a);a.run("E.config.empresas.push('agata exemplo');E.empresasPJ.push({id:'outra',nome:'Outra'});E.marcas.Outra={cor:'#abcdef'}");
  await a.run('empresaExcluir(emp,empresaAssinatura(emp))');
  assert.equal(a.run('E.empresasPJ.map(e=>e.id).join()'),'outra');
  assert.equal(a.run('E.config.empresas.join()'),'Outra');
  assert.equal(a.run("E.marcas['Ágata Exemplo']"),undefined);
  assert.equal(a.run('E.marcas.Outra.cor'),'#abcdef');
  assert.equal(a.run('filtro.empresaId'),'');
  a.run('globalThis.saved=JSON.stringify(E);localStorage.getItem=()=>saved;E=carregar();normalizarEmpresas(E)');
  assert.equal(a.run('E.empresasPJ.map(e=>e.id).join()'),'outra');
});

for(const [label,prepare] of [
  ['banco por ID com nome antigo',"E.bancos=[{id:'b',empresaId:emp.id,titular:'Nome antigo'}]"],
  ['imóvel por ID',"E.patrimonio=[{id:'p',empresaId:emp.id}]"],
  ['nome normalizado de rendimento',"E.rendimentos=[{id:'r',empresa:'AGATA exemplo',valor:50}]"],
  ['titular normalizado',"E.bancos=[{id:'b',titular:'agata exemplo'}]"],
  ['planejamento por ID',"E.planejamentoEmpresas=[{id:'pl',empresaId:emp.id,empresaNome:'Antiga',ano:2027}]"],
  ['nome de planejamento legado',"E.planejamentoEmpresas=[{id:'pl',origemLegado:'agata exemplo',ano:2027}]"],
  ['conta de caixa',"E.contas=[{id:'cx',empresaId:emp.id}]"],
  ['empreendimento',"E.empreend=[{id:'e',empresa:'Ágata Exemplo'}]"],
  ['casa',"E.casas=[{id:'c',empresaNome:'agata exemplo'}]"],
  ['reserva',"E.reservas=[{id:'r',empresaId:emp.id}]"],
  ['documento interno',"emp.documentosEmpresa=[{id:'d',nome:'Contrato',revisoes:[{obs:'Anterior'}]}]"],
  ['obrigação interna',"emp.obrigacoesEmpresa=[{id:'o',nome:'IPTU',status:'Pago'}]"],
  ['estratégia anterior',"E.estrategia={'agata exemplo':{missao:'Preservada'}}"],
  ['histórico consolidado',"E.rendHist.empresas={'AGATA EXEMPLO':[100]}"],
  ['histórico detalhado',"E.rendHist.detalhe={2025:{'agata exemplo':{total:100}}}"],
  ['outra ficha com nome ambíguo',"E.empresasPJ.push({id:'duplicada',nome:'agata exemplo'})"]
])test('Exclusão bloqueada preserva '+label,async()=>{
  const a=app();storage(a);a.run(prepare);const before=snapshot(a);
  assert.ok(a.run('empresaDependencias(emp).length')>0);
  await assert.rejects(a.run('empresaExcluir(emp,empresaAssinatura(emp))'),/dados relacionados/);
  assert.equal(snapshot(a),before);
});

test('Vínculo explícito de outra empresa prevalece sobre texto antigo igual',async()=>{
  const a=app();storage(a);a.run("E.bancos=[{id:'outro',empresaId:'outra',titular:emp.nome}]");
  assert.equal(a.run('empresaDependencias(emp).length'),0);
  await a.run('empresaExcluir(emp,empresaAssinatura(emp))');
  assert.equal(a.run('E.bancos[0].empresaId'),'outra');
});

for(const [label,data] of [
  ['anexo geral local',{local:[{id:'a',ref:'empresa:pj-1',nome:'Contrato.pdf'}]}],
  ['anexo de documento sem registro',{cloud:[['empresa:pj-1:documento:antigo',[{id:'a',nome:'Alteração.pdf'}]]]}],
  ['comprovante de obrigação',{local:[{id:'a',ref:'empresa:pj-1:obrigacao:iptu',nome:'Guia.pdf'}]}]
])test('Exclusão bloqueada preserva '+label,async()=>{
  const a=app();storage(a,data);const before=snapshot(a);
  await assert.rejects(a.run('empresaExcluir(emp,empresaAssinatura(emp))'),/arquivos anexados/);
  assert.equal(snapshot(a),before);
});

test('Conferência de anexos deduplica servidor/local e não confunde prefixo de outra PJ',async()=>{
  const a=app();storage(a,{local:[{id:'duplicado',ref:'empresa:pj-1',nome:'Local.pdf'},{id:'outro',ref:'empresa:pj-10',nome:'Outra.pdf'}],cloud:[['empresa:pj-1',[{id:'duplicado',nome:'Nuvem.pdf'}]],['empresa:pj-10',[{id:'externo'}]]]});
  assert.equal((await a.run('empresaAnexos(emp)')).length,1);
});

for(const [label,options] of [['nuvem',{cloudError:true}],['aparelho',{localError:true}]])test('Falha ao conferir '+label+' não permite excluir',async()=>{
  const a=app({hostname:'exemplo.test'});a.ctx.localStorage.getItem=()=> 'token-de-teste';storage(a,options);const before=snapshot(a);
  await assert.rejects(a.run('empresaExcluir(emp,empresaAssinatura(emp))'),/conferir os arquivos/);
  assert.equal(snapshot(a),before);
  a.run('empresaModalExcluir(emp)');await settle();
  assert.equal(button(a,'Excluir empresa').disabled,true);
  assert.match(a.document.querySelector('.empresa-exclusao [role=alert]').textContent,/conferir os arquivos/);
});

for(const [label,change] of [
  ['ficha',"emp.obs='Mudou'"],
  ['marca',"E.marcas[emp.nome].cor='#fedcba'"],
  ['referência da ficha',"E.empresasPJ[0]={...emp}"],
  ['dependência nova',"E.bancos.push({id:'novo',empresaId:emp.id})"]
])test('Alteração de '+label+' durante conferência impede exclusão',async()=>{
  const a=app();let resolve;a.ctx.pause=()=>new Promise(r=>{resolve=r});a.run('empresaAnexos=pause');
  const action=a.run('empresaExcluir(emp,empresaAssinatura(emp))');a.run(change);const before=snapshot(a);resolve([]);
  await assert.rejects(action,/mudou|dados relacionados/);assert.equal(snapshot(a),before);
});

test('Cancelar conferência de exclusão não altera a empresa mesmo depois da resposta assíncrona',async()=>{
  const a=app();let resolve;a.ctx.pause=()=>new Promise(r=>{resolve=r});a.run('empresaAnexos=pause');const before=snapshot(a);
  a.run('empresaModalExcluir(emp)');button(a,'Cancelar').click();resolve([]);await settle();
  assert.equal(snapshot(a),before);assert.equal(a.document.querySelector('.empresa-exclusao'),null);
});

test('Cancelar depois de confirmar exclui a intenção pendente, não a ficha',async()=>{
  const a=app();let resolve,calls=0;
  a.ctx.pause=()=>++calls===1?Promise.resolve([]):new Promise(r=>{resolve=r});
  a.run('empresaAnexos=pause');const before=snapshot(a);
  a.run('empresaModalExcluir(emp)');await settle();
  const action=button(a,'Excluir empresa').onclick();
  button(a,'Cancelar').click();resolve([]);await action;
  assert.equal(snapshot(a),before);
});

test('Logo aparece na lista, ficha e marca compartilhada; iniciais são alternativa à falha da imagem',()=>{
  const a=app();a.run('empresaSalvarLogo(emp,'+JSON.stringify(LOGO)+');tela()');
  assert.equal(a.document.querySelector('.empresa-opcao img').getAttribute('src'),LOGO);
  assert.equal(a.document.querySelector('.empresa-logo-cabecalho img').getAttribute('src'),LOGO);
  assert.match(a.run('avatar(emp.nome)'),/data:image\/png/);
  const img=a.document.querySelector('.empresa-logo-cabecalho img');img.onerror();
  assert.equal(a.document.querySelector('.empresa-logo-cabecalho').textContent,'ÁE');
});

test('Salvar e remover logo preserva cor e situação encerrada',()=>{
  const a=app();a.run('empresaSalvarLogo(emp,'+JSON.stringify(LOGO)+')');
  assert.equal(a.run('E.marcas[emp.nome].logo'),LOGO);a.run("empresaSalvarLogo(emp,'')");
  assert.equal(a.run('E.marcas[emp.nome].logo'),undefined);
  assert.equal(a.run('E.marcas[emp.nome].cor'),'#123456');
  assert.equal(a.run('E.marcas[emp.nome].encerrada.motivo'),'Vendida');
});

test('Cancelar remoção no editor mantém logo salva; confirmar aplica somente a logo',()=>{
  const a=app();a.run('empresaSalvarLogo(emp,'+JSON.stringify(LOGO)+')');const before=snapshot(a);
  a.run('empresaModalLogo(emp)');button(a,'Remover logo').click();assert.equal(snapshot(a),before);button(a,'Cancelar').click();assert.equal(snapshot(a),before);
  a.run('empresaModalLogo(emp)');button(a,'Remover logo').click();button(a,'Salvar logo').click();
  assert.equal(a.run('E.marcas[emp.nome].logo'),undefined);assert.equal(a.run('E.marcas[emp.nome].cor'),'#123456');
});

test('Imagem horizontal é ajustada inteira com margem, sem recorte da origem',()=>{
  const a=app(),mock=imageMock(a);a.run("globalThis.resultado='';globalThis.falha='';lerLogo({type:'image/png',size:100},u=>resultado=u,m=>falha=m)");
  assert.equal(a.run('resultado'),LOGO);assert.equal(a.run('falha'),'');
  const draw=mock.calls.find(c=>c[0]==='draw');assert.equal(draw.length,6);
  assert.equal(draw[4]/draw[5],4);assert.equal(draw[2],12);assert.equal(draw[3],99);
  assert.deepEqual(mock.calls[0],['fill',0,0,256,256]);
});

for(const [label,file] of [['SVG',{type:'image/svg+xml',size:100}],['PDF',{type:'application/pdf',size:100}],['arquivo grande',{type:'image/png',size:10*1024*1024+1}]])test('Logo rejeita '+label+' antes da leitura',()=>{
  const a=app();a.ctx.FileReader=class{constructor(){throw Error('Não deve ler arquivo inválido')}};
  a.run("globalThis.falha='';globalThis.resultado='';lerLogo("+JSON.stringify(file)+",u=>resultado=u,m=>falha=m)");
  assert.equal(a.run('resultado'),'');assert.match(a.run('falha'),/PNG|10 MB/);
});

for(const failure of ['file','image'])test('Erro de '+failure+' na imagem não salva dados',()=>{
  const a=app();imageMock(a,{error:failure});const before=snapshot(a);
  a.run("globalThis.falha='';globalThis.resultado='';lerLogo({type:'image/png',size:100},u=>resultado=u,m=>falha=m)");
  assert.equal(a.run('resultado'),'');assert.ok(a.run('falha'));assert.equal(snapshot(a),before);
});

test('Imagem escolhida fica em prévia até salvar; cancelar durante leitura não grava depois',()=>{
  const a=app(),mock=imageMock(a,{defer:true});const before=snapshot(a);
  a.run("pedirArquivo=cb=>cb({type:'image/png',size:100});empresaModalLogo(emp)");button(a,'Escolher imagem').click();
  assert.equal(button(a,'Salvar logo').disabled,true);button(a,'Cancelar').click();mock.finish();
  assert.equal(snapshot(a),before);assert.equal(a.document.querySelector('.empresa-logo-editor'),null);
});

test('Logo inválida e alteração de ficha rejeitam salvamento sem mudar marca',()=>{
  const a=app(),before=snapshot(a);
  for(const invalid of ['javascript:alert(1)','data:image/svg+xml;base64,PHN2Zz4=','https://example.com/logo.png','data:image/png;base64,<script>'])assert.throws(()=>a.run('empresaSalvarLogo(emp,'+JSON.stringify(invalid)+')'));
  assert.equal(snapshot(a),before);a.run('E.empresasPJ[0]={...emp}');const changed=snapshot(a);
  assert.throws(()=>a.run('empresaSalvarLogo(emp,'+JSON.stringify(LOGO)+')'),/ficha mudou/);assert.equal(snapshot(a),changed);
});

test('URLs inseguras de logo não criam imagem na ficha',()=>{
  const a=app();for(const invalid of ['javascript:alert(1)','data:image/svg+xml;base64,PHN2Zz4=','http://example.com/logo.png','https://user:senha@example.com/logo.png']){
    a.run('globalThis.img=empresaImagem(emp,"",'+JSON.stringify(invalid)+')');assert.equal(a.run('img.querySelector("img")'),null);
  }
});

test('Escolher arquivo abre input conectado, encaminha somente o arquivo selecionado e remove o input',()=>{
  const a=app(),create=a.document.createElement.bind(a.document),recebidos=[];
  let input,conectadoAoAbrir=false;
  a.document.createElement=(name,...args)=>{
    const node=create(name,...args);
    if(name==='input'){
      input=node;
      node.click=()=>{conectadoAoAbrir=node.isConnected};
    }
    return node;
  };
  a.ctx.receberArquivo=file=>recebidos.push(file);
  a.run("pedirArquivo(receberArquivo,'image/png,image/jpeg')");
  assert.equal(conectadoAoAbrir,true);
  assert.equal(input.type,'file');assert.equal(input.hidden,true);
  assert.equal(input.accept,'image/png,image/jpeg');
  const arquivo={name:'logo-exemplo.png',type:'image/png',size:100};
  Object.defineProperty(input,'files',{value:[arquivo]});input.onchange();
  assert.equal(recebidos.length,1);assert.equal(recebidos[0],arquivo);
  assert.equal(input.isConnected,false);
});

test('Cancelar seletor de arquivo remove input conectado sem executar callback',()=>{
  const a=app(),create=a.document.createElement.bind(a.document);
  let input,calls=0;
  a.document.createElement=(name,...args)=>{
    const node=create(name,...args);
    if(name==='input'){input=node;node.click=()=>{assert.equal(node.isConnected,true)}}
    return node;
  };
  a.ctx.receberArquivo=()=>calls++;
  a.run('pedirArquivo(receberArquivo)');
  input.dispatchEvent(new a.document.defaultView.Event('cancel'));
  assert.equal(calls,0);assert.equal(input.isConnected,false);
});
