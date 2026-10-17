import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';
const iniciar=()=>{const a=setup();a.run("E.tratamentos=[];E.peso=[];E.agenda=[];tela=()=>{};atual='saude'");return a};
test('estoque desconta usos, mantém desconhecido e não confunde compra com aplicação',()=>{
 const {run}=iniciar();run("var t={status:'Em andamento',unidade:'cápsula',estoqueInicial:10,alertaEstoque:3,compras:[],usos:[]}");
 assert.equal(run('SaudeTratamentos.saldo(t)'),10);
 run("SaudeTratamentos.registrarUso(t,{data:'2020-01-01',hora:'08:00',quantidade:8})");
 assert.equal(run('SaudeTratamentos.saldo(t)'),2);assert.equal(run('SaudeTratamentos.estoque(t)'),'Comprar mais');
 assert.throws(()=>run("SaudeTratamentos.registrarUso(t,{data:'2020-01-01',hora:'08:00',quantidade:1})"),/Já existe/);
 assert.throws(()=>run("SaudeTratamentos.registrarUso(t,{data:'2020-01-02',hora:'08:00',quantidade:3})"),/maior/);
 run("t.usos[0].desfeitoEm='agora'");assert.equal(run('SaudeTratamentos.saldo(t)'),10);
 run("t={compras:[{marca:'Exemplo',quantidade:null}],usos:[]}");assert.equal(run('SaudeTratamentos.saldo(t)'),null);
});
test('uso pendente ou futuro não baixa estoque',()=>{
 const {run}=iniciar();run("var t={status:'A confirmar',unidade:'ampola'}");
 assert.throws(()=>run("SaudeTratamentos.registrarUso(t,{data:'2020-01-01',hora:'08:00',quantidade:1})"),/Confirme/);
 run("t.status='Em andamento'");assert.throws(()=>run("SaudeTratamentos.registrarUso(t,{data:'2099-01-01',hora:'08:00',quantidade:1})"),/já aconteceu/);
 assert.equal(run('(t.usos||[]).length'),0);
});
test('Google tem título genérico, não contém diagnóstico e exige data e confirmação',()=>{
 const {run}=iniciar();run("var t={id:'teste',oque:'Medicamento confidencial',motivo:'Diagnóstico',status:'A confirmar',proximaData:'2030-01-01',horario:'09:00'}");
 assert.equal(run('SaudeTratamentos.lembrete(t)'),null);run("t.status='Em andamento'");
 const ev=JSON.parse(run('JSON.stringify(SaudeTratamentos.lembrete(t))'));
 assert.equal(ev.titulo,'Lembrete de cuidado');assert.doesNotMatch(JSON.stringify(ev),/confidencial|Diagnóstico/);
});
test('importação retoma sem duplicar anexos e nunca supõe dose ou compra',async()=>{
 const {run,ctx}=iniciar();let files=[];ctx.arqPor=async ref=>files.filter(x=>x.ref===ref);ctx.arqAdd=async(ref,f)=>files.push({ref,nome:f.name});
 run("var p={formato:'central-saude-v1',tratamentos:[{id:'import-teste',oque:'Tratamento fictício',status:'Em andamento',inicio:'2020-01-01',arquivos:[{nome:'exemplo.jpeg',dados:'data:image/jpeg;base64,YQ=='}]}]}");
 await run('aplicarPacoteTratamentos(p)');await run('aplicarPacoteTratamentos(p)');
 assert.equal(run('E.tratamentos.length'),1);assert.equal(files.length,1);assert.equal(run('E.tratamentos[0].status'),'A confirmar');assert.equal(run('E.tratamentos[0].inicio'),'');assert.equal(run('E.tratamentos[0].compras.length'),0);
});
test('pacote inválido é recusado antes de gravar e falha local reverte alteração',()=>{
 const {run,ctx}=iniciar();assert.throws(()=>run("validarPacoteTratamentos({formato:'central-saude-v1',tratamentos:[{id:'import-teste',oque:'Teste',arquivos:[{nome:'x',dados:'data:text/html;base64,YQ=='}]}]})"),/Anexo/);
 run("var t={oque:'Antes'}");ctx.localStorage.setItem=()=>{throw Error('sem espaço')};assert.throws(()=>run("tratamentoCommit(t,()=>t.oque='Depois')"),/sem espaço/);assert.equal(run('t.oque'),'Antes');
});
test('aba tratamentos exibe lista e detalhe sem retirar cuidados ou dados legados',()=>{
 const {run,document}=iniciar();run("E.tratamentos=[{id:'legado',oque:'Cuidado fictício',frequencia:'Conforme profissional',status:'Contínuo'}];vSaude(document.getElementById('main'));organizarSaude(document.getElementById('main'))");
 assert.ok(document.querySelector('[data-area=tratamentos]'));assert.ok(document.querySelector('[data-area=cuidados]'));[...document.querySelectorAll('.trat-subtabs button')].find(b=>b.textContent.includes('Itens prescritos')).click();assert.match(document.querySelector('.trat-detalhe').textContent,/Cuidado fictício/);assert.match(document.querySelector('.trat-detalhe').textContent,/Não se aplica/);
});

test('corrigir compra não permite saldo negativo nem altera movimentos ao falhar',()=>{
 const {run}=iniciar();run("var t={unidade:'cápsula',compras:[{id:'compra',quantidade:10,marca:'Exemplo',data:'2020-01-01'}],usos:[{quantidade:8}]}");
 assert.throws(()=>run("SaudeTratamentos.registrarCompra(t,{data:'2020-01-01',marca:'Exemplo',quantidade:3},'compra')"),/abaixo do consumo/);
 assert.equal(run('SaudeTratamentos.saldo(t)'),2);
 run("SaudeTratamentos.registrarCompra(t,{data:'2020-01-01',marca:'Exemplo',quantidade:12},'compra')");assert.equal(run('SaudeTratamentos.saldo(t)'),4);
});
test('pendentes não são medicamentos em uso e só cuidados confirmados entram na agenda',()=>{
 const {run,document}=iniciar();run("E.tratamentos=[{id:'a',oque:'Pendente fictício',status:'A confirmar',proximaData:'2030-01-01'},{id:'b',oque:'Ativo fictício',status:'Em andamento',proximaData:'2030-01-02',horario:'09:00'}];E.vacinas=[];E.exames=[];E.consultas=[]");
 assert.equal(run("eventosDoEcossistema().filter(x=>x.col==='sa-trat').length"),1);
 run('modalSOS()');assert.doesNotMatch(document.querySelector('.modal').textContent,/Pendente fictício/);assert.match(document.querySelector('.modal').textContent,/Ativo fictício/);
});
test('compra confirmada na importação continua sem uso e sem estoque presumido',async()=>{
 const {run}=iniciar();await run("aplicarPacoteTratamentos({formato:'central-saude-v1',tratamentos:[{id:'import-compra',oque:'Exemplo fictício',compraConfirmada:{data:'2020-01-01',marca:'Exemplo'}}]})");
 assert.equal(run('E.tratamentos[0].compras.length'),1);assert.equal(run('E.tratamentos[0].usos.length'),0);assert.equal(run('SaudeTratamentos.saldo(E.tratamentos[0])'),null);
});

test('planos agrupam prescrições e isolam consultas, medidas e compras entre tratamentos',()=>{
 const {run}=iniciar();run("E.consultas=[{id:'c1',tratamentoId:'p1',valor:80},{id:'c2',tratamentoId:'p2',valor:300}];E.gastos=[];E.tratamentos=[{id:'p1',oque:'Plano um',tipo:'Plano de tratamento'},{id:'i1',origemTratamentoId:'p1',oque:'Item um',compras:[{id:'b1',valor:20}]},{id:'p2',oque:'Plano dois',tipo:'Plano de tratamento'},{id:'i2',origemTratamentoId:'p2',oque:'Item dois',usos:[{id:'u1'},{id:'u2',desfeitoEm:'agora'}]}];E.peso=[{id:'m1',data:'2020-01-01',peso:70,tratamentoId:'p1'},{id:'m2',data:'2020-01-02',peso:60,tratamentoId:'p2'},{id:'m3',data:'2099-01-01',peso:65,tratamentoId:'p1'}]");
 assert.equal(run('gruposTratamento().length'),2);
 const a=JSON.parse(run('JSON.stringify(resumoGrupoTratamento(gruposTratamento()[0]))'));
 assert.equal(a.itens,1);assert.equal(a.total,100);assert.equal(a.consultas.length,1);assert.equal(a.medidas.length,1);assert.equal(a.comprados,1);assert.equal(a.usos,0);
 assert.equal(run('resumoGrupoTratamento(gruposTratamento()[1]).usos'),1);
});
test('trocar chips muda médico e dados do plano sem misturar itens',()=>{
 const {run,document}=iniciar();run("E.tratamentos=[{id:'p1',oque:'Plano um',medico:'Profissional um',tipo:'Plano de tratamento'},{id:'i1',oque:'Item um',origemTratamentoId:'p1'},{id:'p2',oque:'Plano dois',medico:'Profissional dois',tipo:'Plano de tratamento'},{id:'i2',oque:'Item dois',origemTratamentoId:'p2'}];document.body.append(quadroTratamentos())");
 assert.match(document.querySelector('.trat-plano-hero').textContent,/Profissional um/);
 document.querySelectorAll('.trat-grupos button')[1].click();
 assert.match(document.querySelector('.trat-plano-hero').textContent,/Profissional dois/);
 [...document.querySelectorAll('.trat-subtabs button')].find(b=>b.textContent.includes('Itens prescritos')).click();
 assert.match(document.querySelector('.trat-lista').textContent,/Item dois/);assert.doesNotMatch(document.querySelector('.trat-lista').textContent,/Item um/);
});
test('evolução usa somente medidas vinculadas e não desenha tendência com um ponto',()=>{
 const {run,document}=iniciar();run("var g={id:'p',oque:'Teste'};E.peso=[{id:'m',data:'2020-01-01',peso:72,tratamentoId:'p',fonte:'Balança de teste'}];document.body.append(quadroEvolucaoGrupo(g))");
 assert.match(document.querySelector('.trat-baseline').textContent,/Ponto inicial/);assert.equal(document.querySelector('.trat-grafico svg'),null);assert.equal(document.querySelectorAll('.trat-medicoes tbody tr').length,1);
 run("E.peso.push({id:'m2',data:'2020-03-01',peso:71,tratamentoId:'p'});document.body.replaceChildren(quadroEvolucaoGrupo(g))");
 assert.ok(document.querySelector('svg'));assert.match(document.querySelector('.trat-grafico').textContent,/Variação registrada: -1/);
 assert.throws(()=>run("validarMedidaTratamento({data:'2020-01-01',fonte:'Teste',gordura:101})"),/gordura/);
 assert.throws(()=>run("validarMedidaTratamento({data:'2099-01-01',fonte:'Teste',peso:70})"),/realizada/);
});
test('vínculo financeiro cria só uma despesa e separa pendência de pagamento',()=>{
 const {run}=iniciar();run("E.gastos=[];var c={id:'c',data:'2020-01-01',valor:100};criarVinculoGastoSaude('saude:consulta:c',c,{situacao:'Pendente'})");
 assert.equal(run('E.gastos.length'),1);assert.equal(run('E.gastos[0].pagoEm'),'');assert.equal(run('E.gastos[0].mes'),'2020-01');assert.equal(run('E.gastos[0].situacao'),'Pendente');
 assert.throws(()=>run("criarVinculoGastoSaude('saude:consulta:c',c,{})"),/já está/);
 assert.equal(run('E.gastos.length'),1);
 run('E.gastos[0].valor=125');assert.equal(run("valorSaude('saude:consulta:c',c)"),125);
});
test('aproveitar gasto existente não duplica e usa seu valor como fonte',()=>{
 const {run}=iniciar();run("E.gastos=[{id:'g',valor:200,situacao:'Pago'}];var c={data:'2020-01-01',valor:150};criarVinculoGastoSaude('saude:compra:c',c,{existente:'g'})");
 assert.equal(run('E.gastos.length'),1);assert.equal(run("valorSaude('saude:compra:c',c)"),200);
 assert.throws(()=>run("criarVinculoGastoSaude('saude:compra:outro',c,{existente:'g'})"),/já vinculado/);
});
test('falha de persistência financeira reverte criação e vínculo existente',()=>{
 const {run,ctx}=iniciar();run("E.gastos=[{id:'g',valor:20}];var c={data:'2020-01-01',valor:50}");ctx.localStorage.setItem=()=>{throw Error('Falha de disco')};
 assert.throws(()=>run("criarVinculoGastoSaude('saude:consulta:c',c,{situacao:'Pendente'})"),/Falha/);assert.equal(run('E.gastos.length'),1);
 assert.throws(()=>run("criarVinculoGastoSaude('saude:consulta:c',c,{existente:'g'})"),/Falha/);assert.equal(run('E.gastos[0].origemRef'),undefined);
});
test('valor não informado não vira gasto zero e compra vinculada exige edição financeira',()=>{
 const {run}=iniciar();run("E.gastos=[];var c={id:'c',data:'2020-01-01'}");assert.throws(()=>run("criarVinculoGastoSaude('saude:compra:c',c,{})"),/valor e a data/);
 run("var t={unidade:'unidade',compras:[{id:'c',data:'2020-01-01',marca:'Exemplo',quantidade:1,valor:20}]};E.gastos=[{id:'g',origemRef:'saude:compra:c',valor:20}]");
 assert.throws(()=>run("SaudeTratamentos.registrarCompra(t,{data:'2020-01-01',marca:'Exemplo',quantidade:1,valor:30},'c')"),/gasto vinculado/);
 assert.equal(run('t.compras[0].valor'),20);
});
test('novo plano cria agrupador e item novo preserva vínculo ao plano',()=>{
 const {run,ctx}=iniciar();let salvarFormulario;ctx.tratamentoForm=(titulo,campos,base,salvar)=>{salvarFormulario=salvar};
 run('editarPlanoTratamento()');salvarFormulario({oque:'Plano fictício',medico:'Profissional fictício',inicio:'',fim:'',status:'A confirmar'});
 assert.equal(run('E.tratamentos.length'),1);assert.equal(run('E.tratamentos[0].tipo'),'Plano de tratamento');assert.equal(run('gruposTratamento()[0].itens.length'),0);
 run('editarTratamento(null,E.tratamentos[0])');salvarFormulario({oque:'Item fictício',tipo:'Medicamento',status:'A confirmar',inicio:'',fim:'',proximaData:'',unidade:'cápsula',estoqueInicial:'',alertaEstoque:''});
 assert.equal(run('E.tratamentos.length'),2);assert.equal(run('gruposTratamento().length'),1);assert.equal(run('gruposTratamento()[0].itens.length'),1);assert.equal(run('E.tratamentos[1].origemTratamentoId===E.tratamentos[0].id'),true);
});
test('consulta e retorno permanecem no mesmo registro ao editar, sem gerar gastos automáticos',()=>{
 const {run,ctx}=iniciar();let salvarFormulario;ctx.tratamentoForm=(titulo,campos,base,salvar)=>{salvarFormulario=salvar};
 run("E.consultas=[];E.gastos=[];var g={id:'p',medico:'Profissional fictício'};editarConsultaTratamento(g)");
 salvarFormulario({data:'2020-01-01',profissional:'Profissional fictício',retorno:'2020-02-01',valor:'150',situacao:'Realizada'});
 assert.equal(run('E.consultas.length'),1);assert.equal(run('E.consultas[0].tratamentoId'),'p');assert.equal(run('E.gastos.length'),0);
 run('editarConsultaTratamento(g,E.consultas[0])');salvarFormulario({data:'2020-01-01',profissional:'Profissional fictício',retorno:'2020-02-02',valor:'150',situacao:'Realizada'});
 assert.equal(run('E.consultas.length'),1);assert.equal(run('E.consultas[0].retorno'),'2020-02-02');
});
test('importação recusa vínculo circular antes de escrever dados',()=>{
 const {run}=iniciar();assert.throws(()=>run("validarPacoteTratamentos({formato:'central-saude-v1',tratamentos:[{id:'import-aaa',oque:'A',origemTratamentoId:'import-bbb'},{id:'import-bbb',oque:'B',origemTratamentoId:'import-aaa'}]})"),/tratamento principal/);assert.equal(run('E.tratamentos.length'),0);
});

test('pacote inclui evolução completa e consulta sem duplicar nem substituir registros existentes',async()=>{
 const {run}=iniciar();run("E.consultas=[];E.gastos=[];E.peso=[{id:'legado',peso:70}];var p={formato:'central-saude-v1',tratamentos:[{id:'import-plano',oque:'Plano fictício',clinica:'Clínica de exemplo'}],medidas:[{id:'import-medida',tratamentoId:'import-plano',data:'2020-01-01',fonte:'Laudo fictício',peso:72,gordura:20,massaMagra:57.6,agua:40,imcLaudo:24,basal:1500,idadeMetabolica:30,indiceApendicular:8}],consultas:[{id:'import-consulta',tratamentoId:'import-plano',data:'2020-01-01',situacao:'Realizada',profissional:'Profissional fictício',valor:''}]}");
 await run('aplicarPacoteTratamentos(p)');run("E.peso[1].obs='Anotação preservada';E.consultas[0].obs='Revisado'");await run('aplicarPacoteTratamentos(p)');
 assert.equal(run('E.peso.length'),2);assert.equal(run('E.peso[1].agua'),40);assert.equal(run('E.peso[1].tratamentoId'),'import-plano');assert.equal(run('E.peso[1].obs'),'Anotação preservada');assert.equal(run('E.consultas.length'),1);assert.equal(run('E.consultas[0].obs'),'Revisado');assert.equal(run('E.consultas[0].valor'),undefined);assert.equal(run('E.gastos.length'),0);assert.equal(run('E.tratamentos[0].clinica'),'Clínica de exemplo');
});
test('importação recusa medidas inválidas e consultas sem vínculo antes de alterar a conta',()=>{
 const {run}=iniciar();run("var p={formato:'central-saude-v1',tratamentos:[{id:'import-plano',oque:'Plano fictício'}],medidas:[{id:'import-medida',data:'2020-01-01',peso:70,gordura:150}]}");
 assert.throws(()=>run('validarPacoteTratamentos(p)'),/gordura/);run("p.medidas=[];p.consultas=[{id:'import-consulta',tratamentoId:'ausente',data:'2020-01-01',situacao:'Realizada',profissional:'Exemplo'}]");assert.throws(()=>run('validarPacoteTratamentos(p)'),/Consulta/);assert.equal(run('E.tratamentos.length'),0);
});
