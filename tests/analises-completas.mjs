import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';
test('Análises mostram todos os campos anteriores, textos integrais e dados desconhecidos',()=>{
 const {run,document}=setup();run("E=structuredClone(SEED);for(const k of Object.keys(E.comportamento))E.comportamento[k]='Conteúdo integral de '+k+' FINAL';E.comportamento.extraNovo={exemplo:'Valor adicional'};atual='guia';filtro.guiaAba='desenvolvimento';filtro.devAba='resultados';filtro.devResultado='analises';const antes=JSON.stringify(E.comportamento);tela()");
 const root=document.querySelector('#dev-result-pane-analises .dev-complete-profile');assert.ok(root);for(const k of run('Object.keys(E.comportamento)')){const campo=root.querySelector('[data-legacy-field="'+k+'"]');assert.ok(campo,k);assert.match(campo.textContent,k==='extraNovo'?/Valor adicional/:new RegExp('Conteúdo integral de '+k+' FINAL'));}assert.equal(run('JSON.stringify(E.comportamento)===antes'),true);
});
test('Cadastro completo preserva zeros, falsos, listas e textos longos sem executar HTML',()=>{
 const {run,document}=setup();run("E.comportamento={disc:{D:0,I:71},extra:false,lista:['Primeiro',{item:'Segundo'}],comoDecido:'<script>não executar</script>\\n'+ 'Texto completo '.repeat(300)+'FIM'};document.getElementById('main').appendChild(devPainelLegado())");const root=document.querySelector('.dev-complete-profile');assert.match(root.querySelector('[data-legacy-field=disc]').textContent,/0/);assert.match(root.querySelector('[data-legacy-field=extra]').textContent,/Não/);assert.match(root.querySelector('[data-legacy-field=lista]').textContent,/Segundo/);assert.match(root.querySelector('[data-legacy-field=comoDecido]').textContent,/FIM$/);assert.equal(root.querySelector('script'),null);
});
test('Filtros de análises não ocultam o cadastro anterior completo',()=>{
 const {run,document}=setup();run("E=structuredClone(SEED);E.comportamento.eneagrama='Texto antigo completo';filtro.devAnaliseFonte='fonte-inexistente';atual='guia';filtro.guiaAba='desenvolvimento';filtro.devAba='resultados';filtro.devResultado='analises';tela()");assert.match(document.querySelector('#dev-result-pane-analises').textContent,/Texto antigo completo/);assert.equal(document.querySelector('#dev-result-pane-analises').hidden,false);
});
