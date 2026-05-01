import type { OrderItem, ShopSettings } from './types'
import { buildSchedule } from './priorityEngine'

export interface Advice {
  level: 'urgent' | 'action' | 'parallel' | 'warning' | 'next'
  icon: string
  text: string
}

const EQUIP_LABEL: Record<string, string> = {
  cold: '冷菜', stove: 'コンロ', grill: 'グリル',
  fryer: 'フライヤー', straw: '藁焼き台'
}

export function generateAdvice(
  orders: OrderItem[],
  settings: ShopSettings,
  now: number
): Advice[] {
  const advices: Advice[] = []

  // priorityEngineの結果をそのまま使う
  const scheduled = buildSchedule(orders, settings, now)
  const cooking = orders.filter(o => o.status === 'cooking')

  const equipCapacity: Record<string, number> = {
    cold: 99,
    stove: settings.stoveSlots || 4,
    grill: settings.grillSlots || 3,
    fryer: settings.hasFryer ? (settings.fryerSlots || 2) : 0,
    straw: settings.hasStraw ? 2 : 0,
  }
  const equipUsage: Record<string, number> = {}
  cooking.forEach(o => { equipUsage[o.menu.equip] = (equipUsage[o.menu.equip] || 0) + 1 })

  if (scheduled.length === 0 && cooking.length === 0) {
    advices.push({ level: 'next', icon: '✅', text: '全ての注文が完了しています。お疲れ様でした！' })
    return advices
  }

  if (scheduled.length === 0 && cooking.length > 0) {
    advices.push({ level: 'next', icon: '🍳', text: '調理中の料理を仕上げてください。待機中の注文はありません。' })
  }

  // ━━━━━━━━━━━━━━━━━━━━━━
  // レベル1：遅延緊急警告（priorityEngineの順番通り）
  // ━━━━━━━━━━━━━━━━━━━━━━
  const dangerItems = scheduled.filter(o =>
    (now - o.addedAt) / 1000 >= settings.dangerThresholdSec
  )
  if (dangerItems.length > 0) {
    const items = dangerItems.slice(0, 3).map(o => `${o.table}卓${o.menu.name}`).join('、')
    advices.push({
      level: 'urgent',
      icon: '🚨',
      text: `緊急！${items}が遅延しています。今すぐ調理してください。`
    })
  }

  // ━━━━━━━━━━━━━━━━━━━━━━
  // レベル2：優先順位1位の指示（priorityEngineの1番目）
  // ━━━━━━━━━━━━━━━━━━━━━━
  const top = scheduled.find(o => !o.equipBlocked)
  if (top) {
    const usage = equipUsage[top.menu.equip] || 0
    const cap = equipCapacity[top.menu.equip] || 0
    const isEquipFree = cap === 0 || usage < cap

    if (top.menu.equip === 'cold') {
      // 冷菜グループをまとめて指示
      const coldItems = scheduled
        .filter(o => o.menu.equip === 'cold')
        .map(o => `${o.table}卓${o.menu.name}`)
        .join('、')
      advices.push({
        level: 'urgent',
        icon: '🧊',
        text: `今すぐ出せます：${coldItems}`
      })
    } else if (top.isBatchLeader && top.batchCount >= 2) {
      // まとめ調理の指示
      const batchItems = scheduled
        .filter(o => o.menu.id === top.menu.id)
        .map(o => `${o.table}卓`)
        .join('・')
      if (isEquipFree) {
        advices.push({
          level: 'action',
          icon: '🔥',
          text: `まとめて調理：${top.menu.name}が${top.batchCount}件。${batchItems}を${EQUIP_LABEL[top.menu.equip]}でまとめて開始してください。`
        })
      } else {
        advices.push({
          level: 'warning',
          icon: '⏳',
          text: `${top.menu.name}（${batchItems}）：${EQUIP_LABEL[top.menu.equip]}が空き次第まとめて調理してください。`
        })
      }
    } else {
      // 通常の1位指示
      if (isEquipFree && !top.equipBlocked) {
        const icon = top.menu.equip === 'fryer' ? '🍳' :
                     top.menu.equip === 'straw' ? '🔥' :
                     top.menu.equip === 'grill' ? '♨️' : '🥘'
        advices.push({
          level: 'action',
          icon,
          text: `最優先：${top.table}卓${top.menu.name}を${EQUIP_LABEL[top.menu.equip]}で今すぐ開始してください（${top.menu.cookTime}分）。`
        })
      }
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━
  // レベル3：並行作業の指示（priorityEngineの順番に従う）
  // ━━━━━━━━━━━━━━━━━━━━━━
  if (cooking.length > 0) {
    const cookingAttnHigh = cooking.some(o => o.menu.attn >= 3)

    if (cookingAttnHigh) {
      const attnItem = cooking.find(o => o.menu.attn >= 3)!
      const elapsed = attnItem.startedAt ? Math.floor((now - attnItem.startedAt) / 1000) : 0
      const remaining = Math.max(0, attnItem.menu.cookTime * 60 - elapsed)
      advices.push({
        level: 'warning',
        icon: '👀',
        text: `${attnItem.table}卓${attnItem.menu.name}は目を離せません。残り約${Math.ceil(remaining / 60)}分。完了後に次の作業へ。`
      })
    } else {
      // 空き設備で並行できるものを優先順位順に探す
      const parallelCandidate = scheduled.find(o => {
        if (o.menu.equip === 'cold') return false
        const usage = equipUsage[o.menu.equip] || 0
        const cap = equipCapacity[o.menu.equip] || 0
        const cookingEquips = new Set(cooking.map(c => c.menu.equip))
        return cap > 0 && usage < cap && !cookingEquips.has(o.menu.equip)
      })

      if (parallelCandidate) {
        const cookingDesc = cooking.slice(0, 2).map(o => `${o.table}卓${o.menu.name}`).join('、')
        advices.push({
          level: 'parallel',
          icon: '⚡',
          text: `並行作業可：${cookingDesc}の調理中に、${parallelCandidate.table}卓${parallelCandidate.menu.name}を${EQUIP_LABEL[parallelCandidate.menu.equip]}で同時開始できます。`
        })
      }
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━
  // レベル4：調理完了間近の次の準備（priorityEngineの次の候補）
  // ━━━━━━━━━━━━━━━━━━━━━━
  cooking.forEach(o => {
    if (!o.startedAt) return
    const elapsed = (now - o.startedAt) / 1000
    const remaining = o.menu.cookTime * 60 - elapsed
    if (remaining > 0 && remaining <= 60) {
      // 次にやるべき料理をpriority順で探す
      const nextItem = scheduled.find(p =>
        p.menu.equip === o.menu.equip && !p.equipBlocked
      )
      if (nextItem) {
        advices.push({
          level: 'next',
          icon: '⏱',
          text: `まもなく完了：${o.table}卓${o.menu.name}があと約${Math.ceil(remaining)}秒。提供後すぐに${nextItem.table}卓${nextItem.menu.name}を開始してください。`
        })
      } else {
        advices.push({
          level: 'next',
          icon: '⏱',
          text: `まもなく完了：${o.table}卓${o.menu.name}があと約${Math.ceil(remaining)}秒。提供の準備をしてください。`
        })
      }
    }
  })

  // ━━━━━━━━━━━━━━━━━━━━━━
  // レベル5：次の2番目・3番目の指示
  // ━━━━━━━━━━━━━━━━━━━━━━
  const notYetAdvised = scheduled.filter(o =>
    !o.equipBlocked &&
    !advices.some(a => a.text.includes(`${o.table}卓${o.menu.name}`))
  )

  if (notYetAdvised.length > 0 && advices.length < 4) {
    const next = notYetAdvised[0]
    const usage = equipUsage[next.menu.equip] || 0
    const cap = equipCapacity[next.menu.equip] || 0
    if (cap === 0 || usage < cap) {
      advices.push({
        level: 'next',
        icon: '▶️',
        text: `次の準備：${next.table}卓${next.menu.name}（${EQUIP_LABEL[next.menu.equip]}・${next.menu.cookTime}分）を準備してください。`
      })
    }
  }

  // 重複削除・最大5件
  const unique = advices.filter((a, i, arr) =>
    arr.findIndex(b => b.text === a.text) === i
  )
  return unique.slice(0, 5)
}