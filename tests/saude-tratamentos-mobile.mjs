import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

const iniciar=()=>{const a=setup();a.run("E.tratamentos=[];E.peso=[];E.consultas=[];E.gastos=[];E.agenda=[];tela=()=>{};atual='saude'");return a};
const enviar=a=>a.document.querySelector('.trat-form').onsubmit({preventDefault(){}});
const principais=a=>[...a.document.querySelector('.trat-form>.rotina-form-campos').querySelectorAll('[name]')].map(i=>i.name);

test('medicamento mostra o essencial e mantém todos os campos opcionais no formulário',()=>{
  const a=iniciar();a.run('editarTratamento()');
  assert.deepEqual(principais(a),['oque','tipo','status','frequencia']);
  assert.equal(a.document.querySelectorAll('.trat-form [name]').length,21);
  assert.equal(a.document.querySelector('.trat-form [name=oque]').required,true);
  assert.equal(a.document.querySelector('.trat-form-extras').hasAttribute('open'),false);
  assert.match(a.document.querySelector('.trat-form-extras summary').textContent,/17 campos/);
  assert.ok(a.document.querySelector('[name=frequencia]').closest('.trat-campo-longo'));
  assert.equal(a.document.querySelector('[name=estoqueInicial]').inputMode,'decimal');
});

test('salvar com detalhes recolhidos preserva estoque, horários, observações, vínculos e campos legados',()=>{
  const a=iniciar();a.run("var t={id:'item-ficticio',origemTratamentoId:'plano-ficticio',oque:'Item de exemplo',tipo:'Medicamento',status:'Em andamento',frequencia:'Orientação fictícia',usoDiario:true,horariosUso:['08:00','20:00'],inicio:'2020-01-01',fim:'',medico:'Profissional fictício',especialidade:'Área de exemplo',contatoMedico:'Contato de exemplo',enderecoMedico:'Endereço fictício',unidade:'cápsula',estoqueInicial:10,alertaEstoque:2,consumoPorCiclo:1,intervaloConsumoDias:1,proximaData:'2020-01-02',horario:'08:00',obs:'Anotação preservada',legado:{chave:'preservar'},compras:[],usos:[{id:'uso-ficticio',data:'2020-01-01',quantidade:1}]};E.tratamentos=[t];editarTratamento(t)");
  assert.match(a.document.querySelector('.trat-form-extras summary').textContent,/preenchidos/);
  a.document.querySelector('[name=oque]').value='Item atualizado';enviar(a);
  assert.equal(a.document.querySelector('.trat-form'),null);
  assert.equal(a.run('E.tratamentos.length'),1);
  const t=JSON.parse(a.run('JSON.stringify(t)'));
  assert.equal(t.id,'item-ficticio');assert.equal(t.origemTratamentoId,'plano-ficticio');
  assert.equal(t.oque,'Item atualizado');assert.equal(t.status,'Em andamento');
  assert.equal(t.estoqueInicial,'10');assert.equal(t.unidade,'cápsula');
  assert.deepEqual(t.horariosUso,['08:00','20:00']);assert.equal(t.usoDiario,true);
  assert.equal(t.obs,'Anotação preservada');assert.equal(t.enderecoMedico,'Endereço fictício');
  assert.deepEqual(t.legado,{chave:'preservar'});assert.equal(t.usos[0].id,'uso-ficticio');
});

test('erro em detalhes expande o grupo e conserva o lançamento sem gravar parcialmente',()=>{
  const a=iniciar();a.run('editarTratamento()');
  a.document.querySelector('[name=oque]').value='Item de exemplo';
  a.document.querySelector('[name=horariosUsoTexto]').value='horário inválido';enviar(a);
  assert.equal(a.run('E.tratamentos.length'),0);
  assert.equal(a.document.querySelector('.trat-form-extras').open,true);
  assert.match(a.document.querySelector('.trat-form [role=alert]').textContent,/horários/);
  assert.equal(a.document.querySelector('[name=oque]').value,'Item de exemplo');
  assert.equal(a.document.querySelector('[name=horariosUsoTexto]').value,'horário inválido');
});

test('falha no salvamento mantém detalhes e valores do rascunho e reverte o registro',()=>{
  const a=iniciar();a.run("var t={id:'item-ficticio',oque:'Antes',status:'A confirmar',tipo:'Medicamento',obs:'Observação antiga'};E.tratamentos=[t];editarTratamento(t)");
  a.ctx.localStorage.setItem=()=>{throw Error('Falha local fictícia')};
  a.document.querySelector('[name=oque]').value='Depois';
  a.document.querySelector('[name=obs]').value='Observação nova';enviar(a);
  assert.equal(a.run('t.oque'),'Antes');assert.equal(a.run('t.obs'),'Observação antiga');
  assert.equal(a.document.querySelector('.trat-form-extras').open,true);
  assert.equal(a.document.querySelector('[name=obs]').value,'Observação nova');
  assert.match(a.document.querySelector('[role=alert]').textContent,/Falha local/);
});

test('cancelar uma edição com detalhes alterados preserva integralmente o cadastro',()=>{
  const a=iniciar();a.run("var t={id:'item-ficticio',oque:'Item original',tipo:'Medicamento',status:'A confirmar',obs:'Observação original',unidade:'g',legado:{preservar:true}};E.tratamentos=[t];var antes=JSON.stringify(t);editarTratamento(t)");
  a.document.querySelector('[name=oque]').value='Mudança cancelada';
  a.document.querySelector('[name=obs]').value='Detalhe cancelado';
  a.document.querySelector('[data-cancelar]').click();
  assert.equal(a.document.querySelector('.trat-form'),null);
  assert.equal(a.run('JSON.stringify(t)===antes'),true);
  assert.equal(a.run('E.tratamentos.length'),1);
});

test('plano, consulta e medição mantêm campos necessários visíveis e detalhes editáveis',()=>{
  for(const [abrir,esperados,total] of [
    ['editarPlanoTratamento()',['oque','motivo','status','medico'],11],
    ["editarConsultaTratamento({id:'plano-ficticio'})",['tipoConsulta','data','hora','situacao','profissional','local'],15],
    ["editarMedidaTratamento({id:'plano-ficticio'})",['data','fonte','peso'],15]
  ]){const a=iniciar();a.run(abrir);assert.deepEqual(principais(a),esperados);assert.equal(a.document.querySelectorAll('.trat-form [name]').length,total);assert.ok(a.document.querySelector('.trat-form-extras [name=obs]'));}
});

test('medição rápida aceita peso e preserva métricas existentes no mesmo ID',()=>{
  const a=iniciar();a.run("var m={id:'medida-ficticia',tratamentoId:'plano-ficticio',data:'2020-01-01',fonte:'Laudo fictício',peso:70,agua:40,imcLaudo:24,indiceApendicular:8,obs:'Informação mantida',legado:'manter'};E.peso=[m];editarMedidaTratamento({id:'plano-ficticio'},m)");
  a.document.querySelector('[name=peso]').value='71';enviar(a);
  assert.equal(a.document.querySelector('.trat-form'),null);
  assert.equal(a.run('E.peso.length'),1);assert.equal(a.run('m.id'),'medida-ficticia');
  assert.equal(a.run('m.peso'),71);assert.equal(a.run('m.agua'),40);
  assert.equal(a.run('m.imcLaudo'),24);assert.equal(a.run('m.indiceApendicular'),8);
  assert.equal(a.run('m.obs'),'Informação mantida');assert.equal(a.run('m.legado'),'manter');
});

test('consulta salva sem expandir detalhes e mantém retorno, valores e vínculo ao plano',()=>{
  const a=iniciar();a.run("var c={id:'consulta-ficticia',tratamentoId:'plano-ficticio',data:'2020-01-01',hora:'09:00',tipoConsulta:'Consulta',situacao:'Realizada',profissional:'Profissional fictício',local:'Clínica fictícia',contato:'Contato fictício',endereco:'Endereço fictício',conduta:'Acordo de exemplo',retorno:'2020-02-01',horaRetorno:'10:00',valor:120,obs:'Preservar observação',legado:'manter'};E.consultas=[c];editarConsultaTratamento({id:'plano-ficticio'},c)");
  a.document.querySelector('[name=local]').value='Clínica atualizada';enviar(a);
  assert.equal(a.document.querySelector('.trat-form'),null);
  assert.equal(a.run('E.consultas.length'),1);assert.equal(a.run('c.id'),'consulta-ficticia');
  assert.equal(a.run('c.retorno'),'2020-02-01');assert.equal(a.run('c.valor'),'120');
  assert.equal(a.run('c.horaRetorno'),'10:00');assert.equal(a.run('c.endereco'),'Endereço fictício');
  assert.equal(a.run('c.conduta'),'Acordo de exemplo');assert.equal(a.run('c.legado'),'manter');
  assert.equal(a.run('c.tratamentoId'),'plano-ficticio');assert.equal(a.run('E.gastos.length'),0);
});

test('seletor móvel acessa as cinco seções e continua sincronizado com a navegação por botões',()=>{
  const a=iniciar();a.run("E.tratamentos=[{id:'plano-ficticio',oque:'Plano de exemplo',tipo:'Plano de tratamento'}];tratamentoVisao='resumo';document.body.append(quadroTratamentos())");
  const selector=()=>a.document.querySelector('[aria-label="Seção do tratamento"]');
  assert.deepEqual([...selector().options].map(o=>o.value),['resumo','consultas','itens','evolucao','documentos']);
  for(const v of ['consultas','itens','evolucao','documentos','resumo']){
    selector().onchange({target:{value:v}});
    assert.equal(a.run('tratamentoVisao'),v);
    assert.equal(selector().value,v);
    assert.equal(a.document.querySelectorAll('.trat-subtabs [aria-pressed=true]').length,1);
    assert.equal([...selector().options].find(o=>o.value===v).selected,true);
  }
  [...a.document.querySelectorAll('.trat-subtabs button')].find(b=>b.textContent.includes('Consultas')).click();
  assert.equal(selector().value,'consultas');
});
