import {test} from 'node:test';
import assert from 'node:assert/strict';
import LZString from 'lz-string';
import {setup} from './helpers/dom.mjs';

const resposta=dados=>({status:200,ok:true,json:async()=>structuredClone(dados)});
const json=(a,expressao)=>JSON.parse(a.run('JSON.stringify('+expressao+')'));
const compactar=dados=>'lz16:'+LZString.compressToUTF16(JSON.stringify(dados));
const decodificar=texto=>JSON.parse(texto.startsWith('lz16:')?LZString.decompressFromUTF16(texto.slice(5)):texto);
const consultasPermitidas=new Set(['GET','POST:googleResumoInicio','POST:backups']);
function conferirSomenteLeituras(a,gets){
  assert.equal(a.requisicoes.filter(x=>x==='GET').length,gets,'Mantém a quantidade esperada de leituras do estado');
  assert.deepEqual(a.requisicoes.filter(x=>!consultasPermitidas.has(x)),[],
    'Não pode enviar PUT nem ações POST de gravação; resumo inicial e listagem de backups são consultas');
}

async function app(){
  const a=setup({hostname:'leogpereira-afk.github.io'});
  const itens=new Map([['cl_token','sessao-sintetica']]);
  const session=new Map(),recusadas=new Set();
  a.ctx.localStorage={
    getItem:k=>itens.get(k)||null,
    setItem(k,v){
      if(recusadas.has(k)){const e=Error('Quota sintética de armazenamento');e.name='QuotaExceededError';throw e;}
      itens.set(k,String(v));
    },
    removeItem:k=>itens.delete(k),
  };
  a.ctx.sessionStorage={getItem:k=>session.get(k)||null,setItem:(k,v)=>session.set(k,String(v)),removeItem:k=>session.delete(k)};
  a.ctx.LZString=LZString;a.alertas=[];a.ctx.alert=t=>a.alertas.push(t);
  a.run("E=carregar();E.agenda=[{id:'compromisso-sintetico',titulo:'Compromisso de teste',obs:'Confirmado antes da alteração'}];E._mt=100;guardarEstadoLocal(E)");
  a.remoto={mt:10,dados:json(a,'E')};a.requisicoes=[];
  a.ctx.fetch=async(_,op)=>{
    const acao=op.method==='POST'?JSON.parse(op.body).acao:null;
    a.requisicoes.push(acao?op.method+':'+acao:op.method);
    if(op.method==='POST')return resposta({backups:[],arquivos:[],ok:true});
    assert.equal(op.method,'GET','Uma conferência de recuperação não deve enviar dados sobre a base antiga');
    return resposta(a.remoto);
  };
  await a.run('puxarNuvem()');
  assert.equal(a.run('_tabBase'),10);a.requisicoes.length=0;
  return Object.assign(a,{itens,recusadas});
}

function atualizarRemoto(a,mt=20){
  a.remoto={mt,dados:structuredClone(a.remoto.dados)};
  a.remoto.dados._mt=mt*100;
  a.remoto.dados.agenda[0].obs='Atualização remota sintética '+mt;
}

function backupAnterior(a){
  const backup={em:Date.UTC(2026,9,20,12),dados:json(a,'E')};
  backup.dados.agenda[0].obs='Versão anterior recuperável — não substituir';
  a.itens.set('cl_descartado',JSON.stringify(backup));return backup;
}

test('Recuperação: atualizações limpas preservam o backup anterior sem substituí-lo por cache',async()=>{
  const a=await app(),backup=backupAnterior(a),original=a.itens.get('cl_descartado');
  for(const mt of [20,30]){
    atualizarRemoto(a,mt);await a.run('puxarNuvem()');
    assert.equal(a.run('E.agenda[0].obs'),a.remoto.dados.agenda[0].obs,'A aba limpa recebe o conteúdo novo');
    assert.equal(a.run('_tabBase'),mt);
    assert.ok(a.itens.get('cl_descartado')===original,'Receber uma atualização limpa não pode sobrescrever uma recuperação anterior');
  }
  assert.equal(JSON.parse(original).dados.agenda[0].obs,backup.dados.agenda[0].obs);
  conferirSomenteLeituras(a,2);assert.equal(a.alertas.length,0);
});

test('Recuperação: quota no backup interrompe adoção de remoto sem perder edição nem autorizar nova base',async()=>{
  const a=await app();backupAnterior(a);
  a.run("E.agenda[0].obs='Alteração local pendente — ação e informação';E._mt=150;guardarEstadoLocal(E)");
  const estado=json(a,'E'),cache=a.itens.get('centralLeo.v1'),backup=a.itens.get('cl_descartado');
  a.recusadas.add('cl_descartado');atualizarRemoto(a);
  await a.run('puxarNuvem()');
  assert.equal(a.run('E.agenda[0].obs'),estado.agenda[0].obs,'Uma edição sem cópia recuperável não pode sair de cena');
  assert.deepEqual(json(a,'E'),estado);
  assert.deepEqual(decodificar(a.itens.get('centralLeo.v1')),decodificar(cache),
    'O conteúdo original continua íntegro, mesmo se a tentativa de recuperação compactou o cache');
  assert.equal(a.itens.get('cl_descartado'),backup,'A recuperação já existente também continua íntegra');
  assert.equal(a.run('_tabBase'),10,'Não autoriza PUT com a versão remota não adotada');
  conferirSomenteLeituras(a,1);
  assert.doesNotMatch(a.document.querySelector('#stSync').textContent,/sincronizado|atualizado de outro acesso/);
});

test('Recuperação: dois conflitos conservam o backup anterior e cada versão local completa no histórico',async()=>{
  const a=await app(),anterior=backupAnterior(a),versoes=[anterior.dados];
  for(const mt of [20,30]){
    a.ctx.observacaoTeste='Edição local pendente '+mt+' — acentos, valores e detalhes';
    a.run('E.agenda[0].obs=observacaoTeste;E._mt++;guardarEstadoLocal(E)');
    versoes.push(json(a,'E'));atualizarRemoto(a,mt);
    await a.run('puxarNuvem()');
    assert.equal(a.run('E.agenda[0].obs'),a.remoto.dados.agenda[0].obs);
    assert.equal(a.run('_tabBase'),mt);
  }
  const recuperacao=decodificar(a.itens.get('cl_descartado'));
  const guardadas=[recuperacao,...(recuperacao.anteriores||[])];
  assert.equal(guardadas.length,versoes.length,'As três versões precisam continuar recuperáveis, sem perda nem duplicação');
  for(const versao of versoes){
    const entrada=guardadas.find(x=>x.dados?.agenda?.[0]?.obs===versao.agenda[0].obs);
    assert.ok(entrada,'Cada edição anterior precisa aparecer no histórico');
    assert.deepEqual(entrada.dados,versao,'Preserva todos os campos, não somente o texto editado');
  }
  conferirSomenteLeituras(a,2);
  const armazenamento=a.itens.get('cl_descartado'),estado=json(a,'E'),downloads=[];
  a.ctx.capturarDownload=(blob,nome)=>downloads.push({blob,nome});
  a.run("baixar=(blob,nome)=>capturarDownload(blob,nome);atual='config'");
  await a.run("vConfig(document.getElementById('main'))");
  const secao=a.document.querySelector('[data-bid=cf-descartado]');
  const botoes=[...secao.querySelectorAll('button')].filter(x=>x.textContent.startsWith('Baixar')||x.textContent.includes('Baixar (JSON)'));
  assert.equal(botoes.length,versoes.length,'Todas as versões do histórico precisam estar acessíveis para baixar');
  for(const botao of botoes)botao.click();
  const baixadas=await Promise.all(downloads.map(async d=>JSON.parse(await d.blob.text())));
  assert.equal(new Set(downloads.map(d=>d.nome)).size,versoes.length,'Os arquivos das versões têm nomes distintos');
  for(const versao of versoes){
    const baixada=baixadas.find(d=>d.agenda?.[0]?.obs===versao.agenda[0].obs);
    assert.deepEqual(baixada,versao,'Cada botão baixa a versão correspondente, com todos os campos');
  }
  assert.equal(a.itens.get('cl_descartado'),armazenamento);assert.deepEqual(json(a,'E'),estado);
  conferirSomenteLeituras(a,2);
});

test('Recuperação: falha na gravação do cache mantém o formulário aberto com todos os campos',async()=>{
  const a=await app();
  a.run("novoCompromissoRotina('2027-01-10')");
  const modal=a.document.querySelector('#modais .fundo');
  const titulo=modal.querySelector('[name=titulo]');titulo.value='Rascunho sintético com informação completa';
  const campos=[...modal.querySelectorAll('input,select,textarea')].map(x=>({nome:x.name,valor:x.value,marcado:x.checked}));
  const estado=json(a,'E'),cache=a.itens.get('centralLeo.v1');
  a.recusadas.add('centralLeo.v1');atualizarRemoto(a);
  await a.run('puxarNuvem()');
  assert.ok(a.document.querySelector('#modais .fundo')===modal,'A falha de cache não deve fechar o formulário nem trocar seus elementos');
  assert.deepEqual([...modal.querySelectorAll('input,select,textarea')].map(x=>({nome:x.name,valor:x.value,marcado:x.checked})),campos);
  assert.deepEqual(json(a,'E'),estado);assert.equal(a.itens.get('centralLeo.v1'),cache);
  assert.equal(a.run('_tabBase'),10);conferirSomenteLeituras(a,1);
});

for(const formato of ['JSON legado','compactado'])test('Recuperação: Configurações oferece download íntegro de cl_descartado '+formato,async()=>{
  const a=await app(),backup=backupAnterior(a);
  if(formato==='compactado')a.itens.set('cl_descartado',compactar(backup));
  const armazenamento=a.itens.get('cl_descartado'),estado=json(a,'E');
  a.ctx.capturarDownload=(blob,nome)=>{a.download={blob,nome}};
  a.run("baixar=(blob,nome)=>capturarDownload(blob,nome);atual='config'");
  await a.run("vConfig(document.getElementById('main'))");
  const secao=a.document.querySelector('[data-bid=cf-descartado]');assert.ok(secao);
  const botao=[...secao.querySelectorAll('button')].find(x=>x.textContent.includes('Baixar (JSON)'));
  assert.ok(botao,'O backup precisa continuar acessível em Configurações → Versão descartada');
  botao.click();assert.equal(a.download.nome,'central-leo-descartado.json');
  assert.deepEqual(JSON.parse(await a.download.blob.text()),backup.dados,'O arquivo baixado deve preservar exatamente todos os dados anteriores');
  assert.equal(a.itens.get('cl_descartado'),armazenamento);assert.deepEqual(json(a,'E'),estado);
  conferirSomenteLeituras(a,0);
});
