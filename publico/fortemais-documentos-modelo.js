(function(root){
  'use strict';
  const PADRAO=Object.freeze(['Arquitetônico','Estrutural','Instalações','Documentos','Imagens','Sem categoria']);
  const LIMITES=Object.freeze({categoria:80,titulo:160,descricao:3000,revisao:80,dataDocumento:10});
  const especiais=new Set(['__proto__','prototype','constructor']);
  const tem=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const chave=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
  const objeto=v=>!!v&&Object.prototype.toString.call(v)==='[object Object]'&&(Object.getPrototypeOf(v)===null||Object.getPrototypeOf(Object.getPrototypeOf(v))===null);
  function idValido(id){return typeof id==='string'&&!!id.trim()&&id===id.trim()&&id.length<=160&&!especiais.has(id)&&!/[\u0000-\u001f\u007f]/.test(id)}
  function dataValida(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||v.startsWith('0000-'))return false;const d=new Date(v+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v}
  function validarItem(item){
    if(!objeto(item))throw Error('Metadados do documento inválidos.');
    for(const k of Object.keys(item)){
      if(k==='arquivado'){if(typeof item[k]!=='boolean')throw Error('Estado de arquivamento inválido.');continue}
      if(!tem(LIMITES,k))throw Error('Campo de documento inválido: '+k+'.');
      if(typeof item[k]!=='string'||item[k].length>LIMITES[k]||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(item[k]))throw Error('Confira o campo '+k+' do documento.');
      if(k==='dataDocumento'&&item[k]&&!dataValida(item[k]))throw Error('Informe uma data válida para o documento.');
    }
  }
  function validar(mapa){
    if(mapa===undefined)return true;
    if(!objeto(mapa))throw Error('O mapa de documentos está inválido.');
    for(const id of Object.keys(mapa)){if(!idValido(id))throw Error('Identificador de documento inválido.');validarItem(mapa[id])}
    return true;
  }
  function metadados(mapa,id){validar(mapa);return mapa&&tem(mapa,id)?{...mapa[id]}:{}}
  function salvar(mapa,id,patch){
    validar(mapa);if(!idValido(id))throw Error('Identificador de documento inválido.');validarItem(patch);
    const item={...metadados(mapa,id)};
    for(const [k,v] of Object.entries(patch)){if(typeof v==='string'){const texto=v.trim();if(texto)item[k]=texto;else delete item[k]}else item[k]=v}
    validarItem(item);return Object.fromEntries([...Object.entries(mapa||{}).filter(([k])=>k!==id),[id,item]]);
  }
  function categorias(mapa){validar(mapa);return [...new Set([...PADRAO,...Object.values(mapa||{}).map(x=>x.categoria).filter(Boolean)])]}
  function pertence(ref,obraId){const raiz='obra:'+obraId;return ref===raiz||String(ref||'').startsWith(raiz+':')}
  function agrupar(nuvem,locais,obraId){
    const juntos=new Map();
    for(const a of nuvem||[])if(a&&idValido(a.id)&&pertence(a.ref,obraId))juntos.set(a.id,{...a,nuvem:true});
    for(const a of locais||[])if(a&&idValido(a.id)&&pertence(a.ref,obraId)){
      if(juntos.has(a.id))juntos.set(a.id,{...juntos.get(a.id),blob:a.blob});else juntos.set(a.id,{...a,pendente:true});
    }
    return [...juntos.values()];
  }
  function filtrar(arquivos,mapa,{categoria='',busca='',arquivados=false}={}){
    validar(mapa);const procurado=chave(busca);
    return (arquivos||[]).map(a=>({...a,meta:metadados(mapa,a.id)})).filter(a=>{
      const m=a.meta;
      return !!m.arquivado===!!arquivados&&(!categoria||chave(m.categoria||'Sem categoria')===chave(categoria))&&(!procurado||chave([a.nome,a.tipo,m.titulo,m.categoria,m.descricao,m.revisao,m.dataDocumento,a.origem].join(' ')).includes(procurado));
    });
  }
  root.FortemaisDocumentosModelo=Object.freeze({PADRAO,LIMITES,validar,metadados,salvar,categorias,pertence,agrupar,filtrar});
})(typeof globalThis==='object'?globalThis:this);
