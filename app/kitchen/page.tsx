'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { OrderItem, MenuItem, ShopSettings } from '../../lib/types'
import { loadOrders, saveOrders, loadSettings, saveSettings, loadNextId, saveNextId, clearAllOrders, loadOrdersFromDB, loadMenuFromDB, logAnalytics } from '../../lib/storage'
import { buildSchedule, ScoredOrder } from '../../lib/priorityEngine'
import { generateAdvice } from '../../lib/advisor'

// 繧ｸ繝｣繝ｳ繝ｫ濶ｲ螳夂ｾｩ
const GENRE_COLORS: Record<string, { border: string; bg: string; text: string; label: string }> = {
  cold:  { border: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  text: '#60a5fa', label: '蜀ｷ闖・ },
  straw: { border: '#f97316', bg: 'rgba(249,115,22,0.08)',  text: '#fb923c', label: '阯∫┥縺・ },
  stove: { border: '#d97706', bg: 'rgba(146,64,14,0.08)',   text: '#fbbf24', label: '繧ｳ繝ｳ繝ｭ' },
  fryer: { border: '#dc2626', bg: 'rgba(220,38,38,0.08)',   text: '#f87171', label: '繝輔Λ繧､繝､繝ｼ' },
  grill: { border: '#a855f7', bg: 'rgba(168,85,247,0.08)',  text: '#c084fc', label: '繧ｰ繝ｪ繝ｫ' },
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
  if (sec < 60) return `${sec}遘蛋
  const m = Math.floor(sec / 60); const s = sec % 60
  return s > 0 ? `${m}蛻・{s}遘蛋 : `${m}蛻・
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
  { key: 'all',     label: '縺吶∋縺ｦ' },
  { key: 'popular', label: '莠ｺ豌歴沐･' },
  { key: 'cold',    label: '蜀ｷ闖・ },
  { key: 'straw',   label: '阯∫┥縺・ },
  { key: 'stove',   label: '繧ｳ繝ｳ繝ｭ' },
  { key: 'fryer',   label: '繝輔Λ繧､繝､繝ｼ' },
  { key: 'grill',   label: '繧ｰ繝ｪ繝ｫ' },
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
        <div className="text-gray-400">蜷梧悄荳ｭ...</div>
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

      {/* 蝟ｶ讌ｭ邨ゆｺ・Δ繝ｼ繝繝ｫ */}
      {showCloseConfirm && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:'1rem'}}>
          <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm border-2 border-red-700">
            <h2 className="text-2xl font-black text-red-400 mb-3 text-center">蝟ｶ讌ｭ邨ゆｺ・/h2>
            <p className="text-gray-300 mb-6 text-sm text-center">蜈ｨ縺ｦ縺ｮ豕ｨ譁・ョ繝ｼ繧ｿ繧偵け繝ｪ繧｢縺励∪縺吶ょ・縺ｫ謌ｻ縺帙∪縺帙ｓ縲・/p>
            <div className="flex gap-3">
              <button onClick={() => setShowCloseConfirm(false)} className="flex-1 bg-gray-700 text-white font-black py-4 rounded-2xl">繧ｭ繝｣繝ｳ繧ｻ繝ｫ</button>
              <button onClick={handleCloseBusiness} className="flex-1 bg-red-600 text-white font-black py-4 rounded-2xl">邨ゆｺ・☆繧・/button>
            </div>
          </div>
        </div>
      )}

      {/* 繝舌ャ繝√Δ繝ｼ繝繝ｫ */}
      {batchModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:'1rem'}}>
          <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm border-2 border-blue-700">
            <h2 className="text-xl font-black text-blue-400 mb-2 text-center">{batchModal.order.menu.name}</h2>
            <p className="text-gray-400 text-sm text-center mb-4">蜷後§繝｡繝九Η繝ｼ縺鶏batchModal.sameMenuOrders.length + 1}莉ｶ縺ゅｊ縺ｾ縺吶・/p>
            <div className="bg-gray-800 rounded-2xl p-3 mb-4">
              {[batchModal.order, ...batchModal.sameMenuOrders].map(o => (
                <div key={o.id} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                  <span className="text-amber-400 font-black">{o.table}蜊・/span>
                  <span className="text-xs text-gray-400">蠕・ｩ毬formatWait(Math.floor((now - o.addedAt) / 1000))}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 mb-3">
              <button onClick={() => startCooking([batchModal.order.id])} className="w-full bg-gray-700 text-white font-bold py-3 rounded-2xl text-sm active:scale-95">
                {batchModal.order.table}蜊薙□縺鷹幕蟋具ｼ・莉ｶ・・
              </button>
              {batchModal.sameMenuOrders.map((_, idx) => {
                const sel = [batchModal.order, ...batchModal.sameMenuOrders.slice(0, idx + 1)]
                return (
                  <button key={idx} onClick={() => startCooking(sel.map(o => o.id))} className="w-full bg-blue-700 text-white font-bold py-3 rounded-2xl text-sm active:scale-95">
                    {sel.map(o => `${o.table}蜊伝).join('+')} 縺ｾ縺ｨ繧√※・・sel.length}莉ｶ・・
                  </button>
                )
              })}
              <button onClick={() => startCooking([batchModal.order, ...batchModal.sameMenuOrders].map(o => o.id))} className="w-full bg-green-600 text-white font-black py-3 rounded-2xl text-sm active:scale-95">
                蜈ｨ{batchModal.sameMenuOrders.length + 1}莉ｶ縺ｾ縺ｨ繧√※髢句ｧ・
              </button>
            </div>
            <button onClick={() => setBatchModal(null)} className="w-full bg-gray-800 text-gray-400 font-bold py-3 rounded-2xl text-sm">繧ｭ繝｣繝ｳ繧ｻ繝ｫ</button>
          </div>
        </div>
      )}

      {/* 笏≫煤笏・繝倥ャ繝繝ｼ・亥悸邵ｮ迚茨ｼ・笏≫煤笏・*/}
      <div className="bg-gray-900 border-b border-gray-800 px-3 py-2">
        {/* 荳頑ｮｵ・壹ち繧､繝医Ν・九・繧ｿ繝ｳ */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-black text-amber-400">KitchenQ</h1>
            <span className="text-xs text-green-500">笳丞酔譛滉ｸｭ</span>
          </div>
          <div className="flex gap-1.5">
            <button onClick={toggleSound} className={`px-2 py-1 rounded-lg text-xs font-bold ${settings.soundAlert ? 'bg-blue-800 text-blue-300' : 'bg-gray-700 text-gray-400'}`}>
              {settings.soundAlert ? '髻ｳON' : '髻ｳOFF'}
            </button>
            <button onClick={toggleOneOp} className={`px-2 py-1 rounded-lg text-xs font-bold ${settings.oneOperatorMode ? 'bg-amber-500 text-black' : 'bg-gray-700 text-white'}`}>
              {settings.oneOperatorMode ? '繝ｯ繝ｳ繧ｪ繝・ : '騾壼ｸｸ'}
            </button>
            <button onClick={() => setShowCloseConfirm(true)} className="px-2 py-1 rounded-lg text-xs font-bold bg-red-900 text-red-300">邨ゆｺ・/button>
          </div>
        </div>

        {/* 荳区ｮｵ・夂ｵｱ險茨ｼ玖ｨｭ蛯咏憾豕・ｼ・陦後↓蝨ｧ邵ｮ・・*/}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex gap-2">
            <span><span className="text-amber-400 font-black">{pending.length}</span>蠕・ｩ・/span>
            <span><span className="text-blue-400 font-black">{cooking.length}</span>隱ｿ逅・/span>
            <span><span className="text-green-400 font-black">{served.length}</span>謠蝉ｾ・/span>
            <span><span className="text-red-400 font-black">{dangerTables.size}</span>驕・ｻｶ</span>
          </div>
          <div className="flex gap-2 ml-auto">
            {Object.entries(equipCapacity).filter(([, cap]) => cap > 0).map(([equip, cap]) => {
              const usage = equipUsage[equip] || 0
              const label = equip === 'stove' ? '繧ｳ' : equip === 'grill' ? '繧ｰ' : equip === 'fryer' ? '繝・ : '阯・
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

      {/* 笏≫煤笏・繧｢繝峨ヰ繧､繧ｹ繝代ロ繝ｫ 笏≫煤笏・*/}
      {advices.length > 0 && (pending.length > 0 || cooking.length > 0) && (
        <div className={`border-b ${hasUrgent ? 'border-red-800' : 'border-gray-800'}`}>
          <button onClick={() => setShowAdvice(!showAdvice)}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm font-black ${hasUrgent ? 'bg-red-950 text-red-300' : 'bg-gray-900 text-amber-400'}`}>
            <span>{hasUrgent ? '圷 邱頑･謖・､ｺ' : '搭 隱ｿ逅・い繝峨ヰ繧､繧ｹ'}・・advices.length}莉ｶ・・/span>
            <span className="text-gray-400 text-xs">{showAdvice ? '笆ｲ 髢峨§繧・ : '笆ｼ 髢九￥'}</span>
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

      {/* 笏≫煤笏・繧ｿ繝・笏≫煤笏・*/}
      <div className="flex bg-gray-900 border-b border-gray-800">
        {[
          { key: 'priority', label: '蜆ｪ蜈磯・ｽ・ },
          { key: 'tables',   label: '蜊謎ｸ隕ｧ' },
          { key: 'add',      label: '豕ｨ譁・ｿｽ蜉' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 py-2.5 text-sm font-bold border-b-2 ${activeTab === tab.key ? 'text-amber-400 border-amber-400' : 'text-gray-400 border-transparent'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 笏≫煤笏・蜆ｪ蜈磯・ｽ阪ち繝厄ｼ域眠繝ｬ繧､繧｢繧ｦ繝茨ｼ・笏≫煤笏・*/}
      {activeTab === 'priority' && (
        <div className="flex overflow-hidden" style={{height:'calc(100vh - 155px)'}}>

          {/* 蟾ｦ70%・壼ｾ・ｩ滉ｸｭ・・蛻励げ繝ｪ繝・ラ・・*/}
          <div className="overflow-y-auto" style={{width:'70%', borderRight:'1px solid #1f2937'}}>
            <div className="bg-gray-900 px-3 py-1.5 border-b border-gray-800 sticky top-0 z-10">
              <span className="text-xs font-black text-amber-400">谺｡縺ｫ繧・ｋ縺薙→・・scheduled.length}莉ｶ・・/span>
            </div>
            <div className="p-2">
              {scheduled.length === 0 && (
                <div className="text-center py-12 text-gray-600">
                  <div className="text-4xl mb-2">笨・/div>
                  <div className="text-sm">蠕・ｩ溘↑縺・/div>
                </div>
              )}

              {/* 縺ｾ縺ｨ繧√ヰ繝・ず莉倥″繧ｰ繝ｫ繝ｼ繝励ｒ蜈医↓陦ｨ遉ｺ */}
              {(() => {
                const rendered = new Set<number>()
                const elements: React.ReactNode[] = []

                scheduled.forEach((o, i) => {
                  if (rendered.has(o.id)) return
                  const waitSec = Math.floor((now - o.addedAt) / 1000)
                  const isDanger = waitSec >= settings.dangerThresholdSec
                  const isWarn = waitSec >= settings.warningThresholdSec
                  const isBlocked = o.equipBlocked
                  const genre = GENRE_COLORS[o.menu.equip] || GENRE_COLORS.stove
                  const isCombined = o.batchCount > 1

                  if (isCombined && o.isBatchLeader) {
                    // 繧ｰ繝ｫ繝ｼ繝怜・菴薙ｒ蜿門ｾ・
                    const group = scheduled.filter(s => s.menu.id === o.menu.id)
                    group.forEach(s => rendered.add(s.id))

                    elements.push(
                      <div key={`group-${o.menu.id}`} className="mb-3">
                        {/* 縺ｾ縺ｨ繧√ヰ繝・ず */}
                        <div className="inline-flex items-center gap-1 px-3 py-1 mb-2 rounded-full border text-xs font-black"
                          style={{backgroundColor:'rgba(34,197,94,0.15)', borderColor:'#22c55e', color:'#22c55e'}}>
                          笘・縺ｾ縺ｨ繧√※{group.length}莉ｶ・嘴o.menu.name}
                        </div>
                        {/* 繧ｰ繝ｫ繝ｼ繝励ｒ2蛻励〒陦ｨ遉ｺ */}
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
                                {/* 笘・｢ｫ繧翫・繝ｼ繧ｯ */}
                                <div className="absolute top-1.5 right-1.5 text-xs px-1.5 py-0.5 rounded-full font-black animate-pulse"
                                  style={{backgroundColor:'rgba(255,215,0,0.2)', border:'1px solid #FFD700', color:'#FFD700'}}>
                                  笘・
                                </div>
                                {/* 鬆・ｽ・+ 蝠・刀蜷・*/}
                                <div className="flex items-baseline gap-1.5 mb-1 pr-8">
                                  <span className="text-xs text-gray-500">{scheduled.indexOf(go) + 1}</span>
                                  <span className="text-base font-black text-white leading-tight truncate">{go.menu.name}</span>
                                </div>
                                {/* 蜊鍋分・域怙螟ｧ・・*/}
                                <div className="text-3xl font-black mb-1.5" style={{color:'#FFD700'}}>{go.table}蜊・/div>
                                {/* 荳区ｮｵ */}
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="text-xs" style={{color: genre.text}}>{genre.label}ﾂｷ{go.menu.cookTime}蛻・/div>
                                    <div className="text-xs" style={{color: getWaitColor(gWait)}}>竢ｱ{formatWait(gWait)}</div>
                                  </div>
                                  <button onClick={() => !go.equipBlocked && handleStartPress(go)} disabled={go.equipBlocked}
                                    className="px-3 py-2 rounded-lg text-sm font-black active:scale-95"
                                    style={{backgroundColor: go.equipBlocked ? '#374151' : '#2563eb', color: go.equipBlocked ? '#6b7280' : 'white'}}>
                                    {go.equipBlocked ? '貅譚ｯ' : '髢句ｧ・}
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
                        {/* 蠕・ｩ滓凾髢難ｼ亥承荳奇ｼ・*/}
                        <div className="absolute top-2 right-2 text-xs" style={{color: getWaitColor(waitSec)}}>
                          竢ｱ{formatWait(waitSec)}
                        </div>
                        {/* 鬆・ｽ・+ 蝠・刀蜷・*/}
                        <div className="flex items-baseline gap-1.5 mb-1 pr-12">
                          <span className="text-xs text-gray-500">{i + 1}</span>
                          <span className="text-base font-black text-white leading-tight truncate">{o.menu.name}</span>
                        </div>
                        {/* 蜊鍋分・域怙螟ｧ・・*/}
                        <div className="text-3xl font-black mb-1.5" style={{color:'#FFD700'}}>{o.table}蜊・/div>
                        {/* 荳区ｮｵ */}
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs" style={{color: isBlocked ? '#6b7280' : genre.text}}>{genre.label}ﾂｷ{o.menu.cookTime}蛻・/div>
                            {isDanger && !isBlocked && <div className="text-xs text-red-400 font-black animate-pulse">驕・ｻｶ!</div>}
                            {isBlocked && <div className="text-xs text-gray-500">{genre.label}縺梧ｺ譚ｯ</div>}
                          </div>
                          <button onClick={() => !isBlocked && handleStartPress(o)} disabled={isBlocked}
                            className="px-3 py-2 rounded-lg text-sm font-black active:scale-95"
                            style={{backgroundColor: isBlocked ? '#374151' : '#2563eb', color: isBlocked ? '#6b7280' : 'white'}}>
                            {isBlocked ? '貅譚ｯ' : '笆ｶ 髢句ｧ・}
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

          {/* 蜿ｳ30%・夊ｪｿ逅・ｸｭ・・蛻暦ｼ・*/}
          <div className="overflow-y-auto" style={{width:'30%'}}>
            <div className="bg-gray-900 px-3 py-1.5 border-b border-gray-800 sticky top-0 z-10">
              <span className="text-xs font-black text-blue-400">隱ｿ逅・ｸｭ・・cooking.length}・・/span>
            </div>
            <div className="p-2">
              {cooking.length === 0 && (
                <div className="text-center py-8 text-gray-600">
                  <div className="text-2xl mb-1">叉</div>
                  <div className="text-xs">縺ｪ縺・/div>
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
                    {/* 蝠・刀蜷・*/}
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-blue-400 text-sm">笆ｶ</span>
                      <span className="text-sm font-black text-white leading-tight truncate">{o.menu.name}</span>
                    </div>
                    {/* 蜊鍋分 */}
                    <div className="text-2xl font-black mb-1" style={{color:'#FFD700'}}>{o.table}蜊・/div>
                    {/* 騾ｲ謐励ヰ繝ｼ */}
                    <div className="w-full h-1.5 bg-gray-800 rounded-full mb-2 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000"
                        style={{ width:`${progress}%`, backgroundColor: getProgressColor(progress, isOver) }} />
                    </div>
                    {/* 邨碁℃譎る俣 + 螳御ｺ・・繧ｿ繝ｳ */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{color: isOver ? '#ef4444' : '#9ca3af'}}>
                        {isOver ? '雜・℃' : ''}邨碁℃{formatWait(elapsed)}
                      </span>
                      <button onClick={() => setStatus(o.id, 'served')}
                        className="px-3 py-1.5 rounded-lg text-xs font-black active:scale-95"
                        style={{backgroundColor:'#16a34a', color:'white'}}>
                        螳御ｺ・
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* 笏≫煤笏・蜊謎ｸ隕ｧ繧ｿ繝・笏≫煤笏・*/}
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
                  <div className="text-xs text-gray-400">{t}蜊・/div>
                  {ws !== null ? (
                    <div className={`text-2xl font-black ${isDanger ? 'text-red-400' : isWarn ? 'text-amber-400' : 'text-green-400'}`}>{formatWait(ws)}</div>
                  ) : (
                    <div className="text-lg font-black text-gray-600">遨ｺ縺・/div>
                  )}
                  {(pendingCount > 0 || cookingCount > 0) && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {cookingCount > 0 && <span className="text-xs bg-blue-800 text-blue-200 px-1.5 py-0.5 rounded">{cookingCount}隱ｿ逅・ｸｭ</span>}
                      {pendingCount > 0 && <span className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">{pendingCount}蠕・ｩ・/span>}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 笏≫煤笏・豕ｨ譁・ｿｽ蜉繧ｿ繝・笏≫煤笏・*/}
      {activeTab === 'add' && (
        <div className="pb-24 overflow-y-auto" style={{height:'calc(100vh - 155px)'}}>
          <div className="bg-gray-900 px-4 py-3 border-b border-gray-800">
            <div className="text-xs text-gray-400 mb-2">蜊鍋分蜿ｷ</div>
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
                    <div className="absolute top-2 left-2 bg-gray-700 text-gray-300 text-xs px-1.5 py-0.5 rounded-full font-bold">{count}蝗・/div>
                  )}
                  <div className="font-bold text-sm mt-4 mb-1 text-white">{m.name}</div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400">{m.cookTime}蛻・/span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full" style={{backgroundColor:`${genre.border}22`, color: genre.text}}>{genre.label}</span>
                  </div>
                </button>
              )
            })}
          </div>

          {orders.filter(o => o.table === Number(selTable)).length > 0 && (
            <div className="mx-3 mb-3 bg-gray-900 rounded-2xl p-4">
              <div className="text-xs text-gray-400 mb-3">{selTable}蜊薙・迴ｾ蝨ｨ縺ｮ豕ｨ譁・/div>
              {orders.filter(o => o.table === Number(selTable)).map(o => (
                <div key={o.id} className="flex items-center gap-3 py-2.5 border-b border-gray-800 last:border-0">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${o.status === 'pending' ? 'bg-amber-400' : o.status === 'cooking' ? 'bg-blue-400' : 'bg-green-400'}`} />
                  <div className="flex-1 font-bold text-sm">{o.menu.name}</div>
                  <div className="flex gap-2">
                    {o.status === 'pending' && <button onClick={() => setStatus(o.id, 'cooking')} className="bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95">髢句ｧ・/button>}
                    {o.status === 'cooking' && <button onClick={() => setStatus(o.id, 'served')} className="bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95">螳御ｺ・/button>}
                    {o.status === 'served' && <span className="text-xs text-gray-500 line-through">謠蝉ｾ帶ｸ・/span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 蠎暮Κ繝翫ン */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex">
        <Link href="/kitchen" className="flex-1 py-3 text-center text-xs text-amber-400 font-bold border-t-2 border-amber-400">蜴ｨ謌ｿ</Link>
        <Link href="/orders" className="flex-1 py-3 text-center text-xs text-gray-400 font-bold">豕ｨ譁・/Link>
        <Link href="/menu" className="flex-1 py-3 text-center text-xs text-gray-400 font-bold">繝｡繝九Η繝ｼ</Link>
        <Link href="/settings" className="flex-1 py-3 text-center text-xs text-gray-400 font-bold">險ｭ螳・/Link>
        <Link href="/analytics" className="flex-1 py-3 text-center text-xs text-gray-400 font-bold">蛻・梵</Link>
      </div>
    </div>
  )
}
