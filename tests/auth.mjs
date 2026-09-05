import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHmac,webcrypto} from 'node:crypto';
import vm from 'node:vm';
const source=readFileSync(new URL('../supabase/functions/leo-sync/index.ts',import.meta.url),'utf8');
const start=source.indexOf('async function crachaOk('),end=source.indexOf('/* SÓ O CRACHÁ',start);
const fn=source.slice(start,end).replace('token: string','token').replace(': Promise<boolean>','').replace('t: string','t');
const key='synthetic-test-secret';
const ctx=vm.createContext({JWT_EQUIPE:key,crypto:webcrypto,TextEncoder,TextDecoder,atob});vm.runInContext(fn,ctx);
function token(payload){const data=Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify(payload)).toString('base64url');return data+'.'+createHmac('sha256',key).update(data).digest('base64url')}
test('sessão sem expiração é recusada',async()=>assert.equal(await ctx.crachaOk(token({sis:'central'})),false));
test('sessão expirada é recusada',async()=>assert.equal(await ctx.crachaOk(token({sis:'central',exp:1})),false));
test('sessão de outro sistema é recusada',async()=>assert.equal(await ctx.crachaOk(token({sis:'rh',exp:Date.now()/1000+60})),false));
test('sessão válida da Central continua aceita',async()=>assert.equal(await ctx.crachaOk(token({sis:'central',exp:Date.now()/1000+60})),true));
