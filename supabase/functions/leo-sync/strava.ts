// ============================================================================
// strava.ts — o Strava dentro da Central do Léo (14/09/2026)
//
// O QUE MORA AQUI: tudo que fala com a API do Strava. O index.ts só confere o
// crachá e despacha para cá toda `acao` que comece com "strava".
//
// AÇÕES (POST, com crachá no cabeçalho):
//   stravaLer            -> { atualizadoEm, atividades, gear, sync }
//                           (com {sincronizar:true} sincroniza antes, com prazo curto;
//                            sync = { ultima, ultimoErro, autorizado, emAndamento,
//                            sincronizou, precisaAutorizar, erro, aviso, parcial,
//                            orcamentoEsgotado, janela, novas, atualizadas, detalhes,
//                            chamadas15min, chamadasDia, resultado })
//   stravaSincronizar    -> { ok, janela, novas, atualizadas, detalhes, gear, chamadas,
//                             parcial, orcamentoEsgotado, precisaAutorizar, erro, aviso }
//   stravaAutorizarUrl   -> { url }   (o `state` da URL é o próprio crachá)
// GET (SEM crachá no cabeçalho — é o navegador voltando do Strava):
//   ?acao=stravaCallback&code=…&state=…   ou   /leo-sync/stravaCallback?code=…&state=…
//   O index.ts confere o `state` com tokenOk ANTES de chamar aqui; este módulo
//   troca o code por tokens e manda o navegador de volta para a Central.
//
// ONDE FICA CADA COISA:
//   leo_strava_atividades  uma linha por atividade (bruto do Strava; best_efforts das corridas)
//   leo_strava_gear        os tênis — id SEM a letra: o Strava manda "g12345", aqui é "12345"
//   leo_strava_cache       'token' (access_token com a validade do Strava) e os carimbos
//                          'hoje' (1 h), 'mes' e 'ano' (4 h) das janelas já lidas
//   leo_strava_sync        UMA linha: última sincronização, orçamento de chamadas, erro, trava
//   leo_config             chave 'strava_refresh' = o refresh_token (o único segredo que sobrevive)
//
// ORÇAMENTO DO STRAVA: 100 leituras a cada 15 min e 1.000 por dia, por aplicativo.
// Os contadores vivem em leo_strava_sync e são corrigidos pelo cabeçalho
// X-ReadRateLimit-Usage que o Strava devolve em toda resposta. 429 e 5xx
// esperam 1 s, 2 s e desistem na terceira. Quando o orçamento acaba, a
// sincronização PARA LIMPA, grava o que já conseguiu, e a próxima continua de
// onde parou (perf_lido=false marca o que ainda falta detalhar).
//
// NUNCA: logar token, devolver client_secret, mandar token para o navegador.
// ============================================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type Registro = Record<string, unknown>;
type Banco = SupabaseClient;

const API = "https://www.strava.com/api/v3";
const OAUTH = "https://www.strava.com/oauth";
// Para onde o navegador volta depois de autorizar (contrato com a tela).
const APP_URL = "https://leogpereira-afk.github.io/vida-leo/";
// activity:read_all: sem ele as atividades marcadas como privadas nem aparecem.
const ESCOPO = "read,activity:read_all,profile:read_all";

const LIMITE_15MIN = 100;
const LIMITE_DIA = 1000;
const RESERVA = 4;                 // sobra para a renovação de token da próxima rodada
const TENTATIVAS = 3;              // 429 / 5xx / rede: espera 1 s, 2 s e desiste
const PRAZO_MS = 50_000;           // parada limpa antes do teto de tempo da função
const PRAZO_CURTO_MS = 12_000;     // quando a tela pede "sincroniza e já me dá os dados"
const TRAVA_MIN = 3;               // trava mais velha que isto é de uma execução que morreu
const TTL_HOJE = 3600;             // janela curta: desde a última atividade conhecida − 2 dias
const TTL_MES = 4 * 3600;          // últimos 31 dias: pega nome/tênis editados depois
const TTL_ANO = 4 * 3600;          // desde 1º de janeiro: idem, e refaz os totais dos tênis
const POR_PAGINA = 200;            // máximo que o Strava aceita
const LOTE = 200;                  // linhas por upsert
const FUSO_CASA = "-03:00";        // Montes Claros: sem horário de verão desde 2019

// CORS igual ao index.ts (a resposta sai daqui pronta, sem passar por lá).
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "content-type": "application/json" } });

// ---------------------------------------------------------------- miúdos
const texto = (v: unknown): string => (v == null ? "" : String(v)).trim();
const numero = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const inteiro = (v: unknown): number | null => {
  const n = numero(v);
  return n == null ? null : Math.round(n);
};
const agoraIso = () => new Date().toISOString();
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

const CORRIDA = new Set(["Run", "TrailRun", "VirtualRun"]);
const ehCorrida = (tipo: unknown) => CORRIDA.has(texto(tipo));

// O Strava prefixa o gear: "g12345" (tênis), "b1234" (bike). A carga inicial
// e o estado do app usam só os dígitos — a mesma chave dos dois lados.
const gearCurto = (v: unknown): string | null => {
  const s = texto(v);
  if (!s) return null;
  return s.replace(/^[a-zA-Z]/, "") || null;
};

// start_date_local vem com "Z" no fim mas é o relógio LOCAL (a documentação do
// Strava avisa). Guardamos os 19 caracteres, sem fuso, como a carga inicial.
const inicioLocalDe = (v: unknown): string | null => {
  const m = texto(v).match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  return m ? m[0] : null;
};

// Nome que o Strava dá ao best effort -> tipo canônico que a tela conhece.
const TIPO_ESFORCO: Record<string, string> = {
  "400m": "Fastest400", "1/2 mile": "FastestHalfMile", "1k": "Fastest1k", "1 mile": "FastestMile",
  "2 mile": "Fastest2Mile", "5k": "Fastest5k", "10k": "Fastest10k", "15k": "Fastest15k",
  "10 mile": "Fastest10Mile", "20k": "Fastest20k", "Half-Marathon": "FastestHalfMarathon",
  "30k": "Fastest30k", "Marathon": "FastestMarathon", "50k": "Fastest50k",
};
// [{tipo, rotulo, seg}] — o tempo é o elapsed_time, que é o que o Strava exibe.
function esforcosDe(lista: unknown): Registro[] | null {
  if (!Array.isArray(lista)) return null;
  const out: Registro[] = [];
  for (const e of lista as Registro[]) {
    if (!e || typeof e !== "object") continue;
    const nome = texto(e.name);
    const seg = inteiro(e.elapsed_time) ?? inteiro(e.moving_time);
    if (!nome || seg == null || seg <= 0) continue;
    out.push({
      tipo: TIPO_ESFORCO[nome] ?? ("Fastest" + nome.replace(/[^0-9a-zA-Z]/g, "")),
      rotulo: nome,
      seg,
    });
  }
  return out;
}

// Erro com "código" para o laço decidir: parar limpo, pedir autorização, ou subir.
class ErroStrava extends Error {
  codigo: string;
  status: number;
  constructor(codigo: string, mensagem: string, status = 0) {
    super(mensagem);
    this.codigo = codigo;
    this.status = status;
  }
}
// orcamento/servidor/tempo: a rodada para e grava o que já tem — não é falha do código.
const paraLimpa = (e: unknown) =>
  e instanceof ErroStrava && (e.codigo === "orcamento" || e.codigo === "servidor" || e.codigo === "tempo");

function credenciais(): { id: string; secret: string } {
  const id = texto(Deno.env.get("STRAVA_CLIENT_ID"));
  const secret = texto(Deno.env.get("STRAVA_CLIENT_SECRET"));
  if (!id || !secret) {
    throw new ErroStrava("config", "Faltam STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET nas secrets da função leo-sync.");
  }
  return { id, secret };
}

// O redirect_uri usa SUB-CAMINHO, não query string: assim o Strava só acrescenta
// ?state=&code=&scope= a uma URL limpa. O index.ts aceita as duas formas.
function urlCallback(): string {
  const base = texto(Deno.env.get("SUPABASE_URL")).replace(/\/+$/, "");
  return base + "/functions/v1/leo-sync/stravaCallback";
}

// ---------------------------------------------------------------- cache
async function cacheLer(sb: Banco, chave: string): Promise<Registro | null> {
  const { data, error } = await sb.from("leo_strava_cache")
    .select("data, expires_at").eq("cache_key", chave).maybeSingle();
  if (error) throw new Error("leo_strava_cache: " + error.message);
  if (!data) return null;
  const vence = Date.parse(texto(data.expires_at));
  if (Number.isFinite(vence) && vence <= Date.now()) return null;
  return (data.data && typeof data.data === "object" ? data.data : null) as Registro | null;
}
async function cacheGravar(sb: Banco, chave: string, dados: unknown, expiraEm: Date): Promise<void> {
  const { error } = await sb.from("leo_strava_cache").upsert({
    cache_key: chave, data: dados, fetched_at: agoraIso(), expires_at: expiraEm.toISOString(),
  }, { onConflict: "cache_key" });
  if (error) throw new Error("leo_strava_cache: " + error.message);
}
const daquiA = (seg: number) => new Date(Date.now() + seg * 1000);

// ---------------------------------------------------------------- refresh token (leo_config)
interface Refresh { token: string; atleta: string | null; escopo: string | null }

async function refreshLer(sb: Banco): Promise<Refresh | null> {
  const { data, error } = await sb.from("leo_config").select("valor").eq("chave", "strava_refresh").maybeSingle();
  if (error) throw new Error("leo_config: " + error.message);
  if (!data) return null;
  const v = data.valor;
  // aceita o texto puro e o objeto {token, atleta, escopo, em}
  if (typeof v === "string") return v.trim() ? { token: v.trim(), atleta: null, escopo: null } : null;
  if (v && typeof v === "object") {
    const o = v as Registro;
    const token = texto(o.token);
    return token ? { token, atleta: texto(o.atleta) || null, escopo: texto(o.escopo) || null } : null;
  }
  return null;
}
async function refreshGravar(sb: Banco, token: string, atleta: string | null, escopo: string | null): Promise<void> {
  const { error } = await sb.from("leo_config").upsert({
    chave: "strava_refresh",
    valor: { token, atleta, escopo, em: agoraIso() },
    atualizado_em: agoraIso(),
  }, { onConflict: "chave" });
  if (error) throw new Error("leo_config: " + error.message);
}

// Access token: vale ~6 h. Fica em leo_strava_cache ('token') com a validade que
// o Strava deu, menos 5 min de folga. Vencido, renova pelo refresh — e o Strava
// pode devolver um refresh_token NOVO: gravar de volta, senão o antigo morre.
async function tokenAcesso(sb: Banco, forcarNovo = false): Promise<string> {
  if (!forcarNovo) {
    const c = await cacheLer(sb, "token");
    const t = c ? texto(c.access_token) : "";
    if (t) return t;
  }
  const r = await refreshLer(sb);
  if (!r) throw new ErroStrava("sem_autorizacao", "O Strava ainda não foi conectado a esta Central.");
  const { id, secret } = credenciais();
  const corpoPedido = new URLSearchParams({
    client_id: id, client_secret: secret, grant_type: "refresh_token", refresh_token: r.token,
  });
  let resp: Response;
  try {
    resp = await fetch(OAUTH + "/token", { method: "POST", body: corpoPedido, signal: AbortSignal.timeout(20_000) });
  } catch (_) {
    throw new ErroStrava("servidor", "Sem resposta do Strava ao renovar o token (rede ou tempo esgotado).");
  }
  const corpo = (await resp.json().catch(() => ({}))) as Registro;
  if (!resp.ok) {
    if (resp.status === 400 || resp.status === 401) {
      throw new ErroStrava("sem_autorizacao",
        "O Strava recusou a autorização guardada (HTTP " + resp.status + "). Conecte de novo.", resp.status);
    }
    throw new ErroStrava("servidor", "Strava não respondeu ao pedido de token (HTTP " + resp.status + ").", resp.status);
  }
  const acesso = texto(corpo.access_token);
  if (!acesso) throw new ErroStrava("servidor", "O Strava devolveu um token vazio.");
  const expira = numero(corpo.expires_at);   // época, em segundos
  const expiraEm = new Date((expira ? expira * 1000 : Date.now() + 3600e3) - 5 * 60e3);
  await cacheGravar(sb, "token", { access_token: acesso, expires_at: expira }, expiraEm);
  const novoRefresh = texto(corpo.refresh_token);
  if (novoRefresh && novoRefresh !== r.token) await refreshGravar(sb, novoRefresh, r.atleta, r.escopo);
  return acesso;
}

// ---------------------------------------------------------------- orçamento
interface Orcamento {
  c15: number; cDia: number; janela: string; dia: string; feitas: number; esgotado: boolean;
}
interface Sessao {
  sb: Banco; o: Orcamento; token: string; prazo: number; renovado: boolean; parada: ErroStrava | null;
}

// janela de 15 min alinhada ao relógio (:00 :15 :30 :45) e dia em UTC, como o Strava conta
const janelaAtual = () => new Date(Math.floor(Date.now() / 900e3) * 900e3).toISOString();
const diaAtual = () => new Date().toISOString().slice(0, 10);

function orcamentoDe(linha: Registro | null): Orcamento {
  const janela = janelaAtual(), dia = diaAtual();
  const mesmaJanela = !!linha && Date.parse(texto(linha.janela_inicio)) === Date.parse(janela);
  const mesmoDia = !!linha && texto(linha.dia) === dia;
  return {
    c15: mesmaJanela ? (inteiro(linha!.chamadas_15min) ?? 0) : 0,
    cDia: mesmoDia ? (inteiro(linha!.chamadas_dia) ?? 0) : 0,
    janela, dia, feitas: 0, esgotado: false,
  };
}
function rolaJanela(o: Orcamento): void {
  const j = janelaAtual(), d = diaAtual();
  if (j !== o.janela) { o.janela = j; o.c15 = 0; }
  if (d !== o.dia) { o.dia = d; o.cDia = 0; }
}
const temOrcamento = (o: Orcamento) => o.c15 < LIMITE_15MIN - RESERVA && o.cDia < LIMITE_DIA - RESERVA;

// O Strava conta do lado dele e diz quanto já foi: se o contador de lá estiver
// na frente do nosso, vale o de lá (outra execução pode ter morrido sem gravar).
function corrigePeloCabecalho(o: Orcamento, resp: Response): void {
  const uso = (resp.headers.get("x-readratelimit-usage") ?? resp.headers.get("x-ratelimit-usage") ?? "").split(",");
  const u15 = inteiro(uso[0]), uDia = inteiro(uso[1]);
  if (u15 != null && u15 > o.c15) o.c15 = u15;
  if (uDia != null && uDia > o.cDia) o.cDia = uDia;
}
async function gravaOrcamento(sb: Banco, o: Orcamento, extra: Registro = {}): Promise<void> {
  const { error } = await sb.from("leo_strava_sync").update({
    chamadas_15min: o.c15, janela_inicio: o.janela, chamadas_dia: o.cDia, dia: o.dia, ...extra,
  }).eq("id", 1);
  if (error) throw new Error("leo_strava_sync: " + error.message);
}

// UMA chamada de leitura ao Strava, com orçamento, backoff e renovação de token.
async function chamar(s: Sessao, caminho: string): Promise<unknown> {
  const o = s.o;
  rolaJanela(o);
  if (!temOrcamento(o)) {
    o.esgotado = true;
    throw new ErroStrava("orcamento", "Orçamento de chamadas do Strava esgotado por agora (" +
      o.c15 + "/" + LIMITE_15MIN + " em 15 min, " + o.cDia + "/" + LIMITE_DIA + " no dia). A próxima sincronização continua.");
  }
  let espera = 1000;
  for (let tentativa = 1; ; tentativa++) {
    o.c15++; o.cDia++; o.feitas++;
    let resp: Response | null = null;
    try {
      resp = await fetch(API + caminho, {
        headers: { authorization: "Bearer " + s.token },
        signal: AbortSignal.timeout(20_000),
      });
    } catch (_) {
      resp = null;
    }
    if (resp) corrigePeloCabecalho(o, resp);
    await gravaOrcamento(s.sb, o);
    if (resp && resp.ok) return await resp.json();
    const status = resp ? resp.status : 0;
    if (resp && status === 401) {
      // token vencido antes da hora (ou revogado): renova UMA vez e repete
      if (!s.renovado) {
        s.renovado = true;
        s.token = await tokenAcesso(s.sb, true);
        continue;
      }
      throw new ErroStrava("sem_autorizacao", "O Strava recusou o token mesmo depois de renovar. Conecte de novo.", 401);
    }
    if (resp && status === 404) throw new ErroStrava("nao_encontrado", "Não existe no Strava: " + caminho, 404);
    if (resp && status >= 400 && status < 500 && status !== 429) {
      const c = (await resp.json().catch(() => ({}))) as Registro;
      throw new ErroStrava("api", "Strava respondeu HTTP " + status +
        (texto(c.message) ? " (" + texto(c.message) + ")" : "") + " em " + caminho, status);
    }
    // 429, 5xx ou rede: espera 1 s, 2 s… e desiste na terceira
    if (tentativa >= TENTATIVAS) {
      if (status === 429) {
        o.c15 = Math.max(o.c15, LIMITE_15MIN);
        o.esgotado = true;
        await gravaOrcamento(s.sb, o);
        throw new ErroStrava("orcamento", "O Strava limitou as chamadas (429); a próxima sincronização continua de onde parou.", 429);
      }
      throw new ErroStrava("servidor",
        status ? "Strava fora do ar (HTTP " + status + ")." : "Sem resposta do Strava (rede ou tempo esgotado).", status);
    }
    await dormir(espera);
    espera *= 2;
  }
}

// ---------------------------------------------------------------- de-para Strava -> banco
// "Cidade, País" só quando a API mandar a CIDADE. `location_city` está
// descontinuado (vem null desde 2016) e o país sozinho ("Brazil") não pode
// substituir o "Montes Claros, Brazil" que a carga inicial guardou.
const localDe = (cidade: unknown, pais: unknown): string | null => {
  const c = texto(cidade);
  if (!c) return null;
  const p = texto(pais);
  return p ? c + ", " + p : c;
};

// Só as colunas da LISTA (SummaryActivity). calorias, best_efforts e perf_lido
// vêm do detalhe e ficam de fora de propósito: o upsert só mexe no que manda,
// e um resumo novo não pode apagar um detalhe já lido.
//
// O MESMO CUIDADO VALE PARA A PRÓPRIA LISTA: `local` (descontinuado), FC,
// watts, cadência e esforço só aparecem quando o relógio registrou. Mandar a
// chave com null APAGARIA o que a carga inicial ou a leitura do detalhe já
// tinham gravado -- foi assim que o "Montes Claros, Brazil" sumia na primeira
// sincronização. Por isso essas chaves só entram quando vem valor, e o lote é
// agrupado por conjunto de chaves antes do upsert (o PostgREST exige que todas
// as linhas de um mesmo pedido tenham exatamente as mesmas colunas).
function linhaDaAtividade(a: Registro): Registro {
  const l: Registro = {
    id: String(a.id),
    tipo: texto(a.sport_type) || texto(a.type) || null,
    nome: texto(a.name) || null,
    inicio_local: inicioLocalDe(a.start_date_local),
    inicio: texto(a.start_date) || null,
    gear_id: gearCurto(a.gear_id),
    distancia_m: numero(a.distance),
    moving_time: inteiro(a.moving_time),
    elapsed_time: inteiro(a.elapsed_time),
    elevacao: numero(a.total_elevation_gain),
    pr_count: inteiro(a.pr_count),
    achievement_count: inteiro(a.achievement_count),
    atualizado_em: agoraIso(),
  };
  const talvez: Registro = {
    cadencia: numero(a.average_cadence),
    esforco: inteiro(a.suffer_score),
    fc_media: numero(a.average_heartrate),
    fc_max: numero(a.max_heartrate),
    watts: numero(a.average_watts),
    vel_max: numero(a.max_speed),
    local: localDe(a.location_city, a.location_country),
  };
  for (const chave of Object.keys(talvez)) {
    if (talvez[chave] != null) l[chave] = talvez[chave];
  }
  return l;
}

// Grava as atividades em lotes, agrupando por conjunto de chaves: as linhas de
// um upsert precisam ter as mesmas colunas, e aqui elas variam de propósito
// (ver o comentário acima). Na prática saem dois ou três grupos -- corrida com
// frequência cardíaca, musculação sem -- não um pedido por atividade.
async function gravarAtividades(sb: Banco, linhas: Registro[]): Promise<void> {
  const grupos = new Map<string, Registro[]>();
  for (const l of linhas) {
    const assinatura = Object.keys(l).sort().join(",");
    const g = grupos.get(assinatura);
    if (g) g.push(l);
    else grupos.set(assinatura, [l]);
  }
  for (const g of grupos.values()) {
    for (let i = 0; i < g.length; i += LOTE) {
      const { error } = await sb.from("leo_strava_atividades").upsert(g.slice(i, i + LOTE), { onConflict: "id" });
      if (error) throw new Error("gravar atividades: " + error.message);
    }
  }
}

// O DETALHE (GET /activities/{id}) traz o que a lista não tem: calorias,
// best_efforts (corrida) e, às vezes, FC/watts/cadência que a lista omitiu.
function colunasDoDetalhe(d: Registro, tipo: string): Registro {
  const out: Registro = { perf_lido: true, atualizado_em: agoraIso() };
  const loc = localDe(d.location_city, d.location_country); if (loc) out.local = loc;
  const cal = numero(d.calories); if (cal != null) out.calorias = cal;
  const fc = numero(d.average_heartrate); if (fc != null) out.fc_media = fc;
  const fcm = numero(d.max_heartrate); if (fcm != null) out.fc_max = fcm;
  const w = numero(d.average_watts); if (w != null) out.watts = w;
  const cad = numero(d.average_cadence); if (cad != null) out.cadencia = cad;
  const esf = inteiro(d.suffer_score); if (esf != null) out.esforco = esf;
  const vm = numero(d.max_speed); if (vm != null) out.vel_max = vm;
  const g = gearCurto(d.gear_id); if (g) out.gear_id = g;
  if (ehCorrida(tipo)) out.best_efforts = esforcosDe(d.best_efforts);
  return out;
}

function linhaDoGear(g: Registro, curto: string, cru: string): Registro {
  const marca = texto(g.brand_name), modelo = texto(g.model_name), nome = texto(g.name);
  // `nickname` quando o Strava manda; senão `name`, desde que não seja só "marca modelo"
  const soMarcaModelo = nome.toLowerCase() === (marca + " " + modelo).trim().toLowerCase();
  const apelido = texto(g.nickname) || (nome && !soMarcaModelo ? nome : "");
  return {
    gear_id: gearCurto(g.id) ?? curto,
    strava_id: texto(g.id) || cru,
    marca: marca || null,
    modelo: modelo || null,
    nome: apelido || null,
    aposentado_strava: g.retired === true,
    distancia_m: numero(g.distance),
    atualizado_em: agoraIso(),
  };
}

// ---------------------------------------------------------------- banco: apoio
async function lerSync(sb: Banco): Promise<Registro | null> {
  const { data, error } = await sb.from("leo_strava_sync").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error("leo_strava_sync: " + error.message);
  return (data ?? null) as Registro | null;
}

// A trava é a própria linha: duas sincronizações juntas gastariam o orçamento
// em dobro e contariam errado. Cada tentativa é UM update condicional — o
// Postgres serializa; quem chega segundo vê a trava ocupada e desiste.
async function travar(sb: Banco): Promise<boolean> {
  const agora = new Date();
  const { error: e0 } = await sb.from("leo_strava_sync").upsert({ id: 1 }, { onConflict: "id", ignoreDuplicates: true });
  if (e0) throw new Error("leo_strava_sync: " + e0.message);
  const livre = await sb.from("leo_strava_sync").update({ em_andamento: agora.toISOString() })
    .eq("id", 1).is("em_andamento", null).select("id");
  if (livre.error) throw new Error("leo_strava_sync: " + livre.error.message);
  if (livre.data && livre.data.length) return true;
  // trava velha = execução que morreu no meio; toma o lugar dela
  const limite = new Date(agora.getTime() - TRAVA_MIN * 60e3).toISOString();
  const velha = await sb.from("leo_strava_sync").update({ em_andamento: agora.toISOString() })
    .eq("id", 1).lt("em_andamento", limite).select("id");
  if (velha.error) throw new Error("leo_strava_sync: " + velha.error.message);
  return !!(velha.data && velha.data.length);
}
async function destravar(sb: Banco, o: Orcamento, extra: Registro): Promise<void> {
  try {
    await sb.from("leo_strava_sync").update({
      em_andamento: null, chamadas_15min: o.c15, janela_inicio: o.janela, chamadas_dia: o.cDia, dia: o.dia, ...extra,
    }).eq("id", 1);
  } catch (_) {
    // a trava vence sozinha em TRAVA_MIN; os contadores voltam pelo cabeçalho do Strava
  }
}

// Última atividade conhecida (em ms). Linha antiga sem `inicio` cai no relógio local + fuso da casa.
async function cursorDe(sb: Banco): Promise<number | null> {
  const { data, error } = await sb.from("leo_strava_atividades").select("inicio, inicio_local")
    .order("inicio", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  if (error) throw new Error("leo_strava_atividades: " + error.message);
  if (!data) return null;
  let t = Date.parse(texto(data.inicio));
  if (!Number.isFinite(t)) t = Date.parse(texto(data.inicio_local) + FUSO_CASA);
  return Number.isFinite(t) && t > 0 ? t : null;
}
// 1º de janeiro (UTC) do ano corrente, com um dia de folga para o fuso local
const inicioDoAno = () => Date.UTC(new Date().getUTCFullYear(), 0, 1) - 86400e3;

async function idsExistentes(sb: Banco, ids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  for (let i = 0; i < ids.length; i += LOTE) {
    const { data, error } = await sb.from("leo_strava_atividades").select("id").in("id", ids.slice(i, i + LOTE));
    if (error) throw new Error("leo_strava_atividades: " + error.message);
    for (const l of (data ?? []) as Registro[]) out.add(String(l.id));
  }
  return out;
}

// ---------------------------------------------------------------- listagem paginada
async function listar(s: Sessao, afterSeg: number): Promise<{ itens: Registro[]; completo: boolean }> {
  const itens: Registro[] = [];
  for (let pagina = 1; pagina <= 40; pagina++) {
    if (Date.now() > s.prazo) {
      s.parada = new ErroStrava("tempo", "Parou pelo tempo; a próxima sincronização continua.");
      return { itens, completo: false };
    }
    let lote: unknown;
    try {
      lote = await chamar(s, "/athlete/activities?after=" + afterSeg + "&per_page=" + POR_PAGINA + "&page=" + pagina);
    } catch (e) {
      if (paraLimpa(e)) { s.parada = e as ErroStrava; return { itens, completo: false }; }
      throw e;
    }
    if (!Array.isArray(lote)) return { itens, completo: true };
    itens.push(...(lote as Registro[]));
    if (lote.length < POR_PAGINA) return { itens, completo: true };
  }
  return { itens, completo: false };
}

// ---------------------------------------------------------------- sincronizar
interface Resultado {
  ok: boolean; janela: string; novas: number; atualizadas: number; detalhes: number; gear: number;
  chamadas: number; parcial: boolean; orcamentoEsgotado: boolean; precisaAutorizar: boolean;
  emAndamento: boolean; erro: string | null; aviso: string | null;
}

async function sincronizar(sb: Banco, corpo: Registro, prazoMs = PRAZO_MS): Promise<Resultado> {
  const forcar = corpo.forcar === true;
  const r: Resultado = {
    ok: true, janela: "", novas: 0, atualizadas: 0, detalhes: 0, gear: 0, chamadas: 0,
    parcial: false, orcamentoEsgotado: false, precisaAutorizar: false, emAndamento: false, erro: null, aviso: null,
  };
  if (!(await refreshLer(sb))) {
    r.ok = false; r.precisaAutorizar = true; r.erro = "O Strava ainda não foi conectado a esta Central.";
    return r;
  }
  if (!(await travar(sb))) {
    r.emAndamento = true; r.aviso = "Já tem uma sincronização rodando; tente de novo em instantes.";
    return r;
  }

  // os contadores são lidos DEPOIS da trava (ninguém mais mexe neles) e
  // dentro do try: um tropeço no banco aqui não pode deixar a trava presa
  const s: Sessao = { sb, o: orcamentoDe(null), token: "", prazo: Date.now() + prazoMs, renovado: false, parada: null };
  const paraTempo = () => {
    if (Date.now() <= s.prazo) return false;
    s.parada = new ErroStrava("tempo", "Parou pelo tempo; a próxima sincronização continua.");
    return true;
  };
  // tênis vistos em atividade nova (curto -> cru): são os que precisam de GET /gear
  const gearNovo = new Map<string, string>();
  const anota = (cru: string) => { const curto = gearCurto(cru); if (cru && curto) gearNovo.set(curto, cru); };

  try {
    s.o = orcamentoDe(await lerSync(sb));
    s.token = await tokenAcesso(sb);

    /* ---- 1. A LISTA. Três janelas, a mais larga que estiver vencida:
       'ano' (4 h) desde 1º de janeiro, 'mes' (4 h) últimos 31 dias, 'hoje'
       (1 h) desde a última atividade conhecida − 2 dias. A larga cobre a
       estreita, por isso uma listagem só. */
    const [cHoje, cMes, cAno] = await Promise.all([cacheLer(sb, "hoje"), cacheLer(sb, "mes"), cacheLer(sb, "ano")]);
    const cursor = await cursorDe(sb);
    const desdeCursor = cursor == null ? 0 : cursor - 2 * 86400e3;   // banco vazio = desde o começo
    let desde: number | null = null;
    if (forcar || !cAno) { r.janela = "ano"; desde = Math.min(inicioDoAno(), desdeCursor); }
    else if (!cMes) { r.janela = "mes"; desde = Math.min(Date.now() - 31 * 86400e3, desdeCursor); }
    else if (!cHoje) { r.janela = "hoje"; desde = desdeCursor; }

    if (desde != null) {
      const { itens, completo } = await listar(s, Math.max(0, Math.floor(desde / 1000)));
      const validos = itens.filter((a) => a && typeof a === "object" && a.id != null);
      if (validos.length) {
        const existentes = await idsExistentes(sb, validos.map((a) => String(a.id)));
        const linhas: Registro[] = [];
        for (const a of validos) {
          linhas.push(linhaDaAtividade(a));
          if (existentes.has(String(a.id))) r.atualizadas++;
          else { r.novas++; anota(texto(a.gear_id)); }
        }
        await gravarAtividades(sb, linhas);
      }
      if (completo) {
        const carimbo = { em: agoraIso(), janela: r.janela, n: validos.length };
        await cacheGravar(sb, "hoje", carimbo, daquiA(TTL_HOJE));
        if (r.janela !== "hoje") await cacheGravar(sb, "mes", carimbo, daquiA(TTL_MES));
        if (r.janela === "ano") await cacheGravar(sb, "ano", carimbo, daquiA(TTL_ANO));
      } else {
        r.parcial = true;
      }
    }

    /* ---- 2. OS DETALHES. perf_lido=false é a fila: corrida ≥ 1 km (best
       efforts) primeiro, depois quem ainda não tem calorias. Cada uma é uma
       chamada; o orçamento manda quantas cabem nesta rodada. */
    if (!s.parada) {
      const { data: pend, error: ePend } = await sb.from("leo_strava_atividades")
        .select("id, tipo, distancia_m, calorias").eq("perf_lido", false)
        .order("inicio", { ascending: false, nullsFirst: false }).limit(1000);
      if (ePend) throw new Error("pendentes: " + ePend.message);
      const prioridade = (p: Registro) => ehCorrida(p.tipo) && (numero(p.distancia_m) ?? 0) >= 1000;
      const fila = ((pend ?? []) as Registro[])
        .filter((p) => prioridade(p) || p.calorias == null)
        .sort((a, b) => Number(prioridade(b)) - Number(prioridade(a)));
      for (const p of fila) {
        if (paraTempo()) break;
        const id = String(p.id);
        let d: Registro;
        try {
          d = (await chamar(s, "/activities/" + encodeURIComponent(id) + "?include_all_efforts=false")) as Registro;
        } catch (e) {
          if (e instanceof ErroStrava && (e.codigo === "nao_encontrado" || e.status === 403)) {
            // apagada no Strava (404) ou fora do escopo autorizado (403): não
            // insiste — senão a mesma linha derrubaria toda rodada — e não apaga daqui
            await sb.from("leo_strava_atividades").update({ perf_lido: true, atualizado_em: agoraIso() }).eq("id", id);
            continue;
          }
          if (paraLimpa(e)) { s.parada = e as ErroStrava; break; }
          throw e;
        }
        const { error } = await sb.from("leo_strava_atividades").update(colunasDoDetalhe(d, texto(p.tipo))).eq("id", id);
        if (error) throw new Error("gravar detalhe: " + error.message);
        r.detalhes++;
        anota(texto(d.gear_id));
      }
    }

    /* ---- 3. OS TÊNIS. A rodagem oficial (distance) muda a cada corrida, por
       isso todo tênis de atividade nova é relido; nas janelas largas (4 h),
       todos os que o banco conhece. */
    if (!s.parada) {
      const { data: gearDb, error: eGear } = await sb.from("leo_strava_gear").select("gear_id, strava_id");
      if (eGear) throw new Error("leo_strava_gear: " + eGear.message);
      const alvo = new Map<string, string>(gearNovo);
      if (r.janela === "mes" || r.janela === "ano") {
        for (const g of (gearDb ?? []) as Registro[]) {
          const id = texto(g.gear_id);
          if (id && !alvo.has(id)) alvo.set(id, texto(g.strava_id) || "g" + id);   // sem strava_id = tênis (carga inicial)
        }
      }
      for (const [curto, cru] of alvo) {
        if (paraTempo()) break;
        let g: Registro;
        try {
          g = (await chamar(s, "/gear/" + encodeURIComponent(cru))) as Registro;
        } catch (e) {
          if (e instanceof ErroStrava && (e.codigo === "nao_encontrado" || e.status === 403)) continue;
          if (paraLimpa(e)) { s.parada = e as ErroStrava; break; }
          throw e;
        }
        const { error } = await sb.from("leo_strava_gear").upsert(linhaDoGear(g, curto, cru), { onConflict: "gear_id" });
        if (error) throw new Error("gravar gear: " + error.message);
        r.gear++;
      }
    }

    if (s.parada) {
      r.parcial = true;
      if (s.parada.codigo === "orcamento") { r.orcamentoEsgotado = true; r.aviso = s.parada.message; }
      else if (s.parada.codigo === "tempo") r.aviso = s.parada.message;
      else { r.ok = false; r.erro = s.parada.message; }
    }
  } catch (e) {
    if (e instanceof ErroStrava) {
      if (e.codigo === "sem_autorizacao") { r.ok = false; r.precisaAutorizar = true; r.erro = e.message; }
      else if (e.codigo === "orcamento") { r.orcamentoEsgotado = true; r.parcial = true; r.aviso = e.message; }
      else { r.ok = false; r.erro = e.message; }
    } else {
      r.ok = false; r.erro = (e as Error)?.message ?? String(e);
    }
  } finally {
    r.chamadas = s.o.feitas;
    const extra: Registro = { ultimo_erro: r.erro ?? r.aviso ?? null };
    if (!r.erro) extra.ultima = agoraIso();
    await destravar(sb, s.o, extra);
  }
  return r;
}

// ---------------------------------------------------------------- ler (o que a tela consome)
const COLUNAS_TELA = "id, tipo, nome, inicio_local, gear_id, distancia_m, moving_time, elapsed_time, elevacao, " +
  "calorias, cadencia, esforco, pr_count, achievement_count, fc_media, fc_max, watts, vel_max, local, best_efforts";

function atividadeParaTela(l: Registro): Registro {
  return {
    id: String(l.id),
    tipo: texto(l.tipo) || null,
    nome: texto(l.nome) || null,
    inicioLocal: texto(l.inicio_local) || null,
    gearId: texto(l.gear_id) || null,
    distanciaM: numero(l.distancia_m),
    movingTime: inteiro(l.moving_time),
    elapsedTime: inteiro(l.elapsed_time),
    elevacao: numero(l.elevacao),
    calorias: numero(l.calorias),
    cadencia: numero(l.cadencia),
    esforco: inteiro(l.esforco),
    prCount: inteiro(l.pr_count),
    achievementCount: inteiro(l.achievement_count),
    fcMedia: numero(l.fc_media),
    fcMax: numero(l.fc_max),
    watts: numero(l.watts),
    velMax: numero(l.vel_max),
    local: texto(l.local) || null,
    bestEfforts: Array.isArray(l.best_efforts) ? l.best_efforts : null,
  };
}
function gearParaTela(g: Registro): Registro {
  return {
    gearId: texto(g.gear_id),
    marca: texto(g.marca) || null,
    modelo: texto(g.modelo) || null,
    nome: texto(g.nome) || null,
    aposentadoStrava: g.aposentado_strava === true,
    distanciaM: numero(g.distancia_m),
  };
}

/* Relato vazio, para quando a sincronização nem chegou a começar (um tropeço no
   banco antes da trava). A tela lê sempre os mesmos campos. */
function relatoVazio(erro: string | null): Resultado {
  return {
    ok: erro == null, janela: "", novas: 0, atualizadas: 0, detalhes: 0, gear: 0, chamadas: 0,
    parcial: false, orcamentoEsgotado: false, precisaAutorizar: false, emAndamento: false,
    erro, aviso: null,
  };
}

async function ler(sb: Banco, corpo: Registro): Promise<Response> {
  /* A TELA PEDE "atualiza primeiro" com {sincronizar:true} (é o clique em
     Atualizar e a primeira carga do dia): sincroniza com prazo curto e o que
     não couber fica para a próxima rodada. O relato volta dentro de `sync` --
     sem ele a tela não teria como dizer "precisa conectar", "deu erro" ou
     "veio só parte". */
  let sync: Resultado | null = null;
  if (corpo.sincronizar === true) {
    try {
      sync = await sincronizar(sb, corpo, PRAZO_CURTO_MS);
    } catch (e) {
      // sincronizar já trata sozinha o que é do Strava; o que escapa daqui é
      // tropeço de banco. Não pode impedir a LEITURA: a tela mostra o aviso e
      // os dados que já existem.
      sync = relatoVazio(e instanceof Error ? e.message : String(e));
    }
  }

  // Paginado: o PostgREST devolve no máximo 1000 linhas por pedido, SEM avisar.
  const atividades: Registro[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await sb.from("leo_strava_atividades").select(COLUNAS_TELA)
      .order("inicio_local", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false }).range(de, de + 999);
    if (error) return json({ erro: error.message }, 500);
    for (const l of (data ?? []) as Registro[]) atividades.push(atividadeParaTela(l));
    if (!data || data.length < 1000) break;
  }
  const gearRes = await sb.from("leo_strava_gear").select("*").order("distancia_m", { ascending: false, nullsFirst: false });
  if (gearRes.error) return json({ erro: gearRes.error.message }, 500);
  const linha = await lerSync(sb);
  const autorizado = !!(await refreshLer(sb));
  /* O que a tela mostra fica NO PRIMEIRO NÍVEL de `sync` (precisaAutorizar,
     erro, aviso, parcial, novas, atualizadas): assim a linha de sincronização
     não precisa saber se houve rodada agora ou não. `resultado` continua
     trazendo o relato inteiro para quem quiser o detalhe. */
  return json({
    atualizadoEm: linha ? (texto(linha.ultima) || null) : null,
    atividades,
    gear: ((gearRes.data ?? []) as Registro[]).map(gearParaTela),
    sync: {
      ultima: linha ? (texto(linha.ultima) || null) : null,
      ultimoErro: linha ? (texto(linha.ultimo_erro) || null) : null,
      autorizado,
      emAndamento: !!(linha && linha.em_andamento) || (sync ? sync.emAndamento : false),
      chamadas15min: linha ? (inteiro(linha.chamadas_15min) ?? 0) : 0,
      chamadasDia: linha ? (inteiro(linha.chamadas_dia) ?? 0) : 0,
      // houve tentativa de sincronizar NESTA chamada?
      sincronizou: sync != null,
      // sem autorização o resto nem é tentado: a tela precisa do botão Conectar
      precisaAutorizar: sync ? sync.precisaAutorizar : !autorizado,
      erro: sync ? sync.erro : null,
      aviso: sync ? sync.aviso : null,
      parcial: sync ? sync.parcial : false,
      orcamentoEsgotado: sync ? sync.orcamentoEsgotado : false,
      janela: sync ? sync.janela : "",
      novas: sync ? sync.novas : 0,
      atualizadas: sync ? sync.atualizadas : 0,
      detalhes: sync ? sync.detalhes : 0,
      resultado: sync,
    },
  });
}

// ---------------------------------------------------------------- OAuth
// A URL de autorização. O `state` é o crachá de quem pediu: o Strava devolve o
// state intacto no retorno, e é ele que prova que foi o dono quem começou.
function autorizarUrl(c: Registro): Response {
  /* O index.ts põe em `c.state` um crachá CURTO (10 min, carimbado
     uso:"strava-state") feito só para esta ida e volta: o state viaja na URL
     até o Strava e fica em histórico de navegador e em log de terceiro — o
     crachá de 180 dias NÃO pode ir junto, e por isso não há aqui nenhuma volta
     para o cabeçalho Authorization. Sem o state curto, a URL não é montada. */
  const state = texto(c.state);
  if (!state) return json({ erro: "sem crachá" }, 401);
  const { id } = credenciais();
  const u = new URL(OAUTH + "/authorize");
  u.searchParams.set("client_id", id);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", urlCallback());
  u.searchParams.set("approval_prompt", "auto");
  u.searchParams.set("scope", ESCOPO);
  u.searchParams.set("state", state);
  return json({ url: u.toString(), callback: urlCallback(), escopo: ESCOPO });
}

// Volta para a Central. Sucesso = exatamente #strava; problema = ?strava_erro=<motivo>#strava.
const voltar = (motivo: string) =>
  Response.redirect(APP_URL + (motivo ? "?strava_erro=" + encodeURIComponent(motivo) : "") + "#strava", 302);

// GET de retorno do Strava (o index.ts JÁ conferiu o state com tokenOk).
async function callback(sb: Banco, url: URL): Promise<Response> {
  const code = texto(url.searchParams.get("code"));
  const recusa = texto(url.searchParams.get("error"));
  const escopo = texto(url.searchParams.get("scope"));
  if (recusa || !code) return voltar("negado");
  let cred: { id: string; secret: string };
  try { cred = credenciais(); } catch (_) { return voltar("config"); }

  let resp: Response;
  try {
    resp = await fetch(OAUTH + "/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: cred.id, client_secret: cred.secret, code, grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (_) {
    return voltar("rede");
  }
  const corpo = (await resp.json().catch(() => ({}))) as Registro;
  const refresh = texto(corpo.refresh_token);
  if (!resp.ok || !refresh) return voltar("troca" + (resp.ok ? "" : "-" + resp.status));

  const atleta = corpo.athlete && typeof corpo.athlete === "object" ? texto((corpo.athlete as Registro).id) : "";
  try {
    await refreshGravar(sb, refresh, atleta || null, escopo || null);
    const expira = numero(corpo.expires_at);
    const acesso = texto(corpo.access_token);
    if (acesso) {
      await cacheGravar(sb, "token", { access_token: acesso, expires_at: expira },
        new Date((expira ? expira * 1000 : Date.now() + 3600e3) - 5 * 60e3));
    }
    // limpa o "não autorizado" que tenha ficado registrado e libera a primeira sincronização
    await sb.from("leo_strava_sync").upsert({ id: 1 }, { onConflict: "id", ignoreDuplicates: true });
    await sb.from("leo_strava_sync").update({ ultimo_erro: null }).eq("id", 1);
    await sb.from("leo_strava_cache").delete().in("cache_key", ["hoje", "mes", "ano"]);
  } catch (_) {
    return voltar("banco");
  }
  // autorizou, mas sem activity:read_all as atividades privadas ficam de fora
  return voltar(escopo && !escopo.includes("activity:read_all") ? "escopo" : "");
}

// ---------------------------------------------------------------- porta única
export async function stravaAcao(acao: string, corpo: Registro, sb: Banco, req: Request, url?: URL): Promise<Response> {
  const u = url ?? new URL(req.url);
  const c = corpo && typeof corpo === "object" ? corpo : {};
  try {
    if (acao === "stravaLer") return await ler(sb, c);
    if (acao === "stravaSincronizar") return json(await sincronizar(sb, c));
    if (acao === "stravaAutorizarUrl") return autorizarUrl(c);
    if (acao === "stravaCallback") return await callback(sb, u);
    return json({ erro: "ação inválida" }, 400);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    return json({ erro: m }, 500);
  }
}
