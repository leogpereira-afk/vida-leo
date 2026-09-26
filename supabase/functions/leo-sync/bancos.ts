// Cadastro bancário da gestão, somente leitura e apenas pela sessão da Central.
// Retorna campos permitidos, sem outros registros do Painel ou credenciais.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
/* codigoBanco entrou em 25/09/2026: o Painel passou a gravar o número do banco
   confirmado, e sem ele aqui a Central seguia mostrando o deduzido pelo nome.
   A logo (data URI) NÃO vem: a Central e o Painel dividem os 5 MB de
   localStorage da mesma origem. */
const CAMPOS = ['banco','codigoBanco','titular','grupo','doc','tipo','agencia','conta','pix','pixTipo','gerente','telefone','obs'] as const;
export async function lerBancosGestao(sb: SupabaseClient) {
  const contas: Record<string,string>[] = [];
  for (let de=0;de<100000;de+=500) {
    const {data,error}=await sb.from('painel_registros').select('id, registro').eq('colecao','bancos').order('id').range(de,de+499);
    if(error)throw new Error('Não foi possível consultar o cadastro bancário da gestão.');
    for(const linha of data??[]) {
      const r=linha.registro;
      if(!r||typeof r!=='object'||Array.isArray(r))throw new Error('Há uma conta com formato inválido na gestão.');
      const conta: Record<string,string>={id:String(linha.id)};
      for(const k of CAMPOS)conta[k]=r[k]==null?'':String(r[k]);
      // Número de banco só com 3 dígitos: um código errado vai para dentro de uma TED.
      if(!/^\d{3}$/.test(conta.codigoBanco))conta.codigoBanco='';
      contas.push(conta);
    }
    if((data??[]).length<500)return {contas,origem:'Gestão Impresilk',lidoEm:new Date().toISOString()};
  }
  throw new Error('Cadastro bancário acima do limite de leitura.');
}
