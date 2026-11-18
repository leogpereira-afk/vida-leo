/* Inventário opcional de tênis. Somente neste navegador, sem rede nem estado clínico. */
var SaudeEsportesTenis=(function(){
  'use strict';
  const KEY='vidaLeo.esportes.tenis.v1';
  const MODALITIES=['corrida','hyrox','mtb','musculacao'];
  const PHOTO_MAX_INPUT=5*1024*1024,PHOTO_MAX_OUTPUT=500*1024,MAX_ITEMS=30;
  function campo(value,max,label){const v=String(value??'').trim();if(!v)throw Error('Informe '+label+'.');if(v.length>max)throw Error(label+' deve ter até '+max+' caracteres.');return v}
  function cabecalhoWebP(base64){
    const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',bytes=[];let bits=0,buffer=0;
    for(const char of base64.slice(0,20)){const n=alphabet.indexOf(char);if(n<0)break;buffer=(buffer<<6)|n;bits+=6;if(bits>=8){bits-=8;bytes.push((buffer>>bits)&255)}}
    return bytes[0]===82&&bytes[1]===73&&bytes[2]===70&&bytes[3]===70&&bytes[8]===87&&bytes[9]===69&&bytes[10]===66&&bytes[11]===80;
  }
  function validarFoto(value){
    if(value==null||value==='')return '';
    if(typeof value!=='string')throw Error('A foto é inválida. Selecione a imagem novamente.');
    const match=/^data:image\/webp;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if(!match||match[1].length%4!==0||!cabecalhoWebP(match[1]))throw Error('A foto deve ser uma imagem WebP preparada pelo cadastro.');
    const bytes=match[1].length*3/4-(match[1].endsWith('==')?2:match[1].endsWith('=')?1:0);
    if(bytes>PHOTO_MAX_OUTPUT)throw Error('A foto ultrapassa 500 KB. Selecione uma imagem menor.');
    return value;
  }
  function normalizar(value,agora,anterior){
    if(!value||typeof value!=='object')throw Error('Confira os dados do tênis.');
    const brand=campo(value.brand,80,'a marca'),model=campo(value.model,120,'o modelo');
    if(!MODALITIES.includes(value.modality))throw Error('Escolha uma das quatro modalidades.');
    const photo=validarFoto(value.photo===undefined?anterior?.photo:value.photo);
    return{id:anterior?.id||gerarId(),brand,model,modality:value.modality,photo,createdAt:anterior?.createdAt||agora,updatedAt:agora};
  }
  function gerarId(){return 'tenis-'+(typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12))}
  function ler(){
    let raw;try{raw=localStorage.getItem(KEY)}catch(e){throw Error('O armazenamento deste navegador está indisponível. Seus dados não foram alterados.')}
    if(raw===null)return [];
    let payload;try{payload=JSON.parse(raw)}catch(e){throw Error('Não foi possível ler o inventário salvo. O conteúdo anterior foi preservado.')}
    if(payload?.version!==1||!Array.isArray(payload.items)||payload.items.length>MAX_ITEMS)throw Error('O formato do inventário salvo não foi reconhecido. O conteúdo anterior foi preservado.');
    const ids=new Set();
    return payload.items.map(item=>{
      if(!item||typeof item.id!=='string'||!/^[a-zA-Z0-9-]{5,100}$/.test(item.id)||ids.has(item.id)||typeof item.createdAt!=='string'||!Number.isFinite(Date.parse(item.createdAt))||typeof item.updatedAt!=='string'||!Number.isFinite(Date.parse(item.updatedAt)))throw Error('Há um cadastro inválido no inventário. O conteúdo anterior foi preservado.');
      ids.add(item.id);const normalized=normalizar(item,item.updatedAt,item);return{...normalized};
    });
  }
  function gravar(items){
    const json=JSON.stringify({version:1,items});
    try{localStorage.setItem(KEY,json)}catch(e){throw Error('Não foi possível salvar neste navegador. O espaço pode estar cheio ou bloqueado. Seu preenchimento continua aberto.')}
    let saved;try{saved=localStorage.getItem(KEY)}catch(e){throw Error('Não foi possível confirmar o salvamento neste navegador. Confira a lista antes de tentar novamente.')}
    if(saved!==json)throw Error('Não foi possível confirmar o salvamento neste navegador. Confira a lista antes de tentar novamente.');
  }
  function get(){try{return{items:ler(),error:''}}catch(e){return{items:[],error:e.message}}}
  function save(value){
    const items=ler(),previous=value?.id?items.find(x=>x.id===value.id):null;
    if(value?.id&&!previous)throw Error('Este tênis não está mais no inventário. Reabra a lista antes de editar.');
    if(!previous&&items.length>=MAX_ITEMS)throw Error('Você chegou ao limite de 30 cadastros neste navegador.');
    const item=normalizar(value,new Date().toISOString(),previous),next=previous?items.map(x=>x.id===item.id?item:x):[...items,item];
    gravar(next);return{...item};
  }
  function remove(id){const items=ler();if(!items.some(x=>x.id===id))return false;gravar(items.filter(x=>x.id!==id));return true}
  async function decodificar(file){
    if(typeof createImageBitmap==='function')return createImageBitmap(file);
    return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Não foi possível abrir esta imagem.'))};img.src=url});
  }
  function dimensoesCabecalho(bytes,type){
    const u16=i=>bytes[i]*256+bytes[i+1],u24=i=>bytes[i]+bytes[i+1]*256+bytes[i+2]*65536;
    if(type==='image/png'&&bytes.length>=24){const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);return[view.getUint32(16),view.getUint32(20)]}
    if(type==='image/webp'&&bytes.length>=30){
      const chunk=String.fromCharCode(...bytes.slice(12,16));
      if(chunk==='VP8X')return[1+u24(24),1+u24(27)];
      if(chunk==='VP8 '&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42)return[(bytes[26]+bytes[27]*256)&16383,(bytes[28]+bytes[29]*256)&16383];
      if(chunk==='VP8L'&&bytes[20]===47)return[1+((bytes[21]|bytes[22]<<8)&16383),1+((bytes[22]>>6|bytes[23]<<2|bytes[24]<<10)&16383)];
    }
    if(type==='image/jpeg'){
      let i=2;while(i+8<bytes.length){if(bytes[i++]!==255)continue;while(bytes[i]===255)i++;const marker=bytes[i++];if(marker===217||marker===218)break;if(marker===216||marker===1||marker>=208&&marker<=215)continue;const length=u16(i);if(length<2||i+length>bytes.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return[u16(i+5),u16(i+3)];i+=length}
    }
    return null;
  }
  async function preparePhoto(file){
    if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Escolha uma foto JPEG, PNG ou WebP.');
    if(!Number.isFinite(file.size)||file.size<=0||file.size>PHOTO_MAX_INPUT)throw Error('A foto deve ter no máximo 5 MB.');
    let bytes;try{bytes=new Uint8Array(await file.slice(0,file.size).arrayBuffer())}catch(e){throw Error('Não foi possível ler esta foto. Selecione novamente.')}
    const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    const png=[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
    const webp=bytes[0]===82&&bytes[1]===73&&bytes[2]===70&&bytes[3]===70&&bytes[8]===87&&bytes[9]===69&&bytes[10]===66&&bytes[11]===80;
    if(!(file.type==='image/jpeg'&&jpeg||file.type==='image/png'&&png||file.type==='image/webp'&&webp))throw Error('O arquivo não corresponde a uma foto JPEG, PNG ou WebP válida.');
    const size=dimensoesCabecalho(bytes,file.type);if(size&&(!size[0]||!size[1]||size[0]*size[1]>40000000))throw Error('A foto tem dimensões incompatíveis. Escolha uma imagem de até 40 megapixels.');
    let img;try{img=await decodificar(file)}catch(e){throw Error('Não foi possível abrir esta foto. Tente outra imagem.')}
    try{
      const width=img.width||img.naturalWidth,height=img.height||img.naturalHeight;
      if(!width||!height||width*height>40000000)throw Error('A foto tem dimensões incompatíveis. Escolha uma imagem de até 40 megapixels.');
      const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx)throw Error('Este navegador não conseguiu preparar a foto.');
      let scale=Math.min(1,800/Math.max(width,height));
      for(let attempt=0;attempt<4;attempt++){
        canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
        for(const quality of [.84,.72,.6,.48]){const output=canvas.toDataURL('image/webp',quality);if(!output.startsWith('data:image/webp;'))throw Error('Este navegador não oferece o formato WebP. Tente salvar sem foto.');try{return validarFoto(output)}catch(e){if(!e.message.includes('500 KB'))throw e}}
        scale*=.75;
      }
      throw Error('Não foi possível reduzir a foto para 500 KB. Escolha outra imagem.');
    }finally{if(typeof img.close==='function')img.close()}
  }
  return{get,save,remove,preparePhoto,PHOTO_MAX_INPUT,PHOTO_MAX_OUTPUT,MAX_ITEMS};
})();
