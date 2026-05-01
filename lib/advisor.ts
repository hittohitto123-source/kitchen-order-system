import type { OrderItem, ShopSettings } from './types'

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
  const pending = orders.filter(o => o.status === 'pending')
  const cooking = orders.filter(o => o.status === 'cooking')
  const advices: Advice[] = []

  // 設備使用中か
  const cookingEquips = new Set(cooking.map(o => o.menu.equip))
  const equipCapacity: Record<string, number> = {
    cold: 99,
    stove: settings.stoveSlots || 4,
    grill: settings.grillSlots || 3,
    fryer: settings.hasFryer ? (settings.fryerSlots || 2) : 0,
    straw: settings.hasStraw ? 2 : 0,
  }
  const equipUsage: Record<string, number> = {}
  cooking.forEach(o => { equipUsage[o.menu.equip] = (equipUsage[o.menu.equip] || 0) + 1 })

  // ━━━━━━━━━━━━━━━━━━━━━━
  // レベル1：遅延卓の緊急警告
  // ━━━━━━━━━━━━━━━━━━━━━━
  const dangerOrders = pending.filter(o =>
    (now - o.addedAt) / 1000 >= settings.dangerThresholdSec
  )
  if (dangerOrders.length > 0) {
    const tables = [...new Set(dangerOrders.map(o => o.table))].join('・')
    const items = dangerOrders.map(o => `${o.table}卓${o.menu.name}`).join('、')
    advices.push({
      level: 'urgent',
      icon: '🚨',
      text: `緊急！${tables}卓が遅延しています。${items}を最優先で調理してください。`
    })
  }

  // ━━━━━━━━━━━━━━━━━━━━━━
  // レベル2：今すぐ出せる冷菜
  // ━━━━━━━━━━━━━━━━━━━━━━
  const coldPending = pending.filter(o => o.menu.equip === 'cold')
  if (coldPending.length > 0) {
    const items = coldPending.map(o => `${o.table}卓${o.menu.name}`).join('、')
    advices.push({
      level: 'urgent',
      icon: '🧊',
      text: `今すぐ出せます：${items}`
    })
  }

  // ━━━━━━━━━━━━━━━━━━━━━━
  // レベル3：まとめて調理できる同一メニュー
  // ━━━━━━━━━━━━━━━━━━━━━━
  const menuGroups: Record<string, OrderItem[]> = {}
  pending
    .filter(o => o.menu.equip !== 'cold')
    .forEach(o => {
      if (!menuGroups[o.menu.id]) menuGroups[o.menu.id] = []
      menuGroups[o.menu.id].push(o)
    })

  Object.values(menuGroups)
    .filter(g => g.length >= 2)
    .sort((a, b) => b.length - a.length)
    .forEach(group => {
      const equip = group[0].menu.equip
      const usage = equipUsage[equip] || 0
      const cap = equipCapacity[equip] || 0
      const available = Math.max(0, cap - usage)
      const canStart = Math.min(available, group.length)
      const tables = group.map(o => `${o.table}卓`).join('・')

      if (canStart >= 2) {
        advices.push({
          level: 'action',
          icon: '🔥',
          text: `まとめて調理：${group[0].menu.name}が${group.length}件。${tables}をまとめて${EQUIP_LABEL[equip]}で開始してください。`
        })
      } else if (canStart === 1) {
        advices.push({
          level: 'action',
          icon: '▶️',
          text: `${group[0].menu.name}（${tables}）：${EQUIP_LABEL[equip]}が空き次第まとめて調理できます。`
        })
      }
    })

  // ━━━━━━━━━━━━━━━━━━━━━━
  // レベル4：空き設備への投入指示
  // ━━━━━━━━━━━━━━━━━━━━━━
  const equips = ['straw', 'fryer', 'grill', 'stove']
  equips.forEach(equip => {
    const cap = equipCapacity[equip] || 0
    if (cap === 0) return
    const usage = equipUsage[equip] || 0
    const available = cap - usage
    if (available <= 0) return

    const waitingForEquip = pending
      .filter(o => o.menu.equip === equip)
      .sort((a, b) => a.addedAt - b.addedAt)

    if (waitingForEquip.length === 0) return

    const toStart = waitingForEquip.slice(0, available)
    const items = toStart.map(o => `${o.table}卓${o.menu.name}`).join('、')

    // まとめ調理でもう追加されていればスキップ
    const alreadyAdvised = advices.some(a =>
      toStart.some(o => a.text.includes(o.menu.name) && a.text.includes(`${o.table}卓`))
    )
    if (!alreadyAdvised) {
      advices.push({
        level: 'action',
        icon: equip === 'fryer' ? '🍳' : equip === 'straw' ? '🔥' : equip === 'grill' ? '♨️' : '🥘',
        text: `${EQUIP_LABEL[equip]}空き${available}枠：${items}を今すぐ開始してください。`
      })
    }
  })

  // ━━━━━━━━━━━━━━━━━━━━━━
  // レベル5：並行作業の指示
  // ━━━━━━━━━━━━━━━━━━━━━━
  if (cooking.length > 0 && coldPending.length === 0) {
    // 調理中の料理がある状態で、並行して他の設備で調理できるものがあるか
    const cookingAttnHigh = cooking.some(o => o.menu.attn >= 3)
    const parallelPending = pending.filter(o => {
      const equip = o.menu.equip
      if (equip === 'cold') return false
      const usage = equipUsage[equip] || 0
      const cap = equipCapacity[equip] || 0
      return cap > 0 && usage < cap && !cookingEquips.has(equip)
    })

    if (parallelPending.length > 0 && !cookingAttnHigh) {
      const item = parallelPending[0]
      const cookingItems = cooking.map(o => `${o.table}卓${o.menu.name}`).join('、')
      advices.push({
        level: 'parallel',
        icon: '⚡',
        text: `並行作業可：${cookingItems}の調理中に、${item.table}卓${item.menu.name}を${EQUIP_LABEL[item.menu.equip]}で同時開始できます。`
      })
    }

    if (cookingAttnHigh) {
      const attnItems = cooking.filter(o => o.menu.attn >= 3)
      const attnItem = attnItems[0]
      const cookTime = attnItem.menu.cookTime
      const elapsed = attnItem.startedAt
        ? Math.floor((now - attnItem.startedAt) / 1000)
        : 0
      const remaining = Math.max(0, cookTime * 60 - elapsed)
      if (remaining > 0) {
        advices.push({
          level: 'warning',
          icon: '👀',
          text: `${attnItem.table}卓${attnItem.menu.name}は目を離せません。残り約${Math.ceil(remaining / 60)}分。他の作業は完了後に。`
        })
      }
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━
  // レベル6：調理完了間近の次の準備指示
  // ━━━━━━━━━━━━━━━━━━━━━━
  cooking.forEach(o => {
    if (!o.startedAt) return
    const elapsed = (now - o.startedAt) / 1000
    const remaining = o.menu.cookTime * 60 - elapsed
    if (remaining > 0 && remaining <= 60) {
      // 完了間近 → 次に何を開始するか
      const nextForEquip = pending
        .filter(p => p.menu.equip === o.menu.equip)
        .sort((a, b) => a.addedAt - b.addedAt)[0]
      if (nextForEquip) {
        advices.push({
          level: 'next',
          icon: '⏱',
          text: `まもなく完了：${o.table}卓${o.menu.name}があと約${Math.ceil(remaining)}秒で完了。提供後すぐに${nextForEquip.table}卓${nextForEquip.menu.name}を開始してください。`
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
  // レベル7：警告時間超過の卓
  // ━━━━━━━━━━━━━━━━━━━━━━
  const warnOrders = pending.filter(o =>
    (now - o.addedAt) / 1000 >= settings.warningThresholdSec &&
    (now - o.addedAt) / 1000 < settings.dangerThresholdSec
  )
  if (warnOrders.length > 0) {
    const tables = [...new Set(warnOrders.map(o => o.table))].join('・')
    advices.push({
      level: 'warning',
      icon: '⚠️',
      text: `${tables}卓の待ち時間が長くなっています。優先して調理してください。`
    })
  }

  // ━━━━━━━━━━━━━━━━━━━━━━
  // 何もない場合
  // ━━━━━━━━━━━━━━━━━━━━━━
  if (advices.length === 0 && pending.length === 0 && cooking.length === 0) {
    advices.push({
      level: 'next',
      icon: '✅',
      text: '全ての注文が完了しています。お疲れ様でした！'
    })
  }

  if (advices.length === 0 && cooking.length > 0 && pending.length === 0) {
    advices.push({
      level: 'next',
      icon: '🍳',
      text: `調理中の料理を仕上げてください。待機中の注文はありません。`
    })
  }

  // 重複削除・最大5件まで
  const unique = advices.filter((a, i, arr) =>
    arr.findIndex(b => b.text === a.text) === i
  )
  return unique.slice(0, 5)
}