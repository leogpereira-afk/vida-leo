(function(root){
  'use strict';
  const TEXTOS=Object.freeze({responsavel:160,ambientes:3000,acabamentos:4000,diferenciais:4000,descricaoComercial:8000,observacoesInternas:8000});
  const NUMEROS=Object.freeze(['quartos','suites','banheiros','vagas']);
  const FOTO_TEXTOS=Object.freeze({legenda:1000,data:10,etapa:160,ambiente:160});
  const TIPOS=Object.freeze({real:'Foto real',projeto:'Projeto / renderização',divulgacao:'Material de divulgação'});
  const USOS=Object.freeze({interno:'Acompanhamento interno',divulgacao:'Divulgação'});
  const tem=(o,k)=>Object.prototype.hasOwnProperty.call(o,k), proibidos=new Set(['__proto__','prototype','constructor']);
  const objeto=v=>!!v&&Object.prototype.toString.call(v)==='[object Object]'&&(Object.getPrototypeOf(v)===null||Object.getPrototypeOf(Object.getPrototypeOf(v))===null);
  function idValido(v){return typeof v==='string'&&v===v.trim()&&v.length>0&&v.length<=160&&!proibidos.has(v)&&!/[\u0000-\u001f\u007f]/.test(v)}
  function texto(v,max){return typeof v==='string'&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)}
  function dataValida(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||v.startsWith('0000-'))return false;const d=new Date(v+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v}
  function validarFoto(f){
    if(!objeto(f))throw Error('Metadados da foto inválidos.');
    for(const [k,v] of Object.entries(f)){
      if(tem(FOTO_TEXTOS,k)){if(!texto(v,FOTO_TEXTOS[k]))throw Error('Confira o campo '+k+' da foto.');if(k==='data'&&v&&!dataValida(v))throw Error('Informe uma data válida para a foto.');}
      else if(k==='tipo'){if(!tem(TIPOS,v))throw Error('Tipo de foto inválido.');}
      else if(k==='uso'){if(!tem(USOS,v))throw Error('Uso de foto inválido.');}
      else if(k==='arquivado'){if(typeof v!=='boolean')throw Error('Estado da foto inválido.');}
      else throw Error('Campo de foto inválido: '+k+'.');
    }
    return true;
  }
  function validar(d){
    if(d===undefined)return true;
    if(!objeto(d)||d.versao!==1)throw Error('Cadastro complementar do imóvel inválido.');
    for(const [k,v] of Object.entries(d)){
      if(k==='versao')continue;
      if(tem(TEXTOS,k)){if(!texto(v,TEXTOS[k]))throw Error('Confira o campo '+k+' do imóvel.');}
      else if(NUMEROS.includes(k)){if(!Number.isInteger(v)||v<0||v>999)throw Error('Informe de 0 a 999 no campo '+k+'.');}
      else if(k==='fotos'){if(!objeto(v))throw Error('Mapa de fotos inválido.');for(const [id,m] of Object.entries(v)){if(!idValido(id))throw Error('Identificador de foto inválido.');validarFoto(m);}}
      else if(k==='capaId'){if(!idValido(v))throw Error('Identificador da capa inválido.');}
      else throw Error('Campo do imóvel inválido: '+k+'.');
    }
    if(d.capaId&&(!d.fotos||!tem(d.fotos,d.capaId)||d.fotos[d.capaId].arquivado))throw Error('A capa deve ser uma foto ativa deste imóvel.');
    return true;
  }
  function dados(d){validar(d);return JSON.parse(JSON.stringify(d||{versao:1,fotos:{}}))}
  function cadastro(d,campos){
    const novo=dados(d);
    for(const [k,v] of Object.entries(campos)){
      if(!tem(TEXTOS,k)&&!NUMEROS.includes(k))throw Error('Campo do imóvel inválido: '+k+'.');
      if(v===undefined||v===null||typeof v==='string'&&!v.trim()){delete novo[k];continue}
      if(NUMEROS.includes(k)){if(typeof v!=='number'&&(typeof v!=='string'||!/^\d+$/.test(v.trim())))throw Error('Informe um número inteiro no campo '+k+'.');novo[k]=Number(v);}
      else {if(typeof v!=='string')throw Error('Confira o campo '+k+' do imóvel.');novo[k]=v.trim()}
    }
    validar(novo);return novo;
  }
  function foto(d,id,patch){
    if(!idValido(id))throw Error('Identificador de foto inválido.');if(!objeto(patch))throw Error('Metadados da foto inválidos.');
    // Os campos vazios são removidos; não viram classificação presumida.
    const limpo={};for(const [k,v] of Object.entries(patch)){if((k==='tipo'||k==='uso')&&v==='')continue;limpo[k]=v}validarFoto(limpo);
    const novo=dados(d);novo.fotos=novo.fotos||{};const meta={...(novo.fotos[id]||{})};
    for(const [k,v] of Object.entries(patch)){if(typeof v==='string'){if(v.trim())meta[k]=v.trim();else delete meta[k]}else meta[k]=v}
    novo.fotos[id]=meta;if(meta.arquivado&&novo.capaId===id)delete novo.capaId;validar(novo);return novo;
  }
  function capa(d,id){const novo=dados(d);if(!id){delete novo.capaId;return novo}if(!idValido(id))throw Error('Identificador de foto inválido.');novo.fotos=novo.fotos||{};novo.fotos[id]={...(novo.fotos[id]||{})};novo.capaId=id;validar(novo);return novo}
  function imagemSegura(a){return !!a&&/^(image\/(png|jpeg|webp|gif|bmp))$/i.test(a.tipo||a.type||'')}
  function agrupar(nuvem,locais,obraId){
    const mapa=new Map(),ref='obra:'+obraId;
    for(const a of nuvem||[])if(a&&a.ref===ref&&idValido(a.id)&&imagemSegura(a))mapa.set(a.id,{...a,nuvem:true});
    for(const a of locais||[])if(a&&a.ref===ref&&idValido(a.id)&&imagemSegura(a)){if(mapa.has(a.id))mapa.set(a.id,{...mapa.get(a.id),blob:a.blob});else mapa.set(a.id,{...a,pendente:true});}
    return [...mapa.values()];
  }
  function resumo(d){
    const v=dados(d),chaves=[...Object.keys(TEXTOS),...NUMEROS],preenchidos=chaves.filter(k=>tem(v,k)&&v[k]!=='').length;
    return {preenchidos,totalCampos:chaves.length,completo:preenchidos===chaves.length,fotos:Object.values(v.fotos||{}).filter(f=>!f.arquivado).length,capaId:v.capaId||null,responsavel:v.responsavel||null,descricaoComercial:v.descricaoComercial||null};
  }
  root.FortemaisImovelModelo=Object.freeze({TEXTOS,NUMEROS,FOTO_TEXTOS,TIPOS,USOS,validar,validarFoto,dados,cadastro,foto,capa,imagemSegura,agrupar,resumo});
})(typeof globalThis==='object'?globalThis:this);
