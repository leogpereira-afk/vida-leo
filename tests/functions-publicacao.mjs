import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,copyFileSync,chmodSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
const fonte=new URL('../scripts/publicar-functions.sh',import.meta.url);
function repo(t){
 const dir=mkdtempSync(join(tmpdir(),'leo-functions-test-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const git=(...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 mkdirSync(join(dir,'scripts'));copyFileSync(fonte,join(dir,'scripts/publicar-functions.sh'));
 for(const fn of ['leo-sync','equipe-auth']){mkdirSync(join(dir,'supabase/functions',fn),{recursive:true});writeFileSync(join(dir,'supabase/functions',fn,'index.ts'),'export const teste=1;\n')}
 mkdirSync(join(dir,'fake-bin'));const log=join(dir,'chamadas.txt');
 writeFileSync(join(dir,'fake-bin/curl'),'#!/bin/sh\nprintf "%s\\n" "$*" >> "$TEST_CALLS"\nprintf \'{"version":17,"status":"ACTIVE"}\\n\'\n');chmodSync(join(dir,'fake-bin/curl'),0o755);
 git('init','-q');git('config','user.name','Teste');git('config','user.email','teste@example.invalid');git('add','scripts','supabase');git('commit','-qm','base');const base=git('rev-parse','HEAD');
 const mudar=(arquivo,conteudo)=>{mkdirSync(join(dir,arquivo,'..'),{recursive:true});writeFileSync(join(dir,arquivo),conteudo);git('add','scripts','supabase');git('commit','-qm','alteracao');return git('rev-parse','HEAD')};
 const rodar=(...args)=>spawnSync('bash',['scripts/publicar-functions.sh',...args],{cwd:dir,encoding:'utf8',env:{...process.env,SUPABASE_ACCESS_TOKEN:'token-ficticio-teste',TEST_CALLS:log,PATH:join(dir,'fake-bin')+':'+process.env.PATH}});
 const chamadas=()=>{try{return readFileSync(log,'utf8').trim().split('\n').filter(Boolean)}catch{return []}};
 return{dir,git,base,mudar,rodar,chamadas};
}

test('push de leo-sync publica somente leo-sync, sem equipe-auth',t=>{
 const r=repo(t),head=r.mudar('supabase/functions/leo-sync/index.ts','export const teste=2;\n');const p=r.rodar('--changed',r.base,head);
 assert.equal(p.status,0,p.stderr+p.stdout);assert.equal(r.chamadas().length,1);assert.match(r.chamadas()[0],/slug=leo-sync/);assert.doesNotMatch(r.chamadas()[0],/slug=equipe-auth/);
});

test('mudança apenas no script não publica função alguma',t=>{
 const r=repo(t),head=r.mudar('scripts/publicar-functions.sh',readFileSync(fonte,'utf8')+'\n# comentario de teste\n');const p=r.rodar('--changed',r.base,head);
 assert.equal(p.status,0,p.stderr+p.stdout);assert.equal(r.chamadas().length,0);assert.match(p.stdout,/Nenhuma function alterada/);
});

test('mais de um arquivo da mesma função gera apenas um deploy',t=>{
 const r=repo(t);r.mudar('supabase/functions/leo-sync/modulo.ts','export const a=1;\n');const head=r.mudar('supabase/functions/leo-sync/index.ts','export const b=2;\n');const p=r.rodar('--changed',r.base,head);
 assert.equal(p.status,0,p.stderr+p.stdout);assert.equal(r.chamadas().length,1);
});

test('remoção de função no repositório nunca apaga nem republica a função remota',t=>{
 const r=repo(t);rmSync(join(r.dir,'supabase/functions/leo-sync'),{recursive:true});r.git('add','supabase');r.git('commit','-qm','remove');const p=r.rodar('--changed',r.base,r.git('rev-parse','HEAD'));
 assert.equal(p.status,0,p.stderr+p.stdout);assert.equal(r.chamadas().length,0);assert.match(p.stdout,/não será removida|nao sera removida/);
});

test('referência inválida ou ausente bloqueia antes de qualquer deploy',t=>{
 const r=repo(t);for(const base of ['HEAD~999','f'.repeat(40),'--all']){const p=r.rodar('--changed',base,r.base);assert.notEqual(p.status,0);assert.equal(r.chamadas().length,0)}
});

test('mudança em dependência compartilhada exige seleção explícita sem publicar todas por surpresa',t=>{
 const r=repo(t),head=r.mudar('supabase/functions/_shared/seguro.ts','export const a=1;\n');const p=r.rodar('--changed',r.base,head);
 assert.notEqual(p.status,0);assert.equal(r.chamadas().length,0);assert.match(p.stderr+p.stdout,/compartilhada/);
});

test('execução manual sem argumentos mantém publicação completa explícita',t=>{
 const r=repo(t),p=r.rodar();assert.equal(p.status,0,p.stderr+p.stdout);assert.equal(r.chamadas().length,2);assert.match(r.chamadas().join('\n'),/slug=equipe-auth/);assert.match(r.chamadas().join('\n'),/slug=leo-sync/);
});
