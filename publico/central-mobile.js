/* Usa as mesmas ações das abas existentes; o seletor evita abas fora da tela. */
const centralMobilePaginas=new WeakMap();
function prepararCentralMobile(pagina){
  if(!pagina||pagina.classList.contains('saude-workbench'))return;
  const seletores='nav.workspace-tabs,nav.finance-tabs:not(.saude-tabs),nav.agenda-abas,nav.caixa-abas,nav.aviao-abas,nav.aviao-sheet-tabs,nav.stv-abas,nav.dev-nav,nav.fm-tabs,.db-abas';
  const Observar=globalThis.MutationObserver||pagina.ownerDocument?.defaultView?.MutationObserver;
  let estado=centralMobilePaginas.get(pagina);
  if(!estado){
    estado={navs:new Map(),observador:null};centralMobilePaginas.set(pagina,estado);
    if(Observar){estado.observador=new Observar(registros=>{
      const relevante=registros.some(r=>{
        const alvo=r.target;if(alvo.nodeType!==1||alvo.closest('.central-mobile-nav'))return false;
        if(alvo.matches(seletores)||alvo.closest(seletores))return true;
        return [...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&!n.matches('.central-mobile-nav')&&(n.matches(seletores)||n.querySelector(seletores)));
      });
      if(relevante)prepararCentralMobile(pagina);
    });estado.observador.observe(pagina,{childList:true,subtree:true})}
  }
  for(const [nav,item]of estado.navs)if(!pagina.contains(nav)){item.observador?.disconnect();nav.removeEventListener('click',item.sincronizar);item.label.remove();nav.classList.remove('central-mobile-nav-origin');delete nav.dataset.centralMobile;estado.navs.delete(nav)}
  pagina.querySelectorAll(seletores).forEach(nav=>{
    if(estado.navs.has(nav))return;
    let botoes=[...nav.querySelectorAll('button')];if(botoes.length<3)return;
    const label=document.createElement('label');label.className='central-mobile-nav';const titulo=document.createElement('span'),select=document.createElement('select');
    const nome=nav.getAttribute('aria-label')||'Seções desta área';titulo.textContent=nome;select.setAttribute('aria-label',nome+' · celular');
    const sincronizar=()=>{botoes=[...nav.querySelectorAll('button')];if(select.options.length!==botoes.length){select.replaceChildren();botoes.forEach((b,i)=>{const o=document.createElement('option');o.value=String(i);select.append(o)})}botoes.forEach((b,i)=>{const o=select.options[i],texto=b.textContent.trim();if(o.textContent!==texto)o.textContent=texto;if(o.disabled!==b.disabled)o.disabled=b.disabled});const atual=botoes.findIndex(b=>b.getAttribute('aria-pressed')==='true'||b.getAttribute('aria-selected')==='true'||b.getAttribute('aria-current')==='page'||b.classList.contains('on')||b.classList.contains('ativa')),valor=String(atual<0?0:atual);if(select.value!==valor)select.value=valor};
    select.onchange=()=>{const b=botoes[+select.value];if(!b||b.disabled)return;b.click();sincronizar()};
    nav.addEventListener('click',sincronizar);nav.classList.add('central-mobile-nav-origin');nav.dataset.centralMobile='1';label.append(titulo,select);nav.after(label);sincronizar();
    const observador=Observar?new Observar(sincronizar):null;observador?.observe(nav,{attributes:true,attributeFilter:['aria-pressed','aria-selected','aria-current','class','disabled'],childList:true,characterData:true,subtree:true});estado.navs.set(nav,{label,observador,sincronizar});
  });
}
