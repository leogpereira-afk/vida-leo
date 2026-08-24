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
            .order("data", { ascending: true }).range(de, de + passo - 1);
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
        // sem `refs` = o índice inteiro (a tela precisa saber quem tem anexo)
        let q = sb.from("leo_arquivos").select("id, ref, nome, tipo, tam, em");
        const refs = Array.isArray(corpo.refs) ? corpo.refs.map(String) : null;
        if (refs) {
          if (!refs.length) return json({ arquivos: [] });
          q = q.in("ref", refs);
        }
        const { data, error } = await q.order("criado_em", { ascending: true });
        if (error) return json({ erro: error.message }, 500);
        return json({ arquivos: data ?? [] });
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
      const { data: reg } = await sb.from("leo_arquivos")
        .select("caminho").eq("id", id).maybeSingle();
      if (reg?.caminho) await balde.remove([reg.caminho]);
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
