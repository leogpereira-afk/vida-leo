// ============================================================================
// empresa.ts — o calendário da empresa dentro da Central (15/09/2026)
//
// POR QUE UMA PORTA NOVA, e não chamar a `painel-agenda` que já existe: a porta
// do Painel exige um crachá assinado com PAINEL_JWT_SECRET e sis "painel". O
// crachá da Central é outro sistema, com outro segredo. Emitir crachá do Painel
// para a Central furaria a regra 1 do padrão da casa — A PORTA CONFERE O
// SISTEMA. O caminho limpo é este: porta da Central, sob o crachá da Central,
// lendo o mesmo banco. É exatamente o que a própria `painel-agenda` fez quando
// precisou do dado do PCP e do RH.
//
// O QUE ESTA PORTA LÊ: public.registros, coleção `eventos` (dona: RH) e as
// cores em public.config_global. MAIS NADA.
//
// O QUE ELA NUNCA DEVOLVE, e por quê:
//   - Dinheiro (título, valor de O.S., pagamento). Calendário não é caixa.
//   - Ficha de pessoa do RH: aniversário, férias, exame agendado, NR vencendo,
//     dia de pagamento. É ordem do dono, de 14/09/2026, e vale aqui também:
//     as coleções colaboradores, ferias, documentos e certificacoesNr não são
//     consultadas em lugar nenhum deste arquivo. Não há o que filtrar na tela
//     porque não há o que chegar.
//   - CNPJ/CPF, telefone ou WhatsApp de cliente.
//
// RECORRÊNCIA ANUAL: o evento anual casa só pelo MÊS E DIA (feriado fixo, data
// comemorativa, fundação da empresa) e é materializado em cada ano da janela.
// A regra é a mesma de painel-agenda/index.ts — se ela mudar lá, muda aqui.
// ============================================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type Registro = Record<string, unknown>;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "content-type": "application/json" } });

const texto = (v: unknown, max = 200): string =>
  (v == null ? "" : String(v)).trim().slice(0, max);

const CORES_DE_FABRICA: Record<string, string> = {
  "Comemorativa": "#2563eb",
  "Reunião": "#16334f",
  "Feriado": "#dc2626",
  "Empresa": "#16a34a",
  "Outro": "#64748b",
};
const COR_PADRAO = "#64748b";
const COR_OK = /^#[0-9a-fA-F]{3,8}$/;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

/* Janela de anos materializados. Passado de um ano serve para a Agenda mostrar
   o que já passou no mês que o Léo estiver olhando; futuro de dois anos cobre
   o planejamento sem inchar a resposta. */
const ANOS_ATRAS = 1;
const ANOS_FRENTE = 2;

async function lerEventos(sb: SupabaseClient): Promise<Registro[]> {
  const saida: Registro[] = [];
  let ultimo = "";
  /* Paginado: o PostgREST corta em 1000 linhas SEM avisar, e um calendário que
     perde o fim da lista some com feriado sem dizer nada. */
  for (let pagina = 0; pagina < 100; pagina++) {
    const { data, error } = await sb.from("registros")
      .select("id, registro")
      .eq("colecao", "eventos")
      .eq("apagado", false)
      .gt("id", ultimo)
      .order("id", { ascending: true })
      .limit(500);
    if (error) throw new Error("registros: " + error.message);
    const linhas = (data ?? []) as Registro[];
    for (const l of linhas) saida.push(l);
    if (linhas.length < 500) return saida;
    ultimo = String(linhas[linhas.length - 1].id ?? "");
  }
  throw new Error("Leitura de eventos passou de 100 páginas; conferir a origem.");
}

async function cores(sb: SupabaseClient): Promise<Record<string, string>> {
  const { data, error } = await sb.from("config_global").select("config").eq("id", true).maybeSingle();
  /* O erro é CONFERIDO. Descartado, uma falha passageira devolveria 200 com
     todo tipo em cinza, e quem olhasse concluiria que a cor se perdeu no RH. */
  if (error) throw new Error("config_global: " + error.message);
  const cfg = (data?.config ?? {}) as Registro;
  const out: Record<string, string> = { ...CORES_DE_FABRICA };
  const lista = Array.isArray(cfg.tiposEventoPersonalizados) ? cfg.tiposEventoPersonalizados : [];
  for (const t of lista as Registro[]) {
    const nome = texto(t?.nome, 40);
    const cor = texto(t?.cor, 9);
    if (nome && !out[nome]) out[nome] = COR_OK.test(cor) ? cor : COR_PADRAO;
  }
  return out;
}

/* 29 DE FEVEREIRO: um evento anual gravado em 2024-02-29 casa com fevereiro de
   TODO ano. Remontar como "2027-02-29" produz data que não existe — a grade do
   mês vai até 28 e o evento sumiria. Prende-se ao último dia do mês, que é
   onde a empresa o comemora. */
function noAno(dia: string, ano: number): string {
  const mes = Number(dia.slice(5, 7));
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const d = Math.min(Number(dia.slice(8, 10)), ultimoDia);
  return `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export async function empresaAcao(acao: string, sb: SupabaseClient, hojeIso: string): Promise<Response> {
  if (acao !== "empresaDatas") return json({ erro: "ação inválida" }, 400);
  try {
    const [linhas, paleta] = await Promise.all([lerEventos(sb), cores(sb)]);
    const anoBase = Number(hojeIso.slice(0, 4)) || new Date().getUTCFullYear();
    const eventos: Registro[] = [];
    for (const l of linhas) {
      const e = (l.registro ?? {}) as Registro;
      const dia = texto(e.data, 10);
      if (!DIA.test(dia)) continue;
      const tipo = texto(e.tipo, 40) || "Outro";
      const base = {
        id: texto(l.id, 60) || texto(e.id, 60),
        titulo: texto(e.titulo, 160),
        tipo,
        cor: paleta[tipo] || COR_PADRAO,
        hora: texto(e.hora, 5),
        descricao: texto(e.descricao, 400),
        recorrenteAnual: !!e.recorrenteAnual,
      };
      if (!e.recorrenteAnual) { eventos.push({ ...base, data: dia }); continue; }
      for (let ano = anoBase - ANOS_ATRAS; ano <= anoBase + ANOS_FRENTE; ano++) {
        eventos.push({ ...base, id: base.id + "@" + ano, data: noAno(dia, ano) });
      }
    }
    eventos.sort((a, b) => String(a.data).localeCompare(String(b.data)));
    return json({ eventos, em: new Date().toISOString() });
  } catch (e) {
    return json({ erro: (e as Error)?.message || "Não deu para ler o calendário da empresa." }, 500);
  }
}
