// Apoio dos testes da equipe-auth. NAO e teste: e o banco falso e o carregador
// da function.
//
// Nada aqui encosta no Supabase. A function roda inteira, com UMA troca so: o
// `createClient` passa a devolver o banco falso. O cracha e de verdade (HS256
// com um segredo ficticio, so dos testes), conferido pelo `lerCracha` dela.
//
// A function e TypeScript. Para rodar no Node, os tipos saem de um de dois
// jeitos, nesta ordem:
//   1) `module.stripTypeScriptTypes` (Node 22.13 ou mais novo; e o da CI, Node 24);
//   2) o esbuild, se houver um: o do proprio repo, o de ESBUILD_DIR, ou o do
//      checkout do painel ao lado deste (`../painel/node_modules/esbuild`).
// Sem nenhum dos dois (Node 20 sem esbuild), `carregar` devolve null e o teste
// se declara pulado, dizendo por que.
import * as modulo from "node:module";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHmac } from "node:crypto";

export const SEGREDO = "segredo-ficticio-so-dos-testes-da-equipe-auth";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

/** Cracha da equipe-auth. `iat` em segundos; `iat: null` gera um SEM iat. */
export function cracha({ sis, sub, iat = Math.floor(Date.now() / 1000), exp } = {}) {
  const corpo = { sis, sub, nome: sub, papel: "equipe" };
  if (iat !== null) corpo.iat = iat;
  corpo.exp = exp ?? Math.floor(Date.now() / 1000) + 30 * 86400;
  const h = b64({ alg: "HS256", typ: "JWT" });
  const d = b64(corpo);
  return `${h}.${d}.${createHmac("sha256", SEGREDO).update(`${h}.${d}`).digest("base64url")}`;
}

// O mesmo PBKDF2 da casa, para semear o hash da senha atual.
export async function hashDe(senha, saltHex = "00112233445566778899aabbccddeeff") {
  const salt = Buffer.from(saltHex, "hex");
  const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" }, km, 256);
  return { hash: Buffer.from(bits).toString("hex"), salt: saltHex, iter: 120000 };
}

/**
 * O banco falso. `estado` semeia as tabelas; `auth` os usuarios do Auth
 * ({id: {senha}}). `falhas.rpc[nome] = {message}` faz a funcao de banco
 * devolver erro.
 *
 * `porta_travada` segue a funcao de verdade (20260817_freio_atomico.sql): a
 * ficha e consumida na chamada, por (sistema, usuario em minusculas), e trava
 * a partir da 11a tentativa (v_limite = 10) dentro da janela.
 */
export function bancoFalso({ estado = {}, auth = {}, falhas = {} } = {}) {
  const t = {
    equipe_contas: [], painel_contas: [], acesso_conta: [], acesso_senha_legado: [],
    equipe_acessos_log: [],
    ...structuredClone(estado),
  };
  const usuarios = new Map(Object.entries(structuredClone(auth)));
  const ops = [];
  const freio = new Map();
  const f = { rpc: {}, ...falhas };

  function executar(q) {
    ops.push({ tipo: "from", tabela: q.tabela, acao: q.acao });
    const linhas = (t[q.tabela] ??= []);
    const casa = (l) => q.filtros.every((fn) => fn(l));
    if (q.acao === "select") {
      const achadas = linhas.filter(casa).map((l) => structuredClone(l));
      if (q.opcoes?.head) return { data: null, count: achadas.length, error: null };
      if (q.modo === "talvez") {
        return achadas.length > 1 ? { data: null, error: { message: "mais de uma linha" } } : { data: achadas[0] ?? null, error: null };
      }
      return { data: achadas, error: null };
    }
    if (q.acao === "update") {
      for (const l of linhas.filter(casa)) Object.assign(l, structuredClone(q.valores));
      return { data: null, error: null };
    }
    if (q.acao === "delete") {
      t[q.tabela] = linhas.filter((l) => !casa(l));
      return { data: null, error: null };
    }
    if (q.acao === "insert" || q.acao === "upsert") {
      const novas = Array.isArray(q.valores) ? q.valores : [q.valores];
      const chaves = String(q.opcoes?.onConflict ?? "").split(",").filter(Boolean);
      for (const n of novas) {
        const ja = chaves.length ? linhas.find((l) => chaves.every((k) => l[k] === n[k])) : null;
        if (ja && q.acao === "upsert") Object.assign(ja, structuredClone(n));
        else linhas.push(structuredClone(n));
      }
      return { data: null, error: null };
    }
    return { data: null, error: { message: `acao ${q.acao} nao suportada no falso` } };
  }

  function consulta(tabela) {
    const q = { tabela, acao: "select", filtros: [], valores: null, opcoes: {}, modo: null };
    const api = {
      select(_c, opcoes) { if (q.acao === "select") q.opcoes = opcoes ?? {}; return api; },
      insert(v) { q.acao = "insert"; q.valores = v; return api; },
      upsert(v, o) { q.acao = "upsert"; q.valores = v; q.opcoes = o ?? {}; return api; },
      update(v) { q.acao = "update"; q.valores = v; return api; },
      delete() { q.acao = "delete"; return api; },
      eq(c, v) { q.filtros.push((l) => l[c] === v); return api; },
      order() { return api; }, limit() { return api; },
      maybeSingle() { q.modo = "talvez"; return api; },
      then(ok, erro) { return Promise.resolve().then(() => executar(q)).then(ok, erro); },
    };
    return api;
  }

  async function rpc(nome, args) {
    ops.push({ tipo: "rpc", nome, args: structuredClone(args) });
    if (f.rpc[nome]) return { data: null, error: { message: f.rpc[nome].message } };
    if (nome === "porta_travada") {
      const k = `${args.p_sistema ?? "-"}|${String(args.p_usuario ?? "").toLowerCase()}`;
      const n = (freio.get(k) ?? 0) + 1;
      freio.set(k, n);
      return { data: n > 10, error: null };
    }
    return { data: null, error: { message: `rpc ${nome} nao existe no falso` } };
  }

  const authFalso = {
    admin: {
      async updateUserById(id, { password }) {
        ops.push({ tipo: "auth", acao: "update", id });
        const u = usuarios.get(id);
        if (!u) return { data: null, error: { status: 404, message: "User not found" } };
        u.senha = password;
        return { data: { user: { id } }, error: null };
      },
    },
  };

  return { cliente: { from: consulta, rpc, auth: authFalso }, tabelas: t, usuarios, ops };
}

/** O que a function mandou GRAVAR fora do historico: tabelas de senha e o Auth. */
export const escritas = (banco) => banco.ops.filter((o) =>
  (o.tipo === "from" && o.tabela !== "equipe_acessos_log" && o.acao !== "select") ||
  (o.tipo === "auth" && o.acao === "update"));

export const fichasDoFreio = (banco) => banco.ops.filter((o) => o.tipo === "rpc" && o.nome === "porta_travada");

// ------------------------------------------------------------- carregador
const RAIZ = new URL("../../", import.meta.url);

async function acharEsbuild() {
  const lugares = [
    null,                                                     // o do proprio repo
    process.env.ESBUILD_DIR || "",
    fileURLToPath(new URL("../painel/node_modules/esbuild", RAIZ)),
  ];
  for (const lugar of lugares) {
    try {
      if (lugar === null) return await import("esbuild");
      if (!lugar || !existsSync(lugar)) continue;
      const req = modulo.createRequire(pathToFileURL(lugar + "/"));
      return await import(pathToFileURL(req.resolve(lugar)).href);
    } catch { /* tenta o proximo */ }
  }
  return null;
}

// Os jeitos de tirar os tipos, na ordem de preferencia (ver o topo).
async function* versoesJs(ts) {
  if (typeof modulo.stripTypeScriptTypes === "function") {
    let js = null;
    try { js = modulo.stripTypeScriptTypes(ts); } catch { /* cai para o esbuild */ }
    if (js !== null) yield js;
  }
  const esbuild = await acharEsbuild();
  if (!esbuild) return;
  const m = esbuild.transform ? esbuild : esbuild.default;
  yield (await m.transform(ts, { loader: "ts", format: "esm", target: "es2022" })).code;
}

export const POR_QUE_PULOU =
  "sem como tirar os tipos da equipe-auth neste Node (precisa do Node 22.13+ ou de um esbuild: ESBUILD_DIR)";

/** Monta a equipe-auth com o banco falso e devolve `chamar(token, corpo)`, ou null. */
export async function carregar(banco) {
  let handler;
  const env = {
    SUPABASE_URL: "https://banco-falso.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "service-falsa",
    EQUIPE_JWT_SECRET: SEGREDO,
    LEO_SESSION_SECRET: "leo-ficticio-dos-testes",
  };
  let s = await readFile(new URL("supabase/functions/equipe-auth/index.ts", RAIZ), "utf8");
  const antes = s;
  s = s.replace(/import \{ createClient \} from "https:\/\/esm\.sh\/[^"]+";/,
    "const createClient = () => globalThis.__bancoEquipeAuth;");
  if (s === antes) throw new Error("nao achei o import do createClient na equipe-auth");
  globalThis.Deno = { env: { get: (k) => env[k] }, serve: (fn) => { handler = fn; } };
  globalThis.__bancoEquipeAuth = banco.cliente;
  const calado = "const console = { ...globalThis.console, error: () => {}, warn: () => {} };\n";
  // Um transformador que devolve JavaScript invalido (SyntaxError na carga) e
  // defeito do transformador, nao da function: passa para o proximo jeito.
  // Qualquer outro erro na carga e da function e derruba o teste.
  let carregou = false;
  for await (const js of versoesJs(s)) {
    try {
      await import("data:text/javascript;base64," +
        Buffer.from(calado + js + "\n//" + Math.random()).toString("base64"));
    } catch (e) {
      if (e instanceof SyntaxError) continue;
      throw e;
    }
    carregou = true;
    break;
  }
  if (!carregou) return null;
  if (!handler) throw new Error("a equipe-auth nao chamou Deno.serve");
  return {
    async chamar(token, corpo) {
      const headers = { "content-type": "application/json" };
      if (token) headers.authorization = `Bearer ${token}`;
      const r = await handler(new Request("https://teste.invalid", { method: "POST", headers, body: JSON.stringify(corpo) }));
      const texto = await r.text();
      return { status: r.status, texto, body: JSON.parse(texto) };
    },
  };
}
