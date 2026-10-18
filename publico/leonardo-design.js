/* Identidade da Central. Cores de navegação não alteram cores de status ou dados. */
const LeonardoDesign = (() => {
  const areas = {
    inicio: ['#3840e8','#9298ff','#24296a','home'],
    donboy: ['#6941c6','#c4a8ff','#39275c','spark'],
    agenda: ['#2563a6','#94c5ff','#203e61','calendar'],
    planilhas: ['#2c7059','#8fd6b7','#244a3e','table'],
    rendimentos: ['#3840e8','#9298ff','#3840e8','trend'],
    gastos: ['#6d3bb8','#c9aff4','#6d3bb8','wallet'],
    empresas: ['#4656ac','#acb8ff','#2e365f','building'],
    marketing: ['#a23d76','#f6a3d2','#602f4c','megaphone'],
    bancos: ['#476184','#a8c8ef','#2a3c55','bank'],
    patrimonio: ['#7f6b37','#dfc780','#4f462e','home'],
    caixavgv: ['#68732b','#c9d48a','#424929','chart'],
    aviao: ['#286e90','#87d1ef','#214858','plane'],
    viagens: ['#087c81','#7adce0','#194e51','globe'],
    demandas: ['#7051a1','#c7adf1','#423356','check'],
    saude: ['#276e5d','#90d5bb','#294e43','heart'],
    strava: ['#b34c18','#ffb789','#5e3624','activity'],
    estrategia: ['#5464a8','#aebdf4','#333d60','target'],
    fortemais: ['#333333','#d5d5d5','#242424','building'],
    oportunidades: ['#8f6921','#eacc83','#544327','bulb'],
    'metodo-vof': ['#5650a4','#b8b2fa','#373262','target'],
    documentos: ['#586481','#b9c8ea','#343e55','file'],
    drive: ['#427548','#a0d6a5','#2b4c30','folder'],
    guia: ['#9c5265','#efb5c5','#5d3540','compass'],
    config: ['#5c6876','#c0cbd8','#35414c','settings']
  };
  const paths = {
    home:'<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',
    spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/><path d="M20 2v4m-2-2h4"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2m-8 3h2"/>',
    table:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M3 15h18M9 3v18"/>',
    trend:'<path d="m3 17 6-6 4 4 8-10m-7 0h7v7"/>',
    wallet:'<path d="M20 8V5a2 2 0 0 0-2-2L5 6a3 3 0 0 0-2 3v9a3 3 0 0 0 3 3h14V8H6"/><path d="M20 12h-5v5h5m-3-2.5h.1"/>',
    building:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1M10 21v-3h4v3"/>',
    megaphone:'<path d="m4 9 15-5v16L4 15Zm2 7 2 5h4l-2-6M22 9v6"/>',
    bank:'<path d="m3 8 9-5 9 5H3Zm2 3v7m7-7v7m7-7v7M3 21h18"/>',
    chart:'<path d="M4 3v18h17M9 16v-4m5 4V8m5 8V5"/>',
    plane:'<path d="m3 10 7 2 7-8c2-2 4-1 3 1l-6 9 1 7-3-3-3-2-5 1 2-3Z"/>',
    globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
    check:'<rect x="3" y="3" width="18" height="18" rx="5"/><path d="m7 12 3 3 7-7"/>',
    heart:'<path d="M12 21 4 13C-2 5 7 0 12 7c5-7 14-2 8 6Z"/><path d="M4 12h4l2-4 3 8 2-4h5"/>',
    activity:'<path d="M2 12h5l3-8 4 16 3-8h5"/>',
    target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    bulb:'<path d="M8 17v-2a7 7 0 1 1 8 0v2Zm1 3h6m-5 2h4"/>',
    file:'<path d="M14 3H5v18h14V8Zm0 0v5h5M8 12h8m-8 4h6"/>',
    folder:'<path d="M3 7V4h7l3 3h8v14H3Z"/><path d="M3 11h18"/>',
    compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6Z"/>',
    settings:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>'
  };
  function aplicar(id,pagina){
    const [accent,light,hero,icon]=areas[id]||areas.inicio;
    document.body.dataset.leoArea=id;
    const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">'+paths[icon]+'</svg>';
    for(const alvo of [document.body,pagina].filter(Boolean)){
      alvo.style.setProperty('--leo-accent',accent);alvo.style.setProperty('--leo-light',light);alvo.style.setProperty('--leo-hero',hero);
      alvo.style.setProperty('--leo-icon','url("data:image/svg+xml,'+encodeURIComponent(svg)+'")');
    }
    if(pagina)pagina.dataset.leoArea=id;
  }
  return {areas,aplicar};
})();
