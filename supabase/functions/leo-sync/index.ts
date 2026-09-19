// ============================================================================
// leo-sync — Central do Leo (substitui netlify/functions/sync.mjs)
//
// O CONTRATO:
//   POST {acao:'login', senha}                       -> { token }
//   POST {acao:'trocar', senhaAtual, senhaNova} +Bearer -> { ok: true }
//   GET  (Bearer)                                    -> { mt, dados } | { mt: 0, dados: null }
//   PUT  (Bearer) { dados }                          -> { mt }
//   POST {acao:"strava…"} +Bearer                       -> strava.ts (ler, sincronizar, autorizarUrl)
//   GET  ?acao=stravaCallback&code&state (sem Bearer)   -> strava.ts (volta do OAuth; state = crachá CURTO)
//
// De-para: store "central" chave "estado" -> tabela leo_estado (uma linha so).
//
// SENHA: mora no banco (leo_config, chave "senha") como PBKDF2 — trocavel de
// dentro do app. A secret LEO_APP_SENHA vira so o bootstrap: vale enquanto
// nenhuma senha foi gravada no banco; depois da primeira troca, quem manda e o
// banco. Mesmo desenho dos outros sistemas (a senha "master" e so a inicial).
//
// PROJETO COMPARTILHADO: prefixo obrigatorio no nome da function e das tabelas.
//
// verify_jwt = false: quem autoriza e o token HMAC proprio, conferido aqui
// dentro. O preflight CORS tambem chega sem credencial nenhuma.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
// O Strava mora em strava.ts: aqui só se confere o crachá e se despacha (14/09/2026).
import { stravaAcao } from "./strava.ts";
// O Google mora em google.ts: a autorização fica no servidor e a tela recebe só um crachá curto (14/09/2026).
import { googleAcao } from "./google.ts";
// O calendário da empresa entra pela porta da PRÓPRIA Central (15/09/2026):
// a porta do Painel exige crachá do Painel, e crachá é por sistema.
import { empresaAcao } from "./empresa.ts";
import { lerBancosGestao } from "./bancos.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SESSION_SECRET = Deno.env.get("LEO_SESSION_SECRET") ?? "";
const DIAS = 180;
/* Crachá CURTO, só para administrar os sistemas da empresa.
   O de 180 dias continua existindo para a sessão do app pessoal (é conforto, e
   o app é só do Léo). Mas a equipe-auth passou a recusar crachá que nasça para
   durar mais de 12h: administrar a empresa inteira com um token de meio ano
   copiado do navegador é risco de outra ordem. */
const HORAS_ADMIN = 12;

// Chave publica, para CONFERIR senha no Supabase Auth (signInWithPassword nao
// aceita a de servico). O prefixo SUPABASE_ e reservado pela plataforma, por
// isso o nome proprio.
const ANON_KEY = Deno.env.get("ANON_KEY_IMPRESILK") ?? "";
// De quem e este app. A senha dele passa a ser a MESMA da pessoa nos sistemas.
const DONO = (Deno.env.get("LEO_USUARIO") ?? "leonardo").toLowerCase();

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/* UMA SENHA SO.
   Este app tinha senha propria (LEO_APP_SENHA, depois um PBKDF2 em leo_config),
   separada da que o Leo usa nos sistemas. Duas senhas para a mesma pessoa e uma
   que envelhece: troca-se uma, esquece-se a outra, e a mais velha continua
   valendo em algum lugar.
   Agora a senha dos sistemas abre aqui tambem: a conta dele em `acesso_conta`
   aponta para uma identidade do Supabase Auth, e e ela que confere.
   A senha antiga continua aceita como segunda tentativa -- tirar a saida de
   emergencia de um app pessoal, no mesmo dia em que se muda o login dele, e
   pedir para ficar do lado de fora. */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "content-type": "application/json" } });

// ---------------------------------------------------------------- sessao
// Mesmo esquema do original: o token e "<expira>.<hmac(expira)>". Nao guarda
// sessao em lugar nenhum -- a assinatura e que prova que o servidor emitiu.

const enc = new TextEncoder();

async function assina(exp: number): Promise<string> {
  const chave = await crypto.subtle.importKey(
    "raw", enc.encode(SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", chave, enc.encode(String(exp)));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Comparacao em tempo constante: comparar com === vazaria, pelo tempo de
// resposta, quantos caracteres bateram. Vale para a senha e para o mac.
function igual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

/* Crachá CURTO, para administrar os sistemas da empresa.
   O de 180 dias continua servindo à sessão deste app pessoal — é conforto, e o
   app é só do Léo. Mas a equipe-auth passou a RECUSAR crachá que nasça para
   durar mais que 12h: administrar os sete sistemas com um token de meio ano
   copiado de um navegador é risco de outra ordem. Este aqui é pedido na hora,
   com a sessão longa como prova de que a pessoa já entrou. */
const novoTokenAdmin = async () => {
  const exp = Date.now() + HORAS_ADMIN * 3600e3;
  return exp + "." + (await assina(exp));
};

/* A CENTRAL VIROU UM SISTEMA COMO OS OUTROS (11/08/2026).
   Ela tinha sessao propria (um HMAC `<expira>.<hmac>`), diferente do cracha que
   os outros seis usam. Ser diferente era o problema: senha propria, entrada
   propria, e ela de fora da entrada unica.
   Agora ela tambem aceita o CRACHA -- mesmo formato, mesmo segredo, com
   `sis === "central"`. Assim entrar no Painel ja abre a Central, e a senha e a
   mesma. O HMAC antigo continua valendo enquanto a virada assenta. */
const JWT_EQUIPE = Deno.env.get("EQUIPE_JWT_SECRET") ?? "";

/* CADA CRACHÁ PARA A SUA PORTA (14/09/2026).
   Este conferidor devolve o PAYLOAD em vez de um sim/não, porque quem chama
   precisa olhar o campo `uso`. São dois crachás com o mesmo formato e o mesmo
   segredo, mas com finalidades diferentes:
     - o da SESSÃO (180 dias, sem `uso`): abre o estado da Central, as obras e
       as ações do Strava;
     - o do `state` do OAuth (10 min, `uso:"strava-state"`): viaja na URL até o
       Strava e volta, ficando no histórico do navegador e no log de terceiros.
   Misturar os dois é o buraco: o que passeia pela URL abriria tudo, e o de meio
   ano poderia ser colado num link de autorização montado à mão. */
interface Cracha {
  uso: string;
  exp: number;
  iat: number | null;
}

async function crachaPayload(token: string): Promise<Cracha | null> {
  if (!JWT_EQUIPE || !token) return null;
  const partes = token.split(".");
  if (partes.length !== 3) return null;
  try {
    const chave = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(JWT_EQUIPE),
      { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const b64url = (t: string) => {
      t = t.replace(/-/g, "+").replace(/_/g, "/");
      while (t.length % 4) t += "=";
      const bin = atob(t);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    };
    const ok = await crypto.subtle.verify(
      "HMAC", chave, b64url(partes[2]),
      new TextEncoder().encode(`${partes[0]}.${partes[1]}`));
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(b64url(partes[1])));
    if (typeof p.exp !== "number" || !Number.isFinite(p.exp) || p.exp <= Math.floor(Date.now() / 1000)) return null;
    if (p.sis !== "central") return null;
    return {
      uso: typeof p.uso === "string" ? p.uso : "",
      exp: p.exp,
      iat: typeof p.iat === "number" && Number.isFinite(p.iat) ? p.iat : null,
    };
  } catch {
    return null;
  }
}

// O carimbo do crachá que só serve de `state`, e o quanto ele pode durar.
const USO_STATE = "strava-state";
const STATE_MAX_SEG = 15 * 60;   // crachaCurto(10 min) + folga de relógio

/* SÓ O CRACHÁ (11/08/2026).
   A sessão desta Central era um HMAC próprio, de formato diferente do dos
   outros sete. Ela virou um sistema como os demais: entra pela entrada única e
   guarda o crachá padrão. O formato antigo saiu -- deixar as duas portas
   abertas é manter viva justamente a diferença que a virada existiu para
   acabar. Quem tiver sessão velha no navegador cai na tela de login e entra com
   a senha de sempre. */
async function tokenOk(t: string | null): Promise<boolean> {
  if (!t) return false;
  const p = await crachaPayload(t);
  /* O crachá do `state` NÃO abre porta nenhuma aqui: ele passeia pela URL do
     Strava e fica registrado em histórico e em log de terceiro. */
  return !!p && p.uso !== USO_STATE;
}

/* O `state` que volta do Strava: só vale o crachá curto feito para esta ida e
   volta. O de 180 dias é recusado mesmo válido, e um crachá curto forjado com
   validade longa também (iat/exp precisam caber em STATE_MAX_SEG). */
async function stateOk(t: string | null): Promise<boolean> {
  if (!t) return false;
  const p = await crachaPayload(t);
  if (!p || p.uso !== USO_STATE) return false;
  if (p.iat == null || p.exp - p.iat > STATE_MAX_SEG) return false;
  return true;
}

/* Crachá CURTO (minutos) só para o `state` do OAuth do Strava: ele viaja na URL
   até o Strava e volta -- fica em histórico de navegador e em log de terceiro,
   e o crachá de 180 dias não pode ir junto. Mesmo formato (JWT HS256, sis
   "central") e mesmo segredo, mas com `uso: "strava-state"` — é esse carimbo
   que o `stateOk` exige na volta e que o `tokenOk` recusa nas outras portas. */
async function crachaCurto(minutos: number): Promise<string> {
  const b64 = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const cab = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const agora = Math.floor(Date.now() / 1000);
  const carga = b64(JSON.stringify({ sis: "central", uso: "strava-state", iat: agora, exp: agora + minutos * 60 }));
  const chave = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(JWT_EQUIPE), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(cab + "." + carga)));
  return cab + "." + carga + "." + b64(String.fromCharCode(...mac));
}

/* A PORTA DA TAREFA AGENDADA (14/09/2026).
   O pg_cron não tem — e não pode ter — o crachá do dono: o mesmo crachá abre o
   estado, as obras, os anexos e o `crachaAdmin`. Também não vale a chave
   service_role: ela é do projeto INTEIRO, compartilhado com os sistemas da
   empresa, e girá-la derrubaria todos. Então a tarefa tem um segredo só dela,
   que vale para UMA ação de leitura (puxar treinos do Strava para as tabelas do
   próprio dono) e mais nada.

   O segredo mora em `leo_config` (tabela com RLS e nenhuma política: só o
   service_role enxerga), nunca no git nem nas variáveis. RECUSA POR OMISSÃO:
   sem a linha, ou com menos de 32 caracteres, nenhum cabeçalho abre a porta —
   "esqueci de configurar" não pode virar "porta aberta". A consulta ao banco só
   acontece se o cabeçalho já vier com tamanho plausível, para um pedido anônimo
   não conseguir fazer o servidor bater no banco à toa. */
const CRON_ACAO = "stravaSincronizarCron";
async function cronOk(req: Request): Promise<boolean> {
  const dado = (req.headers.get("x-leo-cron") ?? "").trim();
  if (dado.length < 32 || dado.length > 200) return false;
  const { data, error } = await sb.from("leo_config").select("valor").eq("chave", "cron_token").maybeSingle();
  if (error || !data) return false;
  const v = data.valor as Record<string, unknown> | null;
  const esperado = v && typeof v.token === "string" ? v.token.trim() : "";
  if (esperado.length < 32) return false;
  // comparação de tempo constante: não entrega o segredo letra por letra
  if (esperado.length !== dado.length) return false;
  let dif = 0;
  for (let i = 0; i < esperado.length; i++) dif |= esperado.charCodeAt(i) ^ dado.charCodeAt(i);
  return dif === 0;
}

// ---------------------------------------------------------------- senha
// PBKDF2-SHA256; o registro no banco guarda { salt, iter, hash } em hex.

// senha errada espera um pouco: força-bruta fica cara sem atrapalhar quem digita
const freia = () => new Promise((r) => setTimeout(r, 400));

// ---------------------------------------------------------------- handler

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (!SESSION_SECRET) return json({ erro: "LEO_SESSION_SECRET ausente" }, 500);

  if (req.method === "POST") {
    const corpo = await req.json().catch(() => ({}));
    const { acao, senha, senhaAtual, senhaNova, id: corpoId } = corpo;

    // Troca a sessao longa por um cracha curto de administracao.
    if (acao === "crachaAdmin") {
      const t = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
      if (!(await tokenOk(t))) return json({ erro: "sessão inválida" }, 401);
      return json({ token: await novoTokenAdmin() });
    }

    /* A SENHA DESTE APP MORREU JUNTO COM A SESSÃO PRÓPRIA.
       Quem entra aqui entra pela entrada única, com o mesmo usuário e a mesma
       senha dos outros sistemas -- e a tela desta Central já faz isso sozinha
       antes de chegar aqui. Este `login` sobrou como porta de servidor e não
       emite mais nada: duas senhas para a mesma pessoa é uma que envelhece. */
    if (acao === "login") {
      await freia();
      return json({
        erro: "Entre pelo seu usuário e senha, os mesmos dos outros sistemas.",
        usarEntradaUnica: true,
      }, 401);
    }

    /* TROCAR A SENHA NÃO É MAIS AQUI.
       Esta ação gravava um hash em `leo_config` -- e essa senha, depois da
       unificação, não abre mais nada: quem confere a entrada é o Supabase Auth.
       Mantê-la seria pior que removê-la: a tela diria "senha alterada" e nada
       teria mudado. A senha da casa se troca no Painel, num lugar só, e vale
       para os oito sistemas. */


    /* ---- STRAVA (14/09/2026) ------------------------------------------
       Toda ação que começa com "strava" vive em strava.ts (ler o que está no
       banco, sincronizar com a API do Strava, montar a URL de autorização).
       O crachá é conferido AQUI, do mesmo jeito que nas outras ações; o
       módulo recebe o pedido já autorizado. */
    /* ---- GOOGLE (14/09/2026) --------------------------------------
       Mesmo desenho do Strava: o crachá de renovação fica aqui e a tela do
       Drive recebe um crachá curto, de leitura. É o que faz a conexão
       acontecer sozinha, sem o Léo clicar em "Conectar" toda sessão. */
    if (typeof acao === "string" && acao.startsWith("google")) {
      const t = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
      if (!(await tokenOk(t))) return json({ erro: "Não autorizado" }, 401);
      if (acao === "googleAutorizarUrl") corpo.state = await crachaCurto(10);
      return await googleAcao(acao, corpo, sb, req, new URL(req.url));
    }

    /* A tarefa agendada: uma ação, um segredo, corpo IGNORADO. O corpo é
       reescrito à mão para que nem `forcar` nem qualquer outro campo vindo de
       fora mude o que essa rodada faz. */
    if (acao === CRON_ACAO && req.headers.has("x-leo-cron")) {
      if (!(await cronOk(req))) return json({ erro: "Não autorizado" }, 401);
      return await stravaAcao(CRON_ACAO, {}, sb, req, new URL(req.url));
    }

    if (acao === "bancosGestao") {
      const t = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
      if (!(await tokenOk(t))) return json({ erro: "Não autorizado" }, 401);
      const resposta = json(await lerBancosGestao(sb));
      resposta.headers.set("Cache-Control", "no-store");
      return resposta;
    }

    if (acao === "empresaDatas") {
      const t = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
      if (!(await tokenOk(t))) return json({ erro: "Não autorizado" }, 401);
      return await empresaAcao(acao, sb, new Date().toISOString().slice(0, 10));
    }

    if (typeof acao === "string" && acao.startsWith("strava")) {
      const t = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
      if (!(await tokenOk(t))) return json({ erro: "Não autorizado" }, 401);
      // o state da autorização é um crachá de 10 minutos, nunca o da sessão
      if (acao === "stravaAutorizarUrl") corpo.state = await crachaCurto(10);
      return await stravaAcao(acao, corpo, sb, req, new URL(req.url));
    }

    /* ---- OBRAS: o histórico de custo (23/08/2026) -----------------------
       Por que estes lançamentos NÃO moram no estado geral: uma obra do
       Léo tem ~820 lançamentos (170 kB). O estado inteiro sobe a cada
       mudança em qualquer tela; com meia dúzia de obras, digitar uma nota
       numa viagem passaria a empurrar 1,5 MB pela rede. Livro-caixa é
       grande e só cresce -- separa. As FICHAS das obras e os APORTES ficam
       no estado normal: são dezenas de linhas e são editados à mão. */
    if (acao === "obraResumo" || acao === "obraCustos" ||
        acao === "obraCustosGravar" || acao === "obraCustosApagar") {
      const t = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
      if (!(await tokenOk(t))) return json({ erro: "Não autorizado" }, 401);

      /* O PostgREST devolve no máximo 1000 linhas por padrão, SEM avisar.
         Com 824 lançamentos hoje isso não apareceria; na segunda obra os
         totais ficariam errados em silêncio -- que é o pior jeito de errar
         um número de dinheiro. Por isso a leitura é sempre paginada. */
      async function todasAsLinhas(obra?: string) {
        const passo = 1000;
        const out: Record<string, unknown>[] = [];
        for (let de = 0; ; de += passo) {
          let q = sb.from("leo_obra_custos")
            .select("id, obra, data, nome, centro, fornecedor, valor, forma, conta, origem")
            // desempate por id: `data` REPETE (dezenas de lançamentos no mesmo
            // dia). Sem uma chave única na ordenação, a paginação do Postgres
            // pode devolver a mesma linha em duas páginas e pular outra — o
            // total sairia errado em silêncio a partir de 1.000 linhas.
            .order("data", { ascending: true }).order("id", { ascending: true })
            .range(de, de + passo - 1);
          if (obra) q = q.eq("obra", obra);
          const { data, error } = await q;
          if (error) throw new Error(error.message);
          out.push(...(data ?? []));
          if (!data || data.length < passo) return out;
        }
      }

      try {
        if (acao === "obraCustos") {
          const obra = String(corpo.obra ?? "").trim();
          if (!obra) return json({ erro: "sem obra" }, 400);
          return json({ custos: await todasAsLinhas(obra) });
        }

        if (acao === "obraResumo") {
          // O celular não precisa de 8 mil linhas para desenhar cinco cartões:
          // a soma é feita aqui e desce pronta.
          const linhas = await todasAsLinhas();
          const porObra: Record<string, {
            total: number; n: number; de: string | null; ate: string | null;
            centros: Record<string, { total: number; n: number }>;
            meses: Record<string, number>;
            fornecedores: Record<string, { total: number; n: number }>;
          }> = {};
          for (const l of linhas) {
            const o = String(l.obra);
            const r = porObra[o] ??= { total: 0, n: 0, de: null, ate: null, centros: {}, meses: {}, fornecedores: {} };
            const v = Number(l.valor) || 0;
            r.total += v; r.n++;
            const d = l.data ? String(l.data) : null;
            if (d) { if (!r.de || d < r.de) r.de = d; if (!r.ate || d > r.ate) r.ate = d; }
            const c = String(l.centro || "").trim() || "(sem centro)";
            (r.centros[c] ??= { total: 0, n: 0 }).total += v; r.centros[c].n++;
            if (d) r.meses[d.slice(0, 7)] = (r.meses[d.slice(0, 7)] ?? 0) + v;
            const f = String(l.fornecedor || "").trim() || "(sem fornecedor)";
            (r.fornecedores[f] ??= { total: 0, n: 0 }).total += v; r.fornecedores[f].n++;
          }
          return json({ resumo: porObra });
        }

        if (acao === "obraCustosGravar") {
          const linhas = Array.isArray(corpo.linhas) ? corpo.linhas : [];
          if (!linhas.length) return json({ erro: "nada para gravar" }, 400);
          if (linhas.length > 5000) return json({ erro: "lote grande demais (máx. 5000)" }, 400);
          const limpas = linhas.map((l: Record<string, unknown>) => ({
            id: String(l.id ?? "").trim(),
            obra: String(l.obra ?? "").trim(),
            data: String(l.data ?? "").slice(0, 10) || null,
            nome: String(l.nome ?? "").slice(0, 300),
            centro: String(l.centro ?? "").slice(0, 120),
            fornecedor: String(l.fornecedor ?? "").slice(0, 200),
            valor: Number(l.valor) || 0,
            forma: String(l.forma ?? "").slice(0, 80),
            conta: String(l.conta ?? "").slice(0, 120),
            // auditoria: o valor COM O SINAL de origem e de que arquivo veio.
            // Sem isto, um estorno reclassificado não tem como ser conferido.
            valor_original: l.valor_original === undefined ? null : Number(l.valor_original),
            origem: String(l.origem ?? "").slice(0, 200) || null,
          })).filter((l) => l.id && l.obra);
          if (!limpas.length) return json({ erro: "toda linha precisa de id e obra" }, 400);
          // upsert: reimportar o mesmo arquivo ATUALIZA, não duplica
          const { error } = await sb.from("leo_obra_custos").upsert(limpas, { onConflict: "id" });
          if (error) return json({ erro: error.message }, 500);
          return json({ ok: true, gravadas: limpas.length });
        }

        // obraCustosApagar: a obra inteira, ou uma lista de ids
        const obra = String(corpo.obra ?? "").trim();
        const ids = Array.isArray(corpo.ids) ? corpo.ids.map(String) : null;
        if (!obra && !ids?.length) return json({ erro: "sem obra nem ids" }, 400);
        const q = sb.from("leo_obra_custos").delete();
        const { error } = ids?.length ? await q.in("id", ids) : await q.eq("obra", obra);
        if (error) return json({ erro: error.message }, 500);
        return json({ ok: true });
      } catch (e) {
        return json({ erro: (e as Error).message }, 500);
      }
    }

    /* ---- ANEXOS (23/08/2026) ------------------------------------------
       Os anexos moravam só no IndexedDB do navegador: presos ao aparelho E ao
       endereço do site. Trocar de celular perdia tudo, e o backup diário nunca
       os levou -- ele copia leo_estado, que só tem texto. Agora o arquivo vai
       para o bucket privado `leo-arquivos` e o índice para `leo_arquivos`.

       O ARQUIVO NÃO PASSA POR AQUI. Uma Edge Function carregando 25 MB de PDF
       na memória para repassar é desperdício e trava. O que se emite é uma
       URL assinada de curta duração; o navegador fala direto com o Storage.

       ORDEM DE PROPÓSITO: sobe primeiro, indexa depois. Se a subida falhar,
       sobra um blob órfão -- bytes invisíveis. Se fosse ao contrário, sobraria
       uma linha no índice apontando para nada: a tela mostraria um anexo que
       não abre. Órfão silencioso é melhor que mentira visível. */
    if (acao === "arqListar" || acao === "arqSubirUrl" || acao === "arqIndexar" ||
        acao === "arqUrl" || acao === "arqApagar") {
      const t = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
      if (!(await tokenOk(t))) return json({ erro: "Não autorizado" }, 401);
      const balde = sb.storage.from("leo-arquivos");

      if (acao === "arqListar") {
        const refs = Array.isArray(corpo.refs) ? corpo.refs.map(String) : null;
        if (refs && !refs.length) return json({ arquivos: [] });
        const arquivos: Record<string, unknown>[] = [];
        for (let de = 0; ; de += 1000) {
          let q = sb.from("leo_arquivos").select("id, ref, nome, tipo, tam, em");
          if (refs) q = q.in("ref", refs);
          const { data, error } = await q.order("criado_em", { ascending: true })
            .order("id", { ascending: true }).range(de, de + 999);
          if (error) return json({ erro: error.message }, 500);
          arquivos.push(...(data ?? []));
          if (!data || data.length < 1000) break;
        }
        return json({ arquivos });
      }

      if (acao === "arqSubirUrl") {
        const id = String(corpo.id ?? "").trim();
        const ref = String(corpo.ref ?? "").trim();
        if (!id || !ref) return json({ erro: "sem id ou ref" }, 400);
        // O nome do arquivo fica no ÍNDICE, não no caminho: caminho com nome de
        // usuário dentro vira problema de acento, barra e maiúscula.
        const caminho = ref + "/" + id;
        const { data, error } = await balde.createSignedUploadUrl(caminho, { upsert: true });
        if (error) return json({ erro: error.message }, 500);
        return json({ caminho, url: data.signedUrl });
      }

      if (acao === "arqIndexar") {
        const id = String(corpo.id ?? "").trim();
        const ref = String(corpo.ref ?? "").trim();
        const caminho = String(corpo.caminho ?? "").trim();
        if (!id || !ref || !caminho) return json({ erro: "faltou id, ref ou caminho" }, 400);
        const { error } = await sb.from("leo_arquivos").upsert({
          id, ref, caminho,
          nome: String(corpo.nome ?? "arquivo"),
          tipo: String(corpo.tipo ?? ""),
          tam: Number(corpo.tam ?? 0) || 0,
          em: String(corpo.em ?? "").slice(0, 10) || null,
        });
        if (error) return json({ erro: error.message }, 500);
        return json({ ok: true });
      }

      if (acao === "arqUrl") {
        const id = String(corpo.id ?? "").trim();
        if (!id) return json({ erro: "sem id" }, 400);
        const { data: reg, error: e1 } = await sb.from("leo_arquivos")
          .select("caminho, nome, tipo").eq("id", id).maybeSingle();
        if (e1) return json({ erro: e1.message }, 500);
        if (!reg) return json({ erro: "anexo não encontrado" }, 404);
        // 5 minutos: tempo de abrir ou baixar, não de virar link compartilhável
        const baixar = corpo.baixar ? { download: reg.nome } : undefined;
        const { data, error } = await balde.createSignedUrl(reg.caminho, 300, baixar);
        if (error) return json({ erro: error.message }, 500);
        return json({ url: data.signedUrl, nome: reg.nome, tipo: reg.tipo });
      }

      // arqApagar: o blob sai primeiro; se o índice não sair, a tela ainda
      // mostraria o anexo -- e tentar abrir daria erro. Por isso o índice é o
      // último a cair, e o erro dele é reportado.
      const id = String(corpo.id ?? "").trim();
      if (!id) return json({ erro: "sem id" }, 400);
      const { data: reg, error: leituraErro } = await sb.from("leo_arquivos")
        .select("caminho").eq("id", id).maybeSingle();
      if (leituraErro) return json({ erro: leituraErro.message }, 500);
      if (reg?.caminho) {
        const { error: remocaoErro } = await balde.remove([reg.caminho]);
        if (remocaoErro) return json({ erro: remocaoErro.message }, 500);
      }
      const { error } = await sb.from("leo_arquivos").delete().eq("id", id);
      if (error) return json({ erro: error.message }, 500);
      return json({ ok: true });
    }

    /* CÓPIAS DE SEGURANÇA (23/08/2026).
       Um backup que não dá para consultar nem restaurar é fé, não seguro. O
       banco tira uma cópia por dia (leo_backup_diario) e guarda 90 dias, só
       quando algo mudou. Estas duas ações são a porta para ver e trazer de
       volta -- restaurar NÃO é feito aqui: a ação devolve os dados, a tela
       mostra o que veio e quem grava é o caminho normal, com a mesma trava de
       concorrência. Restaurar direto no servidor pularia essa trava. */
    if (acao === "backups") {
      const t = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
      if (!(await tokenOk(t))) return json({ erro: "Não autorizado" }, 401);
      const { data, error } = await sb.from("leo_backups")
        .select("id, em, mt").order("em", { ascending: false }).limit(90);
      if (error) return json({ erro: error.message }, 500);
      return json({ backups: data ?? [] });
    }

    if (acao === "backupPegar") {
      const t = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
      if (!(await tokenOk(t))) return json({ erro: "Não autorizado" }, 401);
      const id = Number(corpoId);
      if (!id) return json({ erro: "sem id" }, 400);
      const { data, error } = await sb.from("leo_backups")
        .select("id, em, mt, dados").eq("id", id).maybeSingle();
      if (error) return json({ erro: error.message }, 500);
      if (!data) return json({ erro: "cópia não encontrada" }, 404);
      return json(data);
    }

    if (acao === "trocar") {
      return json({
        erro: "A senha agora é a mesma dos outros sistemas. Troque no Painel, em Acessos → Minha senha.",
        trocarNoPainel: true,
      }, 400);
    }

    return json({ erro: "ação inválida" }, 400);
  }

  /* VOLTA DO STRAVA (OAuth, 14/09/2026). O navegador chega aqui redirecionado
     pelo Strava, SEM cabeçalho Authorization: o crachá viaja no `state`, que
     o Strava devolve intacto. Conferido pelo `stateOk`: só passa o crachá curto
     carimbado para isto (uso "strava-state", 10 min) — o de 180 dias não serve
     de state, e o state não serve de sessão. Sem ele, nenhum code vira token. Aceita a
     forma ?acao=stravaCallback e o sub-caminho /leo-sync/stravaCallback (o
     redirect_uri usa o sub-caminho: URL limpa para o Strava acrescentar
     ?state=&code=&scope=). */
  // a conferência barata primeiro: só quem cheira a volta do Strava vira URL
  // volta do Google: mesmo desenho do Strava — o `state` é o crachá curto
  if (req.method === "GET" && req.url.includes("googleCallback")) {
    const url = new URL(req.url);
    if (!(await stateOk(url.searchParams.get("state")))) {
      return json({ erro: "Crachá inválido ou vencido no retorno do Google. Abra a Central, entre de novo e conecte outra vez." }, 401);
    }
    return await googleAcao("googleCallback", {}, sb, req, url);
  }

  if (req.method === "GET" && req.url.includes("stravaCallback")) {
    const url = new URL(req.url);
    if (url.searchParams.get("acao") === "stravaCallback" || /\/stravaCallback\/?$/.test(url.pathname)) {
      if (!(await stateOk(url.searchParams.get("state")))) {
        return json({ erro: "Crachá inválido ou vencido no retorno do Strava. Abra a Central, entre de novo e clique em Conectar ao Strava outra vez." }, 401);
      }
      return await stravaAcao("stravaCallback", {}, sb, req, url);
    }
  }

  const t = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!(await tokenOk(t))) return json({ erro: "Não autorizado" }, 401);

  if (req.method === "GET") {
    const { data, error } = await sb
      .from("leo_estado").select("mt, dados").eq("id", true).maybeSingle();
    if (error) return json({ erro: error.message }, 500);
    return json(data ? { mt: Number(data.mt), dados: data.dados } : { mt: 0, dados: null });
  }

  if (req.method === "PUT") {
    const { dados, base } = await req.json().catch(() => ({}));
    if (!dados || typeof dados !== "object" || Array.isArray(dados) || !Array.isArray(dados.viagens)) return json({ erro: "estado inválido" }, 400);
    // Gravação CONDICIONAL (compare-and-swap): o cliente diz qual versão do
    // servidor ele viu ("base"); só gravamos se ela ainda for a atual. Isso
    // fecha a corrida de dois lados salvando quase juntos E corta os clientes
    // antigos (sem "base"), que eram exatamente os que atropelavam correções.
    if (base === undefined || base === null)
      return json({ erro: "cliente desatualizado — recarregue a página" }, 428);
    if (!Number.isSafeInteger(base) || base < 0) return json({ erro: "base inválida" }, 400);
    const mt = Math.max(Date.now(), base + 1);
    const atual = await sb.from("leo_estado").select("mt").eq("id", true).maybeSingle();
    if (atual.error) return json({ erro: atual.error.message }, 500);
    if (!atual.data) {
      // primeira gravação de todas: só vale se o cliente também partiu do zero
      if (Number(base) !== 0) return json({ erro: "conflito", mt: 0 }, 409);
      const { error } = await sb.from("leo_estado").insert(
        { id: true, mt, dados, atualizado_em: new Date().toISOString() });
      if (error) return json({ erro: error.message }, error.code === "23505" ? 409 : 500);
      return json({ mt });
    }
    const { data, error } = await sb.from("leo_estado")
      .update({ mt, dados, atualizado_em: new Date().toISOString() })
      .eq("id", true).eq("mt", Number(base)).select("mt");
    if (error) return json({ erro: error.message }, 500);
    if (!data || !data.length) {
      const agora = await sb.from("leo_estado").select("mt").eq("id", true).maybeSingle();
      return json({ erro: "conflito", mt: agora.data ? Number(agora.data.mt) : 0 }, 409);
    }
    return json({ mt });
  }

  return json({ erro: "método não suportado" }, 405);
});
