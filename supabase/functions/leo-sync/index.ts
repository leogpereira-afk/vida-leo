// ============================================================================
// leo-sync — Central do Leo (substitui netlify/functions/sync.mjs)
//
// O CONTRATO E O MESMO, inclusive os metodos HTTP:
//   POST {acao:'login', senha}  -> { token }
//   GET  (Bearer)               -> { mt, dados }  |  { mt: 0, dados: null }
//   PUT  (Bearer) { dados }     -> { mt }
//
// De-para: store "central" chave "estado" -> tabela leo_estado (uma linha so).
//
// Este e o unico sistema com LOGIN DE VERDADE: senha conferida no servidor e
// sessao assinada por HMAC. Os apps de campo usam token compartilhado que viaja
// no bundle -- aqui nao, e por isso o desenho fica como esta.
//
// PROJETO COMPARTILHADO: prefixo obrigatorio no nome da function e da tabela.
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
// resposta, quantos caracteres bateram -- e isso permite adivinhar a assinatura
// byte a byte. Vale para a senha e para o mac.
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

// ---------------------------------------------------------------- handler

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (!SESSION_SECRET) return json({ erro: "LEO_SESSION_SECRET ausente" }, 500);

  if (req.method === "POST") {
    const { acao, senha } = await req.json().catch(() => ({}));
    if (acao !== "login") return json({ erro: "ação inválida" }, 400);
    if (!APP_SENHA) return json({ erro: "LEO_APP_SENHA não configurada" }, 500);
    if (!igual(String(senha ?? ""), APP_SENHA)) return json({ erro: "Senha incorreta" }, 401);
    return json({ token: await novoToken() });
  }

  const t = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!(await tokenOk(t))) return json({ erro: "Não autorizado" }, 401);

  if (req.method === "GET") {
    const { data, error } = await sb
      .from("leo_estado").select("mt, dados").eq("id", true).maybeSingle();
    if (error) return json({ erro: error.message }, 500);
    // Primeira vez (nada gravado): devolve o mesmo formato vazio de antes, para
    // o cliente saber que a nuvem esta atras e subir o que ele tem.
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
