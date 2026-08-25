/* ============================================================
   Backup do FORTEMAIS para o hub da Impresilk (painel-backup).
   POST {action:'list'}   -> {registros:[{_col:'obras',...}], nextAfter:null}
   POST {action:'getCfg'} -> {cfg:null}
   Auth: header x-token conferido contra o HASH abaixo — o valor
   do token só existe no registry (secret) do hub. Guardar o hash
   aqui é seguro num repo público; o token, nunca.
   Só a coleção 'obras' sai daqui: o resto da Central é vida
   pessoal e não pertence ao backup da empresa.
   ============================================================ */
import { getStore } from '@netlify/blobs'
import { createHash } from 'node:crypto'

const HASH_TOKEN = '961f34e72ce5adf4eea50bf29e0248df751c051d7690859b581eec572780b5de'
const store = () => getStore({ name: 'central', consistency: 'strong' })
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } })

export default async function handler(req) {
  if (req.method !== 'POST') return json({ erro: 'use POST' }, 405)
  const t = req.headers.get('x-token') || ''
  if (createHash('sha256').update(t).digest('hex') !== HASH_TOKEN) return json({ erro: 'Não autorizado' }, 401)

  const { action } = await req.json().catch(() => ({}))
  if (action === 'getCfg') return json({ cfg: null })
  if (action !== 'list') return json({ erro: 'ação inválida' }, 400)

  const reg = await store().get('estado', { type: 'json' })
  const obras = (reg && reg.dados && Array.isArray(reg.dados.obras)) ? reg.dados.obras : []
  return json({
    registros: obras.map((o) => ({ _col: 'obras', ...o })),
    nextAfter: null,
    mt: reg ? reg.mt : 0,
  })
}

export const config = { path: '/api/backup-fortemais' }
