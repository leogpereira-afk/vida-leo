// ============================================================================
// google.ts — a autorização do Google mora no servidor (14/09/2026)
//
// POR QUE ISTO EXISTE: a tela do Drive pedia o crachá ao Google pelo próprio
// navegador (GIS). Funciona, mas o Google só entrega esse crachá dentro de uma
// janela, e o navegador bloqueia janela que não nasce de um clique — ou seja, o
// Léo tinha de clicar em "Conectar" toda sessão. Aqui é como no Strava: ele
// autoriza UMA vez, o servidor guarda a chave de renovação (refresh token) e
// entrega ao navegador apenas um crachá curto, de leitura, quando a tela abre.
//
// AÇÕES (POST, com crachá da Central no cabeçalho):
//   googleToken        -> { token, vence, escopo } | { precisaAutorizar: true }
//   googleAutorizarUrl -> { url }   (o `state` é o crachá CURTO que o index.ts cria)
//   googleDesconectar  -> { ok: true }   apaga a chave de renovação daqui
// GET (sem cabeçalho — é o navegador voltando do Google):
//   /leo-sync/googleCallback?code=…&state=…
//
// ONDE FICA CADA COISA (leo_config):
//   'google_refresh' = { token, escopo, em }   o único segredo que sobrevive
//   'google_token'   = { token, exp }          crachá de ~1 h, para não renovar à toa
//
// O QUE O NAVEGADOR RECEBE: só o crachá curto, de LEITURA do Drive — o mesmo
// que ele já recebia do Google direto. A chave de renovação nunca sai daqui.
// ============================================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type Registro = Record<string, unknown>;
type Banco = SupabaseClient;

const OAUTH_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_TOKEN = "https://oauth2.googleapis.com/token";
const APP_URL = "https://leogpereira-afk.github.io/vida-leo/";
// Só leitura do Drive: é tudo o que a tela faz (navegar, ver, baixar).
const ESCOPO = "https://www.googleapis.com/auth/drive.readonly";
const FOLGA_SEG = 120;   // renova um pouco antes de vencer, para a tela não pegar crachá morto

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "content-type": "application/json" } });

const texto = (v: unknown): string => (v == null ? "" : String(v)).trim();
const agoraIso = () => new Date().toISOString();

function credenciais(): { id: string; secret: string } {
  const id = texto(Deno.env.get("GOOGLE_CLIENT_ID"));
  const secret = texto(Deno.env.get("GOOGLE_CLIENT_SECRET"));
  if (!id || !secret) throw new Error("config");
  return { id, secret };
}

function urlCallback(): string {
  const base = texto(Deno.env.get("SUPABASE_URL")).replace(/\/+$/, "");
  return base + "/functions/v1/leo-sync/googleCallback";
}

// ---------------------------------------------------------------- leo_config
async function configLer(sb: Banco, chave: string): Promise<Registro | null> {
  const { data, error } = await sb.from("leo_config").select("valor").eq("chave", chave).maybeSingle();
  if (error) throw new Error("leo_config: " + error.message);
  const v = data?.valor;
  return v && typeof v === "object" ? (v as Registro) : null;
}
async function configGravar(sb: Banco, chave: string, valor: Registro): Promise<void> {
  const { error } = await sb.from("leo_config")
    .upsert({ chave, valor, atualizado_em: agoraIso() }, { onConflict: "chave" });
  if (error) throw new Error("leo_config: " + error.message);
}

/* O crachá de acesso: vale ~1 h. Guardado em leo_config para não pedir um novo
   a cada abertura de tela. Vencido, renova com a chave de renovação — e se o
   Google recusar (acesso revogado pelo dono), some com tudo e pede para
   autorizar de novo, em vez de insistir com uma chave morta. */
async function tokenAcesso(sb: Banco): Promise<{ token: string; vence: string; escopo: string } | null> {
  const guardado = await configLer(sb, "google_token");
  const exp = guardado ? Date.parse(texto(guardado.exp)) : NaN;
  if (guardado && texto(guardado.token) && Number.isFinite(exp) && exp > Date.now() + FOLGA_SEG * 1000) {
    return { token: texto(guardado.token), vence: new Date(exp).toISOString(), escopo: texto(guardado.escopo) };
  }
  const refresh = await configLer(sb, "google_refresh");
  const chave = refresh ? texto(refresh.token) : "";
  if (!chave) return null;

  const { id, secret } = credenciais();
  const corpo = new URLSearchParams({
    client_id: id, client_secret: secret, grant_type: "refresh_token", refresh_token: chave,
  });
  let resp: Response;
  try {
    resp = await fetch(OAUTH_TOKEN, {
      method: "POST", body: corpo,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (_) {
    throw new Error("rede");
  }
  const dados = (await resp.json().catch(() => ({}))) as Registro;
  if (!resp.ok) {
    // 400/401 = a autorização foi revogada no Google: a chave guardada não vale mais
    if (resp.status === 400 || resp.status === 401) {
      await configGravar(sb, "google_refresh", { token: "", em: agoraIso(), motivo: "recusado pelo Google" });
      return null;
    }
    throw new Error("google " + resp.status);
  }
  const token = texto(dados.access_token);
  if (!token) throw new Error("token vazio");
  const segundos = Number(dados.expires_in) || 3600;
  const vence = new Date(Date.now() + segundos * 1000).toISOString();
  const escopo = texto(dados.scope) || texto(refresh?.escopo);
  await configGravar(sb, "google_token", { token, exp: vence, escopo });
  return { token, vence, escopo };
}

// ---------------------------------------------------------------- OAuth
function autorizarUrl(c: Registro): Response {
  const state = texto(c.state);
  if (!state) return json({ erro: "sem crachá" }, 401);
  let id: string;
  try { id = credenciais().id; } catch (_) { return json({ erro: "Faltam as chaves do Google no servidor." }, 500); }
  const u = new URL(OAUTH_AUTH);
  u.searchParams.set("client_id", id);
  u.searchParams.set("redirect_uri", urlCallback());
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", ESCOPO);
  // offline + consent: é o que faz o Google devolver a chave de renovação
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("include_granted_scopes", "true");
  u.searchParams.set("state", state);
  return json({ url: u.toString(), callback: urlCallback(), escopo: ESCOPO });
}

const voltar = (motivo: string) =>
  Response.redirect(APP_URL + (motivo ? "?google_erro=" + encodeURIComponent(motivo) : "") + "#drive", 302);

// O index.ts JÁ conferiu o `state` (crachá curto) antes de chamar aqui.
async function callback(sb: Banco, url: URL): Promise<Response> {
  if (texto(url.searchParams.get("error"))) return voltar("negado");
  const code = texto(url.searchParams.get("code"));
  if (!code) return voltar("negado");
  let id: string, secret: string;
  try { ({ id, secret } = credenciais()); } catch (_) { return voltar("config"); }

  let resp: Response;
  try {
    resp = await fetch(OAUTH_TOKEN, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: id, client_secret: secret, code,
        grant_type: "authorization_code", redirect_uri: urlCallback(),
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (_) {
    return voltar("rede");
  }
  const dados = (await resp.json().catch(() => ({}))) as Registro;
  if (!resp.ok) return voltar("troca-" + resp.status);

  const refresh = texto(dados.refresh_token);
  const token = texto(dados.access_token);
  const escopo = texto(dados.scope);
  if (!refresh) {
    // sem chave de renovação a conexão morre em 1 h — melhor dizer do que fingir
    return voltar("sem-renovacao");
  }
  try {
    await configGravar(sb, "google_refresh", { token: refresh, escopo, em: agoraIso() });
    if (token) {
      const segundos = Number(dados.expires_in) || 3600;
      await configGravar(sb, "google_token", {
        token, exp: new Date(Date.now() + segundos * 1000).toISOString(), escopo,
      });
    }
  } catch (_) {
    return voltar("banco");
  }
  return voltar(escopo && !escopo.includes("drive.readonly") ? "escopo" : "");
}

/* Desligar de verdade: a chave de renovação é o que faz a conexão sobreviver ao
   recarregamento, então desconectar é apagá-la daqui. Depois disso a tela volta a
   pedir autorização — e o Léo pode tirar o acesso também do lado do Google, em
   myaccount.google.com/connections. */
async function desconectar(sb: Banco): Promise<Response> {
  await configGravar(sb, "google_token", { token: "", exp: "", em: agoraIso() });
  await configGravar(sb, "google_refresh", { token: "", em: agoraIso(), motivo: "desligado na Central" });
  return json({ ok: true });
}

// ---------------------------------------------------------------- porta
export async function googleAcao(
  acao: string, corpo: Registro, sb: Banco, _req: Request, url: URL,
): Promise<Response> {
  try {
    if (acao === "googleToken") {
      const t = await tokenAcesso(sb);
      if (!t) return json({ precisaAutorizar: true });
      return json({ token: t.token, vence: t.vence, escopo: t.escopo });
    }
    if (acao === "googleAutorizarUrl") return autorizarUrl(corpo);
    if (acao === "googleDesconectar") return await desconectar(sb);
    if (acao === "googleCallback") return await callback(sb, url);
    return json({ erro: "ação inválida" }, 400);
  } catch (e) {
    const m = (e as Error)?.message || "erro";
    if (m === "config") return json({ erro: "Faltam as chaves do Google no servidor." }, 500);
    if (m === "rede") return json({ erro: "Não foi possível falar com o Google agora." }, 502);
    return json({ erro: "Não deu para renovar o acesso ao Google (" + m + ")." }, 500);
  }
}
