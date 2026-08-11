// ============================================================================
// equipe-auth — o login de verdade do Brief e do PCP.
//
// O QUE ESTA FUNÇÃO CONSERTA
// Nos dois apps, a conta da pessoa morava dentro do JSON de configuração que
// todo aparelho baixa, com a SENHA EM TEXTO PURO, e a conferência acontecia no
// navegador. Como o token que autoriza o download está no bundle público, dava
// para ler a senha de todo mundo só abrindo o site. Aqui a senha vira PBKDF2
// (mesmo mecanismo do Painel: 120 mil iterações, salt de 16 bytes, hex) e a
// conferência acontece no servidor.
//
// O CRACHÁ É LONGO DE PROPÓSITO (30 dias). O Brief e o PCP são usados na rua,
// muitas vezes sem sinal. Login novo precisa de internet uma vez; depois o
// aparelho segue funcionando com o crachá guardado. Sessão curta trancaria o
// instalador no meio de uma obra.
//
// QUEM PODE ADMINISTRAR
//   1) quem tem crachá de papel administrador DAQUELE sistema; ou
//   2) a Central do Léo — o mesmo token HMAC da leo-sync (LEO_SESSION_SECRET).
// A Central é o dono da empresa: por decisão dele, ela manda em tudo.
//
// verify_jwt = false: quem autoriza é o crachá conferido aqui dentro, e o
// preflight CORS chega sem credencial nenhuma.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JWT_SECRET = Deno.env.get("EQUIPE_JWT_SECRET") ?? "";
const LEO_SECRET = Deno.env.get("LEO_SESSION_SECRET") ?? "";
const DIAS = 30;
const SISTEMAS = ["brief", "pcp", "compras", "dre", "painel", "rh", "pops"] as const;
type Sistema = typeof SISTEMAS[number];

// Papéis de cada sistema, com quem administra. Lista fechada: papel digitado
// errado vira gente sem acesso a nada (ou com acesso demais).
const PAPEIS: Record<Sistema, { todos: string[]; admin: string[] }> = {
  // medidor (05/08/2026): quem vai à rua medir. Vê só o que foi DIRECIONADO a
  // ele e só a parte de campo do briefing (da etapa 4 em diante). Não cria
  // briefing, não vê preço nem O.S. -- o trabalho dele é medir e fotografar.
  brief: { todos: ["vendedor", "designer", "medidor", "admin"], admin: ["admin"] },
  pcp: {
    todos: ["admin", "pcp", "montagem", "operacao", "comercial"],
    admin: ["admin"],
  },
  // Compras (03/08/2026): admin aprova e configura; comprador cota e emite OC;
  // solicitante pede material e registra recebimento.
  compras: { todos: ["admin", "comprador", "solicitante"], admin: ["admin"] },
  // DRE (03/08/2026): é uma PORTA, não um quadro de gente. Uma senha de entrada
  // para quem alimenta o sistema. `admin: []` de propósito — ninguém administra
  // acesso de dentro do DRE; a senha se troca pela Central.
  dre: { todos: ["equipe"], admin: [] },
  // Painel e RH têm login PRÓPRIO e mais antigo que este. Eles entram aqui só
  // para a Central poder administrar de um lugar só — ninguém faz login por
  // esta função neles, e ninguém administra a partir de dentro deles aqui.
  painel: { todos: ["tudo"], admin: [] },
  rh: { todos: ["ADMIN_RH", "GESTOR", "COLABORADOR"], admin: [] },
  // Pops & Fabricação (03/08/2026): admin edita tudo e vê o mapa de treinamento;
  // gestor edita os POPs do(s) setor(es) dele; equipe lê e registra leitura.
  pops: { todos: ["admin", "gestor", "equipe"], admin: ["admin"] },
};

// Sistemas com mecanismo próprio: a Central administra, mas o login é lá.
const EXTERNOS = new Set(["painel", "rh"]);
// TERCEIRA copia desta lista (as outras: painel/supabase/functions/painel-auth
// e painel/src/lib/modulos.js). Ela estava CINCO modulos atrasada -- gestao,
// glossario, compromissos, manutencoes e patrimonio -- e o filtro abaixo
// descartava esses ids sem dizer nada: a direcao marcava a caixa, recebia
// {ok:true} e a pessoa nao ganhava acesso nenhum.
//
// Nao da para importar de outro repo aqui, entao a defesa e o `descartados` da
// resposta: id que nao existir volta na resposta e a tela reclama. Modulo novo
// entra nos TRES lugares.
const MODULOS_PAINEL = ["gestao", "contas-atrasadas", "fluxo-caixa", "produtos", "orcamentos",
  "bancos", "marketing", "licitacoes", "glossario", "compromissos", "manutencoes",
  "patrimonio", "configuracoes"];
// Calculado na hora de usar, não na carga do módulo: normalizarUsuario é um
// const declarado mais abaixo, e chamá-lo aqui derruba a function inteira.
const masterPainel = () => normalizarUsuario(Deno.env.get("PAINEL_AUTH_MASTER_USUARIO") || "leonardo");
const DOMINIO_RH = "rh.impresilk.local";

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "content-type": "application/json" } });

const enc = new TextEncoder();
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
const bytesHex = (h: string) => new Uint8Array((h.match(/../g) ?? []).map((x) => parseInt(x, 16)));

// Comparação em tempo constante: com === o tempo de resposta contaria quantos
// caracteres bateram.
function igual(a: string, b: string): boolean {
  let dif = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) dif |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return dif === 0;
}

// Mesma normalização do Painel e do RH: o nome é a chave de login, então tem
// que casar com acento, sem acento, maiúscula e espaço sobrando.
const normalizarUsuario = (s: unknown): string =>
  String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();

// ------------------------------------------------------------------ senha
// PBKDF2-HMAC-SHA256, salt de 16 bytes, 256 bits de saída, tudo em hex —
// idêntico ao painel/_shared/cripto.ts, de propósito: um mecanismo de senha
// reescrito é um mecanismo de senha enfraquecido.
async function hashSenha(senha: string, saltHex?: string, iter = 120000) {
  const salt = saltHex ? bytesHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const km = await crypto.subtle.importKey("raw", enc.encode(senha), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, km, 256);
  return { hash: hex(new Uint8Array(bits)), salt: hex(salt), iter };
}

async function conferirSenha(senha: string, reg: { hash?: string; salt?: string; iter?: number }) {
  if (!reg?.hash || !reg?.salt) return false;
  const { hash } = await hashSenha(senha, reg.salt, reg.iter || 120000);
  return igual(hash, reg.hash);
}

// ------------------------------------------------------------------ crachá
// JWT HS256 escrito à mão (só Web Crypto, sem dependência).
const b64url = (b: Uint8Array) => {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const b64urlBytes = (s: string) => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const b64urlTexto = (s: string) => b64url(enc.encode(s));

async function chaveHmac(segredo: string) {
  return crypto.subtle.importKey("raw", enc.encode(segredo), { name: "HMAC", hash: "SHA-256" },
    false, ["sign", "verify"]);
}

async function assinarCracha(dados: Record<string, unknown>) {
  const agora = Math.floor(Date.now() / 1000);
  const corpo = { ...dados, iat: agora, exp: agora + DIAS * 86400 };
  const cab = b64urlTexto(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const meio = `${cab}.${b64urlTexto(JSON.stringify(corpo))}`;
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await chaveHmac(JWT_SECRET), enc.encode(meio)));
  return `${meio}.${b64url(sig)}`;
}

async function lerCracha(token: string): Promise<Record<string, any> | null> {
  const p = String(token || "").split(".");
  if (p.length !== 3) return null;
  const ok = await crypto.subtle.verify("HMAC", await chaveHmac(JWT_SECRET),
    b64urlBytes(p[2]), enc.encode(`${p[0]}.${p[1]}`));
  if (!ok) return null;
  try {
    const corpo = JSON.parse(new TextDecoder().decode(b64urlBytes(p[1])));
    if (!corpo.exp || corpo.exp < Math.floor(Date.now() / 1000)) return null;
    return corpo;
  } catch { return null; }
}

// Crachá da Central do Léo: "<expira_ms>.<hmac hex>" assinado com LEO_SESSION_SECRET.
// É o mesmo formato da leo-sync — reaproveitado para a Central não precisar de
// mais um segredo só para administrar acessos.
async function ehCentral(token: string): Promise<boolean> {
  if (!LEO_SECRET || !token) return false;
  const [expS, mac] = String(token).split(".");
  const exp = Number(expS);
  if (!exp || exp < Date.now() || !mac || mac.length !== 64) return false;
  const chave = await crypto.subtle.importKey("raw", enc.encode(LEO_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const calc = hex(new Uint8Array(await crypto.subtle.sign("HMAC", chave, enc.encode(String(exp)))));
  return igual(calc, mac);
}

const bearer = (req: Request) => (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");

// Quem está pedindo: a Central, um admin do sistema, ou ninguém.
//
// O PAPEL VEM DO BANCO, NÃO DO CRACHÁ. O crachá vale 30 dias — se a permissão
// saísse de dentro dele, rebaixar ou desligar um admin só teria efeito um mês
// depois. Aqui o crachá só diz QUEM é; o que essa pessoa pode, pergunta-se à
// tabela toda vez.
async function quemPede(req: Request, sistema: Sistema) {
  const t = bearer(req);
  if (await ehCentral(t)) return { central: true, admin: true, quem: "central", usuario: "" };
  const c = await lerCracha(t);
  if (!c || c.sis !== sistema) return { central: false, admin: false, quem: "", usuario: "" };
  const { data: conta } = await sb.from("equipe_contas").select("papel, ativo")
    .eq("sistema", sistema).eq("usuario", String(c.sub)).maybeSingle();
  // conta apagada ou desativada perde tudo na hora, mesmo com crachá válido
  const vale = !!conta && conta.ativo !== false;
  return {
    central: false,
    admin: vale && PAPEIS[sistema].admin.includes(String(conta!.papel)),
    quem: `${sistema}:${c.sub}`,
    usuario: String(c.sub),
  };
}

// A operação deixaria o sistema sem nenhuma conta de gestão ativa?
async function ficariaSemAdmin(sistema: Sistema, usuario: string, papelNovo: string, ativoNovo: boolean) {
  const { data } = await sb.from("equipe_contas").select("usuario, papel, ativo").eq("sistema", sistema);
  const admins = (data ?? []).filter((c: any) => c.ativo !== false && PAPEIS[sistema].admin.includes(c.papel));
  if (!admins.some((c: any) => c.usuario === usuario)) return false;   // não é admin ativo: não muda a conta
  const continua = ativoNovo && PAPEIS[sistema].admin.includes(papelNovo);
  return admins.length === 1 && !continua;
}

// ---------------------------------------------------------------- painel
// Mesma tabela e MESMO formato de senha que a painel-auth usa (PBKDF2 120k,
// salt 16 bytes, tudo hex, em três colunas). Se isto divergir, a conta criada
// aqui não abre lá — por isso não se reescreve o mecanismo, se repete.
async function painelListar() {
  const { data, error } = await sb.from("painel_contas")
    .select("usuario, nome, permissoes, vendedor_id, atualizado_em").order("usuario");
  if (error) throw new Error(error.message);
  return (data ?? []).map((c: any) => ({
    usuario: c.usuario,
    nome: c.nome || c.usuario,
    papel: (c.permissoes ?? []).includes("*") ? "tudo" : ((c.permissoes ?? []).join(", ") || "nada"),
    ativo: true,                       // o Painel não tem "desativado": ou existe, ou não
    trocarSenha: false,
    atualizadoEm: c.atualizado_em,
    master: c.usuario === masterPainel(),
  }));
}

async function painelSalvar(body: Record<string, any>) {
  const usuario = normalizarUsuario(body.usuario);
  if (!usuario) return json({ erro: "Informe o usuário." }, 400);
  if (usuario === masterPainel()) {
    return json({ erro: "Esta é a conta da direção no Painel: ela já entra e já vê tudo. A senha dela se troca dentro do Painel." }, 400);
  }
  const { data: atual } = await sb.from("painel_contas").select("*").eq("usuario", usuario).maybeSingle();
  const senha = String(body.senha ?? "");
  if (!atual && senha.length < 6) return json({ erro: "Defina uma senha de ao menos 6 caracteres." }, 400);
  if (senha && senha.length < 6) return json({ erro: "A senha precisa ter ao menos 6 caracteres." }, 400);
  const reg = senha ? await hashSenha(senha) : { hash: atual!.hash, salt: atual!.salt, iter: atual!.iter };
  // "tudo" = curinga; qualquer outra coisa vira a lista de módulos informada
  const pedidos: string[] = Array.isArray(body.permissoes) ? body.permissoes : [];
  const permissoes = body.papel === "tudo" ? ["*"]
    : (Array.isArray(body.permissoes) ? pedidos.filter((p: string) => MODULOS_PAINEL.includes(p))
      : (atual?.permissoes ?? []));
  // O que foi pedido e nao existe aqui. Vai na resposta para a tela reclamar --
  // silencio aqui e concessao que nunca aconteceu, e ninguem descobre.
  const descartados = pedidos.filter((p: string) => !MODULOS_PAINEL.includes(p) && p !== "*");
  const { error } = await sb.from("painel_contas").upsert({
    usuario, nome: String(body.nome ?? "").trim() || usuario, permissoes,
    vendedor_id: atual?.vendedor_id ?? "", ...reg, atualizado_em: new Date().toISOString(),
  }, { onConflict: "usuario" });
  if (error) throw new Error(error.message);
  return json({ ok: true, temporaria: false, descartados: descartados.length ? descartados : undefined });
}

async function painelRemover(body: Record<string, any>) {
  const usuario = normalizarUsuario(body.usuario);
  if (!usuario) return json({ erro: "Informe o usuário." }, 400);
  if (usuario === masterPainel()) return json({ erro: "A conta da direção não pode ser removida." }, 400);
  const { error } = await sb.from("painel_contas").delete().eq("usuario", usuario);
  if (error) throw new Error(error.message);
  return json({ ok: true });
}

// ---------------------------------------------------------------- rh
// O RH usa o Supabase Auth de verdade: a senha mora em auth.users e a tabela
// "perfis" só liga a conta a um colaborador e a um perfil. O login é por NOME;
// o e-mail é sintético só porque o Auth exige um.
const emailRh = (usuario: string) => `${usuario.replace(/\s+/g, ".")}@${DOMINIO_RH}`;

async function rhListar() {
  const { data, error } = await sb.from("perfis")
    .select("usuario, nome, perfil, colaborador_id, atualizado_em").order("usuario");
  if (error) throw new Error(error.message);
  return (data ?? []).map((c: any) => ({
    usuario: c.usuario, nome: c.nome || c.usuario, papel: c.perfil,
    ativo: true, trocarSenha: false, atualizadoEm: c.atualizado_em,
  }));
}

async function rhSalvar(body: Record<string, any>) {
  const usuario = normalizarUsuario(body.usuario);
  const perfil = String(body.papel ?? "COLABORADOR");
  if (!usuario) return json({ erro: "Informe o nome." }, 400);
  if (!PAPEIS.rh.todos.includes(perfil)) return json({ erro: "Perfil inválido." }, 400);
  const senha = String(body.senha ?? "");
  const { data: existente } = await sb.from("perfis").select("user_id, colaborador_id, nome").eq("usuario", usuario).maybeSingle();
  if (!existente && senha.length < 6) return json({ erro: "Defina uma senha de ao menos 6 caracteres." }, 400);

  // Conta nova precisa estar ligada a um colaborador — senão o RH mostra uma
  // pessoa que não existe na ficha de ninguém.
  let colaboradorId = existente?.colaborador_id ?? "";
  if (!existente) {
    const { data: regs } = await sb.from("registros").select("id, dados").eq("colecao", "colaboradores");
    const achado = (regs ?? []).find((r: any) =>
      normalizarUsuario((r.dados ?? {}).nome) === usuario);
    if (!achado) {
      return json({ erro: `Não achei "${body.usuario}" entre os colaboradores do RH. Cadastre a pessoa no RH primeiro — o acesso se liga à ficha dela.` }, 400);
    }
    colaboradorId = String(achado.id);
  }

  const email = emailRh(usuario);
  let userId = existente?.user_id ?? "";
  if (existente) {
    if (senha) {
      const { error } = await sb.auth.admin.updateUserById(userId, { password: senha });
      if (error) throw new Error(error.message);
    }
  } else {
    const { data, error } = await sb.auth.admin.createUser({
      email, password: senha, email_confirm: true,
      user_metadata: { nome: String(body.nome ?? body.usuario) },
    });
    if (error) throw new Error(error.message);
    userId = data.user!.id;
  }
  const { error: erroPerfil } = await sb.from("perfis").upsert({
    user_id: userId, usuario, colaborador_id: colaboradorId,
    nome: String(body.nome ?? body.usuario), perfil, atualizado_em: new Date().toISOString(),
  });
  if (erroPerfil) throw new Error(erroPerfil.message);
  return json({ ok: true, temporaria: false });
}

async function rhRemover(body: Record<string, any>) {
  const usuario = normalizarUsuario(body.usuario);
  if (!usuario) return json({ erro: "Informe o nome." }, 400);
  const { data: existente } = await sb.from("perfis").select("user_id").eq("usuario", usuario).maybeSingle();
  if (!existente) return json({ ok: true });                 // já não existe
  const { count } = await sb.from("perfis").select("usuario", { count: "exact", head: true }).eq("perfil", "ADMIN_RH");
  const { data: eu } = await sb.from("perfis").select("perfil").eq("usuario", usuario).maybeSingle();
  if (eu?.perfil === "ADMIN_RH" && (count ?? 0) <= 1) {
    return json({ erro: "Este é o único ADMIN_RH. Promova outra pessoa antes de remover esta." }, 400);
  }
  const { error } = await sb.auth.admin.deleteUser(existente.user_id);   // cascata apaga o perfil
  if (error) throw new Error(error.message);
  return json({ ok: true });
}

async function registrar(sistema: string, usuario: string, acao: string, por: string, detalhe = "") {
  // O histórico é TESTEMUNHA, não dono da operação: se a gravação falhar, a
  // troca de senha (ou o login) tem que acontecer do mesmo jeito. Sem este
  // try, um problema na tabela de log tirava o sistema inteiro do ar.
  try {
    await sb.from("equipe_acessos_log").insert({ sistema, usuario, acao, por, detalhe });
  } catch (e) {
    console.warn("[equipe-auth] log falhou:", (e as Error)?.message);
  }
}

// ---------------------------------------------------------------- elenco
// Os dois apps continuam precisando saber QUEM é da equipe mesmo sem sinal:
// o Brief usa a lista para conferir se alguém foi desligado e para oferecer os
// designers; o PCP, para montar a tela de montagem. Então o elenco (nome, papel,
// ativo) segue dentro da configuração que os aparelhos baixam — mas SEM SENHA
// NENHUMA, que é o que vazava. Esta função reescreve esse elenco a cada mudança,
// para as duas listas nunca discordarem.
const TAB_CFG: Record<Sistema, string> = {
  brief: "brief_config_global",
  pcp: "pcp_config_global",
  compras: "compras_config_global",
};

async function espelharElenco(sistema: Sistema) {
  // Sistema sem tabela de configuração mapeada não tem elenco para espelhar —
  // e não pode derrubar a criação da conta por causa disso.
  if (!TAB_CFG[sistema]) return "";
  const { data: contas } = await sb.from("equipe_contas")
    .select("usuario, nome, papel, ativo").eq("sistema", sistema).order("usuario");
  const { data: linha } = await sb.from(TAB_CFG[sistema]).select("config").eq("id", true).maybeSingle();
  const cfg = (linha?.config ?? {}) as Record<string, any>;
  const antigos: any[] = Array.isArray(cfg.usuarios) ? cfg.usuarios : [];
  const acharId = (u: string) => {
    const a = antigos.find((x) => normalizarUsuario(x.usuario ?? x.nome) === u);
    return a?.id;
  };
  cfg.usuarios = (contas ?? []).map((c: any) => {
    const base: Record<string, unknown> = {
      nome: c.nome || c.usuario, usuario: c.usuario, papel: c.papel, ativo: c.ativo !== false,
    };
    // o Brief liga o designer ao briefing por este id; quem não tem ganha um
    // agora, senão o designer novo não aparece para ser atribuído
    base.id = acharId(c.usuario) || ("u-" + crypto.randomUUID().slice(0, 8));
    return base;                  // repare: SEM campo "senha"
  });
  const { error } = await sb.from(TAB_CFG[sistema])
    .upsert({ id: true, config: cfg, atualizado_em: new Date().toISOString() }, { onConflict: "id" });
  if (error) { console.error("[equipe-auth] espelharElenco", error.message); return error.message; }
  return "";
}

// Nunca devolve hash nem salt para a tela.
const publica = (c: any) => ({
  usuario: c.usuario,
  nome: c.nome || c.usuario,
  papel: c.papel,
  ativo: c.ativo !== false,
  trocarSenha: !!c.trocar_senha,
  atualizadoEm: c.atualizado_em,
  criadoEm: c.criado_em,
});

// Senha errada espera um pouco — força bruta fica cara sem atrapalhar quem digita.
const freia = () => new Promise((r) => setTimeout(r, 400));
const ERRO_LOGIN = "Usuário ou senha incorretos.";

// ------------------------------------------------------------------ handler

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);
  if (!JWT_SECRET) return json({ erro: "EQUIPE_JWT_SECRET ausente" }, 500);

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ erro: "JSON inválido." }, 400); }

  const acao = String(body.acao ?? body.action ?? "");
  const sistema = String(body.sistema ?? "") as Sistema;
  // "historico" com sistema "*" é a visão da Central (todos os sistemas de uma
  // vez) -- por isso ela escapa da lista fechada aqui; quem barra é a checagem
  // de Central lá dentro.
  const precisaSistema = acao !== "eu" && !(acao === "historico" && sistema === "*");
  if (precisaSistema && !SISTEMAS.includes(sistema)) {
    return json({ erro: `sistema inválido (use ${SISTEMAS.join(" ou ")})` }, 400);
  }

  try {
    switch (acao) {
      // -------------------------------------------------------------- login
      case "login": {
        if (EXTERNOS.has(sistema)) {
          return json({ erro: "Este sistema tem login próprio — entre por ele." }, 400);
        }
        const usuario = normalizarUsuario(body.usuario);
        const senha = String(body.senha ?? "");
        if (!usuario || !senha) return json({ erro: "Informe usuário e senha." }, 400);
        const { data: conta } = await sb.from("equipe_contas").select("*")
          .eq("sistema", sistema).eq("usuario", usuario).maybeSingle();
        // Conta inexistente e senha errada precisam ser indistinguíveis, senão
        // dá para descobrir quem tem acesso só tentando nomes.
        if (!conta || !(await conferirSenha(senha, conta))) {
          await freia();
          // Tentativa que falhou também é histórico: é assim que se percebe
          // alguém tentando entrar na conta de outro (ou alguém travado na
          // senha errada, que é o caso comum e merece ajuda).
          await registrar(sistema, usuario, "login-falhou", "-", conta ? "senha errada" : "usuário não existe");
          return json({ erro: ERRO_LOGIN }, 401);
        }
        if (conta.ativo === false) {
          await registrar(sistema, usuario, "login-barrado", "-", "conta desativada");
          return json({ erro: "Este acesso está desativado. Fale com a gestão." }, 403);
        }
        const token = await assinarCracha({ sis: sistema, sub: conta.usuario, nome: conta.nome || conta.usuario, papel: conta.papel });
        await registrar(sistema, conta.usuario, "entrou", `${sistema}:${conta.usuario}`);
        return json({
          token, usuario: conta.usuario, nome: conta.nome || conta.usuario,
          papel: conta.papel, trocarSenha: !!conta.trocar_senha, dias: DIAS,
        });
      }

      // ------------------------------------------------------------- crachá
      // O crachá é emitido POR SISTEMA (claim `sis`), e todas as ações conferem
      // isso -- menos esta, que não conferia. O efeito era concreto: o app do
      // DRE só desloga quem recebe 401, então um crachá do Brief passava aqui,
      // voltava 200 e a TELA do DRE abria para quem nunca teve acesso a ela.
      // Dos dez acessos do Brief, nenhum deveria ver o resultado financeiro.
      case "eu": {
        const c = await lerCracha(bearer(req));
        if (!c || c.sis !== sistema) return json({ erro: "Sessão inválida ou expirada." }, 401);
        return json({ sistema: c.sis, usuario: c.sub, nome: c.nome, papel: c.papel, exp: c.exp });
      }

      case "trocarMinhaSenha": {
        const c = await lerCracha(bearer(req));
        if (!c || c.sis !== sistema) return json({ erro: "Sessão inválida ou expirada." }, 401);
        const nova = String(body.novaSenha ?? "");
        if (nova.length < 6) return json({ erro: "A senha nova precisa de ao menos 6 caracteres." }, 400);
        const { data: conta } = await sb.from("equipe_contas").select("*")
          .eq("sistema", sistema).eq("usuario", c.sub).maybeSingle();
        if (!conta) return json({ erro: "Conta não encontrada." }, 404);
        // Senha temporária (criada por outra pessoa) troca sem pedir a antiga —
        // é justamente a que a pessoa não escolheu.
        if (!conta.trocar_senha) {
          const atual = String(body.senhaAtual ?? "");
          if (!(await conferirSenha(atual, conta))) { await freia(); return json({ erro: "Senha atual incorreta." }, 401); }
        }
        const reg = await hashSenha(nova);
        const { error } = await sb.from("equipe_contas").update({
          ...reg, trocar_senha: false, atualizado_em: new Date().toISOString(),
        }).eq("sistema", sistema).eq("usuario", c.sub);
        if (error) throw new Error(error.message);
        await registrar(sistema, String(c.sub), "trocou-senha", `${sistema}:${c.sub}`);
        return json({ ok: true });
      }

      // --------------------------------------------------------- administrar
      case "listarContas": {
        const q = await quemPede(req, sistema);
        if (!q.admin) return json({ erro: "Apenas a gestão." }, 403);
        if (sistema === "painel") return json({ contas: await painelListar(), papeis: PAPEIS.painel.todos, modulos: MODULOS_PAINEL });
        if (sistema === "rh") return json({ contas: await rhListar(), papeis: PAPEIS.rh.todos });
        const { data, error } = await sb.from("equipe_contas").select("*")
          .eq("sistema", sistema).order("usuario");
        if (error) throw new Error(error.message);
        return json({ contas: (data ?? []).map(publica), papeis: PAPEIS[sistema].todos });
      }

      // ------------------------------------------------------------ histórico
      // O log já era gravado desde sempre — mas não havia por onde LER, então
      // ninguém nunca viu. Esta é a porta: quem administra o sistema vê o
      // histórico DELE; a Central vê o de todos (sistema: "*").
      case "historico": {
        const todos = String(body.sistema ?? "") === "*";
        let q: { central: boolean; admin: boolean; quem: string };
        if (todos) {
          const central = await ehCentral(bearer(req));
          if (!central) return json({ erro: "Apenas a Central." }, 403);
          q = { central: true, admin: true, quem: "central" };
        } else {
          q = await quemPede(req, sistema);
          if (!q.admin) return json({ erro: "Apenas a gestão." }, 403);
        }
        const limite = Math.min(Number(body.limite ?? 200), 500);
        let sel = sb.from("equipe_acessos_log")
          .select("em, sistema, usuario, acao, por, detalhe")
          .order("em", { ascending: false }).limit(limite);
        if (!todos) sel = sel.eq("sistema", sistema);
        if (body.usuario) sel = sel.eq("usuario", normalizarUsuario(body.usuario));
        if (body.acao) sel = sel.eq("acao", String(body.acao));
        const { data, error } = await sel;
        if (error) throw new Error(error.message);
        return json({ linhas: data ?? [] });
      }

      case "salvarConta": {
        const q = await quemPede(req, sistema);
        if (!q.admin) return json({ erro: "Apenas a gestão." }, 403);
        if (sistema === "painel") { const r = await painelSalvar(body); await registrar(sistema, normalizarUsuario(body.usuario), "salvou", q.quem); return r; }
        if (sistema === "rh") { const r = await rhSalvar(body); await registrar(sistema, normalizarUsuario(body.usuario), "salvou", q.quem); return r; }
        const usuario = normalizarUsuario(body.usuario);
        if (!usuario) return json({ erro: "Informe o usuário." }, 400);
        const papel = String(body.papel ?? "");
        if (!PAPEIS[sistema].todos.includes(papel)) {
          return json({ erro: `Papel inválido. Use: ${PAPEIS[sistema].todos.join(", ")}` }, 400);
        }
        const { data: atual } = await sb.from("equipe_contas").select("*")
          .eq("sistema", sistema).eq("usuario", usuario).maybeSingle();
        const senha = String(body.senha ?? "");
        if (!atual && senha.length < 6) return json({ erro: "Defina uma senha de ao menos 6 caracteres." }, 400);
        if (senha && senha.length < 6) return json({ erro: "A senha precisa ter ao menos 6 caracteres." }, 400);
        // Conta existente sem senha no corpo = mantém a que já tem.
        const reg = senha ? await hashSenha(senha) : { hash: atual!.hash, salt: atual!.salt, iter: atual!.iter };
        // Senha definida por outra pessoa nasce temporária: quem entra é
        // obrigado a trocar. Só a própria pessoa deixa de ter senha temporária.
        const trocar = senha ? body.temporaria !== false : !!atual?.trocar_senha;
        const ativoNovo = body.ativo === undefined ? (atual?.ativo ?? true) : !!body.ativo;
        // Ficar com zero admin tranca todo mundo para fora — e a contagem só
        // vale se for feita aqui, no banco: a da tela pode estar velha.
        if (atual && await ficariaSemAdmin(sistema, usuario, papel, ativoNovo)) {
          return json({ erro: "Esta é a única conta de gestão ativa. Crie outra antes de mudar esta." }, 400);
        }
        const { error } = await sb.from("equipe_contas").upsert({
          sistema, usuario, nome: String(body.nome ?? "").trim() || usuario, papel,
          ativo: ativoNovo,
          ...reg, trocar_senha: trocar, atualizado_em: new Date().toISOString(),
        }, { onConflict: "sistema,usuario" });
        if (error) throw new Error(error.message);
        await registrar(sistema, usuario, atual ? (senha ? "trocou-senha" : "editou") : "criou", q.quem);
        const falhaEspelho = await espelharElenco(sistema);
        return json({ ok: true, temporaria: trocar, espelho: !falhaEspelho, erroEspelho: falhaEspelho || undefined });
      }

      case "removerConta": {
        const q = await quemPede(req, sistema);
        if (!q.admin) return json({ erro: "Apenas a gestão." }, 403);
        if (sistema === "painel") { const r = await painelRemover(body); await registrar(sistema, normalizarUsuario(body.usuario), "removeu", q.quem); return r; }
        if (sistema === "rh") { const r = await rhRemover(body); await registrar(sistema, normalizarUsuario(body.usuario), "removeu", q.quem); return r; }
        const usuario = normalizarUsuario(body.usuario);
        if (!usuario) return json({ erro: "Informe o usuário." }, 400);
        if (!q.central && usuario === q.usuario) {
          return json({ erro: "Você não pode remover o próprio acesso." }, 400);
        }
        if (await ficariaSemAdmin(sistema, usuario, "", false)) {
          return json({ erro: "Esta é a única conta de gestão ativa. Crie outra antes de remover esta." }, 400);
        }
        const { error } = await sb.from("equipe_contas").delete()
          .eq("sistema", sistema).eq("usuario", usuario);
        if (error) throw new Error(error.message);
        await registrar(sistema, usuario, "removeu", q.quem);
        const falhaEspelho2 = await espelharElenco(sistema);
        return json({ ok: true, espelho: !falhaEspelho2, erroEspelho: falhaEspelho2 || undefined });
      }

      // ------------------------------------------------------------ mudança
      // Importa as contas que já existiam no JSON de configuração, com a senha
      // que a pessoa já usa — ninguém precisa trocar nada no dia da virada.
      // Autorizada pelo token DAQUELE sistema (ou pela Central) e só cria o que
      // ainda não existe: rodar duas vezes não estraga senha de ninguém.
      case "importar": {
        // SÓ A CENTRAL. Esta ação já aceitou o token do sistema como
        // autorização, e isso era um buraco: esse token vai no JavaScript
        // público do site (brief-medicao/config.js:5), então qualquer visitante
        // podia mandar {acao:"importar", papel:"admin"} e criar um admin com a
        // senha que quisesse. Token que vive num bundle não autoriza nada.
        const q = await quemPede(req, sistema);
        if (!q.central) return json({ erro: "Não autorizado." }, 401);
        const lista = Array.isArray(body.contas) ? body.contas : [];
        if (!lista.length) return json({ erro: "Nada para importar." }, 400);
        const { data: jaTem } = await sb.from("equipe_contas").select("usuario").eq("sistema", sistema);
        const existentes = new Set((jaTem ?? []).map((x: any) => x.usuario));
        const criadas: string[] = [], puladas: string[] = [], recusadas: string[] = [];
        for (const c of lista) {
          const usuario = normalizarUsuario(c.usuario ?? c.nome);
          const senha = String(c.senha ?? "");
          const papel = String(c.papel ?? "");
          if (!usuario || !senha || !PAPEIS[sistema].todos.includes(papel)) { recusadas.push(usuario || "(sem nome)"); continue; }
          if (existentes.has(usuario)) { puladas.push(usuario); continue; }
          const reg = await hashSenha(senha);
          const { error } = await sb.from("equipe_contas").insert({
            sistema, usuario, nome: String(c.nome ?? "").trim() || usuario, papel,
            ativo: c.ativo !== false, ...reg,
            // senha que a pessoa já usava: não força troca, senão a virada
            // tranca a equipe inteira no mesmo dia
            trocar_senha: false,
          });
          if (error) { recusadas.push(usuario); continue; }
          criadas.push(usuario);
        }
        await registrar(sistema, "*", "importou", q.quem || "token-do-sistema",
          `criadas:${criadas.length} puladas:${puladas.length} recusadas:${recusadas.length}`);
        // reescreve o elenco na configuração SEM as senhas — é isto que fecha o
        // vazamento: depois daqui, nenhum aparelho baixa senha de ninguém
        await espelharElenco(sistema);
        return json({ ok: true, criadas, puladas, recusadas });
      }

      case "diag": {
        const q = await quemPede(req, sistema);
        if (!q.admin) return json({ erro: "Apenas a gestão." }, 403);
        const { count } = await sb.from("equipe_contas")
          .select("usuario", { count: "exact", head: true }).eq("sistema", sistema);
        return json({ sistema, contas: count ?? 0, papeis: PAPEIS[sistema].todos, dias: DIAS });
      }

      default:
        return json({ erro: `Ação desconhecida: ${acao}` }, 400);
    }
  } catch (e) {
    console.error("[equipe-auth]", e);
    // Para a Central (que é o dono) vale dizer o que aconteceu: um "Falha
    // interna" genérico escondeu por um bom tempo que o banco estava recusando
    // o sistema novo por causa de uma trava de coluna. Para o resto continua
    // opaco — mensagem de erro é mapa para quem está sondando.
    const q = await quemPede(req, sistema).catch(() => ({ central: false }));
    const detalhe = e instanceof Error ? e.message : String(e);
    return json(q.central ? { erro: "Falha interna: " + detalhe } : { erro: "Falha interna." }, 500);
  }
});
