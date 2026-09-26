// equipe-auth, acao trocarMinhaSenha: quando a senha atual pode ser dispensada.
//
// O BURACO (achado 9 do contrato das senhas): com a conta marcada como
// provisoria (`equipe_contas.trocar_senha`), a troca nao pedia a senha atual e
// espalhava a nova para todas as linhas da pessoa, para o Painel, para a
// entrada unica (Supabase Auth) e para a guarda de senhas antigas. O cracha
// vale 30 dias e fica num localStorage que 11 sistemas dividem: logo depois de
// a direcao definir uma provisoria, qualquer cracha ANTIGO da pessoa escolhia
// a senha nova dela em todos os lugares sem saber senha nenhuma. E a atual
// errada so custava 400 ms, sem limite de tentativas.
//
// Os primeiros testes sao os do caso ruim.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bancoFalso, carregar, cracha, escritas, fichasDoFreio, hashDe, POR_QUE_PULOU,
} from "./helpers/equipe-auth.mjs";

const PROVISORIA = "pedra-verde-chuva-123";
const DELA = "a-senha-que-ela-escolheu";
const NOVA = "senha-nova-escolhida";
const agora = () => Math.floor(Date.now() / 1000);
const iso = (seg) => new Date(seg * 1000).toISOString();

/** A pessoa `ana`: conta no Brief e no PCP, no Painel, e ja na entrada unica. */
async function cenario({ provisoria, gravadaEm, senha = provisoria ? PROVISORIA : DELA, falhas } = {}) {
  const h = await hashDe(senha);
  const linha = (sistema) => ({
    sistema, usuario: "ana", nome: "Ana", papel: sistema === "brief" ? "vendedor" : "comercial",
    ativo: true, ...h, trocar_senha: !!provisoria,
    criado_em: iso(agora() - 90 * 86400), atualizado_em: iso(gravadaEm ?? agora() - 30 * 86400),
  });
  const banco = bancoFalso({
    estado: {
      equipe_contas: [linha("brief"), linha("pcp")],
      painel_contas: [{ usuario: "ana", nome: "Ana", permissoes: ["orcamentos"], ...h, atualizado_em: iso(agora() - 86400) }],
      acesso_conta: [{ id: "conta-ana", usuario: "ana", auth_user_id: "auth-ana" }],
      acesso_senha_legado: [{ conta_id: "conta-ana", origem: "central", ...h }],
    },
    auth: { "auth-ana": { senha } },
    falhas,
  });
  const fotoInicial = JSON.stringify(banco.tabelas);
  return { banco, fotoInicial };
}

/** Nada foi gravado em lugar nenhum: tabelas de senha, Painel, guarda e Auth. */
function nadaGravado(banco, fotoInicial, contexto) {
  assert.deepEqual(escritas(banco), [], `${contexto}: nenhuma escrita fora do historico`);
  const semLog = (t) => { const c = JSON.parse(t); delete c.equipe_acessos_log; return c; };
  assert.deepEqual(semLog(JSON.stringify(banco.tabelas)), semLog(fotoInicial), `${contexto}: tabelas intactas`);
  assert.equal(banco.usuarios.get("auth-ana").senha !== NOVA, true, `${contexto}: entrada unica intacta`);
}

/** A senha nova chegou a todos os lugares (o comportamento de antes, que fica). */
async function trocouEmTudo(banco) {
  const h = await hashDe(NOVA, banco.tabelas.equipe_contas[0].salt);
  for (const l of banco.tabelas.equipe_contas) {
    assert.equal(l.hash, h.hash, `equipe_contas ${l.sistema} com a senha nova`);
    assert.equal(l.trocar_senha, false, `equipe_contas ${l.sistema} deixa de ser provisoria`);
  }
  const p = banco.tabelas.painel_contas[0];
  assert.equal((await hashDe(NOVA, p.salt)).hash, p.hash, "painel_contas com a senha nova");
  assert.equal(banco.usuarios.get("auth-ana").senha, NOVA, "entrada unica com a senha nova");
  const guarda = banco.tabelas.acesso_senha_legado;
  assert.equal(guarda.length, 1, "a guarda vira uma linha so");
  assert.equal(guarda[0].origem, "propria");
  assert.equal((await hashDe(NOVA, guarda[0].salt)).hash, guarda[0].hash, "guarda com a senha nova");
}

async function montar(t, opcoes) {
  const { banco, fotoInicial } = await cenario(opcoes);
  const fn = await carregar(banco);
  if (!fn) { t.skip(POR_QUE_PULOU); return null; }
  return { banco, fotoInicial, fn };
}

const trocar = (fn, token, extra = {}) =>
  fn.chamar(token, { acao: "trocarMinhaSenha", sistema: "brief", novaSenha: NOVA, ...extra });

// ------------------------------------------------------------ o caso ruim

test("cracha ANTIGO + senha provisoria: sem a atual, 401 pedindo a provisoria e nada gravado", async (t) => {
  const m = await montar(t, { provisoria: true, gravadaEm: agora() - 60 });
  if (!m) return;
  const velho = cracha({ sis: "brief", sub: "ana", iat: agora() - 10 * 86400 });
  const r = await trocar(m.fn, velho);
  assert.equal(r.status, 401);
  assert.equal(r.body.erro, "Digite a senha atual (a provisória que você recebeu).");
  assert.notEqual(r.body.ok, true);
  nadaGravado(m.banco, m.fotoInicial, "cracha antigo sem a atual");
  assert.equal(fichasDoFreio(m.banco).length, 0, "sem senha digitada nao e tentativa: nao gasta ficha");
  const log = m.banco.tabelas.equipe_acessos_log;
  assert.equal(log.at(-1)?.acao, "troca-barrada", "a tentativa fica no historico");
});

test("cracha antigo + provisoria + atual ERRADA: 401 e nada gravado; o texto digitado nao vai ao log", async (t) => {
  const m = await montar(t, { provisoria: true, gravadaEm: agora() - 60 });
  if (!m) return;
  const velho = cracha({ sis: "brief", sub: "ana", iat: agora() - 10 * 86400 });
  const r = await trocar(m.fn, velho, { senhaAtual: "chute-qualquer-987" });
  assert.equal(r.status, 401);
  assert.equal(r.body.erro, "Senha atual incorreta.");
  nadaGravado(m.banco, m.fotoInicial, "atual errada");
  assert.equal(m.banco.tabelas.equipe_acessos_log.at(-1)?.acao, "senha-atual-errada");
  assert.doesNotMatch(JSON.stringify(m.banco.tabelas.equipe_acessos_log), /chute-qualquer-987/);
});

test("cracha SEM iat conta como antigo: pede a atual", async (t) => {
  const m = await montar(t, { provisoria: true, gravadaEm: agora() - 3600 });
  if (!m) return;
  const r = await trocar(m.fn, cracha({ sis: "brief", sub: "ana", iat: null }));
  assert.equal(r.status, 401);
  assert.equal(r.body.erro, "Digite a senha atual (a provisória que você recebeu).");
  nadaGravado(m.banco, m.fotoInicial, "cracha sem iat");
});

test("senha atual errada ate travar: a 11a tentativa e barrada ANTES de conferir, mesmo com a senha certa", async (t) => {
  // O limite e o da funcao de banco public.porta_travada (10 tentativas em 15
  // minutos), a mesma que o login usa; o falso segue a mesma conta.
  const m = await montar(t, { provisoria: true, gravadaEm: agora() - 60 });
  if (!m) return;
  const velho = cracha({ sis: "brief", sub: "ana", iat: agora() - 10 * 86400 });
  for (let i = 1; i <= 10; i++) {
    const r = await trocar(m.fn, velho, { senhaAtual: `chute-${i}` });
    assert.equal(r.status, 401, `tentativa ${i}`);
  }
  const r = await trocar(m.fn, velho, { senhaAtual: PROVISORIA });
  assert.equal(r.status, 429, "travada: nem a senha certa passa");
  assert.match(r.body.erro, /Muitas tentativas/);
  nadaGravado(m.banco, m.fotoInicial, "freio");
  const fichas = fichasDoFreio(m.banco);
  assert.equal(fichas.length, 11, "uma ficha por tentativa");
  for (const f of fichas) assert.deepEqual(f.args, { p_sistema: "senha-atual", p_usuario: "ana" });
  assert.equal(m.banco.tabelas.equipe_acessos_log.at(-1)?.acao, "troca-barrada");
});

test("rpc do freio com erro: 503 e nada gravado (nunca libera)", async (t) => {
  for (const [nome, opcoes, senhaAtual] of [
    ["cracha antigo + provisoria", { provisoria: true, gravadaEm: agora() - 60 }, PROVISORIA],
    ["conta normal", { provisoria: false }, DELA],
  ]) {
    const m = await montar(t, { ...opcoes, falhas: { rpc: { porta_travada: { message: "banco fora do ar (simulado)" } } } });
    if (!m) return;
    const velho = cracha({ sis: "brief", sub: "ana", iat: agora() - 10 * 86400 });
    const r = await trocar(m.fn, velho, { senhaAtual });
    assert.equal(r.status, 503, nome);
    nadaGravado(m.banco, m.fotoInicial, nome);
  }
});

// -------------------------------------------------- o que continua valendo

test("cracha NOVO (entrou com a provisoria) troca sem a atual e espalha como antes", async (t) => {
  const m = await montar(t, { provisoria: true, gravadaEm: agora() - 3600 });
  if (!m) return;
  const novo = cracha({ sis: "brief", sub: "ana", iat: agora() - 30 });
  const r = await trocar(m.fn, novo);
  assert.equal(r.status, 200, r.texto);
  assert.equal(r.body.ok, true);
  await trocouEmTudo(m.banco);
  assert.equal(fichasDoFreio(m.banco).length, 0, "caminho da tela obrigatoria nao gasta ficha");
});

test("cracha antigo que SABE a provisoria troca normalmente", async (t) => {
  const m = await montar(t, { provisoria: true, gravadaEm: agora() - 60 });
  if (!m) return;
  const velho = cracha({ sis: "brief", sub: "ana", iat: agora() - 10 * 86400 });
  const r = await trocar(m.fn, velho, { senhaAtual: PROVISORIA });
  assert.equal(r.status, 200, r.texto);
  await trocouEmTudo(m.banco);
});

test("conta normal com a atual certa troca como antes, passando pelo freio", async (t) => {
  const m = await montar(t, { provisoria: false });
  if (!m) return;
  const r = await trocar(m.fn, cracha({ sis: "brief", sub: "ana" }), { senhaAtual: DELA });
  assert.equal(r.status, 200, r.texto);
  await trocouEmTudo(m.banco);
  const fichas = fichasDoFreio(m.banco);
  assert.equal(fichas.length, 1);
  assert.deepEqual(fichas[0].args, { p_sistema: "senha-atual", p_usuario: "ana" });
});

test("conta normal: cracha novo nao dispensa a atual", async (t) => {
  const m = await montar(t, { provisoria: false });
  if (!m) return;
  const r = await trocar(m.fn, cracha({ sis: "brief", sub: "ana" }));
  assert.equal(r.status, 401);
  assert.equal(r.body.erro, "Senha atual incorreta.");
  nadaGravado(m.banco, m.fotoInicial, "conta normal sem a atual");
});

test("fronteira do segundo: o iat vem arredondado para baixo, e so o do mesmo segundo ou depois dispensa", async (t) => {
  // Provisoria gravada no meio de um segundo S.
  const S = agora() - 120;
  for (const [iat, esperado] of [[S, 200], [S - 1, 401]]) {
    const { banco } = await cenario({ provisoria: true });
    for (const l of banco.tabelas.equipe_contas) l.atualizado_em = new Date(S * 1000 + 500).toISOString();
    const fn = await carregar(banco);
    if (!fn) { t.skip(POR_QUE_PULOU); return; }
    const r = await trocar(fn, cracha({ sis: "brief", sub: "ana", iat }));
    assert.equal(r.status, esperado, `iat ${iat - S} s do segundo da gravacao`);
  }
});

test("carimbo ilegivel na conta: pede a atual", async (t) => {
  const { banco } = await cenario({ provisoria: true });
  for (const l of banco.tabelas.equipe_contas) l.atualizado_em = null;
  const fotoInicial = JSON.stringify(banco.tabelas);
  const fn = await carregar(banco);
  if (!fn) { t.skip(POR_QUE_PULOU); return; }
  const r = await trocar(fn, cracha({ sis: "brief", sub: "ana" }));
  assert.equal(r.status, 401);
  nadaGravado(banco, fotoInicial, "sem carimbo");
});
