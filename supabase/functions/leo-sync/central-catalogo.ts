import { dataValida } from './financeiro.ts';
type Campo = { tipo: 'texto'|'numero'|'data'|'mes'|'booleano'|'passos'; min?:number; max?:number; inteiro?:boolean; opcoes?:string[] };
type Area = { destino:string; campos:Record<string,Campo>; obrigatorios:string[]; orientacao:string };
const texto:Campo={tipo:'texto'},numero:Campo={tipo:'numero',min:0},data:Campo={tipo:'data'},mes:Campo={tipo:'mes'};
const campos=(nomes:string,tipo:Campo=texto)=>Object.fromEntries(nomes.split(' ').filter(Boolean).map(n=>[n,tipo]));
const area=(destino:string,c:Record<string,Campo>,obrigatorios:string[],orientacao=''):Area=>({destino,campos:c,obrigatorios,orientacao});
const recorrente={valor:numero,ciclo:{tipo:'texto',opcoes:['Mensal','Anual']} as Campo,pago:texto,obs:texto};
export const CATALOGO_CENTRAL:Record<string,Area>={
 'metas.passos':area('Meta → Passos',{texto,feito:{tipo:'booleano'}},['texto'],'Para editar, use o ID do pai e subitemId do passo.'),
 patrimonio:area('Patrimônio pessoal',{...campos('nome tipo onde situacao documento obs'),valor:numero,falta:numero,avaliadoEm:data},['nome','tipo'],'Avaliação não é renda nem saldo. Não altera vínculo empresarial ou histórico de avaliações.'),
 pdi:area('Guia → Desenvolvimento',{...campos('habilidade area status como medida porque'),ate:data},['habilidade']),
 rituais:area('Guia → Rituais',{...campos('ritual comQuem frequencia obs'),ultima:data},['ritual']),
 paraEles:area('Guia → Pessoas e ideias',{...campos('oque pessoa tipo status'),quando:data},['oque','pessoa']),
 gastos:area('Gastos pessoais',{...campos('oque classe pago obs origemRef'),valor:{tipo:'numero'},mes,data,vencimento:data,pagoEm:data,situacao:{tipo:'texto',opcoes:['Não informado','Pendente','Pago']},natureza:{tipo:'texto',opcoes:['Despesa pessoal','Estorno']},parcela:{tipo:'numero',min:1,inteiro:true},parcelas:{tipo:'numero',min:1,inteiro:true}},['oque','classe','valor','mes'],'BRL. pago é FORMA de pagamento, não quitação. Negativo somente estorno explicitamente informado. Não duplicar recorrentes, viagens ou avião. Não lançar gastos empresariais ou transferências como despesa pessoal.'),
 'viagens.custos':area('Viagem → Centro de custo',{...campos('categoria descricao pago'),valor:numero,data},['categoria','descricao','valor'],'BRL. Exige ID exato da viagem; não repetir em Gastos. pago é forma de pagamento. Não lançar moeda estrangeira como reais; pedir valor convertido quando não informado.'),
 casa:area('Gastos → Casa',{...recorrente,...campos('item onde'),dia:{tipo:'numero',min:1,max:31,inteiro:true},status:{tipo:'texto',opcoes:['Ativo','Cancelado']}},['item','valor','ciclo','status'],'Cadastro recorrente, não pagamento individual. Não repetir a mesma despesa em Gastos.'),
 assinaturas:area('Gastos → Assinaturas',{...recorrente,nome:texto,dia:{tipo:'numero',min:1,max:31,inteiro:true},status:{tipo:'texto',opcoes:['Ativa','Cancelar']}},['nome','valor','ciclo','status']),
 seguros:area('Gastos → Seguros',{...recorrente,...campos('tipo item seguradora apolice beneficiarios telefone titular'),capital:numero,renova:data,status:{tipo:'texto',opcoes:['Ativo','Cancelado']}},['tipo','item','valor','ciclo','status']),
 planos:area('Gastos → Plano de saúde',{...recorrente,...campos('quem operadora plano carteirinha acomodacao'),status:{tipo:'texto',opcoes:['Ativo','Cancelado']}},['quem','operadora','valor','ciclo','status']),
 rendimentos:area('Rendimentos pessoais',{...campos('empresa instituicao tipo obs'),data,valor:numero},['data','tipo','valor'],'Receita pessoal efetiva; empresa indica origem do rendimento, não faturamento da empresa. Transferência entre contas próprias não é rendimento.'),
 peso:area('Saúde → Medidas',{data,peso:{tipo:'numero',min:0.1},altura:{tipo:'numero',min:0.1},cintura:{tipo:'numero',min:0.1},obs:texto},['data','peso'],'Peso em kg; altura em m ou cm conforme informado; cintura em cm. Não inferir diagnóstico.'),
 vitais:area('Saúde → Sinais vitais',{data,...campos('sis dia fc',{tipo:'numero',min:1}),obs:texto},['data'],'sis/dia em mmHg; fc em bpm. Pelo menos uma medida. Não confundir 12/8 com 12/8 mmHg; esclarecer unidade ambígua.'),
 consultas:area('Saúde → Consultas',{...campos('especialidade profissional queixaId motivo conduta obs'),data,retorno:data},['especialidade','data'],'Registro da consulta no painel não cria evento no Google Agenda.'),
 exames:area('Saúde → Exames',{...campos('exame valor unidade medico resultado obs'),data,proximo:data},['data','exame'],'Transcrever resultado e unidade do laudo; não inventar normalidade ou diagnóstico.'),
 tratamentos:area('Saúde → Tratamentos',{...campos('oque motivo frequencia status medico obs'),inicio:data,fim:data},['oque'],'Dose/frequência somente conforme informação ou prescrição. Não sincroniza automaticamente a base separada de medicamentos do Don Boy.'),
 vacinas:area('Saúde → Vacinas',{...campos('vacina viagem obs'),data,proxima:data},['vacina','data']),
 queixas:area('Saúde → Queixas',{...campos('oque onde situacao obs'),data,intensidade:{tipo:'numero',min:0,max:10}},['oque','data']),
 fisio:area('Saúde → Fisioterapia',{...campos('oque queixaId profissional obs'),data,...campos('sessao total',{tipo:'numero',min:1,inteiro:true}),...campos('dorAntes dorDepois',{tipo:'numero',min:0,max:10})},['oque','data']),
 pessoas:area('Guia de vida → Pessoas',{...campos('nome relacao gosta obs'),nascimento:data},['nome'],'Léo é Leonardo; Leo é o filho. Não fundir pessoas por nome parecido.'),
 documentos:area('Documentos pessoais',{...campos('nome dono numero onde obs'),validade:data},['nome','dono'],'Cadastro não é upload do original. Só declarar anexo guardado após confirmação do armazenamento.'),
 metas:area('Guia de vida → Metas',{...campos('meta area horizonte status obs'),prazo:data,passos:{tipo:'passos'}},['meta'],'Passos são subitens e não devem ser sobrescritos ao alterar a meta.'),
};
export function catalogoCentral(areaNome=''){
 if(areaNome&&!Object.hasOwn(CATALOGO_CENTRAL,areaNome))return {disponivel:false,area:areaNome,orientacao:'Sem contrato específico neste catálogo. Não inventar campos nem contornar bloqueios. Viagem, hotel e demanda usam preparar_registro_central; demais áreas exigem verificar capacidade existente.'};
 return {disponivel:true,escopo:'Central pessoal do Léo; separado das despesas e operações empresariais',areas:areaNome?{[areaNome]:CATALOGO_CENTRAL[areaNome]}:CATALOGO_CENTRAL,gravado:false};
}
export function validarCamposCentral(lista:string,sublista:string,dados:Record<string,unknown>,adicionar:boolean){
 const chave=sublista?`${lista}.${sublista}`:lista;
 const esquema=Object.hasOwn(CATALOGO_CENTRAL,chave)?CATALOGO_CENTRAL[chave]:undefined;
 if(!esquema&&['viagens','viagens.hoteis','demandas'].includes(chave))throw Error('Use preparar_registro_central para viagem, hotel ou demanda.');
 if(!esquema)throw Error(`Área ${chave} sem operação de escrita validada. Consulte o catálogo; não contorne usando outra lista.`);
 for(const [k,v] of Object.entries(dados)){
  const campo=Object.hasOwn(esquema.campos,k)?esquema.campos[k]:undefined;
  if(!campo)throw Error(`Campo ${k} não pertence a ${esquema.destino}. Consulte consultar_catalogo_central.`);
  if(v===''&&!esquema.obrigatorios.includes(k))continue;
  if(campo.tipo==='booleano'){
   if(typeof v!=='boolean')throw Error(`Valor booleano inválido: ${k}.`);
  }else if(campo.tipo==='passos'){
   if(!adicionar||!Array.isArray(v)||v.length>50)throw Error('Passos embutidos somente ao criar a meta; para editar use subitemId.');
   for(const passo of v)validarCamposCentral('metas','passos',passo as Record<string,unknown>,true);
  }else if(campo.tipo==='numero'){
   if(typeof v!=='number'||!Number.isFinite(v)||(campo.min!==undefined&&v<campo.min)||(campo.max!==undefined&&v>campo.max)||(campo.inteiro&&!Number.isInteger(v)))throw Error(`Valor numérico inválido: ${k}.`);
  }else{
   if(typeof v!=='string'||v.length>4000)throw Error(`Texto inválido: ${k}.`);
   if(campo.tipo==='data'&&!dataValida(v))throw Error(`Data inválida: ${k}.`);
   if(campo.tipo==='mes'&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(v))throw Error(`Mês inválido: ${k}.`);
   if(campo.opcoes&&!campo.opcoes.includes(v))throw Error(`Opção inválida: ${k}.`);
  }
 }
 for(const k of esquema.obrigatorios){if((adicionar||Object.hasOwn(dados,k))&&(dados[k]===undefined||dados[k]===null||typeof dados[k]==='string'&&!String(dados[k]).trim()))throw Error(`Falta informar ${k} para ${esquema.destino}.`);}
 if(chave==='gastos'&&dados.valor===0)throw Error('Gasto precisa ter valor diferente de zero.');
 if(chave==='vitais'&&adicionar&&!['sis','dia','fc'].some(k=>typeof dados[k]==='number'))throw Error('Informe pelo menos uma medida.');
 if(chave==='gastos'){
  if(dados.data&&dados.mes&&String(dados.data).slice(0,7)!==dados.mes)throw Error('Data e mês do gasto divergentes.');
  if(typeof dados.valor==='number'&&dados.valor<0&&dados.natureza!=='Estorno')throw Error('Valor negativo exige natureza Estorno.');
  if(dados.natureza==='Estorno'&&typeof dados.valor==='number'&&dados.valor>=0)throw Error('Estorno exige valor negativo.');
  if(dados.pagoEm&&dados.situacao!=='Pago')throw Error('Data de pagamento exige situação Pago.');
  if(dados.parcela&&dados.parcelas&&Number(dados.parcela)>Number(dados.parcelas))throw Error('Parcela maior que o total de parcelas.');
 }
 if(dados.inicio&&dados.fim&&String(dados.fim)<String(dados.inicio))throw Error('Fim anterior ao início.');
}
const norm=(v:unknown)=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
export function duplicatasCentrais(lista:string,sublista:string,dados:Record<string,unknown>,itens:Record<string,unknown>[]){
 const chave=sublista?`${lista}.${sublista}`:lista;
 const chaves:Record<string,string[]>={gastos:['mes','oque','valor',...(dados.data?['data']:[])],rendimentos:['data','empresa','tipo','valor'],'viagens.custos':['categoria','descricao','valor'],peso:['data','peso'],vitais:['data','sis','dia','fc'],exames:['data','exame','valor','unidade'],assinaturas:['nome'],casa:['item','onde'],documentos:['nome','dono','numero']};
 const campos=chaves[chave];if(!campos)return [];
 return itens.filter(item=>campos.every(k=>norm(item[k])===norm(dados[k]))).map(item=>({id:item.id,possivelDuplicata:true}));
}

// Ao editar, validar também o estado resultante; campos legados não alterados são preservados.
export function validarResultadoCentral(lista:string,sublista:string,patch:Record<string,unknown>,anterior:Record<string,unknown>){
 const schema=CATALOGO_CENTRAL[sublista?`${lista}.${sublista}`:lista];
 if(!schema)throw Error('Área sem escrita validada.');
 validarCamposCentral(lista,sublista,patch,false);
 const final={...anterior,...patch};
 const conhecidos=Object.fromEntries(Object.entries(final).filter(([k])=>Object.hasOwn(schema.campos,k)&&k!=='passos'));
 validarCamposCentral(lista,sublista,conhecidos,true);
}
