/* Compras são acompanhamento operacional; nenhum lançamento financeiro é gerado. */
(function(root){
  'use strict';
  const BASES=Object.freeze(['estimado','cotado','comprado']);
  const SITUACOES=Object.freeze(['solicitado','em cotação','comprado','parcial','recebido','cancelado']);
  const PRIORIDADES=Object.freeze(['baixa','normal','alta']);
  const ROTULOS=Object.freeze({solicitado:'Solicitado','em cotação':'Em cotação',comprado:'Comprado',parcial:'Recebido parcialmente',recebido:'Recebido',cancelado:'Cancelado'});
  const LIMITES=Object.freeze({titulo:160,solicitante:160,obs:3000,fornecedor:200,descricao:240,especificacao:1000,unidade:30});
  const objeto=v=>!!v&&Object.prototype.toString.call(v)==='[object Object]'&&(Object.getPrototypeOf(v)===null||Object.getPrototypeOf(Object.getPrototypeOf(v))===null);
  const idValido=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,159}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
  const presente=v=>v!==null&&v!==undefined;
  const dataValida=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!v.startsWith('0000-')&&Number.isFinite(+new Date(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
  function campos(o,permitidos){if(!objeto(o)||Object.keys(o).some(k=>!permitidos.includes(k)))throw Error('Estrutura de compras inválida.');}
  function texto(v,k,obrigatorio=false){if(typeof v!=='string'||v.length>LIMITES[k]||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)||(obrigatorio&&!v.trim()))throw Error('Confira o campo '+k+' da compra.');}
  function dinheiro(v,nulo=true){if(nulo&&!presente(v))return;if(!Number.isSafeInteger(v)||v<0||v>1e9)throw Error('Informe valores não negativos, com até duas casas decimais.');}
  function quantidade(v,zero=false){if(typeof v!=='number'||!Number.isFinite(v)||v<(zero?0:0.001)||v>1e6||Math.abs(v*1000-Math.round(v*1000))>1e-6)throw Error('Informe uma quantidade válida, com até três casas decimais.');}
  function totalItem(item,base){return presente(item[base])?Number((BigInt(item[base])*BigInt(Math.round(item.quantidade*1000))+500n)/1000n):null;}
  function validarLista(l){
    campos(l,['id','titulo','solicitante','data','prioridade','prazo','obs','fornecedor','situacao','itens','ajustes']);
    if(!idValido(l.id))throw Error('Identificador da lista de compras inválido.');
    for(const k of ['titulo','solicitante','obs','fornecedor'])texto(l[k],k,k==='titulo');
    if(!dataValida(l.data)||l.prazo&&!dataValida(l.prazo)||typeof l.prazo!=='string')throw Error('Informe datas válidas para a compra.');
    if(!PRIORIDADES.includes(l.prioridade)||!SITUACOES.includes(l.situacao))throw Error('Confira a prioridade e a situação da compra.');
    if(!Array.isArray(l.itens)||!l.itens.length||l.itens.length>500)throw Error('A lista deve ter de 1 a 500 itens.');
    const ids=new Set();let recebidos=0,completos=0;
    for(const i of l.itens){
      campos(i,['id','descricao','especificacao','quantidade','unidade','estimado','cotado','comprado','recebido']);
      if(!idValido(i.id)||ids.has(i.id))throw Error('Os itens precisam ter identificadores únicos.');ids.add(i.id);
      texto(i.descricao,'descricao',true);texto(i.especificacao,'especificacao');texto(i.unidade,'unidade',true);quantidade(i.quantidade);quantidade(i.recebido,true);
      if(i.recebido>i.quantidade)throw Error('O recebimento não pode superar a quantidade solicitada.');
      if(i.recebido>0)recebidos++;if(i.recebido===i.quantidade)completos++;
      BASES.forEach(b=>dinheiro(i[b]));
    }
    if(l.situacao==='recebido'&&completos!==l.itens.length)throw Error('Informe o recebimento de todos os itens antes de concluir.');
    if(l.situacao==='parcial'&&(!recebidos||completos===l.itens.length))throw Error('O recebimento parcial precisa ter itens recebidos e pendentes.');
    if(recebidos&&!['parcial','recebido','cancelado'].includes(l.situacao))throw Error('Atualize a situação para refletir os itens recebidos.');
    campos(l.ajustes,BASES);
    for(const b of BASES){campos(l.ajustes[b],['frete','desconto']);dinheiro(l.ajustes[b].frete,false);dinheiro(l.ajustes[b].desconto,false);const t=totalLista(l,b);if(t.completo&&t.centavos<0)throw Error('O desconto não pode superar os itens e o frete na base '+b+'.');}
  }
  function validar(dados){
    if(dados===undefined)return true;campos(dados,['versao','listas']);
    if(dados.versao!==1||!Array.isArray(dados.listas)||dados.listas.length>2000)throw Error('Formato de compras não reconhecido.');
    const ids=new Set();for(const l of dados.listas){validarLista(l);if(ids.has(l.id))throw Error('Identificador de lista repetido.');ids.add(l.id);}
    // Evita totais acima da precisão inteira disponível mesmo em backups importados.
    for(const b of BASES){const soma=dados.listas.reduce((s,l)=>s+Math.abs(totalLista(l,b).centavos||0),0);if(!Number.isSafeInteger(soma))throw Error('O total de compras excede o limite permitido.');}
    return true;
  }
  function totalLista(l,base){
    if(!BASES.includes(base))throw Error('Base de preço inválida.');
    let subtotalCentavos=0,informados=0;for(const i of l.itens){const v=totalItem(i,base);if(v!==null){subtotalCentavos+=v;informados++;}}
    const a=l.ajustes[base],centavos=informados?subtotalCentavos+a.frete-a.desconto:null;
    if(!Number.isSafeInteger(subtotalCentavos)||centavos!==null&&!Number.isSafeInteger(centavos))throw Error('O total de compras excede o limite permitido.');
    return {centavos,completo:informados===l.itens.length,informados,totalItens:l.itens.length,subtotalCentavos,freteCentavos:a.frete,descontoCentavos:a.desconto};
  }
  function atrasada(l,hoje){return !['recebido','cancelado'].includes(l.situacao)&&dataValida(l.prazo)&&dataValida(hoje)&&l.prazo<hoje;}
  /** Totais em centavos; null significa nenhum preço informado. Completo inclui todos os itens ativos.
   * pendentes = listas não recebidas nem canceladas; itensPendentes conta linhas, não soma unidades diferentes. */
  function resumo(dados,hoje){
    validar(dados);const r={totalListas:0,ativas:0,pendentes:0,atrasadas:0,parciais:0,recebidas:0,canceladas:0,itensPendentes:0};
    for(const b of BASES)r[b]={centavos:null,completo:true,informados:0,totalItens:0};
    for(const l of dados?.listas||[]){
      r.totalListas++;if(l.situacao==='cancelado'){r.canceladas++;continue;}r.ativas++;
      if(l.situacao==='recebido')r.recebidas++;else{r.pendentes++;if(atrasada(l,hoje))r.atrasadas++;}if(l.situacao==='parcial')r.parciais++;
      r.itensPendentes+=l.itens.filter(i=>i.recebido<i.quantidade).length;
      for(const b of BASES){const t=totalLista(l,b),s=r[b];s.informados+=t.informados;s.totalItens+=t.totalItens;s.completo=s.completo&&t.completo;if(t.centavos!==null)s.centavos=(s.centavos??0)+t.centavos;}
    }
    return r;
  }
  function salvar(dados,entrada,id,uid){
    validar(dados);const listas=dados?.listas||[],anterior=id?listas.find(l=>l.id===id):null;
    if(id&&!anterior)throw Error('Esta lista não pertence à obra aberta.');
    const lista=structuredClone(entrada);lista.id=anterior?.id||uid();validarLista(lista);
    const novos={versao:1,listas:anterior?listas.map(l=>l.id===id?lista:l):[...listas,lista]};validar(novos);return novos;
  }
  function receber(dados,id,valores){
    validar(dados);const l=dados?.listas.find(x=>x.id===id);if(!l||l.situacao==='cancelado')throw Error('Escolha uma lista ativa desta obra.');
    campos(valores,l.itens.map(i=>i.id));
    const itens=l.itens.map(i=>({...i,recebido:Object.hasOwn(valores,i.id)?valores[i.id]:i.recebido}));
    const situacao=itens.every(i=>i.recebido===i.quantidade)?'recebido':itens.some(i=>i.recebido>0)?'parcial':(['parcial','recebido'].includes(l.situacao)?'comprado':l.situacao);
    return salvar(dados,{...l,itens,situacao},id,()=>id);
  }
  root.FortemaisComprasModelo=Object.freeze({BASES,SITUACOES,PRIORIDADES,ROTULOS,LIMITES,validar,resumo,totalItem,totalLista,atrasada,salvar,receber,dataValida});
})(typeof globalThis==='object'?globalThis:this);
