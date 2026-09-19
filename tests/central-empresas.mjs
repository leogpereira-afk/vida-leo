import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';
function app(){const a=setup();a.run("E=structuredClone(SEED);E.empresasPJ=[{id:'a',nome:'Alfa'},{id:'b',nome:'Beta'}];E.liderancas=[];E.planejamentoEmpresas=[];normalizarEmpresas(E);globalThis.emp=E.empresasPJ[0];atual='empresas';filtro.empresaId='a'");return a;}
test('liderança permanente tem responsabilidades diferentes em duas empresas',()=>{const a=app();a.run("globalThis.p=centralSalvarLider(emp,'',{nome:'Líder',responsabilidade:'Produção'});centralSalvarLider(E.empresasPJ[1],p.id,{nome:'Líder',responsabilidade:'Gestão'})");assert.equal(a.run('E.liderancas.length'),1);assert.equal(a.run('p.vinculos[0].responsabilidade'),'Produção');assert.equal(a.run('p.vinculos[1].responsabilidade'),'Gestão');assert.equal(a.run('centralLideres(emp).length'),1);assert.ok(a.run('empresaDependencias(emp).some(x=>x.titulo.includes("Lideranças"))'));});
test('abrir central e cancelar perfil não altera dados e conserva seções existentes',()=>{const a=app(),antes=a.run('JSON.stringify(E)');a.run('tela();centralModalLider(emp)');assert.equal(a.run('JSON.stringify(E)'),antes);for(const id of ['direcao','liderancas','acompanhamento','contatos','sistemas','gerais','bancos','documentos','imoveis','conexoes'])assert.ok(a.document.querySelector('#empresa-'+id),id);});
test('nome vazio, ID inexistente e URL insegura não mutam o cadastro',()=>{const a=app(),antes=a.run('JSON.stringify(E)');for(const expr of ["centralSalvarLider(emp,'',{nome:''})","centralSalvarLider(emp,'ausente',{nome:'Líder'})","centralSalvarLider(emp,'',{nome:'Líder',foto:'javascript:alert(1)'})"])assert.throws(()=>a.run(expr));assert.equal(a.run('JSON.stringify(E)'),antes);});
test('backup aceita perfis e rejeita estruturas inválidas',()=>{const a=app();a.run("centralSalvarLider(emp,'',{nome:'Líder',responsabilidade:'Gestão'})");assert.doesNotThrow(()=>a.run('validarBackup(E)'));a.run("E.liderancas[0].vinculos='inválido'");assert.throws(()=>a.run('validarBackup(E)'));});
test('ação estratégica vincula responsável pelo ID e impede usar liderança de outra empresa',()=>{const a=app();a.run("globalThis.p=centralSalvarLider(emp,'',{nome:'Líder',responsabilidade:'Gestão'})");assert.equal(a.run("centralResponsavelAcao({empresaId:'a'},{liderId:p.id,quem:'Antigo'}).quem"),'Líder');assert.throws(()=>a.run("centralResponsavelAcao({empresaId:'b'},{liderId:p.id})"));assert.equal(a.run("centralResponsavelAcao({empresaId:'a'},{quem:'Legado'}).quem"),'Legado');});

test('formulários salvam contatos e sistemas só na empresa escolhida',()=>{
 const a=app();a.run("tela();centralModalItem(emp,'contatosEmpresa')");
 let f=a.document.querySelector('#modais form');f.querySelector('[name=nome]').value='Contato exemplo';f.onsubmit({preventDefault(){}});
 assert.equal(a.run('emp.contatosEmpresa.length'),1);assert.equal(a.run('E.empresasPJ[1].contatosEmpresa.length'),0);
 a.run("centralModalItem(emp,'sistemasEmpresa')");f=a.document.querySelector('#modais form');f.querySelector('[name=nome]').value='Sistema';f.querySelector('[name=url]').value='javascript:alert(1)';f.onsubmit({preventDefault(){}});assert.equal(a.run('emp.sistemasEmpresa.length'),0);
 f.querySelector('[name=url]').value='https://example.com';f.onsubmit({preventDefault(){}});assert.equal(a.run('emp.sistemasEmpresa.length'),1);
});
test('acompanhamento preserva história e não aparece em outra empresa',()=>{
 const a=app();a.run("globalThis.p=centralSalvarLider(emp,'',{nome:'Líder'});tela();centralModalConversa(emp,p)");
 const f=a.document.querySelector('#modais form');f.querySelector('[name=assunto]').value='Decisão de teste';f.onsubmit({preventDefault(){}});
 assert.equal(a.run('p.registros.length'),1);assert.match(a.document.querySelector('#empresa-acompanhamento').textContent,/Decisão de teste/);
 a.document.querySelector('#empresa-acompanhamento button').click();assert.equal(a.run('p.registros[0].concluido'),true);
 a.run("filtro.empresaId='b';tela()");assert.doesNotMatch(a.document.querySelector('#empresa-acompanhamento').textContent,/Decisão de teste/);assert.equal(a.run('p.registros.length'),1);
});
