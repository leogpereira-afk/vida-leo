import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHmac,webcrypto} from 'node:crypto';
import vm from 'node:vm';
// O crachá virou três peças: crachaPayload confere assinatura/validade/sistema,
// tokenOk guarda as portas normais e stateOk guarda só a volta do Strava.
const source=readFileSync(new URL('../supabase/functions/leo-sync/index.ts',import.meta.url),'utf8');
const start=source.indexOf('async function crachaPayload('),end=source.indexOf('/* Crachá CURTO',start);
const fn=source.slice(start,end)
  .replace(/: Promise<[^>]*>/g,'')
  .replace(/\(([a-zA-Z]+): string( \| null)?\)/g,'($1)');
const key='synthetic-test-secret';
const ctx=vm.createContext({JWT_EQUIPE:key,crypto:webcrypto,TextEncoder,TextDecoder,atob});vm.runInContext(fn,ctx);
function token(payload){const data=Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify(payload)).toString('base64url');return data+'.'+createHmac('sha256',key).update(data).digest('base64url');}
const agora=()=>Math.floor(Date.now()/1000);

test('sessão sem expiração é recusada',async()=>assert.equal(await ctx.crachaPayload(token({sis:'central'})),null));
test('sessão expirada é recusada',async()=>assert.equal(await ctx.crachaPayload(token({sis:'central',exp:1})),null));
test('sessão de outro sistema é recusada',async()=>assert.equal(await ctx.crachaPayload(token({sis:'rh',exp:agora()+60})),null));
test('sessão válida da Central continua aceita',async()=>assert.equal(await ctx.tokenOk(token({sis:'central',exp:agora()+60})),true));
test('assinatura adulterada é recusada',async()=>assert.equal(await ctx.tokenOk(token({sis:'central',exp:agora()+60})+'x'),false));
// o crachá que passeia pela URL do Strava não pode abrir as portas de dados
test('crachá de state não serve de sessão',async()=>assert.equal(await ctx.tokenOk(token({sis:'central',uso:'strava-state',iat:agora(),exp:agora()+600})),false));
test('state curto é aceito na volta do Strava',async()=>assert.equal(await ctx.stateOk(token({sis:'central',uso:'strava-state',iat:agora(),exp:agora()+600})),true));
test('sessão de 180 dias não serve de state',async()=>assert.equal(await ctx.stateOk(token({sis:'central',exp:agora()+60})),false));
test('state forjado com validade longa é recusado',async()=>assert.equal(await ctx.stateOk(token({sis:'central',uso:'strava-state',iat:agora(),exp:agora()+3600})),false));
