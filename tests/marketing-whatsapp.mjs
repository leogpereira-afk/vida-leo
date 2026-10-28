import test from 'node:test';
import assert from 'node:assert/strict';
import {coletarContatosGA4,preservarHistoricoGA4} from '../supabase/functions/leo-sync/marketing-ga4-contatos.mjs';
import {coletarFonte} from '../supabase/functions/leo-sync/marketing-direto-fontes.mjs';
import {projetarFonte} from '../supabase/functions/leo-sync/marketing-fortemais.mjs';
import {bancoDireto} from '../supabase/functions/leo-sync/marketing-direto.mjs';
const agora=Date.parse('2026-06-20T18:00:00Z'),j={inicio:'2026-05-21',fim:'2026-06-17'};
const marca={id:'minaslab',nome:'Marca teste',host:'teste.test',site:'https://teste.test/'};
const ativo={id:'properties/123',medicaoContatos:{inicio:'2026-06-20',parametro:'contact_method',registradoEm:'2026-06-20T12:00:00Z'}};
const linha=(metodo,n)=>({dimensionValues:[{value:metodo}],metricValues:[{value:String(n)}]});
const api=(rows,requests=[])=>async(u,b)=>{requests.push([u,b]);return u.endsWith('/metadata')?{dimensions:[{apiName:'customEvent:contact_method'}]}:{rows}};
test('WhatsApp: canais separados, filtro de domínio e evento exatos e cobertura inicial sem fabricar histórico',async()=>{
 const calls=[],r=await coletarContatosGA4(api([linha('whatsapp',3),linha('telephone',2),linha('email',8),linha('(not set)',99)],calls),ativo,marca,j,agora,{});
 assert.deepEqual(r.contatos.periodo,{inicio:'2026-06-20',fim:'2026-06-20',metricas:{whatsapp:3,telefone:2,email:8}});assert.equal(r.consolidado,null);assert.equal(r.contatos.estado,'ok');
 const b=calls[1][1];assert.deepEqual(b.dimensionFilter.andGroup.expressions.map(x=>x.filter.fieldName),['hostName','eventName','customEvent:contact_method']);
 assert.deepEqual(b.dimensionFilter.andGroup.expressions[0].filter.inListFilter.values,['teste.test','www.teste.test']);assert.equal(b.dimensionFilter.andGroup.expressions[1].filter.stringFilter.value,'contact_click');
 assert.deepEqual(b.dimensionFilter.andGroup.expressions[2].filter.inListFilter.values,['whatsapp','telephone','email']);assert.equal(calls.length,2);
});
test('WhatsApp: metadado ausente, sem linhas, número inválido e zero confirmado são estados distintos',async()=>{
 const ausente=await coletarContatosGA4(async()=>({dimensions:[]}),ativo,marca,j,agora,{});assert.equal(ausente.contatos.estado,'aguardando_dados');
 const antigo=await coletarContatosGA4(async()=>({dimensions:[]}),ativo,marca,j,agora+3*86400000,{});assert.equal(antigo.contatos.estado,'aguardando_configuracao');
 for(const rows of [[],[linha('(not set)',5)],[linha('whatsapp',-1)],[linha('whatsapp','NaN')]]){const r=await coletarContatosGA4(api(rows),ativo,marca,j,agora,{});assert.equal(r.contatos.periodo.metricas.whatsapp,null);assert.equal(r.contatos.estado,'aguardando_dados');}
 const zero=await coletarContatosGA4(api([linha('whatsapp',0)]),ativo,marca,j,agora,{});assert.equal(zero.contatos.periodo.metricas.whatsapp,0);assert.equal(zero.contatos.estado,'ok');
});
test('WhatsApp: consolidado usa sua própria janela quando há cobertura integral, sem somar recente',async()=>{
 const a={...ativo,medicaoContatos:{...ativo.medicaoContatos,inicio:'2026-05-01',registradoEm:'2026-05-01T12:00:00Z'}},calls=[];
 const r=await coletarContatosGA4(async(u,b)=>{calls.push([u,b]);return !b?{dimensions:[{apiName:'customEvent:contact_method'}]}:{rows:[linha('whatsapp',b.dateRanges[0].endDate===j.fim?4:7)]}},a,marca,j,agora,{});
 assert.equal(r.consolidado,4);assert.equal(r.contatos.periodo.metricas.whatsapp,7);assert.equal(calls.length,3);
});
test('WhatsApp: erro opcional não derruba agregado GA4, e marca sem configuração não faz consulta adicional',async()=>{
 const chamadas=[];const r=await coletarFonte('ga4',ativo,async(u,b)=>{chamadas.push([u,b]);if(!b)throw Error('provider detail');return {rows:[{metricValues:b.metrics.map(()=>({value:'12'}))}]};},agora,'minaslab');
 assert.equal(r.periodos[0].metricas.usuarios,12);assert.equal(r.periodos[0].metricas.cliques_whatsapp,null);assert.equal(r.contatos.estado,'erro');assert.equal(r.estado,'parcial');
 const sem=await coletarContatosGA4(()=>assert.fail('consulta indevida'),{id:'properties/123'},marca,j,agora,{});assert.equal(sem,null);
});
test('WhatsApp: privacidade e amostragem não são ocultadas; configuração futura é recusada',async()=>{
 const qualidade={};await coletarContatosGA4(async(u,b)=>b?{rows:[linha('whatsapp',1)],metadata:{subjectToThresholding:true,samplingMetadatas:[{}]}}:{dimensions:[{apiName:'customEvent:contact_method'}]},ativo,marca,j,agora,qualidade);
 assert.deepEqual(qualidade,{limiar_privacidade:true,amostragem:true});
 const r=await coletarContatosGA4(()=>assert.fail(),{...ativo,medicaoContatos:{...ativo.medicaoContatos,inicio:'2027-01-01'}},marca,j,agora,{});assert.equal(r.contatos.estado,'aguardando_configuracao');
});
test('WhatsApp: início anterior ao cadastro da dimensão não consulta histórico sem cobertura',async()=>{
 const r=await coletarContatosGA4(()=>assert.fail('não consultar sem cobertura'),{...ativo,medicaoContatos:{...ativo.medicaoContatos,inicio:'2026-05-01'}},marca,j,agora,{});
 assert.equal(r.contatos.estado,'aguardando_configuracao');assert.equal(r.contatos.inicioMedicao,null);assert.equal(r.consolidado,null);
});
const retrato=(fim,n)=>({empresa:'minaslab',identidade:{site:marca.site},estado:'ok',coletadoEm:'2026-06-20T18:00:00Z',qualidade:{},periodos:[{inicio:'2026-05-21',fim,completo:true,metricas:{usuarios:n,cliques_whatsapp:n},tabelas:{},serie:[]}]});
test('WhatsApp: recoletas substituem o mesmo período, preservam os outros e não misturam marcas',()=>{
 const anterior=retrato('2026-06-16',2),novo=retrato('2026-06-17',3);
 const r=preservarHistoricoGA4(novo,anterior);assert.equal(r.periodos.length,2);assert.equal(r.periodos[0].metricas.usuarios,3);
 assert.deepEqual(preservarHistoricoGA4(novo,r),r);assert.equal(preservarHistoricoGA4(novo,{...anterior,empresa:'domo'}).periodos.length,1);
});
test('WhatsApp: falha mantém última leitura identificada, sem atualizar a data da evidência',()=>{
 const anterior={...retrato('2026-06-17',3),contatos:{estado:'ok',coletadoEm:'2026-06-19T12:00:00Z',periodo:{metricas:{whatsapp:3}}}};
 const novo={...retrato('2026-06-17',null),qualidade:{contatos_indisponiveis:true},contatos:{estado:'erro'}};
 const r=preservarHistoricoGA4(novo,anterior);assert.equal(r.contatos.coletadoEm,anterior.contatos.coletadoEm);assert.equal(r.contatos.estado,'erro');assert.equal(r.contatos.ultimaLeituraConfirmada,true);assert.equal(r.periodos[0].metricas.cliques_whatsapp,3);assert.equal(preservarHistoricoGA4(novo,r).contatos.periodo.metricas.whatsapp,3);
});
test('WhatsApp: resposta pendente preserva a leitura anterior e a data, inclusive em repetição',()=>{
 const anterior={...retrato('2026-06-17',3),contatos:{estado:'ok',coletadoEm:'2026-06-19T12:00:00Z',periodo:{metricas:{whatsapp:3}}}};
 for(const estado of ['aguardando_dados','aguardando_configuracao']){
  const novo={...retrato('2026-06-17',null),contatos:{estado,periodo:{metricas:{whatsapp:null}}}};
  const r=preservarHistoricoGA4(novo,anterior);assert.equal(r.contatos.estado,estado);assert.equal(r.contatos.coletadoEm,anterior.contatos.coletadoEm);assert.equal(r.contatos.ultimaLeituraConfirmada,true);assert.equal(r.contatos.periodo.metricas.whatsapp,3);
  assert.equal(preservarHistoricoGA4(novo,r).contatos.periodo.metricas.whatsapp,3);
  assert.equal(r.periodos[0].metricas.cliques_whatsapp,3);assert.equal(r.qualidade.contatos_desatualizados,true);
 }
});
test('WhatsApp: projeção permite só métricas esperadas e recusa intervalo fora da cobertura',()=>{
 const bruto={...retrato('2026-06-17',3),contatos:{inicioMedicao:'2026-06-20',coletadoEm:'2026-06-20T18:00:00Z',estado:'ok',token:'SEGREDO',periodo:{inicio:'2026-06-20',fim:'2026-06-20',metricas:{whatsapp:0,telefone:null,email:2,senha:'SEGREDO'}}}};
 const r=projetarFonte('ga4',bruto,agora,marca);assert.equal(r.contatos.periodo.metricas.whatsapp,0);assert.doesNotMatch(JSON.stringify(r),/SEGREDO|token|senha/);
 bruto.contatos.periodo.inicio='2026-06-19';assert.equal(projetarFonte('ga4',bruto,agora,marca).contatos,undefined);
});
test('WhatsApp: persistência lê o cache da mesma marca, preserva período e grava idempotente',async()=>{
 let salvo;const anteriores=retrato('2026-06-16',2),chaves=[];
 const sb={from(t){assert.equal(t,'painel_cache');return {select(){return this},eq(k,v){chaves.push(v);return this},async maybeSingle(){return {data:{valor:anteriores}}},async upsert(v){salvo=v;return {error:null}}}}};
 const novo={...retrato('2026-06-17',3),contatos:{estado:'aguardando_dados'}};await bancoDireto(sb,'minaslab').salvarFonte('ga4',novo);
 assert.equal(salvo.chave,'leo_marketing_minaslab_direto_ga4');assert.equal(salvo.valor.periodos.length,2);assert.deepEqual(chaves,[salvo.chave]);
});
