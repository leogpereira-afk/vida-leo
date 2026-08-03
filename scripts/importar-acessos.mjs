#!/usr/bin/env node
// ============================================================================
// Leva as contas que HOJE moram em texto puro dentro da configuração do Brief e
// do PCP para a tabela equipe_contas, com a senha embaralhada (PBKDF2).
//
// A senha de cada pessoa é MANTIDA: ninguém precisa trocar nada no dia da
// virada. Depois de importar, a própria equipe-auth reescreve a configuração
// SEM o campo "senha" — é isso que fecha o vazamento.
//
// Rodar (o token de cada sistema já é público, vai no bundle do site):
//   node scripts/importar-acessos.mjs brief
//   node scripts/importar-acessos.mjs pcp
//   node scripts/importar-acessos.mjs brief --valendo     ← grava de verdade
//
// Sem --valendo ele só MOSTRA o que faria. Rodar duas vezes não estraga senha
// de ninguém: a equipe-auth pula quem já existe.
// ============================================================================

const BASE = "https://heveemylixartyijxewh.supabase.co/functions/v1";

const SIS = {
  brief: {
    sync: "brief-sync",
    // config.js do repo brief-medicao (o token é público por desenho: vai no
    // JavaScript que qualquer visitante baixa)
    token: process.env.BRIEF_TOKEN || "",
    papeis: ["vendedor", "designer", "admin"],
    // no Brief a conta já tem "usuario" próprio
    ler: (cfg) => (cfg.usuarios || []).map((u) => ({
      usuario: u.usuario, nome: u.nome, papel: u.papel, senha: u.senha, ativo: u.ativo !== false,
    })),
  },
  pcp: {
    sync: "pcp-sync",
    token: process.env.PCP_TOKEN || "",
    papeis: ["admin", "pcp", "montagem", "operacao", "comercial"],
    // no PCP a conta é {nome, papel, senha} — o login é o próprio nome
    ler: (cfg) => (cfg.usuarios || []).map((u) => ({
      usuario: u.nome, nome: u.nome, papel: u.papel, senha: u.senha, ativo: u.ativo !== false,
    })),
  },
};

const sistema = process.argv[2];
const valendo = process.argv.includes("--valendo");
if (!SIS[sistema]) {
  console.error("Use: node scripts/importar-acessos.mjs <brief|pcp> [--valendo]");
  process.exit(1);
}
const S = SIS[sistema];
if (!S.token) {
  console.error(`Falta o token do sistema. Rode com ${sistema.toUpperCase()}_TOKEN=... na frente do comando.`);
  console.error("(é o mesmo valor que está no config.js do site — ele já é público)");
  process.exit(1);
}

const post = async (fn, corpo, cab = {}) => {
  const r = await fetch(`${BASE}/${fn}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-token": S.token, ...cab },
    body: JSON.stringify(corpo),
  });
  const txt = await r.text();
  let dados;
  try { dados = JSON.parse(txt); } catch { dados = { bruto: txt }; }
  return { status: r.status, dados };
};

console.log(`\n▸ lendo a configuração do ${sistema}…`);
const cfgR = await post(S.sync, { action: "getCfg" });
if (cfgR.status !== 200) {
  console.error("não consegui ler a configuração:", cfgR.status, cfgR.dados);
  process.exit(1);
}
const cfg = cfgR.dados.cfg ?? cfgR.dados.config ?? cfgR.dados;
const contas = S.ler(cfg).filter((c) => c.usuario && c.senha);
const semSenha = S.ler(cfg).filter((c) => c.usuario && !c.senha);

console.log(`  ${contas.length} conta(s) com senha para importar`);
contas.forEach((c) => {
  const papelOk = S.papeis.includes(c.papel);
  console.log(`   · ${c.usuario}${c.nome && c.nome !== c.usuario ? ` (${c.nome})` : ""}` +
    ` — ${c.papel}${papelOk ? "" : "  ⚠ PAPEL DESCONHECIDO, será recusado"}` +
    `${c.ativo ? "" : "  [desativado]"}  senha: ${"•".repeat(Math.min(String(c.senha).length, 12))}`);
});
if (semSenha.length) {
  console.log(`\n  ⚠ ${semSenha.length} entrada(s) SEM senha ficam de fora (entravam sem senha nenhuma):`);
  semSenha.forEach((c) => console.log(`   · ${c.usuario} — ${c.papel}`));
}

if (!valendo) {
  console.log(`\n(nada foi gravado — repita com --valendo para valer)\n`);
  process.exit(0);
}

console.log(`\n▸ importando para equipe_contas…`);
const r = await post("equipe-auth", { acao: "importar", sistema, contas });
if (r.status !== 200) {
  console.error("falhou:", r.status, r.dados);
  process.exit(1);
}
console.log(`  criadas: ${r.dados.criadas.length}${r.dados.criadas.length ? " → " + r.dados.criadas.join(", ") : ""}`);
console.log(`  já existiam: ${r.dados.puladas.length}${r.dados.puladas.length ? " → " + r.dados.puladas.join(", ") : ""}`);
if (r.dados.recusadas.length) console.log(`  ⚠ recusadas: ${r.dados.recusadas.join(", ")}`);

console.log(`\n▸ conferindo se a senha saiu da configuração pública…`);
const depois = await post(S.sync, { action: "getCfg" });
const cfg2 = depois.dados.cfg ?? depois.dados.config ?? depois.dados;
const aindaTem = (cfg2.usuarios || []).filter((u) => u.senha != null);
if (aindaTem.length) {
  console.log(`  ✗ AINDA HÁ ${aindaTem.length} senha(s) na configuração — o espelho não rodou.`);
  process.exit(1);
}
console.log(`  ✓ nenhuma senha na configuração. ${(cfg2.usuarios || []).length} pessoa(s) no elenco.\n`);
