import type { OrderItem, ShopSettings } from './types'

export interface ScoredOrder extends OrderItem {
  score: number
  reasons: string[]
  isBatchLeader: boolean
  batchCount: number
  equipBlocked: boolean
}

export function buildSchedule(
  orders: OrderItem[],
  settings: ShopSettings,
  now: number
): ScoredOrder[] {
  const pending = orders.filter(o => o.status === 'pending')
  const cooking = orders.filter(o => o.status === 'cooking')

  // 設備ごとの使用中スロット数を計算
  const equipUsage: Record<string, number> = {
    cold: 0,
    stove: 0,
    grill: 0,
    fryer: 0,
    straw: 0,
  }
  cooking.forEach(o => {
    equipUsage[o.menu.equip] = (equipUsage[o.menu.equip] || 0) + 1
  })

  // 設備ごとの最大スロット数
  const equipCapacity: Record<string, number> = {
    cold: 99,
    stove: settings.stoveSlots || 4,
    grill: settings.grillSlots || 3,
    fryer: settings.hasFryer ? (settings.fryerSlots || 2) : 0,
    straw: settings.hasStraw ? 2 : 0,
  }

  // スコア計算
  const scored = pending.map(o => {
    const { score, reasons } = calcScore(o, orders, settings, now)
    const currentUsage = equipUsage[o.menu.equip] || 0
    const capacity = equipCapacity[o.menu.equip] || 0
    const equipBlocked = capacity > 0 && currentUsage >= capacity
    return { ...o, score, reasons, equipBlocked }
  })

  // ソート：設備ブロック中は後回し、その中でスコア順
  scored.sort((a, b) => {
    if (a.equipBlocked && !b.equipBlocked) return 1
    if (!a.equipBlocked && b.equipBlocked) return -1
    return b.score - a.score
  })

  // 同じメニューを隣接させる（待機中のみ）
  const result: typeof scored = []
  const used = new Set<number>()

  for (const item of scored) {
    if (used.has(item.id)) continue
    used.add(item.id)
    result.push(item)
    const sameMenu = scored.filter(s => !used.has(s.id) && s.menu.id === item.menu.id)
    for (const same of sameMenu) {
      used.add(same.id)
      result.push(same)
    }
  }

  // バッチリーダーフラグ
  return result.map(o => {
    const sameMenuItems = result.filter(s => s.menu.id === o.menu.id)
    const isLeader = sameMenuItems.length > 1 && sameMenuItems[0].id === o.id
    return { ...o, isBatchLeader: isLeader, batchCount: sameMenuItems.length }
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

  // 1. 待機時間
  if (waitSec < warn) {
    score += waitMin * 5
  } else if (waitSec < danger) {
    score += (warn / 60) * 5 + (waitMin - warn / 60) * 15
    reasons.push('長待ち')
  } else {
    score += 999
    reasons.push('遅延!')
  }

  // 2. 卓の初提供
  const tableOrders = all.filter(o => o.table === item.table)
  const tableHasServed = tableOrders.some(o => o.status === 'served')
  if (!tableHasServed) { score += 35; reasons.push('初提供') }

  // 3. 冷菜は常に先出し
  if (item.menu.equip === 'cold') { score += 30; reasons.push('冷菜先出し') }

  // 4. 長時間料理は早めに着手
  if (item.menu.cookTime >= 12) { score += 20; reasons.push('長調理') }
  else if (item.menu.cookTime >= 8) score += 10

  // 5. 同じ設備のバッチボーナス
  const sameEquipPending = all.filter(
    o => o.id !== item.id && o.status === 'pending' &&
    o.menu.equip === item.menu.equip && item.menu.equip !== 'cold'
  ).length
  if (sameEquipPending > 0) {
    score += Math.min(sameEquipPending * 8, 24)
    reasons.push(`同設備×${sameEquipPending + 1}`)
  }

  // 6. 同じメニューのまとめボーナス
  const sameMenuCount = all.filter(
    o => o.id !== item.id && o.menu.id === item.menu.id && o.status === 'pending'
  ).length
  if (sameMenuCount > 0) { score += 40; reasons.push(`まとめ×${sameMenuCount + 1}`) }

  // 7. 同卓まとめ
  const sameTablePending = tableOrders.filter(o => o.id !== item.id && o.status === 'pending').length
  if (sameTablePending > 0) score += 8

  // 8. 付きっきり減点
  score -= item.menu.attn * 5

  // 9. ワンオペモード補正
  if (settings.oneOperatorMode) {
    if (item.menu.attn >= 4) { score -= 30; reasons.push('ワンオペ注意') }
    else if (item.menu.attn === 0) { score += 15; reasons.push('放置可') }
    if (item.menu.equip === 'cold') score += 10
  }

  // 10. 藁焼き特別ルール
  if (item.menu.equip === 'straw') {
    const strawPending = all.filter(
      o => o.id !== item.id && o.menu.equip === 'straw' && o.status === 'pending'
    ).length
    if (strawPending >= 1) { score += 30; reasons.push('藁焼きまとめ') }
    else if (waitMin < 2) score -= 15
  }

  // 11. 危険卓の強制引き上げ
  const tableMaxWait = Math.max(
    0,
    ...tableOrders.filter(o => o.status === 'pending').map(o => (now - o.addedAt) / 1000)
  )
  if (tableMaxWait >= danger) { score += 50; reasons.push('危険卓') }
  else if (tableMaxWait >= warn) { score += 20; reasons.push('注意卓') }

  // 12. メニュー固有ボーナス
  score += item.menu.bonus ?? 0

  return { score: Math.round(score), reasons }
}