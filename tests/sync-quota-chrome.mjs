import {test} from 'node:test';
import assert from 'node:assert/strict';
import LZString from 'lz-string';
import {readFileSync} from 'node:fs';
import {setup} from './helpers/dom.mjs';

function app(){
  const a=setup({hostname:'leogpereira-afk.github.io'}),itens=new Map([['cl_token','sessao-sintetica']]);
  let quota=Infinity;const tamanho=m=>[...m].reduce((s,[k,v])=>s+k.length+v.length,0);
  a.ctx.LZString=LZString;
  a.ctx.localStorage={getItem:k=>itens.get(k)||null,setItem(k,v){const m=new Map(itens);m.set(k,String(v));if(tamanho(m)>quota){const e=Error('QuotaExceededError');e.name='QuotaExceededError';throw e}itens.set(k,String(v))},removeItem:k=>itens.delete(k)};
  a.run('E=carregar();E._mt=100;guardarEstadoLocal(E)');
  return {...a,itens,limitar:n=>quota=n,tamanho:()=>tamanho(itens)};
}
const ler=(a,x)=>JSON.parse(a.run('JSON.stringify('+x+')'));
const compactar=x=>'lz16:'+LZString.compressToUTF16(JSON.stringify(x));

test('Recuperação móvel não cobre Salvar ou Fechar e reaparece depois do formulário',()=>{
  const a=app();a.run("novoCompromissoRotina('2026-10-31')");
  a.document.querySelector('[name=titulo]').value='Rascunho fictício';
  a.run('guardarRascunhoSync();mostrarRascunhoSync()');
  const botao=a.document.querySelector('[data-abrir-rascunho-sync]');
  assert.equal(botao.hidden,true);assert.equal(botao.style.display,'none');
  a.document.querySelector('#modais .fechar').click();
  assert.equal(botao.hidden,false);assert.notEqual(botao.style.display,'none');
  botao.click();assert.equal(botao.hidden,true);
  assert.match(a.document.querySelector('[aria-label="Textos dos formulários preservados"]').value,/Rascunho fictício/);
});

test('Saúde também identifica as novas falhas como envio pendente, sem confirmar gravação no servidor',()=>{
  const a=app();a.run(readFileSync(new URL('../publico/saude-painel.js',import.meta.url),'utf8'));
  for(const status of ['armazenamento cheio — sincronização pendente','dados precisam de conferência','cópia de recuperação precisa de conferência','sincronização não concluída — tente novamente','servidor indisponível — tente novamente']){
    a.ctx.status=status;const resultado=ler(a,'saudeEstadoSync(status)');
    assert.equal(resultado.tipo,'atencao',status);assert.match(resultado.titulo,/pendente/i);
  }
});

test('Recuperação: envelope legado sem cache não impede guardar uma nova versão completa',()=>{
  const a=app();a.itens.set('cl_descartado',JSON.stringify({em:1,dados:null}));
  const dados=ler(a,'E');a.run('guardaDescartado(E)');
  const recuperacao=ler(a,'lerRecuperacaoLocal()');
  assert.deepEqual(recuperacao.dados,dados);
  assert.deepEqual(recuperacao.anteriores,[{em:1,dados:null}]);
});

test('Chrome antigo: compacta recuperação legada sem apagar nada e comporta o novo cache',()=>{
  const a=app(),antigo=ler(a,'E');antigo.notasSinteticas='Registro com acentos e informações completas. '.repeat(8000);
  const desc={em:100,dados:antigo,origem:'campo legado preservado'};
  a.itens.set('cl_descartado',JSON.stringify(desc));a.itens.set('outra-aplicacao','conteúdo intocado');
  a.itens.set('centralLeo.v1',compactar(antigo));
  const remoto=structuredClone(antigo);remoto.novaInformacao='Novo conteúdo completo! '.repeat(3000);
  a.limitar(a.tamanho()+100);
  a.ctx.remoto=remoto;a.run('guardarEstadoLocal(remoto)');
  assert.deepEqual(ler(a,'lerEstadoLocal()'),remoto);
  assert.deepEqual(ler(a,'lerRecuperacaoLocal()'),desc);
  assert.equal(a.itens.get('outra-aplicacao'),'conteúdo intocado');
  assert.ok(a.itens.get('cl_descartado').startsWith('lz16:'));
});

test('Sincronização: quota real não é descrita como falta de conexão e não envia estado antigo',async()=>{
  const a=app(),remoto=ler(a,'E');remoto._mt=200;remoto.agenda=[{id:'remoto',titulo:'Somente sintético'}];
  const cache=a.itens.get('centralLeo.v1');let puts=0;
  a.ctx.localStorage.setItem=()=>{const e=Error('quota');e.name='QuotaExceededError';throw e};
  a.ctx.fetch=async(_,{method})=>{if(method==='PUT')puts++;return {ok:true,status:200,json:async()=>({mt:2,dados:remoto})}};
  await a.run('puxarNuvem()');
  assert.match(a.document.querySelector('#stSync').textContent,/armazenamento/i);
  assert.doesNotMatch(a.document.querySelector('#stSync').textContent,/sem conexão|sincronizado/);
  assert.equal(a.itens.get('centralLeo.v1'),cache);assert.equal(a.run('_tabBase'),0);assert.equal(puts,0);
});

test('Sincronização: dados remotos inválidos são diferenciados de falha de rede',async()=>{
  const a=app(),remoto=ler(a,'E');remoto.gastos='inválido';
  const cache=a.itens.get('centralLeo.v1');
  a.ctx.fetch=async()=>({ok:true,status:200,json:async()=>({mt:2,dados:remoto})});
  await a.run('puxarNuvem()');
  assert.match(a.document.querySelector('#stSync').textContent,/dados.*conferência/i);
  assert.doesNotMatch(a.document.querySelector('#stSync').textContent,/sem conexão|sincronizado/);
  assert.equal(a.itens.get('centralLeo.v1'),cache);assert.equal(a.run('_tabBase'),0);
});
