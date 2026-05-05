'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { OrderItem, MenuItem, ShopSettings } from '../../lib/types'
import { loadOrders, saveOrders, loadSettings, saveSettings, loadNextId, saveNextId, clearAllOrders, loadOrdersFromDB, loadMenuFromDB, logAnalytics } from '../../lib/storage'
import { buildSchedule, ScoredOrder } from '../../lib/priorityEngine'
import { generateAdvice } from '../../lib/advisor'

// ジャンル色定義
const GENRE_COLORS: Record<string, { border: string; bg: string; text: string; label: string }> = {
  cold:  { border: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  text: '#60a5fa', label: '冷菜' },
  straw: { border: '#f97316', bg: 'rgba(249,115,22,0.08)',  text: '#fb923c', label: '藁焼き' },
  stove: { border: '#d97706', bg: 'rgba(146,64,14,0.08)',   text: '#fbbf24', label: 'コンロ' },
  fryer: { border: '#dc2626', bg: 'rgba(220,38,38,0.08)',   text: '#f87171', label: 'フライヤー' },
  grill: { border: '#a855f7', bg: 'rgba(168,85,247,0.08)',  text: '#c084fc', label: 'グリル' },
}

function getWaitColor(sec: number): string {
  if (sec >= 180) return '#ef4444'
  if (sec >= 60)  return '#f59e0b'
  return '#6b7280'
}

function getProgressColor(progress: number, isOver: boolean): string {
  if (isOver)        return '#ef4444'
  if (progress > 80) return '#f59e0b'
  if (progress > 50) return '#eab308'
  return '#22c55e'
}

function formatWait(sec: number) {
  if (sec < 60) return `${sec}秒`
  const m = Math.floor(sec / 60); const s = sec % 60
  return s > 0 ? `${m}分${s}秒` : `${m}分`
}

function playAlertSound() {
  try {
    const ctx = new AudioContext()
    const frequencies = [880, 660, 880]
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.2)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 0.15)
      osc.start(ctx.currentTime + i * 0.2)
      osc.stop(ctx.currentTime + i * 0.2 + 0.15)
    })
  } catch {}
}

const EQUIP_TABS = [
  { key: 'all',     label: 'すべて' },
  { key: 'popular', label: '人気🔥' },
  { key: 'cold',    label: '冷菜' },
  { key: 'straw',   label: '藁焼き' },
  { key: 'stove',   label: 'コンロ' },
  { key: 'fryer',   label: 'フライヤー' },
  { key: 'grill',   label: 'グリル' },
]

const ADVICE_COLORS: Record<string, string> = {
  urgent:   'bg-red-950 border-red-600 text-red-200',
  action:   'bg-blue-950 border-blue-600 text-blue-200',
  parallel: 'bg-green-950 border-green-600 text-green-200',
  warning:  'bg-amber-950 border-amber-600 text-amber-200',
  next:     'bg-gray-800 border-gray-600 text-gray-300',
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [menuList, setMenuList] = useState<MenuItem[]>([])
  const [settings, setSettings] = useState<ShopSettings | null>(null)
  const [now, setNow] = useState(Date.now())
  const [selTable, setSelTable] = useState('1')
  const [selMenu, setSelMenu] = useState('')
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [dbSynced, setDbSynced] = useState(false)
  const [activeTab, setActiveTab] = useState<'priority' | 'tables' | 'add'>('priority')
  const [activeEquip, setActiveEquip] = useState('all')
  const [batchModal, setBatchModal] = useState<{ order: OrderItem; sameMenuOrders: OrderItem[] } | null>(null)
  const [orderCount, setOrderCount] = useState<Record<string, number>>({})
  const [showAdvice, setShowAdvice] = useState(false)
  const alertedTables = useRef<Set<number>>(new Set())

  useEffect(() => {
    setSettings(loadSettings())
    Promise.all([loadMenuFromDB(), loadOrdersFromDB()]).then(([menuData, dbOrders]) => {
      const activeMenu = menuData.filter(m => m.active)
      setMenuList(activeMenu)
      localStorage.setItem('kitchen_menu', JSON.stringify(menuData))
      if (activeMenu.length) setSelMenu(activeMenu[0].id)
      if (dbOrders.length > 0) {
        setOrders(dbOrders); saveOrders(dbOrders)
        const maxId = Math.max(...dbOrders.map(o => o.id), 0)
        saveNextId(maxId + 1)
        const count: Record<string, number> = {}
        dbOrders.forEach(o => { count[o.menu.id] = (count[o.menu.id] || 0) + 1 })
        setOrderCount(count)
      } else { setOrders(loadOrders()) }
      setDbSynced(true)
    })
  }, [])

  useEffect(() => {
    let dbPollCount = 0
    const t = setInterval(() => {
      const newNow = Date.now()
      setNow(newNow)
      const currentOrders = loadOrders()
      setOrders(currentOrders)
      const count: Record<string, number> = {}
      currentOrders.forEach(o => { count[o.menu.id] = (count[o.menu.id] || 0) + 1 })
      setOrderCount(count)
      const currentSettings = loadSettings()
      if (currentSettings.soundAlert) {
        const dangerTables = currentOrders
          .filter(o => o.status === 'pending' && (newNow - o.addedAt) / 1000 >= currentSettings.dangerThresholdSec)
          .map(o => o.table)
        const newDanger = dangerTables.filter(t => !alertedTables.current.has(t))
        if (newDanger.length > 0) { playAlertSound(); newDanger.forEach(t => alertedTables.current.add(t)) }
        if (dangerTables.length === 0) alertedTables.current.clear()
      }
      dbPollCount++
      if (dbPollCount >= 10) {
        dbPollCount = 0
        loadOrdersFromDB().then(dbOrders => {
          if (dbOrders.length > 0) {
            saveOrders(dbOrders); setOrders(dbOrders)
            const maxId = Math.max(...dbOrders.map(o => o.id), 0)
            saveNextId(maxId + 1)
          }
        })
        loadMenuFromDB().then(menuData => {
          const activeMenu = menuData.filter(m => m.active)
          setMenuList(activeMenu)
          localStorage.setItem('kitchen_menu', JSON.stringify(menuData))
        })
      }
    }, 1000)
    return () => clearInterval(t)
  }, [])

  const commit = (updated: OrderItem[]) => { setOrders(updated); saveOrders(updated) }

  const handleStartPress = (order: OrderItem) => {
    const sameMenuOrders = orders.filter(o => o.id !== order.id && o.menu.id === order.menu.id && o.status === 'pending')
    if (sameMenuOrders.length > 0) setBatchModal({ order, sameMenuOrders })
    else startCooking([order.id])
  }

  const startCooking = (ids: number[]) => {
    const t = Date.now()
    const updated = orders.map(o => ids.includes(o.id) ? { ...o, status: 'cooking' as const, startedAt: t } : o)
    commit(updated); setBatchModal(null)
  }

  const setStatus = async (id: number, status: OrderItem['status']) => {
    const t = Date.now()
    const updated = orders.map(o => o.id === id ? {
      ...o, status,
      startedAt: status === 'cooking' ? t : o.startedAt,
      servedAt: status === 'served' ? t : o.servedAt,
    } : o)
    commit(updated)
    if (status === 'served') {
      const order = updated.find(o => o.id === id)
      if (order) { alertedTables.current.delete(order.table); await logAnalytics(order) }
    }
  }

  const addOrder = (menuId?: string) => {
    const menu = menuList.find(m => m.id === (menuId || selMenu))
    if (!menu || !settings) return
    const id = loadNextId()
    commit([...orders, { id, table: Number(selTable), menu, status: 'pending', addedAt: Date.now() }])
    saveNextId(id + 1)
    setOrderCount(prev => ({ ...prev, [menu.id]: (prev[menu.id] || 0) + 1 }))
  }

  const toggleOneOp = () => {
    if (!settings) return
    const updated = { ...settings, oneOperatorMode: !settings.oneOperatorMode }
    setSettings(updated); saveSettings(updated)
  }

  const toggleSound = () => {
    if (!settings) return
    const updated = { ...settings, soundAlert: !settings.soundAlert }
    setSettings(updated); saveSettings(updated)
  }

  const handleCloseBusiness = () => {
    clearAllOrders(); setOrders([]); alertedTables.current.clear(); setShowCloseConfirm(false)
  }

  const filteredMenu = () => {
    let filtered = menuList
    if (activeEquip === 'popular') return [...menuList].sort((a, b) => (orderCount[b.id] || 0) - (orderCount[a.id] || 0)).slice(0, 12)
    if (activeEquip !== 'all') filtered = menuList.filter(m => m.equip === activeEquip)
    return [...filtered].sort((a, b) => (orderCount[b.id] || 0) - (orderCount[a.id] || 0))
  }

  if (!settings || !dbSynced) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
      <div className="text-center">
        <div className="text-amber-400 font-black text-3xl mb-3">KitchenQ</div>
        <div className="text-gray-400">同期中...</div>
      </div>
    </div>
  )

  const scheduled = buildSchedule(orders, settings, now)
  const cooking = orders.filter(o => o.status === 'cooking')
  const pending = orders.filter(o => o.status === 'pending')
  const served = orders.filter(o => o.status === 'served')
  const dangerTables = new Set(
    orders.filter(o => o.status === 'pending' && (now - o.addedAt) / 1000 >= settings.dangerThresholdSec).map(o => o.table)
  )
  const tables = Array.from({ length: settings.tableCount }, (_, i) => i + 1)
  const advices = generateAdvice(orders, settings, now)
  const hasUrgent = advices.some(a => a.level === 'urgent')

  const equipUsage: Record<string, number> = {}
  cooking.forEach(o => { equipUsage[o.menu.equip] = (equipUsage[o.menu.equip] || 0) + 1 })
  const equipCapacity: Record<string, number> = {
    stove: settings.stoveSlots || 4,
    grill: settings.grillSlots || 3,
    fryer: settings.hasFryer ? (settings.fryerSlots || 2) : 0,
    straw: settings.hasStraw ? 2 : 0,
  }

  const getWaitSec = (table: number) => {
    const items = orders.filter(o => o.table === table && o.status !== 'served')
    if (!items.length) return null
    return Math.floor((now - Math.min(...items.map(o => o.addedAt))) / 1000)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white" style={{fontFamily:'system-ui,sans-serif'}}>

      {/* 営業終了モーダル */}
      {showCloseConfirm && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:'1rem'}}>
          <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm border-2 border-red-700">
            <h2 className="text-2xl font-black text-red-400 mb-3 text-center">営業終了</h2>
            <p className="text-gray-300 mb-6 text-sm text-center">全ての注文データをクリアします。元に戻せません。</p>
            <div className="flex gap-3">
              <button onClick={() => setShowCloseConfirm(false)} className="flex-1 bg-gray-700 text-white font-black py-4 rounded-2xl">キャンセル</button>
              <button onClick={handleCloseBusiness} className="flex-1 bg-red-600 text-white font-black py-4 rounded-2xl">終了する</button>
            </div>
          </div>
        </div>
      )}

      {/* バッチモーダル */}
      {batchModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:'1rem'}}>
          <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm border-2 border-blue-700">
            <h2 className="text-xl font-black text-blue-400 mb-2 text-center">{batchModal.order.menu.name}</h2>
            <p className="text-gray-400 text-sm text-center mb-4">同じメニューが{batchModal.sameMenuOrders.length + 1}件あります。</p>
            <div className="bg-gray-800 rounded-2xl p-3 mb-4">
              {[batchModal.order, ...batchModal.sameMenuOrders].map(o => (
                <div key={o.id} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                  <span className="text-amber-400 font-black">{o.table}卓</span>
                  <span className="text-xs text-gray-400">待機{formatWait(Math.floor((now - o.addedAt) / 1000))}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 mb-3">
              <button onClick={() => startCooking([batchModal.order.id])} className="w-full bg-gray-700 text-white font-bold py-3 rounded-2xl text-sm active:scale-95">
                {batchModal.order.table}卓だけ開始（1件）
              </button>
              {batchModal.sameMenuOrders.map((_, idx) => {
                const sel = [batchModal.order, ...batchModal.sameMenuOrders.slice(0, idx + 1)]
                return (
                  <button key={idx} onClick={() => startCooking(sel.map(o => o.id))} className="w-full bg-blue-700 text-white font-bold py-3 rounded-2xl text-sm active:scale-95">
                    {sel.map(o => `${o.table}卓`).join('+')} まとめて（{sel.length}件）
                  </button>
                )
              })}
              <button onClick={() => startCooking([batchModal.order, ...batchModal.sameMenuOrders].map(o => o.id))} className="w-full bg-green-600 text-white font-black py-3 rounded-2xl text-sm active:scale-95">
                全{batchModal.sameMenuOrders.length + 1}件まとめて開始
              </button>
            </div>
            <button onClick={() => setBatchModal(null)} className="w-full bg-gray-800 text-gray-400 font-bold py-3 rounded-2xl text-sm">キャンセル</button>
          </div>
        </div>
      )}

      {/* ━━━ ヘッダー（圧縮版） ━━━ */}
      <div className="bg-gray-900 border-b border-gray-800 px-3 py-2">
        {/* 上段：タイトル＋ボタン */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-black text-amber-400">KitchenQ</h1>
            <span className="text-xs text-green-500">●同期中</span>
          </div>
          <div className="flex gap-1.5">
            <button onClick={toggleSound} className={`px-2 py-1 rounded-lg text-xs font-bold ${settings.soundAlert ? 'bg-blue-800 text-blue-300' : 'bg-gray-700 text-gray-400'}`}>
              {settings.soundAlert ? '音ON' : '音OFF'}
            </button>
            <button onClick={toggleOneOp} className={`px-2 py-1 rounded-lg text-xs font-bold ${settings.oneOperatorMode ? 'bg-amber-500 text-black' : 'bg-gray-700 text-white'}`}>
              {settings.oneOperatorMode ? 'ワンオペ' : '通常'}
            </button>
            <button onClick={() => setShowCloseConfirm(true)} className="px-2 py-1 rounded-lg text-xs font-bold bg-red-900 text-red-300">終了</button>
          </div>
        </div>

        {/* 下段：統計＋設備状況（1行に圧縮） */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex gap-2">
            <span><span className="text-amber-400 font-black">{pending.length}</span>待機</span>
            <span><span className="text-blue-400 font-black">{cooking.length}</span>調理</span>
            <span><span className="text-green-400 font-black">{served.length}</span>提供</span>
            <span><span className="text-red-400 font-black">{dangerTables.size}</span>遅延</span>
          </div>
          <div className="flex gap-2 ml-auto">
            {Object.entries(equipCapacity).filter(([, cap]) => cap > 0).map(([equip, cap]) => {
              const usage = equipUsage[equip] || 0
              const label = equip === 'stove' ? 'コ' : equip === 'grill' ? 'グ' : equip === 'fryer' ? 'フ' : '藁'
              return (
                <div key={equip} className="flex items-center gap-0.5">
                  <span className="text-gray-400">{label}</span>
                  {Array.from({ length: cap }).map((_, i) => (
                    <span key={i} className="w-2.5 h-2.5 rounded-sm inline-block"
                      style={{ backgroundColor: i < usage ? '#ef4444' : '#374151' }} />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ━━━ アドバイスパネル ━━━ */}
      {advices.length > 0 && (pending.length > 0 || cooking.length > 0) && (
        <div className={`border-b ${hasUrgent ? 'border-red-800' : 'border-gray-800'}`}>
          <button onClick={() => setShowAdvice(!showAdvice)}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm font-black ${hasUrgent ? 'bg-red-950 text-red-300' : 'bg-gray-900 text-amber-400'}`}>
            <span>{hasUrgent ? '🚨 緊急指示' : '📋 調理アドバイス'}（{advices.length}件）</span>
            <span className="text-gray-400 text-xs">{showAdvice ? '▲ 閉じる' : '▼ 開く'}</span>
          </button>
          {showAdvice && (
            <div className="bg-gray-950 px-3 py-2 flex flex-col gap-2">
              {advices.map((advice, i) => (
                <div key={i} className={`flex items-start gap-2 p-3 rounded-xl border text-sm ${ADVICE_COLORS[advice.level]}`}>
                  <span className="text-lg flex-shrink-0">{advice.icon}</span>
                  <span className="leading-snug font-bold">{advice.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ━━━ タブ ━━━ */}
      <div className="flex bg-gray-900 border-b border-gray-800">
        {[
          { key: 'priority', label: '優先順位' },
          { key: 'tables',   label: '卓一覧' },
          { key: 'add',      label: '注文追加' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 py-2.5 text-sm font-bold border-b-2 ${activeTab === tab.key ? 'text-amber-400 border-amber-400' : 'text-gray-400 border-transparent'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ━━━ 優先順位タブ（新レイアウト） ━━━ */}
      {activeTab === 'priority' && (
        <div className="flex overflow-hidden" style={{height:'calc(100vh - 155px)'}}>

          {/* 左70%：待機中（2列グリッド） */}
          <div className="overflow-y-auto" style={{width:'70%', borderRight:'1px solid #1f2937'}}>
            <div className="bg-gray-900 px-3 py-1.5 border-b border-gray-800 sticky top-0 z-10">
              <span className="text-xs font-black text-amber-400">次にやること（{scheduled.length}件）</span>
            </div>
            <div className="p-2">
              {scheduled.length === 0 && (
                <div className="text-center py-12 text-gray-600">
                  <div className="text-4xl mb-2">✓</div>
                  <div className="text-sm">待機なし</div>
                </div>
              )}

              {/* まとめバッジ付きグループを先に表示 */}
              {(() => {
                const rendered = new Set<number>()
                const elements: JSX.Element[] = []

                scheduled.forEach((o, i) => {
                  if (rendered.has(o.id)) return
                  const waitSec = Math.floor((now - o.addedAt) / 1000)
                  const isDanger = waitSec >= settings.dangerThresholdSec
                  const isWarn = waitSec >= settings.warningThresholdSec
                  const isBlocked = o.equipBlocked
                  const genre = GENRE_COLORS[o.menu.equip] || GENRE_COLORS.stove
                  const isCombined = o.batchCount > 1

                  if (isCombined && o.isBatchLeader) {
                    // グループ全体を取得
                    const group = scheduled.filter(s => s.menu.id === o.menu.id)
                    group.forEach(s => rendered.add(s.id))

                    elements.push(
                      <div key={`group-${o.menu.id}`} className="mb-3">
                        {/* まとめバッジ */}
                        <div className="inline-flex items-center gap-1 px-3 py-1 mb-2 rounded-full border text-xs font-black"
                          style={{backgroundColor:'rgba(34,197,94,0.15)', borderColor:'#22c55e', color:'#22c55e'}}>
                          ★ まとめて{group.length}件：{o.menu.name}
                        </div>
                        {/* グループを2列で表示 */}
                        <div className="grid grid-cols-2 gap-2">
                          {group.map((go, gi) => {
                            const gWait = Math.floor((now - go.addedAt) / 1000)
                            const gDanger = gWait >= settings.dangerThresholdSec
                            const gWarn = gWait >= settings.warningThresholdSec
                            return (
                              <div key={go.id} className="rounded-xl p-2.5 relative"
                                style={{
                                  borderLeft: `5px solid ${genre.border}`,
                                  backgroundColor: gDanger ? 'rgba(127,29,29,0.5)' : gWarn ? 'rgba(120,53,15,0.5)' : '#1a1f2e',
                                  boxShadow: `0 0 10px ${genre.border}55`,
                                }}>
                                {/* ★被りマーク */}
                                <div className="absolute top-1.5 right-1.5 text-xs px-1.5 py-0.5 rounded-full font-black animate-pulse"
                                  style={{backgroundColor:'rgba(255,215,0,0.2)', border:'1px solid #FFD700', color:'#FFD700'}}>
                                  ★
                                </div>
                                {/* 順位 + 商品名 */}
                                <div className="flex items-baseline gap-1.5 mb-1 pr-8">
                                  <span className="text-xs text-gray-500">{scheduled.indexOf(go) + 1}</span>
                                  <span className="text-base font-black text-white leading-tight truncate">{go.menu.name}</span>
                                </div>
                                {/* 卓番（最大） */}
                                <div className="text-3xl font-black mb-1.5" style={{color:'#FFD700'}}>{go.table}卓</div>
                                {/* 下段 */}
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="text-xs" style={{color: genre.text}}>{genre.label}·{go.menu.cookTime}分</div>
                                    <div className="text-xs" style={{color: getWaitColor(gWait)}}>⏱{formatWait(gWait)}</div>
                                  </div>
                                  <button onClick={() => !go.equipBlocked && handleStartPress(go)} disabled={go.equipBlocked}
                                    className="px-3 py-2 rounded-lg text-sm font-black active:scale-95"
                                    style={{backgroundColor: go.equipBlocked ? '#374151' : '#2563eb', color: go.equipBlocked ? '#6b7280' : 'white'}}>
                                    {go.equipBlocked ? '満杯' : '開始'}
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  } else if (!rendered.has(o.id)) {
                    rendered.add(o.id)
                    elements.push(
                      <div key={o.id} className="rounded-xl p-2.5 mb-2 relative"
                        style={{
                          borderLeft: `5px solid ${isBlocked ? '#374151' : genre.border}`,
                          backgroundColor: isDanger ? 'rgba(127,29,29,0.5)' : isWarn ? 'rgba(120,53,15,0.5)' : isBlocked ? '#111' : '#1a1f2e',
                          opacity: isBlocked ? 0.6 : 1,
                        }}>
                        {/* 待機時間（右上） */}
                        <div className="absolute top-2 right-2 text-xs" style={{color: getWaitColor(waitSec)}}>
                          ⏱{formatWait(waitSec)}
                        </div>
                        {/* 順位 + 商品名 */}
                        <div className="flex items-baseline gap-1.5 mb-1 pr-12">
                          <span className="text-xs text-gray-500">{i + 1}</span>
                          <span className="text-base font-black text-white leading-tight truncate">{o.menu.name}</span>
                        </div>
                        {/* 卓番（最大） */}
                        <div className="text-3xl font-black mb-1.5" style={{color:'#FFD700'}}>{o.table}卓</div>
                        {/* 下段 */}
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs" style={{color: isBlocked ? '#6b7280' : genre.text}}>{genre.label}·{o.menu.cookTime}分</div>
                            {isDanger && !isBlocked && <div className="text-xs text-red-400 font-black animate-pulse">遅延!</div>}
                            {isBlocked && <div className="text-xs text-gray-500">{genre.label}が満杯</div>}
                          </div>
                          <button onClick={() => !isBlocked && handleStartPress(o)} disabled={isBlocked}
                            className="px-3 py-2 rounded-lg text-sm font-black active:scale-95"
                            style={{backgroundColor: isBlocked ? '#374151' : '#2563eb', color: isBlocked ? '#6b7280' : 'white'}}>
                            {isBlocked ? '満杯' : '▶ 開始'}
                          </button>
                        </div>
                      </div>
                    )
                  }
                })
                return elements
              })()}
            </div>
          </div>

          {/* 右30%：調理中（1列） */}
          <div className="overflow-y-auto" style={{width:'30%'}}>
            <div className="bg-gray-900 px-3 py-1.5 border-b border-gray-800 sticky top-0 z-10">
              <span className="text-xs font-black text-blue-400">調理中（{cooking.length}）</span>
            </div>
            <div className="p-2">
              {cooking.length === 0 && (
                <div className="text-center py-8 text-gray-600">
                  <div className="text-2xl mb-1">🍳</div>
                  <div className="text-xs">なし</div>
                </div>
              )}
              {cooking.map(o => {
                const genre = GENRE_COLORS[o.menu.equip] || GENRE_COLORS.stove
                const elapsed = o.startedAt ? Math.floor((now - o.startedAt) / 1000) : 0
                const stdSec = o.menu.cookTime * 60
                const progress = Math.min((elapsed / stdSec) * 100, 100)
                const isOver = elapsed > stdSec
                return (
                  <div key={o.id} className="rounded-xl p-2.5 mb-2"
                    style={{ borderLeft:`5px solid ${genre.border}`, backgroundColor:'#1a1f2e' }}>
                    {/* 商品名 */}
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-blue-400 text-sm">▶</span>
                      <span className="text-sm font-black text-white leading-tight truncate">{o.menu.name}</span>
                    </div>
                    {/* 卓番 */}
                    <div className="text-2xl font-black mb-1" style={{color:'#FFD700'}}>{o.table}卓</div>
                    {/* 進捗バー */}
                    <div className="w-full h-1.5 bg-gray-800 rounded-full mb-2 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000"
                        style={{ width:`${progress}%`, backgroundColor: getProgressColor(progress, isOver) }} />
                    </div>
                    {/* 経過時間 + 完了ボタン */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{color: isOver ? '#ef4444' : '#9ca3af'}}>
                        {isOver ? '超過' : ''}経過{formatWait(elapsed)}
                      </span>
                      <button onClick={() => setStatus(o.id, 'served')}
                        className="px-3 py-1.5 rounded-lg text-xs font-black active:scale-95"
                        style={{backgroundColor:'#16a34a', color:'white'}}>
                        完了
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ━━━ 卓一覧タブ ━━━ */}
      {activeTab === 'tables' && (
        <div className="p-3 pb-24">
          <div className="grid grid-cols-3 gap-3">
            {tables.map(t => {
              const ws = getWaitSec(t)
              const items = orders.filter(o => o.table === t)
              const isDanger = ws !== null && ws >= settings.dangerThresholdSec
              const isWarn = ws !== null && ws >= settings.warningThresholdSec
              const pendingCount = items.filter(o => o.status === 'pending').length
              const cookingCount = items.filter(o => o.status === 'cooking').length
              return (
                <button key={t} onClick={() => { setSelTable(String(t)); setActiveTab('add') }}
                  className={`rounded-2xl p-4 text-left active:scale-95 border-2 ${
                    isDanger ? 'bg-red-950 border-red-600' :
                    isWarn ? 'bg-amber-950 border-amber-600' :
                    items.length ? 'bg-gray-800 border-gray-600' :
                    'bg-gray-900 border-gray-800 opacity-50'
                  }`}>
                  <div className="text-xs text-gray-400">{t}卓</div>
                  {ws !== null ? (
                    <div className={`text-2xl font-black ${isDanger ? 'text-red-400' : isWarn ? 'text-amber-400' : 'text-green-400'}`}>{formatWait(ws)}</div>
                  ) : (
                    <div className="text-lg font-black text-gray-600">空き</div>
                  )}
                  {(pendingCount > 0 || cookingCount > 0) && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {cookingCount > 0 && <span className="text-xs bg-blue-800 text-blue-200 px-1.5 py-0.5 rounded">{cookingCount}調理中</span>}
                      {pendingCount > 0 && <span className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">{pendingCount}待機</span>}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ━━━ 注文追加タブ ━━━ */}
      {activeTab === 'add' && (
        <div className="pb-24 overflow-y-auto" style={{height:'calc(100vh - 155px)'}}>
          <div className="bg-gray-900 px-4 py-3 border-b border-gray-800">
            <div className="text-xs text-gray-400 mb-2">卓番号</div>
            <div className="flex overflow-x-auto gap-2">
              {tables.map(t => (
                <button key={t} onClick={() => setSelTable(String(t))}
                  className={`flex-shrink-0 w-12 h-12 rounded-xl font-black text-lg active:scale-95 ${selTable === String(t) ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex overflow-x-auto gap-2 px-4 py-3 bg-gray-900 border-b border-gray-800">
            {EQUIP_TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveEquip(tab.key)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold active:scale-95 ${activeEquip === tab.key ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 p-3">
            {filteredMenu().map(m => {
              const count = orderCount[m.id] || 0
              const genre = GENRE_COLORS[m.equip] || GENRE_COLORS.stove
              return (
                <button key={m.id} onClick={() => { setSelMenu(m.id); addOrder(m.id) }}
                  className="rounded-xl p-3 text-left active:scale-95 border-2 relative"
                  style={{ borderLeft:`5px solid ${genre.border}`, borderColor:'#374151', backgroundColor:'#1a1f2e' }}>
                  {count > 0 && (
                    <div className="absolute top-2 left-2 bg-gray-700 text-gray-300 text-xs px-1.5 py-0.5 rounded-full font-bold">{count}回</div>
                  )}
                  <div className="font-bold text-sm mt-4 mb-1 text-white">{m.name}</div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400">{m.cookTime}分</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full" style={{backgroundColor:`${genre.border}22`, color: genre.text}}>{genre.label}</span>
                  </div>
                </button>
              )
            })}
          </div>

          {orders.filter(o => o.table === Number(selTable)).length > 0 && (
            <div className="mx-3 mb-3 bg-gray-900 rounded-2xl p-4">
              <div className="text-xs text-gray-400 mb-3">{selTable}卓の現在の注文</div>
              {orders.filter(o => o.table === Number(selTable)).map(o => (
                <div key={o.id} className="flex items-center gap-3 py-2.5 border-b border-gray-800 last:border-0">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${o.status === 'pending' ? 'bg-amber-400' : o.status === 'cooking' ? 'bg-blue-400' : 'bg-green-400'}`} />
                  <div className="flex-1 font-bold text-sm">{o.menu.name}</div>
                  <div className="flex gap-2">
                    {o.status === 'pending' && <button onClick={() => setStatus(o.id, 'cooking')} className="bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95">開始</button>}
                    {o.status === 'cooking' && <button onClick={() => setStatus(o.id, 'served')} className="bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95">完了</button>}
                    {o.status === 'served' && <span className="text-xs text-gray-500 line-through">提供済</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 底部ナビ */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex">
        <Link href="/kitchen" className="flex-1 py-3 text-center text-xs text-amber-400 font-bold border-t-2 border-amber-400">厨房</Link>
        <Link href="/orders" className="flex-1 py-3 text-center text-xs text-gray-400 font-bold">注文</Link>
        <Link href="/menu" className="flex-1 py-3 text-center text-xs text-gray-400 font-bold">メニュー</Link>
        <Link href="/settings" className="flex-1 py-3 text-center text-xs text-gray-400 font-bold">設定</Link>
        <Link href="/analytics" className="flex-1 py-3 text-center text-xs text-gray-400 font-bold">分析</Link>
      </div>
    </div>
  )
}