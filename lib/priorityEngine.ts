import type { OrderItem, ShopSettings } from './types'

export interface ScoredOrder extends OrderItem {
  score: number
  reasons: string[]
  isBatchLeader: boolean
  batchCount: number
}

export function buildSchedule(
  orders: OrderItem[],
  settings: ShopSettings,
  now: number
): ScoredOrder[] {
  const pending = orders.filter(o => o.status === 'pending')
  const scored = pending
    .map(o => { const { score, reasons } = calcScore(o, orders, settings, now); return { ...o, score, reasons } })
    .sort((a, b) => b.score - a.score)
  return scored.map(o => {
    const sameMenu = scored.filter(s => s.menu.id === o.menu.id)
    return { ...o, isBatchLeader: sameMenu.length > 1 && sameMenu[0].id === o.id, batchCount: sameMenu.length }
  })
}

function calcScore(
  item: OrderItem,
  all: OrderItem[],
  settings: ShopSettings,
  now: number
): { score: number; reasons: string[] } {
  const waitSec = (now - item.addedAt) / 1000
  const waitMin = waitSec / 60
  const warn = settings.warningThresholdSec
  const danger = settings.dangerThresholdSec
  const reasons: string[] = []
  let score = 0

  // 1. 待機時間（段階的指数スコア）
  if (waitSec < warn) {
    score += waitMin * 5
  } else if (waitSec < danger) {
    score += (warn / 60) * 5 + (waitMin - warn / 60) * 15
    reasons.push('長待ち')
  } else {
    score += 999
    reasons.push('遅延!')
  }

  // 2. 卓の飢餓防止（まだ何も出ていない卓を最優先）
  const tableOrders = all.filter(o => o.table === item.table)
  const tableHasServed = tableOrders.some(o => o.status === 'served')
  if (!tableHasServed) { score += 35; reasons.push('初提供') }

  // 3. 冷菜は常に先出し
  if (item.menu.equip === 'cold') { score += 30; reasons.push('冷菜先出し') }

  // 4. 長時間料理は早めに着手
  if (item.menu.cookTime >= 12) { score += 20; reasons.push('長調理') }
  else if (item.menu.cookTime >= 8) score += 10

  // 5. 同じ設備の料理がまとまっているバッチボーナス
  const sameEquipCount = all.filter(
    o => o.id !== item.id && o.status === 'pending' && o.menu.equip === item.menu.equip && item.menu.equip !== 'cold'
  ).length
  if (sameEquipCount > 0) { score += Math.min(sameEquipCount * 8, 24); reasons.push(`同設備×${sameEquipCount + 1}`) }

  // 6. 同じメニューが複数卓（まとめて調理できる）
  const sameMenuCount = all.filter(
    o => o.id !== item.id && o.menu.id === item.menu.id && (o.status === 'pending' || o.status === 'cooking')
  ).length
  if (sameMenuCount > 0) { score += 25; reasons.push(`まとめ調理×${sameMenuCount + 1}`) }

  // 7. 同卓にまとめて出せる料理がある
  const sameTablePending = tableOrders.filter(o => o.id !== item.id && o.status === 'pending').length
  if (sameTablePending > 0) score += 8

  // 8. 付きっきり必要度による減点
  score -= item.menu.attn * 5

  // 9. ワンオペモード補正
  if (settings.oneOperatorMode) {
    if (item.menu.attn >= 4) { score -= 30; reasons.push('ワンオペ注意') }
    else if (item.menu.attn === 0) { score += 15; reasons.push('放置可') }
    if (item.menu.equip === 'cold') score += 10
  }

  // 10. 藁焼き特別ルール（まとめ処理 or 単発待機）
  if (item.menu.equip === 'straw') {
    const strawPending = all.filter(o => o.id !== item.id && o.menu.equip === 'straw' && o.status === 'pending').length
    if (strawPending >= 1) { score += 30; reasons.push('藁焼きまとめ') }
    else if (waitMin < 2) score -= 15
  }

  // 11. 危険卓の強制引き上げ
  const tableMaxWait = Math.max(0, ...tableOrders.filter(o => o.status === 'pending').map(o => (now - o.addedAt) / 1000))
  if (tableMaxWait >= danger) { score += 50; reasons.push('危険卓') }
  else if (tableMaxWait >= warn) { score += 20; reasons.push('注意卓') }

  // 12. メニュー固有ボーナス
  score += item.menu.bonus ?? 0

  return { score: Math.round(score), reasons }
}