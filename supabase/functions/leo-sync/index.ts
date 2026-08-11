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

async function crachaOk(token: string): Promise<boolean> {
  if (!JWT_EQUIPE || !token) return false;
  const partes = token.split(".");
  if (partes.length !== 3) return false;
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
    if (!ok) return false;
    const p = JSON.parse(new TextDecoder().decode(b64url(partes[1])));
    if (typeof p.exp === "number" && p.exp < Math.floor(Date.now() / 1000)) return false;
    return p.sis === "central";
  } catch {
    return false;
  }
}

/* SÓ O CRACHÁ (11/08/2026).
   A sessão desta Central era um HMAC próprio, de formato diferente do dos
   outros sete. Ela virou um sistema como os demais: entra pela entrada única e
   guarda o crachá padrão. O formato antigo saiu -- deixar as duas portas
   abertas é manter viva justamente a diferença que a virada existiu para
   acabar. Quem tiver sessão velha no navegador cai na tela de login e entra com
   a senha de sempre. */
async function tokenOk(t: string | null): Promise<boolean> {
  if (!t) return false;
  return await crachaOk(t);
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
    const { acao, senha, senhaAtual, senhaNova } = await req.json().catch(() => ({}));

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
    if (acao === "trocar") {
      return json({
        erro: "A senha agora é a mesma dos outros sistemas. Troque no Painel, em Acessos → Minha senha.",
        trocarNoPainel: true,
      }, 400);
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
    const { dados, base } = await req.json().catch(() => ({}));
    if (!dados || typeof dados !== "object") return json({ erro: "dados ausentes" }, 400);
    // Gravação CONDICIONAL (compare-and-swap): o cliente diz qual versão do
    // servidor ele viu ("base"); só gravamos se ela ainda for a atual. Isso
    // fecha a corrida de dois lados salvando quase juntos E corta os clientes
    // antigos (sem "base"), que eram exatamente os que atropelavam correções.
    if (base === undefined || base === null)
      return json({ erro: "cliente desatualizado — recarregue a página" }, 428);
    const mt = Date.now();
    const atual = await sb.from("leo_estado").select("mt").eq("id", true).maybeSingle();
    if (atual.error) return json({ erro: atual.error.message }, 500);
    if (!atual.data) {
      // primeira gravação de todas: só vale se o cliente também partiu do zero
      if (Number(base) !== 0) return json({ erro: "conflito", mt: 0 }, 409);
      const { error } = await sb.from("leo_estado").insert(
        { id: true, mt, dados, atualizado_em: new Date().toISOString() });
      if (error) return json({ erro: error.message }, 500);
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
