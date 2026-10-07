// Porta privada do DON BOY: consultas e envio explícito de fontes, sem Telegram
// e sem credenciais no navegador. O chamador já conferiu a sessão do dono.
// A tabela donboy_ponte é privada (RLS sem políticas; apenas service_role).
const DONBOY_ENDPOINT = "https://reoghclxripktzpdwhiy.supabase.co/functions/v1/badboy-telegram";
const DONBOY_MAX_RESPOSTA = 256 * 1024;
type DonboyBanco = { from: (tabela: string) => any };
type DonboyObjeto = Record<string, unknown>;
const donboyObjeto = (v: unknown): v is DonboyObjeto => !!v && typeof v === "object" && !Array.isArray(v);
const donboyJson = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), {
  status, headers: { "content-type": "application/json; charset=utf-8", "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" },
});
const donboyCampos = (valor: unknown, campos: string[]) => {
  if (!donboyObjeto(valor)) return null;
  return Object.fromEntries(campos.filter((k) => Object.hasOwn(valor, k)).map((k) => [k, valor[k]]));
};

async function donboyLerResposta(resposta: Response, limite = DONBOY_MAX_RESPOSTA): Promise<DonboyObjeto> {
  if (!resposta.ok || !resposta.headers.get("content-type")?.toLowerCase().startsWith("application/json") ||
      Number(resposta.headers.get("content-length") ?? 0) > limite || !resposta.body) throw Error("resposta inválida");
  const leitor = resposta.body.getReader(), blocos: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const {done,value} = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > limite) { await leitor.cancel(); throw Error("resposta acima do limite"); }
    blocos.push(value);
  }
  const bytes = new Uint8Array(total); let posicao = 0;
  for (const bloco of blocos) { bytes.set(bloco,posicao); posicao += bloco.byteLength; }
  const valor = JSON.parse(new TextDecoder().decode(bytes));
  if (!donboyObjeto(valor)) throw Error("resposta inválida");
  return valor;
}

function donboyProjetarPreferencias(valor:unknown){
  const rotulos:Record<string,string>={extensao:'Extensão das respostas',tom:'Tom da conversa',formato:'Formato das respostas',duracao_reuniao_min:'Duração padrão das reuniões (min)'};
  const escolhas:Record<string,string[]>={extensao:['curta','equilibrada','detalhada'],tom:['direto','consultivo','formal'],formato:['automatico','paragrafos','listas']};
  if(!Array.isArray(valor))return [];
  const vistas=new Set<string>();
  return valor.slice(0,20).flatMap(p=>{
    if(!donboyObjeto(p)||typeof p.chave!=='string'||!Object.hasOwn(rotulos,p.chave)||vistas.has(p.chave)||typeof p.valor!=='string'||!['pedido_confirmado','padrao'].includes(String(p.origem)))return [];
    const valido=p.valor==='padrao'||(p.chave==='duracao_reuniao_min'?/^\d+$/.test(p.valor)&&Number(p.valor)>=5&&Number(p.valor)<=480:escolhas[p.chave].includes(p.valor));
    if(!valido||(p.origem==='padrao')!==(p.valor==='padrao'))return [];
    vistas.add(p.chave);
    return [{chave:p.chave,rotulo:rotulos[p.chave],valor:p.valor,origem:p.origem}];
  });
}
function donboyProjetarAutomacoes(valor:unknown){
  if(!Array.isArray(valor))return [];
  const vistas=new Set<string>();
  const texto=(v:unknown,max:number)=>typeof v==='string'?v.slice(0,max):null;
  return valor.slice(0,20).flatMap(a=>{
    if(!donboyObjeto(a)||typeof a.id!=='string'||!['email_diario','briefing','acompanhamento','saude'].includes(a.id)||vistas.has(a.id)||!['inativo','nao_verificado'].includes(String(a.estado)))return [];
    vistas.add(a.id);
    // Não existe API de verificação do agendador neste contrato. Campos de
    // horário e execução permanecem vazios, mesmo se um upstream os afirmar.
    return [{id:a.id,nome:texto(a.nome,120),estado:a.estado,horario:null,fuso:texto(a.fuso,80),escopo:texto(a.escopo,200),ultimaExecucao:null,detalhe:texto(a.detalhe,600)}];
  });
}
function donboyProjetarPainel(d: DonboyObjeto) {
  if (!donboyObjeto(d.inteligencia) || !Array.isArray(d.capacidades) || !Array.isArray(d.ultimosTurnos) ||
      !Array.isArray(d.pendentes) || !donboyObjeto(d.custos)) throw Error("painel inválido");
  const turno = (v: unknown) => donboyCampos(v,["id","estado","iniciado_em","finalizado_em","modelo","duracao_ms","custo_usd","erro","consultas","etapas","conclusao","entregaResposta"]);
  return {
    ...donboyCampos(d,["versao","geradoEm","consultadoEm"]),
    inteligencia: donboyCampos(d.inteligencia,["provedor","modelo","esforco"]),
    preferencias:donboyProjetarPreferencias(d.preferencias),
    preferenciasEstado:Array.isArray(d.preferencias)&&['disponivel','indisponivel','nao_consultado'].includes(String(d.preferenciasEstado))?d.preferenciasEstado:'nao_consultado',
    automacoes:donboyProjetarAutomacoes(d.automacoes),
    capacidades: d.capacidades.slice(0,50).map(c=>donboyCampos(c,["id","nome","configuracao","modo","faz","verificacao","testadaEm","status","detalhe"])),
    ultimaExecucao: turno(d.ultimaExecucao),
    ultimosTurnos: d.ultimosTurnos.slice(0,50).map(turno),
    pendentes: d.pendentes.slice(0,50).map(p=>donboyCampos(p,["id","tipo","estado","criado_em"])),
    custos: { ...donboyCampos(d.custos,["mes","moeda"]),
      openai: donboyCampos(d.custos.openai,["custoUsd","chamadas"]),
      claude: donboyCampos(d.custos.claude,["custoUsd","chamadas"]),
      desconhecido: donboyCampos(d.custos.desconhecido,["custoUsd","chamadas"]) },
    limites: donboyCampos(d.limites,["referenciaBrl","tetoAutomatico","aviso","observacao"]),
  };
}

function donboyProjetarTeste(d: DonboyObjeto) {
  if (d.somente_leitura !== true || d.telegram_enviado !== false || typeof d.texto !== "string" ||
      !Array.isArray(d.consultas) || !Array.isArray(d.anexos) || !Array.isArray(d.modelos)) throw Error("teste inválido");
  return { somente_leitura:true, telegram_enviado:false, texto:d.texto.slice(0,30000),
    consultas:d.consultas.filter(c=>typeof c==="string").slice(0,80),
    anexos:d.anexos.slice(0,20).map(a=>donboyCampos(a,["nome","bytes"])),
    modelos:d.modelos.filter(m=>typeof m==="string").slice(0,20) };
}

const DONBOY_MAX_ARQUIVO = 3 * 1024 * 1024;
const DONBOY_MIMES = ["application/pdf","image/jpeg","image/png","image/webp","text/plain","text/markdown","text/csv"];
function donboyData(valor: unknown): valor is string {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(valor+"T00:00:00.000Z");
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0,10) === valor;
}
function donboyDocumento(valor: unknown) {
  if (!donboyObjeto(valor) || typeof valor.chave !== "string" || !valor.chave ||
      typeof valor.nome !== "string" || typeof valor.titulo !== "string" || typeof valor.origem !== "string" ||
      !(valor.empresa === null || typeof valor.empresa === "string") || !donboyData(valor.dataBase) ||
      typeof valor.recebidoEm !== "string" || !Number.isFinite(Date.parse(valor.recebidoEm)) ||
      !["informada","recebimento","base_existente"].includes(String(valor.naturezaData)) ||
      !["recebido","disponivel","revisao","falhou"].includes(String(valor.estado)) ||
      !(valor.leitura === null || ["texto_original","extracao_ia","acervo_existente"].includes(String(valor.leitura))) ||
      typeof valor.arquivoGuardado !== "boolean" || typeof valor.caracteres !== "number" ||
      !Number.isInteger(valor.caracteres) || valor.caracteres < 0 || !Array.isArray(valor.observacoes)) throw Error("documento inválido");
  return {
    chave:valor.chave.slice(0,180), nome:valor.nome.slice(0,150), titulo:valor.titulo.slice(0,200), origem:valor.origem.slice(0,300),
    empresa:typeof valor.empresa === "string" ? valor.empresa.slice(0,80) : null,
    dataBase:valor.dataBase,naturezaData:valor.naturezaData,recebidoEm:valor.recebidoEm,
    estado:valor.estado,leitura:valor.leitura,arquivoGuardado:valor.arquivoGuardado,caracteres:valor.caracteres,
    observacoes:valor.observacoes.filter((x): x is string=>typeof x === "string").slice(0,10).map(x=>x.slice(0,600)),
    // Erros técnicos do processamento nunca atravessam a fronteira privada.
    erro:valor.erro ? "A leitura não foi concluída. Confira o arquivo e as observações." : null,
  };
}
function donboyProjetarMemoria(d: DonboyObjeto, adicionar: boolean) {
  if (adicionar) {
    if (typeof d.ok !== "boolean" || typeof d.duplicado !== "boolean" || d.telegram_enviado !== false) throw Error("envio inválido");
    const documento = donboyDocumento(d.documento);
    if (d.ok !== (documento.estado === "disponivel")) throw Error("estado inconsistente");
    return {ok:d.ok,duplicado:d.duplicado,documento,telegram_enviado:false};
  }
  if (!Array.isArray(d.documentos) || d.documentos.length > 50 || !(d.proximoInicio === null ||
      (Number.isInteger(d.proximoInicio) && Number(d.proximoInicio) >= 0 && Number(d.proximoInicio) <= 10000))) throw Error("lista inválida");
  return {documentos:d.documentos.map(donboyDocumento),proximoInicio:d.proximoInicio};
}

function donboyPrepararMemoria(corpo: DonboyObjeto, adicionar: boolean): {dados: DonboyObjeto} | {erro: string;status:number} {
  const permitidos = adicionar ? ["acao","nome","mime","base64","titulo","origem","empresa","dataBase"] : ["acao","inicio","limite"];
  if (Object.keys(corpo).some(k=>!permitidos.includes(k))) return {erro:"O pedido contém campos não permitidos.",status:400};
  if (new TextEncoder().encode(JSON.stringify(corpo)).length > (adicionar ? 4300000 : 10000)) return {erro:"O arquivo excede o limite de 3 MB.",status:413};
  if (!adicionar) {
    const inicio=corpo.inicio ?? 0, limite=corpo.limite ?? 20;
    if (!Number.isInteger(inicio) || Number(inicio)<0 || Number(inicio)>10000 ||
        !Number.isInteger(limite) || Number(limite)<1 || Number(limite)>50) return {erro:"Informe uma página válida, com até 50 fontes.",status:400};
    return {dados:{inicio,limite}};
  }
  const {nome,mime,base64} = corpo;
  if (typeof nome !== "string" || !nome.trim() || nome.length>150 || /[\x00-\x1f\x7f/\\]/.test(nome) ||
      typeof mime !== "string" || !DONBOY_MIMES.includes(mime.toLowerCase()) || typeof base64 !== "string" || !base64) {
    return {erro:"Envie um arquivo PDF, JPG, PNG, WebP, TXT, MD ou CSV com nome válido.",status:400};
  }
  if (base64.length > 4 * Math.ceil(DONBOY_MAX_ARQUIVO/3)) return {erro:"O arquivo excede o limite de 3 MB.",status:413};
  if (base64.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(base64) || !/^[^=]*={0,2}$/.test(base64)) return {erro:"O conteúdo do arquivo é inválido.",status:400};
  try {
    const bytes=atob(base64);
    if (!bytes.length || btoa(bytes)!==base64) return {erro:"O conteúdo do arquivo é inválido.",status:400};
    if (bytes.length>DONBOY_MAX_ARQUIVO) return {erro:"O arquivo excede o limite de 3 MB.",status:413};
  } catch { return {erro:"O conteúdo do arquivo é inválido.",status:400}; }
  const dados:DonboyObjeto={nome:nome.trim(),mime:mime.toLowerCase(),base64};
  for (const [campo,maximo] of [["titulo",200],["origem",300],["empresa",80]] as const) {
    const valor=corpo[campo];
    if (valor !== undefined && (typeof valor !== "string" || valor.length>maximo || /[\x00-\x1f\x7f]/.test(valor))) return {erro:"Confira o título, a origem e a empresa do arquivo.",status:400};
    if (typeof valor === "string" && valor.trim()) dados[campo]=valor.trim();
  }
  if (corpo.dataBase !== undefined && corpo.dataBase !== "") {
    if (!donboyData(corpo.dataBase)) return {erro:"Informe uma data válida no formato ano-mês-dia.",status:400};
    dados.dataBase=corpo.dataBase;
  }
  return {dados};
}

function donboyPrepararLink(corpo:DonboyObjeto):{dados:DonboyObjeto}|{erro:string;status:number}{
  if (Object.keys(corpo).some(k=>!["acao","url","titulo","assunto","empresa"].includes(k))) return {erro:"O pedido contém campos não permitidos.",status:400};
  if (new TextEncoder().encode(JSON.stringify(corpo)).length>6000) return {erro:"O link e seu contexto excedem o limite permitido.",status:413};
  if (typeof corpo.url!=="string" || !corpo.url.trim() || corpo.url.length>2000 || /[\x00-\x1f\x7f]/.test(corpo.url)) return {erro:"Informe um link HTTPS de um arquivo do Drive ou de uma página pública.",status:400};
  let url:URL;
  try{url=new URL(corpo.url.trim());}catch{return {erro:"Informe um link válido.",status:400};}
  if (url.protocol!=="https:" || url.username || url.password || (url.port && url.port!=="443") ||
      /(?:^|\.)(?:localhost|local|internal)$/.test(url.hostname) || url.hostname.startsWith("[")) return {erro:"Use um endereço HTTPS público ou um arquivo do Drive.",status:400};
  // O servidor principal confere DNS, endereços de rede e redirecionamentos.
  // O proxy nunca abre o link nem encaminha sessão ou cookies do navegador.
  const dados:DonboyObjeto={url:url.href};
  for(const [campo,maximo] of [["titulo",200],["assunto",500],["empresa",80]] as const){
    const valor=corpo[campo];
    if(valor!==undefined&&(typeof valor!=="string"||valor.length>maximo||/[\x00-\x1f\x7f]/.test(valor)))return {erro:"Confira o título, o assunto e a empresa da referência.",status:400};
    if(typeof valor==="string"&&valor.trim())dados[campo]=valor.trim();
  }
  return {dados};
}

export async function donboyAcao(acao: string, corpo: unknown, sb: DonboyBanco, buscar: typeof fetch = fetch): Promise<Response> {
  if (!donboyObjeto(corpo) || !["donboy_painel","donboy_testar","donboy_memoria_listar","donboy_memoria_adicionar","donboy_memoria_link"].includes(acao)) return donboyJson({erro:"Ação inválida."},400);
  const teste = acao === "donboy_testar";
  const link = acao === "donboy_memoria_link";
  const memoria = acao === "donboy_memoria_listar" || acao === "donboy_memoria_adicionar" || link;
  const adicionar = acao === "donboy_memoria_adicionar" || link;
  let memoriaDados:DonboyObjeto={};
  if (memoria) {
    const preparado=link ? donboyPrepararLink(corpo) : donboyPrepararMemoria(corpo,adicionar);
    if ("erro" in preparado) return donboyJson({ok:false,erro:preparado.erro},preparado.status);
    memoriaDados=preparado.dados;
  }
  const permitidos = teste ? ["acao","comando","historico"] : ["acao"];
  if (!memoria && (Object.keys(corpo).some(k=>!permitidos.includes(k)) ||
      (teste && (typeof corpo.comando !== "string" || !corpo.comando.trim() || corpo.comando.length > 2000)))) {
    return donboyJson({erro:"Informe somente o comando, com até 2.000 caracteres."},400);
  }
  let historicoTeste: {papel:string;conteudo:string;em?:string}[]=[];
  if(teste&&corpo.historico!==undefined){
    if(!Array.isArray(corpo.historico)||corpo.historico.length>8||corpo.historico.length%2!==0)return donboyJson({erro:'Histórico de teste inválido.'},400);
    for(const [i,m] of corpo.historico.entries()){
      if(!donboyObjeto(m)||Object.keys(m).some(k=>!['papel','conteudo','em'].includes(k))||m.papel!==(i%2===0?'user':'assistant')||typeof m.conteudo!=='string'||!m.conteudo.trim()||m.conteudo.length>6000||m.em!==undefined&&(typeof m.em!=='string'||!Number.isFinite(Date.parse(m.em))))return donboyJson({erro:'Histórico de teste inválido.'},400);
      historicoTeste.push({papel:m.papel as string,conteudo:m.conteudo, ...(m.em?{em:m.em as string}:{})});
    }
    if(JSON.stringify(historicoTeste).length>15000)return donboyJson({erro:'Histórico de teste acima do limite.'},400);
  }
  let hash: string;
  try {
    const {data,error} = await sb.from("donboy_ponte").select("hash").limit(2);
    if (error || !Array.isArray(data) || data.length !== 1 || !/^[a-f0-9]{64}$/.test(String(data[0]?.hash ?? ""))) throw Error("ponte indisponível");
    hash = data[0].hash;
  } catch { return donboyJson({erro:"A ligação privada com o DON BOY precisa ser conferida. Nenhum comando foi enviado."},503); }
  const destino = memoria ? (link ? "memoria-link" : adicionar ? "memoria-adicionar" : "memoria-listar") : teste ? "testar-conversa" : "painel";
  const agora = new Date();
  const corpoRaw = JSON.stringify(memoria ? memoriaDados : teste ? {historico:[...historicoTeste,{papel:"user",conteudo:String(corpo.comando).trim(),em:agora.toISOString()}]} : {});
  const timestamp = String(Math.floor(agora.getTime()/1000));
  try {
    const encoder = new TextEncoder();
    const chave = await crypto.subtle.importKey("raw",encoder.encode(hash),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
    const mac = new Uint8Array(await crypto.subtle.sign("HMAC",chave,encoder.encode(timestamp+"\n"+destino+"\n"+corpoRaw)));
    const signature = Array.from(mac,b=>b.toString(16).padStart(2,"0")).join("");
    const resposta = await buscar(DONBOY_ENDPOINT+"?acao="+destino,{method:"POST",redirect:"error",
      headers:{"content-type":"application/json","x-donboy-painel-ts":timestamp,"x-donboy-painel-signature":signature},
      body:corpoRaw,signal:AbortSignal.timeout(teste || adicionar ? 90000 : 25000)});
    if (memoria && [400,413].includes(resposta.status)) {
      await resposta.body?.cancel();
      return donboyJson({ok:false,erro:resposta.status === 413 ? "O arquivo excede o limite permitido de tamanho ou páginas." : "Não foi possível aceitar o arquivo ou a consulta. Confira o formato e os dados informados."},resposta.status);
    }
    const dados = await donboyLerResposta(resposta,memoria ? 512*1024 : DONBOY_MAX_RESPOSTA);
    return donboyJson(memoria ? donboyProjetarMemoria(dados,adicionar) : teste ? donboyProjetarTeste(dados) : donboyProjetarPainel(dados));
  } catch {
    // Nenhum detalhe bruto da ponte/credencial ou HTML remoto vai ao navegador.
    if (adicionar) return donboyJson({ok:false,erro:"Não foi possível confirmar o processamento. Atualize a lista de fontes; reenviar o mesmo arquivo permite consultar o resultado sem duplicar a fonte."},502);
    return donboyJson({erro:"Não consegui concluir a consulta ao DON BOY. Nenhuma mensagem foi enviada ao Telegram; tente consultar novamente."},502);
  }
}
