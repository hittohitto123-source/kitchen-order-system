'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { OrderItem, MenuItem, ShopSettings } from '../../lib/types'
import { loadOrders, saveOrders, loadSettings, saveSettings, loadNextId, saveNextId, clearAllOrders, loadOrdersFromDB, loadMenuFromDB, logAnalytics } from '../../lib/storage'
import { buildSchedule } from '../../lib/priorityEngine'

const EQUIP_LABEL: Record<string, string> = {
  cold: '蜀ｷ闖・, stove: '繧ｳ繝ｳ繝ｭ', grill: '繧ｰ繝ｪ繝ｫ', fryer: '繝輔Λ繧､繝､繝ｼ', straw: '阯∫┥縺・
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
      } else { setOrders(loadOrders()) }
      setDbSynced(true)
    })
  }, [])

  useEffect(() => {
    const t = setInterval(() => {
      const newNow = Date.now()
      setNow(newNow)
      const currentOrders = loadOrders()
      setOrders(currentOrders)
      const currentSettings = loadSettings()
      if (currentSettings.soundAlert) {
        const dangerTables = currentOrders
          .filter(o => o.status === 'pending' && (newNow - o.addedAt) / 1000 >= currentSettings.dangerThresholdSec)
          .map(o => o.table)
        const newDanger = dangerTables.filter(t => !alertedTables.current.has(t))
        if (newDanger.length > 0) { playAlertSound(); newDanger.forEach(t => alertedTables.current.add(t)) }
        if (dangerTables.length === 0) alertedTables.current.clear()
      }
    }, 1000)
    return () => clearInterval(t)
  }, [])

  const commit = (updated: OrderItem[]) => { setOrders(updated); saveOrders(updated) }

  const addOrder = () => {
    const menu = menuList.find(m => m.id === selMenu)
    if (!menu || !settings) return
    const id = loadNextId()
    commit([...orders, { id, table: Number(selTable), menu, status: 'pending', addedAt: Date.now() }])
    saveNextId(id + 1)
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
  const dangerTables = new Set(
    orders.filter(o => o.status === 'pending' && (now - o.addedAt) / 1000 >= settings.dangerThresholdSec).map(o => o.table)
  )
  const tables = Array.from({ length: settings.tableCount }, (_, i) => i + 1)

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
              <button onClick={() => setShowCloseConfirm(false)}
                className="flex-1 bg-gray-700 text-white font-black py-4 rounded-2xl text-lg">繧ｭ繝｣繝ｳ繧ｻ繝ｫ</button>
              <button onClick={handleCloseBusiness}
                className="flex-1 bg-red-600 text-white font-black py-4 rounded-2xl text-lg">邨ゆｺ・☆繧・/button>
            </div>
          </div>
        </div>
      )}

      {/* 繝倥ャ繝繝ｼ */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-black text-amber-400">KitchenQ</h1>
            <span className="text-xs text-green-500">DB蜷梧悄貂・/span>
          </div>
          <div className="flex gap-2">
            <button onClick={toggleSound}
              className={`px-3 py-2 rounded-xl text-xs font-bold ${settings.soundAlert ? 'bg-blue-800 text-blue-300' : 'bg-gray-700 text-gray-400'}`}>
              {settings.soundAlert ? '髻ｳON' : '髻ｳOFF'}
            </button>
            <button onClick={toggleOneOp}
              className={`px-3 py-2 rounded-xl text-xs font-bold ${settings.oneOperatorMode ? 'bg-amber-500 text-black' : 'bg-gray-700 text-white'}`}>
              {settings.oneOperatorMode ? '繝ｯ繝ｳ繧ｪ繝・ : '騾壼ｸｸ'}
            </button>
            <button onClick={() => setShowCloseConfirm(true)}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-red-900 text-red-300">
              邨ゆｺ・
            </button>
          </div>
        </div>

        {/* 邨ｱ險医ち繧､繝ｫ */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-gray-800 rounded-xl py-2 text-center">
            <div className="text-2xl font-black text-amber-400">{pending.length}</div>
            <div className="text-xs text-gray-400">蠕・ｩ・/div>
          </div>
          <div className="bg-gray-800 rounded-xl py-2 text-center">
            <div className="text-2xl font-black text-blue-400">{cooking.length}</div>
            <div className="text-xs text-gray-400">隱ｿ逅・ｸｭ</div>
          </div>
          <div className="bg-gray-800 rounded-xl py-2 text-center">
            <div className="text-2xl font-black text-green-400">{orders.filter(o => o.status === 'served').length}</div>
            <div className="text-xs text-gray-400">謠蝉ｾ帶ｸ・/div>
          </div>
          <div className="bg-gray-800 rounded-xl py-2 text-center">
            <div className="text-2xl font-black text-red-400">{dangerTables.size}</div>
            <div className="text-xs text-gray-400">驕・ｻｶ蜊・/div>
          </div>
        </div>
      </div>

      {/* 繧ｿ繝・*/}
      <div className="flex bg-gray-900 border-b border-gray-800">
        {[
          { key: 'priority', label: '蜆ｪ蜈磯・ｽ・ },
          { key: 'tables',   label: '蜊謎ｸ隕ｧ' },
          { key: 'add',      label: '豕ｨ譁・ｿｽ蜉' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 py-3 text-sm font-bold transition-all border-b-2 ${
              activeTab === tab.key ? 'text-amber-400 border-amber-400' : 'text-gray-400 border-transparent'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 蜆ｪ蜈磯・ｽ阪ち繝・*/}
      {activeTab === 'priority' && (
        <div className="p-3 pb-24">
          {scheduled.length === 0 && cooking.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <div className="text-5xl mb-4">叉</div>
              <div className="font-bold">豕ｨ譁・′縺ゅｊ縺ｾ縺帙ｓ</div>
            </div>
          )}

          {scheduled.map((o, i) => {
            const waitSec = Math.floor((now - o.addedAt) / 1000)
            const isDanger = waitSec >= settings.dangerThresholdSec
            const isWarn = waitSec >= settings.warningThresholdSec
            return (
              <div key={o.id}>
                {o.isBatchLeader && (
                  <div className="flex items-center gap-2 mb-1 mt-2">
                    <span className="text-xs text-green-400 font-bold bg-green-950 border border-green-800 px-3 py-1 rounded-full">
                      笘・縺ｾ縺ｨ繧√※隱ｿ逅・{o.batchCount}莉ｶ
                    </span>
                  </div>
                )}
                <div className={`flex items-center gap-3 p-4 rounded-2xl mb-2 ${
                  o.batchCount > 1 ? 'border-l-4 border-l-green-500 ' : ''
                }${isDanger ? 'bg-red-950 border-2 border-red-700' : isWarn ? 'bg-amber-950 border-2 border-amber-700' : 'bg-gray-800 border-2 border-gray-700'}`}>
                  <div className={`text-3xl font-black w-10 text-center flex-shrink-0 ${
                    isDanger ? 'text-red-400' : isWarn ? 'text-amber-400' : 'text-gray-500'
                  }`}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-xl">{o.menu.name}</div>
                    <div className="flex gap-2 text-sm mt-1 flex-wrap items-center">
                      <span className="text-amber-400 font-black text-lg">{o.table}蜊・/span>
                      <span className="text-gray-400">{EQUIP_LABEL[o.menu.equip]}</span>
                      <span className="text-gray-500">{o.menu.cookTime}蛻・/span>
                      {waitSec > 0 && <span className="text-gray-500">蠕・ｩ毬formatWait(waitSec)}</span>}
                      {isDanger && <span className="text-red-400 font-black animate-pulse text-sm">驕・ｻｶ!</span>}
                    </div>
                  </div>
                  <button onClick={() => setStatus(o.id, 'cooking')}
                    className="bg-blue-600 active:scale-95 text-white px-5 py-4 rounded-2xl text-base font-black flex-shrink-0">
                    髢句ｧ・
                  </button>
                </div>
              </div>
            )
          })}

          {cooking.map(o => (
            <div key={o.id} className="flex items-center gap-3 p-4 rounded-2xl mb-2 bg-blue-950 border-2 border-blue-700">
              <div className="text-3xl font-black w-10 text-center text-blue-400 flex-shrink-0">笆ｶ</div>
              <div className="flex-1">
                <div className="font-black text-xl">{o.menu.name}</div>
                <div className="flex gap-2 text-sm mt-1">
                  <span className="text-amber-400 font-black text-lg">{o.table}蜊・/span>
                  <span className="text-blue-400 font-bold">隱ｿ逅・ｸｭ</span>
                </div>
              </div>
              <button onClick={() => setStatus(o.id, 'served')}
                className="bg-green-600 active:scale-95 text-white px-5 py-4 rounded-2xl text-base font-black flex-shrink-0">
                螳御ｺ・
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 蜊謎ｸ隕ｧ繧ｿ繝・*/}
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
                <button key={t}
                  onClick={() => { setSelTable(String(t)); setActiveTab('add') }}
                  className={`rounded-2xl p-4 text-left transition-all active:scale-95 border-2 ${
                    isDanger ? 'bg-red-950 border-red-600' :
                    isWarn ? 'bg-amber-950 border-amber-600' :
                    items.length ? 'bg-gray-800 border-gray-600' :
                    'bg-gray-900 border-gray-800 opacity-50'
                  }`}>
                  <div className="text-xs text-gray-400 mb-1">{t}蜊・/div>
                  {ws !== null ? (
                    <div className={`text-2xl font-black ${isDanger ? 'text-red-400' : isWarn ? 'text-amber-400' : 'text-green-400'}`}>
                      {formatWait(ws)}
                    </div>
                  ) : (
                    <div className="text-lg font-black text-gray-600">遨ｺ縺・/div>
                  )}
                  {(pendingCount > 0 || cookingCount > 0) && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {cookingCount > 0 && <span className="text-xs bg-blue-800 text-blue-200 px-1.5 py-0.5 rounded">{cookingCount}隱ｿ逅・ｸｭ</span>}
                      {pendingCount > 0 && <span className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">{pendingCount}蠕・ｩ・/span>}
                    </div>
                  )}
                  {isDanger && <div className="text-xs text-red-400 font-black animate-pulse mt-1">驕・ｻｶ!</div>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 豕ｨ譁・ｿｽ蜉繧ｿ繝・*/}
      {activeTab === 'add' && (
        <div className="p-3 pb-24">
          {/* 蜊馴∈謚・*/}
          <div className="bg-gray-900 rounded-2xl p-4 mb-3">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">蜊鍋分蜿ｷ</div>
            <div className="grid grid-cols-5 gap-2">
              {tables.map(t => (
                <button key={t} onClick={() => setSelTable(String(t))}
                  className={`py-4 rounded-xl font-black text-xl transition-all active:scale-95 ${
                    selTable === String(t) ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 繝｡繝九Η繝ｼ驕ｸ謚・*/}
          <div className="bg-gray-900 rounded-2xl p-4 mb-3">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">繝｡繝九Η繝ｼ</div>
            <div className="grid grid-cols-2 gap-2">
              {menuList.map(m => (
                <button key={m.id} onClick={() => setSelMenu(m.id)}
                  className={`p-4 rounded-xl text-left transition-all active:scale-95 border-2 ${
                    selMenu === m.id ? 'bg-amber-900 border-amber-500' : 'bg-gray-800 border-gray-700'
                  }`}>
                  <div className="font-bold text-base">{m.name}</div>
                  <div className="text-xs text-gray-400 mt-1">{m.cookTime}蛻・ﾂｷ {EQUIP_LABEL[m.equip]}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 豕ｨ譁・・繧ｿ繝ｳ */}
          <button onClick={addOrder}
            className="w-full bg-amber-500 active:scale-98 text-black font-black py-6 rounded-2xl text-2xl transition-all">
            {selTable}蜊薙↓豕ｨ譁・☆繧・
          </button>

          {/* 縺薙・蜊薙・迴ｾ蝨ｨ縺ｮ豕ｨ譁・*/}
          {orders.filter(o => o.table === Number(selTable)).length > 0 && (
            <div className="mt-4 bg-gray-900 rounded-2xl p-4">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">{selTable}蜊薙・迴ｾ蝨ｨ縺ｮ豕ｨ譁・/div>
              {orders.filter(o => o.table === Number(selTable)).map(o => (
                <div key={o.id} className="flex items-center gap-3 py-3 border-b border-gray-800 last:border-0">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    o.status === 'pending' ? 'bg-amber-400' : o.status === 'cooking' ? 'bg-blue-400' : 'bg-green-400'
                  }`} />
                  <div className="flex-1 font-bold">{o.menu.name}</div>
                  <div className="flex gap-2">
                    {o.status === 'pending' && (
                      <button onClick={() => setStatus(o.id, 'cooking')}
                        className="bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold active:scale-95">髢句ｧ・/button>
                    )}
                    {o.status === 'cooking' && (
                      <button onClick={() => setStatus(o.id, 'served')}
                        className="bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-bold active:scale-95">螳御ｺ・/button>
                    )}
                    {o.status === 'served' && (
                      <span className="text-xs text-gray-500 line-through">謠蝉ｾ帶ｸ・/span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 蠎暮Κ繝翫ン */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex">
        <Link href="/kitchen" className="flex-1 py-4 text-center text-xs text-amber-400 font-bold border-t-2 border-amber-400">蜴ｨ謌ｿ</Link>
        <Link href="/orders" className="flex-1 py-4 text-center text-xs text-gray-400 font-bold">豕ｨ譁・/Link>
        <Link href="/menu" className="flex-1 py-4 text-center text-xs text-gray-400 font-bold">繝｡繝九Η繝ｼ</Link>
        <Link href="/analytics" className="flex-1 py-4 text-center text-xs text-gray-400 font-bold">蛻・梵</Link>
      </div>
    </div>
  )
}
