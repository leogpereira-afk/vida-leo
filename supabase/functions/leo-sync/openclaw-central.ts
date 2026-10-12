import { validarCamposCentral } from "./central-catalogo.ts";
import { dataValida } from "./financeiro.ts";

// A mesma política é usada ao preparar a prévia e ao conferir a requisição
// na ponte. As listas com vínculos cruzados continuam fora desta automação.
export const LISTAS_FORA_CENTRAL = new Set([
  "empresasPJ", "liderancas", "planejamentoEmpresas", "organogramas", "obraM2Fora", "obras", "obraAportes", "contabilidades", "contas", "empreend", "casas", "reservas",
  "gmailDispensados", "gmailPendentes", "planilhas",
]);
export const SUBLISTAS_CENTRAL: Record<string, string[]> = {
  viagens: ["custos", "passagens", "hoteis", "tickets", "roteiro", "lugares"],
  metas: ["passos"],
  oportunidades: ["links"],
  acervoDocumental: ["registros"],
};
const NOME_LISTA = /^[A-Za-z][A-Za-z0-9]{1,40}$/;
const LIMITE_JSON_CENTRAL = 20_000;
const CAMPOS: Record<string, string[]> = {
  hotel: ["nome", "entrada", "saida", "reserva", "valor", "endereco", "telefone", "cafe", "horaEnt", "horaSai", "obs"],
  viagem: ["cidade", "ida", "volta", "tipo", "status", "obs", "internacional", "transporte", "evento"],
  demanda: ["titulo", "prazo", "prioridade", "status", "obs"],
};
export interface RegistroCentralLocalizado {
  tipo: "viagem" | "hotel" | "demanda";
  id: string;
  esperado: unknown;
  dados: Record<string, unknown>;
  chave: string;
}
export interface LancamentoCentral {
  operacao: "adicionar" | "atualizar";
  lista: string;
  id: string;
  sublista: string;
  subitemId?: string;
  semelhantes?: string[];
  dados: Record<string, unknown>;
}
export interface RegistroCentralLista {
  tipo: "lista";
  lancamento: LancamentoCentral;
  esperado: unknown;
  versaoEsperada: string;
  chave: string;
}
export interface RegistroCentralDesfazer {
  tipo: "desfazer";
  lancamento: number;
  lista: string;
  itemId: string;
}
export type RegistroCentral = RegistroCentralLocalizado | RegistroCentralLista | RegistroCentralDesfazer;

export function validarLancamentoCentral(entrada: unknown): LancamentoCentral {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) throw new Error("Lançamento inválido.");
  const e = entrada as Record<string, unknown>;
  if (e.operacao !== "adicionar" && e.operacao !== "atualizar") throw new Error("Operação deve ser adicionar ou atualizar.");
  const lista = String(e.lista ?? "").trim();
  const id = String(e.id ?? "").trim();
  const sublista = String(e.sublista ?? "").trim();
  const subitemId = String(e.subitemId ?? "").trim();
  if(subitemId.length>150 || (subitemId && (!sublista || e.operacao!=="atualizar")))throw Error("ID de subitem inválido.");
  if (!NOME_LISTA.test(lista)) throw new Error("Lista inválida.");
  if (LISTAS_FORA_CENTRAL.has(lista)) throw new Error(`A lista ${lista} não pode ser alterada pelo Don Boy.`);
  if (id.length > 150) throw new Error("ID do item longo demais.");
  if (e.operacao === "atualizar" && !id) throw new Error("Informe o ID exato do item que será atualizado.");
  if (sublista) {
    if (!id || (e.operacao === "atualizar" && !subitemId) || !(SUBLISTAS_CENTRAL[lista] ?? []).includes(sublista)) {
      throw new Error("Sublista ou item inválido.");
    }
  } else if (e.operacao === "adicionar" && id) {
    throw new Error("Para adicionar item novo, deixe o ID vazio; para sublista, informe a sublista.");
  }
  const dados = e.dados;
  if (!dados || typeof dados !== "object" || Array.isArray(dados) || !Object.keys(dados).length) {
    throw new Error("Dados precisam ser um objeto com campos.");
  }
  if (JSON.stringify(dados).length > LIMITE_JSON_CENTRAL) throw new Error("Dados grandes demais para um lançamento.");
  for (const nome of SUBLISTAS_CENTRAL[lista] ?? []) {
    const valor = (dados as Record<string, unknown>)[nome];
    if (valor !== undefined && (!Array.isArray(valor) || valor.some((item) => !item || typeof item !== "object" || Array.isArray(item)))) {
      throw new Error(`${nome} precisa ser uma lista de itens.`);
    }
  }
  validarCamposCentral(lista, sublista, dados as Record<string, unknown>, e.operacao === "adicionar");
  return { operacao: e.operacao, lista, id, sublista, ...(subitemId?{subitemId}:{}), dados: dados as Record<string, unknown> };
}
export function validarRegistroCentral(tipo: string, id: string, dados: unknown): Record<string, unknown> {
  if (!CAMPOS[tipo]) throw new Error("Tipo não permitido.");
  if (tipo === "hotel" && !id) throw new Error("Consulte primeiro o ID exato da viagem.");
  if (id.length > 150 || !dados || typeof dados !== "object" || Array.isArray(dados)) {
    throw new Error("Registro inválido.");
  }
  const r = { ...dados } as Record<string, unknown>;
  if (!Object.keys(r).length) throw new Error("Nenhum campo informado.");
  for (const [k, v] of Object.entries(r)) {
    if (!CAMPOS[tipo]!.includes(k)) throw new Error("Campo não permitido: " + k);
    if (["entrada", "saida", "ida", "volta", "prazo"].includes(k) && !dataValida(String(v))) {
      throw new Error("Data inválida: " + k);
    }
    if (k === "valor") {
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw new Error("Valor inválido.");
    } else if (k === "internacional") { if (typeof v !== "boolean") throw new Error("Campo inválido: " + k); }
    else if (typeof v !== "string" || v.length > 4000) throw new Error("Texto inválido: " + k);
  }
  if (tipo === "hotel" && (!r.nome || !r.entrada || !r.saida || String(r.saida) <= String(r.entrada))) {
    throw new Error("Informe hotel e período válido.");
  }
  if (!id && tipo === "viagem" && !r.cidade) throw new Error("Informe a cidade.");
  if (!id && tipo === "demanda" && !r.titulo) throw new Error("Informe o título.");
  if (r.ida && r.volta && String(r.volta) < String(r.ida)) throw new Error("Volta anterior à ida.");
  if (tipo === "demanda") {
    if (r.status && !["Aberta", "Fazendo", "Parada", "Concluída"].includes(String(r.status))) {
      throw new Error("Status inválido para demanda.");
    }
    if (r.prioridade && !["Alta", "Média", "Baixa"].includes(String(r.prioridade))) {
      throw new Error("Prioridade inválida.");
    }
    if (!id) {
      r.status ??= "Aberta";
      r.prioridade ??= "Média";
    }
  }
  if (tipo === "viagem" && !id) r.status ??= "Em Planejamento";
  return r;
}
export function previaRegistroCentral(r: RegistroCentral): string {
  if (r.tipo === "desfazer") return [
    "DESFAZER LANÇAMENTO NA CENTRAL DO LÉO",
    `Lançamento: #${r.lancamento}`,
    `Lista: ${r.lista}`,
    `Item: ${r.itemId}`,
    "",
    "O item voltará ao estado anterior somente se ninguém o alterou depois. Confira e toque em Desfazer.",
  ].join("\n");
  if (r.tipo === "lista") {
    const p = r.lancamento;
    return [
      "REGISTRAR NA CENTRAL DO LÉO",
      `Operação: ${p.operacao === "adicionar" ? "Adicionar" : "Atualizar"}`,
      `Lista: ${p.lista}`,
      ...(p.id ? [`Item: ${p.id}`] : []),
      ...(p.sublista ? [`Sublista: ${p.sublista}`] : []),
      ...(p.subitemId ? [`Subitem: ${p.subitemId}`] : []),
      ...(p.semelhantes?.length ? [`Atenção: ${p.semelhantes.length} registro(s) semelhante(s) já existem. Toque Registrar somente se este for outro registro legítimo.`] : []),
      "",
      ...Object.entries(p.dados).filter(([k]) => k !== "id" && k !== "_mt")
        .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`),
      "",
      "Só os campos acima serão registrados. Se o item mudar antes do toque, será necessária uma nova conferência.",
    ].join("\n");
  }
  const alvo = r.esperado as Record<string, unknown> | null;
  return [
    "REGISTRAR NA CENTRAL DO LÉO",
    `Tipo: ${r.tipo}`,
    `Cadastro: ${alvo?.cidade ?? alvo?.titulo ?? r.id}`,
    "",
    ...Object.entries(r.dados).filter(([k]) => k !== "id").map(([k, v]) => `${k}: ${v}`),
    "",
    "Só os campos acima serão registrados. Se o cadastro mudar, será necessária uma nova conferência.",
  ].join("\n");
}
