// ============================================================================
// leo-sync — Central do Leo (substitui netlify/functions/sync.mjs)
//
// O CONTRATO:
//   POST {acao:'login', senha}                       -> { token }
//   POST {acao:'trocar', senhaAtual, senhaNova} +Bearer -> { ok: true }
//   GET  (Bearer)                                    -> { mt, dados } | { mt: 0, dados: null }
//   PUT  (Bearer) { dados }                          -> { mt }
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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_SENHA = Deno.env.get("LEO_APP_SENHA") ?? "";
const SESSION_SECRET = Deno.env.get("LEO_SESSION_SECRET") ?? "";
const DIAS = 180;

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

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

const novoToken = async () => {
  const exp = Date.now() + DIAS * 864e5;
  return exp + "." + (await assina(exp));
};

async function tokenOk(t: string | null): Promise<boolean> {
  if (!t) return false;
  const [expS, mac] = String(t).split(".");
  const exp = Number(expS);
  if (!exp || exp < Date.now() || !mac) return false;
  return igual(mac, await assina(exp));
}

// ---------------------------------------------------------------- senha
// PBKDF2-SHA256; o registro no banco guarda { salt, iter, hash } em hex.

type RegSenha = { salt: string; iter: number; hash: string };

async function pbkdf2(senha: string, saltHex: string, iter: number): Promise<string> {
  const chave = await crypto.subtle.importKey("raw", enc.encode(senha), "PBKDF2", false, ["deriveBits"]);
  const salt = new Uint8Array((saltHex.match(/../g) ?? []).map((h) => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, chave, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function senhaDoBanco(): Promise<RegSenha | null> {
  const { data } = await sb.from("leo_config").select("valor").eq("chave", "senha").maybeSingle();
  const v = data?.valor as RegSenha | undefined;
  return v && v.salt && v.iter && v.hash ? v : null;
}

async function senhaConfere(senha: string, reg: RegSenha | null): Promise<boolean> {
  if (reg) return igual(await pbkdf2(senha, reg.salt, reg.iter), reg.hash);
  if (!APP_SENHA) return false;
  return igual(senha, APP_SENHA);
}

// senha errada espera um pouco: força-bruta fica cara sem atrapalhar quem digita
const freia = () => new Promise((r) => setTimeout(r, 400));

// ---------------------------------------------------------------- handler

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (!SESSION_SECRET) return json({ erro: "LEO_SESSION_SECRET ausente" }, 500);

  if (req.method === "POST") {
    const { acao, senha, senhaAtual, senhaNova } = await req.json().catch(() => ({}));

    if (acao === "login") {
      const reg = await senhaDoBanco();
      if (!reg && !APP_SENHA) return json({ erro: "senha não configurada" }, 500);
      if (!(await senhaConfere(String(senha ?? ""), reg))) { await freia(); return json({ erro: "Senha incorreta" }, 401); }
      return json({ token: await novoToken() });
    }

    if (acao === "trocar") {
      // decisão do dono: basta a sessão válida — a senha antiga não é exigida.
      // (o custo assumido: um aparelho logado consegue definir senha nova)
      const t = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
      if (!(await tokenOk(t))) return json({ erro: "Não autorizado" }, 401);
      const nova = String(senhaNova ?? "");
      if (nova.length < 8) return json({ erro: "A senha nova precisa de pelo menos 8 caracteres" }, 400);
      const salt = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
      const iter = 120000;
      const hash = await pbkdf2(nova, salt, iter);
      const { error } = await sb.from("leo_config").upsert(
        { chave: "senha", valor: { salt, iter, hash }, atualizado_em: new Date().toISOString() },
        { onConflict: "chave" });
      if (error) return json({ erro: error.message }, 500);
      return json({ ok: true });
    }

    return json({ erro: "ação inválida" }, 400);
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
    const { dados } = await req.json().catch(() => ({}));
    if (!dados || typeof dados !== "object") return json({ erro: "dados ausentes" }, 400);
    const mt = Date.now();
    const { error } = await sb.from("leo_estado").upsert(
      { id: true, mt, dados, atualizado_em: new Date().toISOString() }, { onConflict: "id" });
    if (error) return json({ erro: error.message }, 500);
    return json({ mt });
  }

  return json({ erro: "método não suportado" }, 405);
});
