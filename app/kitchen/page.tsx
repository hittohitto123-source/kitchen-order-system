'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { OrderItem, MenuItem, ShopSettings, TableConfig } from '../../lib/types'
import { loadOrders, saveOrders, loadSettings, saveSettings, loadNextId, saveNextId, clearAllOrders, loadOrdersFromDB, loadMenuFromDB, logAnalytics } from '../../lib/storage'
import { buildSchedule } from '../../lib/priorityEngine'
import { generateAdvice } from '../../lib/advisor'

const GENRE: Record<string, { border: string; bg: string; text: string; label: string }> = {
  cold:  { border: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  text: '#93c5fd', label: '冷菜' },
  straw: { border: '#f97316', bg: 'rgba(249,115,22,0.12)',  text: '#fdba74', label: '藁焼き' },
  stove: { border: '#d97706', bg: 'rgba(217,119,6,0.12)',   text: '#fcd34d', label: 'コンロ' },
  fryer: { border: '#dc2626', bg: 'rgba(220,38,38,0.12)',   text: '#fca5a5', label: 'フライヤー' },
  grill: { border: '#a855f7', bg: 'rgba(168,85,247,0.12)',  text: '#d8b4fe', label: 'グリル' },
}

function getProgressColor(p: number, over: boolean) {
  if (over) return '#ef4444'
  if (p > 80) return '#f59e0b'
  if (p > 50) return '#eab308'
  return '#22c55e'
}

function formatWait(sec: number) {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60); const s = sec % 60
  return s > 0 ? `${m}m${s}s` : `${m}m`
}

function formatWaitJP(sec: number) {
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

function getLayout(w: number, h: number) {
  if (w > h && w >= 768) return { cols: 3, isLandscape: true }
  if (w >= 768)           return { cols: 2, isLandscape: false }
  return { cols: 1, isLandscape: false }
}

const EQUIP_TABS = [
  { key: 'all',     label: 'すべて' },
  { key: 'popular', label: '人気' },
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
  const [selTable, setSelTable] = useState('')
  const [selMenu, setSelMenu] = useState('')
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [dbSynced, setDbSynced] = useState(false)
  const [activeTab, setActiveTab] = useState<'priority' | 'tables' | 'add'>('priority')
  const [activeEquip, setActiveEquip] = useState('all')
  const [batchModal, setBatchModal] = useState<{ order: OrderItem; sameMenuOrders: OrderItem[] } | null>(null)
  const [orderCount, setOrderCount] = useState<Record<string, number>>({})
  const [showAdvice, setShowAdvice] = useState(false)
  const [layout, setLayout] = useState({ cols: 2, isLandscape: false })
  const [selectedSeats, setSelectedSeats] = useState<string[]>([])
  const alertedTables = useRef<Set<string>>(new Set())

  useEffect(() => {
    function updateLayout() { setLayout(getLayout(window.innerWidth, window.innerHeight)) }
    updateLayout()
    window.addEventListener('resize', updateLayout)
    window.addEventListener('orientationchange', updateLayout)
    return () => {
      window.removeEventListener('resize', updateLayout)
      window.removeEventListener('orientationchange', updateLayout)
    }
  }, [])

  useEffect(() => {
    const s = loadSettings()
    setSettings(s)
    const firstTable = s.tableConfigs?.[0]?.name || 'C1'
    setSelTable(firstTable)
    setSelectedSeats([firstTable])

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
        const dangerTableSet = new Set(
          currentOrders
            .filter(o => o.status === 'pending' && (newNow - o.addedAt) / 1000 >= currentSettings.dangerThresholdSec)
            .map(o => o.table)
        )
        dangerTableSet.forEach(t => {
          if (!alertedTables.current.has(t)) { playAlertSound(); alertedTables.current.add(t) }
        })
        if (dangerTableSet.size === 0) alertedTables.current.clear()
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
    const same = orders.filter(o => o.id !== order.id && o.menu.id === order.menu.id && o.status === 'pending')
    if (same.length > 0) setBatchModal({ order, sameMenuOrders: same })
    else startCooking([order.id])
  }

  const startCooking = (ids: number[]) => {
    const t = Date.now()
    commit(orders.map(o => ids.includes(o.id) ? { ...o, status: 'cooking' as const, startedAt: t } : o))
    setBatchModal(null)
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

  const setStatusBatch = async (ids: number[], status: OrderItem['status']) => {
    const t = Date.now()
    const updated = orders.map(o => ids.includes(o.id) ? {
      ...o, status,
      startedAt: status === 'cooking' ? t : o.startedAt,
      servedAt: status === 'served' ? t : o.servedAt,
    } : o)
    commit(updated)
    if (status === 'served') {
      for (const id of ids) {
        const order = updated.find(o => o.id === id)
        if (order) { alertedTables.current.delete(order.table); await logAnalytics(order) }
      }
    }
  }

  const addOrder = (menuId?: string) => {
    const menu = menuList.find(m => m.id === (menuId || selMenu))
    if (!menu || !settings || !selTable) return
    const id = loadNextId()
    commit([...orders, { id, table: selTable, menu, status: 'pending', addedAt: Date.now() }])
    saveNextId(id + 1)
    setOrderCount(prev => ({ ...prev, [menu.id]: (prev[menu.id] || 0) + 1 }))
  }

  const toggleSeat = (name: string, type: 'counter' | 'table') => {
    if (type === 'table') {
      setSelectedSeats([name])
      setSelTable(name)
    } else {
      const next = selectedSeats.includes(name)
        ? selectedSeats.filter(s => s !== name)
        : [...selectedSeats, name]
      setSelectedSeats(next)
      setSelTable(next.join('・'))
    }
  }

  const toggleOneOp = () => {
    if (!settings) return
    const u = { ...settings, oneOperatorMode: !settings.oneOperatorMode }
    setSettings(u); saveSettings(u)
  }

  const toggleSound = () => {
    if (!settings) return
    const u = { ...settings, soundAlert: !settings.soundAlert }
    setSettings(u); saveSettings(u)
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
  const dangerTableSet = new Set(
    orders.filter(o => o.status === 'pending' && (now - o.addedAt) / 1000 >= settings.dangerThresholdSec).map(o => o.table)
  )
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

  const tableConfigs = settings.tableConfigs || []
  const counterConfigs = tableConfigs.filter((c: TableConfig) => c.type === 'counter')
  const tableConfigsOnly = tableConfigs.filter((c: TableConfig) => c.type === 'table')

  const getWaitSec = (tableName: string) => {
    const items = orders.filter(o => o.table === tableName && o.status !== 'served')
    if (!items.length) return null
    return Math.floor((now - Math.min(...items.map(o => o.addedAt))) / 1000)
  }

  // 調理中グループ化
  const cookingGroups: { menuId: string; menuName: string; equip: string; orders: OrderItem[] }[] = []
  const cookingRendered = new Set<number>()
  cooking.forEach(o => {
    if (cookingRendered.has(o.id)) return
    const sameMenu = cooking.filter(c => c.menu.id === o.menu.id)
    sameMenu.forEach(c => cookingRendered.add(c.id))
    cookingGroups.push({ menuId: o.menu.id, menuName: o.menu.name, equip: o.menu.equip, orders: sameMenu })
  })

  const renderCards = () => {
    const rendered = new Set<number>()
    const elements: React.ReactNode[] = []
    let rank = 0

    scheduled.forEach((o) => {
      if (rendered.has(o.id)) return
      rank++
      const waitSec = Math.floor((now - o.addedAt) / 1000)
      const isDanger = waitSec >= settings.dangerThresholdSec
      const isWarn = waitSec >= settings.warningThresholdSec
      const isBlocked = o.equipBlocked
      const g = GENRE[o.menu.equip] || GENRE.stove

      if (o.batchCount > 1 && o.isBatchLeader) {
        const group = scheduled.filter(s => s.menu.id === o.menu.id)
        group.forEach(s => rendered.add(s.id))
        const tableStr = group.map(go => go.table).join('・')
        const maxWait = Math.max(...group.map(go => Math.floor((now - go.addedAt) / 1000)))
        const groupDanger = maxWait >= settings.dangerThresholdSec
        const groupWarn = maxWait >= settings.warningThresholdSec

        elements.push(
          <div key={`grp-${o.menu.id}`} style={{
            border: '2px solid #22c55e',
            borderRadius: '10px',
            padding: '7px 9px',
            backgroundColor: groupDanger ? 'rgba(127,29,29,0.7)' : groupWarn ? 'rgba(120,53,15,0.7)' : 'rgba(34,197,94,0.07)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
              <span style={{ backgroundColor: `${g.border}33`, color: g.text, fontSize: '10px', fontWeight: 'bold', padding: '1px 5px', borderRadius: '4px', border: `1px solid ${g.border}66`, flexShrink: 0 }}>{g.label}</span>
              <span style={{ fontSize: '10px', color: '#6b7280', flexShrink: 0 }}>{rank}</span>
              <span style={{ fontSize: '15px', fontWeight: '900', color: 'white', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.menu.name}</span>
              <span style={{ backgroundColor: 'rgba(34,197,94,0.2)', border: '1px solid #22c55e', color: '#4ade80', fontSize: '10px', fontWeight: '900', padding: '1px 6px', borderRadius: '20px', flexShrink: 0 }}>
                ★{group.length}件
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '20px', fontWeight: '900', color: groupDanger ? '#fca5a5' : groupWarn ? '#fcd34d' : '#4ade80', lineHeight: 1 }}>{tableStr}</div>
                {maxWait > 30 && <span style={{ fontSize: '10px', color: groupDanger ? '#ef4444' : groupWarn ? '#f59e0b' : '#6b7280' }}>{formatWait(maxWait)}</span>}
                {groupDanger && <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 'bold', marginLeft: '4px' }}>遅延!</span>}
              </div>
              <button onClick={() => handleStartPress(o)} disabled={!!isBlocked}
                style={{ backgroundColor: isBlocked ? '#374151' : '#2563eb', color: isBlocked ? '#6b7280' : 'white', width: '40px', height: '34px', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', border: 'none', cursor: isBlocked ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {isBlocked ? '×' : '▶'}
              </button>
            </div>
          </div>
        )
      } else if (!rendered.has(o.id)) {
        rendered.add(o.id)
        elements.push(
          <div key={o.id} style={{
            borderTop: `4px solid ${isBlocked ? '#374151' : g.border}`,
            backgroundColor: isDanger ? 'rgba(127,29,29,0.7)' : isWarn ? 'rgba(120,53,15,0.7)' : isBlocked ? '#0d0d0d' : g.bg,
            borderRadius: '10px',
            padding: '7px 9px',
            opacity: isBlocked ? 0.5 : 1,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
              <span style={{ backgroundColor: `${g.border}33`, color: g.text, fontSize: '10px', fontWeight: 'bold', padding: '1px 5px', borderRadius: '4px', border: `1px solid ${g.border}66`, flexShrink: 0 }}>{g.label}</span>
              <span style={{ fontSize: '10px', color: '#6b7280', flexShrink: 0 }}>{rank}</span>
              <span style={{ fontSize: '15px', fontWeight: '900', color: 'white', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.menu.name}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '22px', fontWeight: '900', color: isDanger ? '#fca5a5' : isWarn ? '#fcd34d' : '#FFD700', lineHeight: 1 }}>{o.table}</span>
                {waitSec > 30 && <span style={{ fontSize: '10px', color: isDanger ? '#ef4444' : isWarn ? '#f59e0b' : '#6b7280', marginLeft: '6px' }}>{formatWait(waitSec)}</span>}
                {isDanger && !isBlocked && <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 'bold', marginLeft: '4px' }}>遅延!</span>}
                {isBlocked && <span style={{ fontSize: '10px', color: '#6b7280', marginLeft: '4px' }}>満杯</span>}
              </div>
              <button onClick={() => handleStartPress(o)} disabled={!!isBlocked}
                style={{ backgroundColor: isBlocked ? '#374151' : '#2563eb', color: isBlocked ? '#6b7280' : 'white', width: '36px', height: '32px', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', border: 'none', cursor: isBlocked ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {isBlocked ? '×' : '▶'}
              </button>
            </div>
          </div>
        )
      }
    })
    return elements
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white" style={{ fontFamily: 'system-ui,sans-serif' }}>

      {showCloseConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm border-2 border-red-700">
            <h2 className="text-2xl font-black text-red-400 mb-3 text-center">営業終了</h2>
            <p className="text-gray-300 mb-6 text-sm text-center">全ての注文データをクリアします。</p>
            <div className="flex gap-3">
              <button onClick={() => setShowCloseConfirm(false)} className="flex-1 bg-gray-700 text-white font-black py-4 rounded-2xl">キャンセル</button>
              <button onClick={handleCloseBusiness} className="flex-1 bg-red-600 text-white font-black py-4 rounded-2xl">終了する</button>
            </div>
          </div>
        </div>
      )}

      {batchModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm border-2 border-blue-700">
            <h2 className="text-xl font-black text-blue-400 mb-2 text-center">{batchModal.order.menu.name}</h2>
            <p className="text-gray-400 text-sm text-center mb-4">何件まとめて調理しますか？</p>
            <div className="bg-gray-800 rounded-2xl p-3 mb-4">
              {[batchModal.order, ...batchModal.sameMenuOrders].map(o => (
                <div key={o.id} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                  <span className="text-amber-400 font-black">{o.table}</span>
                  <span className="text-xs text-gray-400">待機{formatWaitJP(Math.floor((now - o.addedAt) / 1000))}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 mb-3">
              <button onClick={() => startCooking([batchModal.order.id])} className="w-full bg-gray-700 text-white font-bold py-3 rounded-2xl text-sm active:scale-95">
                {batchModal.order.table}だけ開始（1件）
              </button>
              {batchModal.sameMenuOrders.map((_, idx) => {
                const sel = [batchModal.order, ...batchModal.sameMenuOrders.slice(0, idx + 1)]
                return (
                  <button key={idx} onClick={() => startCooking(sel.map(o => o.id))} className="w-full bg-blue-700 text-white font-bold py-3 rounded-2xl text-sm active:scale-95">
                    {sel.map(o => o.table).join('+')} まとめて（{sel.length}件）
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

      {/* ヘッダー */}
      <div className="bg-gray-900 border-b border-gray-800 px-3 py-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-black text-amber-400">KitchenQ</span>
            <span className="text-xs text-green-500">同期</span>
            <div className="flex gap-2 text-xs">
              <span><span className="text-amber-400 font-black">{pending.length}</span>待機</span>
              <span><span className="text-blue-400 font-black">{cooking.length}</span>調理</span>
              <span><span className="text-green-400 font-black">{served.length}</span>提供</span>
              <span><span className="text-red-400 font-black">{dangerTableSet.size}</span>遅延</span>
            </div>
            <div className="flex gap-1.5">
              {Object.entries(equipCapacity).filter(([, cap]) => cap > 0).map(([equip, cap]) => {
                const usage = equipUsage[equip] || 0
                const label = equip === 'stove' ? 'コ' : equip === 'grill' ? 'グ' : equip === 'fryer' ? 'フ' : '藁'
                return (
                  <div key={equip} className="flex items-center gap-0.5">
                    <span className="text-gray-400" style={{ fontSize: '10px' }}>{label}</span>
                    {Array.from({ length: cap }).map((_, i) => (
                      <span key={i} className="inline-block rounded-sm" style={{ width: '8px', height: '8px', backgroundColor: i < usage ? '#ef4444' : '#374151' }} />
                    ))}
                  </div>
                )
              })}
            </div>
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
      </div>

      {/* アドバイスパネル */}
      {advices.length > 0 && (pending.length > 0 || cooking.length > 0) && (
        <div className={`border-b ${hasUrgent ? 'border-red-800' : 'border-gray-800'}`}>
          <button onClick={() => setShowAdvice(!showAdvice)}
            className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-black ${hasUrgent ? 'bg-red-950 text-red-300' : 'bg-gray-900 text-amber-400'}`}>
            <span>{hasUrgent ? '緊急指示' : '調理アドバイス'}（{advices.length}件）</span>
            <span className="text-gray-400">{showAdvice ? '▲' : '▼'}</span>
          </button>
          {showAdvice && (
            <div className="bg-gray-950 px-3 py-2 flex flex-col gap-1.5">
              {advices.map((a, i) => (
                <div key={i} className={`flex items-start gap-2 p-2.5 rounded-xl border text-xs ${ADVICE_COLORS[a.level]}`}>
                  <span className="flex-shrink-0">{a.icon}</span>
                  <span className="font-bold leading-snug">{a.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* タブ */}
      <div className="flex bg-gray-900 border-b border-gray-800">
        {[
          { key: 'priority', label: '優先順位' },
          { key: 'tables',   label: '卓一覧' },
          { key: 'add',      label: '注文追加' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 py-2 text-sm font-bold border-b-2 ${activeTab === tab.key ? 'text-amber-400 border-amber-400' : 'text-gray-400 border-transparent'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 優先順位タブ */}
      {activeTab === 'priority' && (
        <div className="flex overflow-hidden" style={{ height: 'calc(100vh - 105px)' }}>
          <div className="overflow-y-auto flex-1" style={{ borderRight: '1px solid #1f2937' }}>
            <div className="bg-gray-900 px-3 py-1 border-b border-gray-800 sticky top-0 z-10">
              <span className="text-xs font-black text-amber-400">次にやること（{scheduled.length}件）</span>
            </div>
            <div style={{ padding: '5px', display: 'grid', gridTemplateColumns: `repeat(${layout.cols}, 1fr)`, gap: '5px', alignItems: 'start' }}>
              {scheduled.length === 0 && (
                <div style={{ gridColumn: `span ${layout.cols}`, textAlign: 'center', padding: '40px', color: '#4b5563' }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>✓</div>
                  <div>待機なし</div>
                </div>
              )}
              {renderCards()}
            </div>
          </div>

          <div className="overflow-y-auto" style={{ width: layout.isLandscape ? '20%' : '27%' }}>
            <div className="bg-gray-900 px-2 py-1 border-b border-gray-800 sticky top-0 z-10">
              <span className="text-xs font-black text-blue-400">調理中（{cookingGroups.length}種・{cooking.length}件）</span>
            </div>
            <div style={{ padding: '5px' }}>
              {cookingGroups.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px', color: '#4b5563' }}>
                  <div style={{ fontSize: '20px' }}>🍳</div>
                </div>
              )}
              {cookingGroups.map(group => {
                const g = GENRE[group.equip] || GENRE.stove
                const minStarted = Math.min(...group.orders.map(o => o.startedAt || Date.now()))
                const elapsed = Math.floor((now - minStarted) / 1000)
                const stdSec = group.orders[0].menu.cookTime * 60
                const progress = Math.min((elapsed / stdSec) * 100, 100)
                const isOver = elapsed > stdSec
                const tableStr = group.orders.map(o => o.table).join('・')
                const isMulti = group.orders.length > 1
                return (
                  <div key={group.menuId} style={{
                    borderTop: `4px solid ${g.border}`,
                    backgroundColor: g.bg,
                    borderRadius: '8px',
                    padding: '7px 8px',
                    marginBottom: '5px',
                    border: isMulti ? '2px solid #22c55e' : 'none',
                    borderTopWidth: '4px',
                    borderTopColor: g.border,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                      <span style={{ color: '#60a5fa', fontSize: '11px' }}>▶</span>
                      <span style={{ fontSize: '12px', fontWeight: '900', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{group.menuName}</span>
                      {isMulti && (
                        <span style={{ backgroundColor: 'rgba(34,197,94,0.2)', border: '1px solid #22c55e', color: '#4ade80', fontSize: '9px', fontWeight: '900', padding: '1px 4px', borderRadius: '10px', flexShrink: 0 }}>
                          {group.orders.length}件
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: isMulti ? '13px' : '20px', fontWeight: '900', color: '#4ade80', lineHeight: 1.2, marginBottom: '4px' }}>
                      {tableStr}
                    </div>
                    <div style={{ width: '100%', height: '5px', backgroundColor: '#1f2937', borderRadius: '999px', overflow: 'hidden', marginBottom: '4px' }}>
                      <div style={{ height: '100%', width: `${progress}%`, backgroundColor: getProgressColor(progress, isOver), borderRadius: '999px', transition: 'width 1s' }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '9px', color: isOver ? '#ef4444' : '#6b7280' }}>
                        {isOver ? '超過' : '経過'}{formatWait(elapsed)}
                      </span>
                      <button onClick={() => setStatusBatch(group.orders.map(o => o.id), 'served')}
                        style={{ backgroundColor: '#16a34a', color: 'white', fontSize: '11px', fontWeight: 'bold', padding: '3px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
                        {isMulti ? `全${group.orders.length}完了` : '完了'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* 卓一覧タブ */}
      {activeTab === 'tables' && (
        <div className="p-3 pb-20 overflow-y-auto" style={{ height: 'calc(100vh - 105px)' }}>
          {counterConfigs.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-bold text-blue-400 mb-2">カウンター席</div>
              <div className="flex flex-wrap gap-2">
                {counterConfigs.map((c: TableConfig) => {
                  const ws = getWaitSec(c.name)
                  const isDanger = ws !== null && ws >= settings.dangerThresholdSec
                  const isWarn = ws !== null && ws >= settings.warningThresholdSec
                  const hasOrder = orders.some(o => o.table === c.name && o.status !== 'served')
                  return (
                    <button key={c.id} onClick={() => { setSelectedSeats([c.name]); setSelTable(c.name); setActiveTab('add') }}
                      style={{
                        borderRadius: '12px', padding: '10px 14px', textAlign: 'center', cursor: 'pointer', minWidth: '60px',
                        border: `2px solid ${isDanger ? '#dc2626' : isWarn ? '#d97706' : hasOrder ? '#3b82f6' : '#374151'}`,
                        backgroundColor: isDanger ? 'rgba(127,29,29,0.5)' : isWarn ? 'rgba(120,53,15,0.5)' : hasOrder ? 'rgba(30,58,95,0.5)' : '#111',
                      }}>
                      <div style={{ fontSize: '16px', fontWeight: '900', color: 'white' }}>{c.name}</div>
                      {ws !== null && <div style={{ fontSize: '10px', color: isDanger ? '#fca5a5' : isWarn ? '#fcd34d' : '#93c5fd' }}>{formatWaitJP(ws)}</div>}
                      {!hasOrder && <div style={{ fontSize: '9px', color: '#4b5563' }}>空き</div>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {tableConfigsOnly.length > 0 && (
            <div>
              <div className="text-xs font-bold text-green-400 mb-2">テーブル席</div>
              <div className="grid grid-cols-4 gap-3">
                {tableConfigsOnly.map((c: TableConfig) => {
                  const ws = getWaitSec(c.name)
                  const isDanger = ws !== null && ws >= settings.dangerThresholdSec
                  const isWarn = ws !== null && ws >= settings.warningThresholdSec
                  const hasOrder = orders.some(o => o.table === c.name && o.status !== 'served')
                  return (
                    <button key={c.id} onClick={() => { setSelectedSeats([c.name]); setSelTable(c.name); setActiveTab('add') }}
                      style={{
                        borderRadius: '16px', padding: '16px 12px', textAlign: 'center', cursor: 'pointer',
                        border: `2px solid ${isDanger ? '#dc2626' : isWarn ? '#d97706' : hasOrder ? '#22c55e' : '#374151'}`,
                        backgroundColor: isDanger ? 'rgba(127,29,29,0.5)' : isWarn ? 'rgba(120,53,15,0.5)' : hasOrder ? 'rgba(5,46,22,0.5)' : '#111',
                      }}>
                      <div style={{ fontSize: '28px', fontWeight: '900', color: 'white' }}>{c.name}</div>
                      {ws !== null ? (
                        <div style={{ fontSize: '11px', color: isDanger ? '#fca5a5' : isWarn ? '#fcd34d' : '#4ade80' }}>{formatWaitJP(ws)}</div>
                      ) : (
                        <div style={{ fontSize: '10px', color: '#4b5563' }}>空き</div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 注文追加タブ */}
      {activeTab === 'add' && (
        <div className="pb-20 overflow-y-auto" style={{ height: 'calc(100vh - 105px)' }}>
          {/* カウンター席選択 */}
          {counterConfigs.length > 0 && (
            <div className="bg-gray-900 px-4 py-3 border-b border-gray-800">
              <div className="text-xs text-blue-400 font-bold mb-2">カウンター席（複数選択可）</div>
              <div className="flex flex-wrap gap-2 mb-2">
                {counterConfigs.map((c: TableConfig) => {
                  const isSelected = selectedSeats.includes(c.name)
                  return (
                    <button key={c.id} onClick={() => toggleSeat(c.name, 'counter')}
                      className="rounded-xl font-black text-base active:scale-95"
                      style={{
                        width: '44px', height: '44px',
                        backgroundColor: isSelected ? '#f59e0b' : '#1f2937',
                        color: isSelected ? 'black' : '#d1d5db',
                        border: isSelected ? '2px solid #f59e0b' : '2px solid #374151',
                      }}>
                      {c.name}
                    </button>
                  )
                })}
              </div>
              {selectedSeats.length > 0 && (
                <div className="text-sm font-black" style={{ color: '#f59e0b' }}>
                  選択中：{selTable || selectedSeats.join('・')}
                </div>
              )}
            </div>
          )}

          {/* テーブル席選択 */}
          {tableConfigsOnly.length > 0 && (
            <div className="bg-gray-900 px-4 py-3 border-b border-gray-800">
              <div className="text-xs text-green-400 font-bold mb-2">テーブル席</div>
              <div className="flex gap-2">
                {tableConfigsOnly.map((c: TableConfig) => (
                  <button key={c.id} onClick={() => toggleSeat(c.name, 'table')}
                    className="rounded-xl font-black text-lg active:scale-95"
                    style={{
                      width: '48px', height: '48px',
                      backgroundColor: selTable === c.name && !selectedSeats.some(s => counterConfigs.some((cc: TableConfig) => cc.name === s)) ? '#22c55e' : '#1f2937',
                      color: selTable === c.name && !selectedSeats.some(s => counterConfigs.some((cc: TableConfig) => cc.name === s)) ? 'black' : '#d1d5db',
                      border: selTable === c.name ? '2px solid #22c55e' : '2px solid #374151',
                    }}>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ジャンルタブ */}
          <div className="flex overflow-x-auto gap-2 px-4 py-2 bg-gray-900 border-b border-gray-800">
            {EQUIP_TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveEquip(tab.key)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-sm font-bold active:scale-95 ${activeEquip === tab.key ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* メニューグリッド */}
          <div style={{ padding: '8px', display: 'grid', gridTemplateColumns: `repeat(${layout.cols}, 1fr)`, gap: '8px' }}>
            {filteredMenu().map(m => {
              const count = orderCount[m.id] || 0
              const g = GENRE[m.equip] || GENRE.stove
              return (
                <button key={m.id} onClick={() => { setSelMenu(m.id); addOrder(m.id) }}
                  style={{
                    borderTop: `4px solid ${g.border}`,
                    backgroundColor: g.bg,
                    borderRadius: '10px',
                    padding: '10px 12px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    position: 'relative',
                    border: '2px solid #374151',
                    borderTopWidth: '4px',
                    borderTopColor: g.border,
                  }}>
                  {count > 0 && (
                    <div style={{ position: 'absolute', top: '6px', right: '6px', backgroundColor: '#374151', color: '#d1d5db', fontSize: '9px', padding: '1px 5px', borderRadius: '999px', fontWeight: 'bold' }}>{count}回</div>
                  )}
                  <div style={{ fontSize: '14px', fontWeight: '900', color: 'white', marginBottom: '4px', paddingRight: count > 0 ? '32px' : '0' }}>{m.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#6b7280' }}>{m.cookTime}分</span>
                    <span style={{ fontSize: '10px', backgroundColor: `${g.border}33`, color: g.text, padding: '1px 6px', borderRadius: '4px', border: `1px solid ${g.border}66` }}>{g.label}</span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* この席の現在の注文 */}
          {selTable && orders.filter(o => o.table === selTable).length > 0 && (
            <div className="mx-3 mb-3 bg-gray-900 rounded-2xl p-3">
              <div className="text-xs text-gray-400 mb-2">{selTable}の現在の注文</div>
              {orders.filter(o => o.table === selTable).map(o => (
                <div key={o.id} className="flex items-center gap-2 py-2 border-b border-gray-800 last:border-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${o.status === 'pending' ? 'bg-amber-400' : o.status === 'cooking' ? 'bg-blue-400' : 'bg-green-400'}`} />
                  <div className="flex-1 font-bold text-sm">{o.menu.name}</div>
                  <div className="flex gap-1.5">
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