// Cadastro bancário da gestão, somente leitura e apenas pela sessão da Central.
// Retorna campos permitidos, sem outros registros do Painel ou credenciais.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
const CAMPOS = ['banco','titular','grupo','doc','tipo','agencia','conta','pix','pixTipo','gerente','telefone','obs'] as const;
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
      contas.push(conta);
    }
    if((data??[]).length<500)return {contas,origem:'Gestão Impresilk',lidoEm:new Date().toISOString()};
  }
  throw new Error('Cadastro bancário acima do limite de leitura.');
}
