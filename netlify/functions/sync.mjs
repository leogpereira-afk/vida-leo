/* ============================================================
   Central do Léo — login + sincronização na nuvem (Netlify Blobs).
   POST /api/sync {acao:'login', senha}  -> {token}
   GET  /api/sync   (Bearer)             -> {mt, dados} | {mt:0}
   PUT  /api/sync   (Bearer) {dados}     -> {mt}
   Env: APP_SENHA, SESSION_SECRET (capturadas no deploy).
   ============================================================ */
import { getStore } from '@netlify/blobs'
import { createHmac, timingSafeEqual } from 'node:crypto'

const DIAS = 180
const store = () => getStore({ name: 'central', consistency: 'strong' })

const segredo = () => {
  const s = process.env.SESSION_SECRET
  if (!s) throw new Error('SESSION_SECRET ausente')
  return s
}
const assina = (exp) => createHmac('sha256', segredo()).update(String(exp)).digest('hex')
const token = () => { const exp = Date.now() + DIAS * 864e5; return exp + '.' + assina(exp) }
function tokenOk(t) {
  if (!t) return false
  const [expS, mac] = String(t).split('.')
  const exp = +expS
  if (!exp || exp < Date.now() || !mac) return false
  try { return timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(assina(exp), 'hex')) }
  catch { return false }
}
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } })

export default async function handler(req) {
  if (req.method === 'POST') {
    const { acao, senha } = await req.json().catch(() => ({}))
    if (acao !== 'login') return json({ erro: 'ação inválida' }, 400)
    const certa = process.env.APP_SENHA
    if (!certa) return json({ erro: 'APP_SENHA não configurada' }, 500)
    const a = Buffer.from(String(senha || '')), b = Buffer.from(certa)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return json({ erro: 'Senha incorreta' }, 401)
    return json({ token: token() })
  }

  const t = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!tokenOk(t)) return json({ erro: 'Não autorizado' }, 401)

  if (req.method === 'GET') {
    const reg = await store().get('estado', { type: 'json' })
    return json(reg || { mt: 0, dados: null })
  }
  if (req.method === 'PUT') {
    const { dados } = await req.json().catch(() => ({}))
    if (!dados || typeof dados !== 'object') return json({ erro: 'dados ausentes' }, 400)
    const mt = Date.now()
    await store().setJSON('estado', { mt, dados })
    return json({ mt })
  }
  return json({ erro: 'método não suportado' }, 405)
}

export const config = { path: '/api/sync' }
