import {test} from 'node:test';
import assert from 'node:assert/strict';
import LZString from 'lz-string';
import {setup} from './helpers/dom.mjs';

const compactar=dados=>'lz16:'+LZString.compressToUTF16(JSON.stringify(dados));
const ler=(a,expressao)=>JSON.parse(a.run('JSON.stringify('+expressao+')'));
function app(){
  const a=setup({hostname:'leogpereira-afk.github.io'});
  const itens=new Map([['cl_token','sessao-sintetica'],['outra-aplicacao','Histórico externo que não pertence à Central']]);
  let quota=Infinity;
  const tamanho=m=>[...m].reduce((s,[k,v])=>s+k.length+v.length,0);
  a.ctx.LZString=LZString;
  a.ctx.localStorage={getItem:k=>itens.get(k)||null,setItem(k,v){
    const proximo=new Map(itens);proximo.set(k,String(v));
    if(tamanho(proximo)>quota){const e=Error('Quota sintética');e.name='QuotaExceededError';throw e}
    itens.set(k,String(v));
  },removeItem(){throw Error('Nenhuma chave pode ser removida para liberar espaço')}};
  a.run("E=carregar();E._mt=100;E.notasSinteticas='Descrição completa com informação e histórico. '.repeat(12000)");
  const estado=ler(a,'E');
  // Simula o cache legado em JSON antes da correção.
  itens.set('centralLeo.v1',JSON.stringify(estado));
  return {...a,itens,estado,limitar:n=>quota=n,tamanho:()=>tamanho(itens)};
}

test('Quota da recuperação compacta somente o cache próprio e conserva todas as versões',()=>{
  const a=app(),anterior={em:1,dados:{...a.estado,notasSinteticas:'Estado anterior sintético.'.repeat(9000)},origem:'Campo legado preservado'};
  a.itens.set('cl_descartado',compactar(anterior));
  const externos=[...a.itens].filter(([k])=>!['centralLeo.v1','cl_descartado'].includes(k));
  a.limitar(a.tamanho()+100);
  a.run('guardaDescartado(E)');
  assert.ok(a.itens.get('centralLeo.v1').startsWith('lz16:'));
  assert.deepEqual(ler(a,'lerEstadoLocal()'),a.estado);
  const historico=ler(a,'lerRecuperacaoLocal()');
  assert.deepEqual(historico.dados,a.estado);
  assert.deepEqual(historico.anteriores,[anterior]);
  assert.equal(historico.origem,anterior.origem);
  for(const [k,v] of externos)assert.equal(a.itens.get(k),v);
  const gravado=a.itens.get('cl_descartado');
  a.run('guardaDescartado(E)');
  assert.equal(a.itens.get('cl_descartado'),gravado,'Repetir não duplica versões');
});

test('Cache grande já fica compacto antes de consumir a quota de outros sistemas',()=>{
  const a=app();
  a.run('guardarEstadoLocal(E)');
  assert.ok(a.itens.get('centralLeo.v1').startsWith('lz16:'));
  assert.deepEqual(ler(a,'lerEstadoLocal()'),a.estado);
});

test('Salvar novamente não reexpande cache compactado e a recarga conserva o conteúdo inteiro',()=>{
  const a=app();a.itens.set('centralLeo.v1',compactar(a.estado));
  a.run("E.agenda=[{id:'agenda-sintetica',titulo:'Salvar e recarregar',obs:'Informação completa — 🗓️'}];guardarEstadoLocal(E)");
  const esperado=ler(a,'E');
  assert.ok(a.itens.get('centralLeo.v1').startsWith('lz16:'));
  a.run('E=carregar()');
  assert.deepEqual(ler(a,'E'),esperado);
  // Inclusive quando a versão seguinte passa a ter menos de 64 KiB.
  a.run("guardarEstadoLocal({notas:['Registro menor, ainda compacto']})");
  assert.ok(a.itens.get('centralLeo.v1').startsWith('lz16:'));
  assert.deepEqual(ler(a,'lerEstadoLocal()'),{notas:['Registro menor, ainda compacto']});
});

test('Quota real, com ambas as cópias compactadas, não remove nem substitui dados',()=>{
  const a=app();a.itens.set('centralLeo.v1',compactar(a.estado));
  a.itens.set('cl_descartado',compactar({em:1,dados:{...a.estado,notasSinteticas:'Versão anterior preservada'}}));
  const antes=[...a.itens];a.limitar(a.tamanho());
  assert.throws(()=>a.run('guardaDescartado(E)'),e=>e.name==='QuotaExceededError');
  assert.deepEqual([...a.itens],antes);
  assert.deepEqual(ler(a,'E'),a.estado);
});

test('Compressão sem conferência integral falha antes de alterar cache ou recuperação',()=>{
  const a=app(),antes=[...a.itens];
  a.ctx.LZString={compressToUTF16:LZString.compressToUTF16,decompressFromUTF16:()=>'{"alterado":true}'};
  assert.throws(()=>a.run('guardarEstadoLocal(E)'),/conferir a cópia compactada/);
  assert.deepEqual([...a.itens],antes);
  assert.deepEqual(ler(a,'E'),a.estado);
});

test('Sem a biblioteca de compactação, uma cópia compactada não é substituída',()=>{
  const a=app();a.itens.set('centralLeo.v1',compactar(a.estado));
  const antes=[...a.itens];a.ctx.LZString=undefined;
  assert.throws(()=>a.run('guardarEstadoLocal(E)'),/compactação.*não carregou/);
  assert.deepEqual([...a.itens],antes);
});

test('Falha distinta de quota na recuperação não tenta alterar o cache',()=>{
  const a=app(),antes=[...a.itens],set=a.ctx.localStorage.setItem;
  a.ctx.localStorage.setItem=(k,v)=>{if(k==='cl_descartado')throw Error('Acesso ao armazenamento bloqueado');set(k,v)};
  assert.throws(()=>a.run('guardaDescartado(E)'),/Acesso ao armazenamento bloqueado/);
  assert.deepEqual([...a.itens],antes);
});

test('Após liberar espaço sem exclusão, salvar com CAS e recarregar mantém dados e histórico',async()=>{
  const a=app(),anterior={em:1,dados:{...a.estado,notasSinteticas:'Histórico anterior preservado'}};
  a.itens.set('cl_descartado',compactar(anterior));a.limitar(a.tamanho()+100);
  let servidor={mt:10,dados:{...a.estado,_mt:200,agenda:[{id:'remoto-sintetico',titulo:'Compromisso confirmado na nuvem'}]}};
  let puts=0;
  const fetch=async(_,op)=>{
    if(op.method==='POST')return {ok:true,status:200,json:async()=>({backups:[],arquivos:[],ok:true})};
    if(op.method==='PUT'){
      const corpo=JSON.parse(op.body);assert.equal(corpo.base,servidor.mt,'O envio deve usar a base confirmada');
      servidor={mt:servidor.mt+1,dados:structuredClone(corpo.dados)};puts++;
      return {ok:true,status:200,json:async()=>({mt:servidor.mt})};
    }
    assert.equal(op.method,'GET');
    return {ok:true,status:200,json:async()=>structuredClone(servidor)};
  };
  a.ctx.fetch=fetch;await a.run('puxarNuvem()');
  assert.equal(a.run('_tabBase'),10);
  const recuperacao=ler(a,'lerRecuperacaoLocal()');
  assert.deepEqual(recuperacao.dados,a.estado);
  assert.deepEqual(recuperacao.anteriores,[anterior]);
  a.run("E.agenda.push({id:'novo-sintetico',titulo:'Novo registro para conferir persistência',obs:'Acentos, histórico e 🗓️'});salvar()");
  const esperado=ler(a,'E');
  assert.equal(await a.run('enviarNuvem()'),true);assert.equal(puts,1);
  assert.deepEqual(servidor.dados,esperado);
  assert.match(a.document.querySelector('#stSync').textContent,/sincronizado/);
  const b=setup({hostname:'leogpereira-afk.github.io'});
  b.ctx.LZString=LZString;b.ctx.localStorage=a.ctx.localStorage;b.ctx.fetch=fetch;
  b.run('E=carregar()');await b.run('puxarNuvem()');
  assert.deepEqual(ler(b,'E'),esperado);
  assert.deepEqual(ler(b,'lerRecuperacaoLocal()'),recuperacao);
  assert.equal(puts,1,'A recarga não pode duplicar a gravação');
  assert.match(b.document.querySelector('#stSync').textContent,/sincronizado/);
});
