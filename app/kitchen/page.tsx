'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { OrderItem, MenuItem, ShopSettings } from '../../lib/types'
import { loadOrders, saveOrders, loadSettings, saveSettings, loadNextId, saveNextId, clearAllOrders, loadOrdersFromDB, loadMenuFromDB, logAnalytics } from '../../lib/storage'
import { buildSchedule } from '../../lib/priorityEngine'

const EQUIP_LABEL: Record<string, string> = {
  cold: '冷菜', stove: 'コンロ', grill: 'グリル', fryer: 'フライヤー', straw: '藁焼き'
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
  const [batchModal, setBatchModal] = useState<{ order: OrderItem; sameMenuOrders: OrderItem[] } | null>(null)
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
    let dbPollCount = 0
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
      dbPollCount++
      if (dbPollCount >= 10) {
        dbPollCount = 0
        loadOrdersFromDB().then(dbOrders => {
          if (dbOrders.length > 0) {
            saveOrders(dbOrders)
            setOrders(dbOrders)
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
    const sameMenuOrders = orders.filter(
      o => o.id !== order.id && o.menu.id === order.menu.id && o.status === 'pending'
    )
    if (sameMenuOrders.length > 0) {
      setBatchModal({ order, sameMenuOrders })
    } else {
      startCooking([order.id])
    }
  }

  const startCooking = (ids: number[]) => {
    const t = Date.now()
    const updated = orders.map(o =>
      ids.includes(o.id) ? { ...o, status: 'cooking' as const, startedAt: t } : o
    )
    commit(updated)
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

  const addOrder = () => {
    const menu = menuList.find(m => m.id === selMenu)
    if (!menu || !settings) return
    const id = loadNextId()
    commit([...orders, { id, table: Number(selTable), menu, status: 'pending', addedAt: Date.now() }])
    saveNextId(id + 1)
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
        <div className="text-gray-400">同期中...</div>
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

      {showCloseConfirm && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:'1rem'}}>
          <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm border-2 border-red-700">
            <h2 className="text-2xl font-black text-red-400 mb-3 text-center">営業終了</h2>
            <p className="text-gray-300 mb-6 text-sm text-center">全ての注文データをクリアします。元に戻せません。</p>
            <div className="flex gap-3">
              <button onClick={() => setShowCloseConfirm(false)}
                className="flex-1 bg-gray-700 text-white font-black py-4 rounded-2xl text-lg">キャンセル</button>
              <button onClick={handleCloseBusiness}
                className="flex-1 bg-red-600 text-white font-black py-4 rounded-2xl text-lg">終了する</button>
            </div>
          </div>
        </div>
      )}

      {batchModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:'1rem'}}>
          <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm border-2 border-blue-700">
            <h2 className="text-xl font-black text-blue-400 mb-2 text-center">
              {batchModal.order.menu.name}
            </h2>
            <p className="text-gray-400 text-sm text-center mb-4">
              同じメニューが{batchModal.sameMenuOrders.length + 1}件あります。何件まとめて調理しますか？
            </p>
            <div className="bg-gray-800 rounded-2xl p-3 mb-4">
              {[batchModal.order, ...batchModal.sameMenuOrders].map(o => (
                <div key={o.id} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                  <span className="text-amber-400 font-black">{o.table}卓</span>
                  <span className="text-xs text-gray-400">待機{formatWait(Math.floor((now - o.addedAt) / 1000))}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 mb-3">
              <button onClick={() => startCooking([batchModal.order.id])}
                className="w-full bg-gray-700 text-white font-bold py-3 rounded-2xl text-sm active:scale-95">
                {batchModal.order.table}卓だけ開始（1件）
              </button>
              {batchModal.sameMenuOrders.map((_, idx) => {
                const selectedOrders = [batchModal.order, ...batchModal.sameMenuOrders.slice(0, idx + 1)]
                return (
                  <button key={idx} onClick={() => startCooking(selectedOrders.map(o => o.id))}
                    className="w-full bg-blue-700 text-white font-bold py-3 rounded-2xl text-sm active:scale-95">
                    {selectedOrders.map(o => `${o.table}卓`).join(' + ')} をまとめて開始（{selectedOrders.length}件）
                  </button>
                )
              })}
              <button onClick={() => startCooking([batchModal.order, ...batchModal.sameMenuOrders].map(o => o.id))}
                className="w-full bg-green-600 text-white font-black py-3 rounded-2xl text-sm active:scale-95">
                全{batchModal.sameMenuOrders.length + 1}件まとめて開始
              </button>
            </div>
            <button onClick={() => setBatchModal(null)}
              className="w-full bg-gray-800 text-gray-400 font-bold py-3 rounded-2xl text-sm">
              キャンセル
            </button>
          </div>
        </div>
      )}

      <div className="bg-gray-900 border-b border-gray-800 px-3 py-2">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-lg font-black text-amber-400">KitchenQ</h1>
            <span className="text-xs text-green-500">DB自動同期（10秒）</span>
          </div>
          <div className="flex gap-1.5">
            <button onClick={toggleSound}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold ${settings.soundAlert ? 'bg-blue-800 text-blue-300' : 'bg-gray-700 text-gray-400'}`}>
              {settings.soundAlert ? '音ON' : '音OFF'}
            </button>
            <button onClick={toggleOneOp}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold ${settings.oneOperatorMode ? 'bg-amber-500 text-black' : 'bg-gray-700 text-white'}`}>
              {settings.oneOperatorMode ? 'ワンオペ' : '通常'}
            </button>
            <button onClick={() => setShowCloseConfirm(true)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-red-900 text-red-300">
              終了
            </button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          <div className="bg-gray-800 rounded-xl py-1.5 text-center">
            <div className="text-xl font-black text-amber-400">{pending.length}</div>
            <div className="text-xs text-gray-400">待機</div>
          </div>
          <div className="bg-gray-800 rounded-xl py-1.5 text-center">
            <div className="text-xl font-black text-blue-400">{cooking.length}</div>
            <div className="text-xs text-gray-400">調理中</div>
          </div>
          <div className="bg-gray-800 rounded-xl py-1.5 text-center">
            <div className="text-xl font-black text-green-400">{orders.filter(o => o.status === 'served').length}</div>
            <div className="text-xs text-gray-400">提供済</div>
          </div>
          <div className="bg-gray-800 rounded-xl py-1.5 text-center">
            <div className="text-xl font-black text-red-400">{dangerTables.size}</div>
            <div className="text-xs text-gray-400">遅延卓</div>
          </div>
        </div>
      </div>

      <div className="flex bg-gray-900 border-b border-gray-800">
        {[
          { key: 'priority', label: '優先順位' },
          { key: 'tables',   label: '卓一覧' },
          { key: 'add',      label: '注文追加' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 py-2.5 text-sm font-bold transition-all border-b-2 ${
              activeTab === tab.key ? 'text-amber-400 border-amber-400' : 'text-gray-400 border-transparent'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'priority' && (
        <div className="flex gap-0 overflow-hidden" style={{height:'calc(100vh - 160px)'}}>
          <div className="flex-1 border-r border-gray-800 overflow-y-auto">
            <div className="bg-gray-900 px-3 py-2 border-b border-gray-800 sticky top-0 z-10">
              <div className="text-xs font-black text-amber-400 uppercase tracking-wider">
                次にやること ({scheduled.length})
              </div>
            </div>
            <div className="p-2">
              {scheduled.length === 0 && (
                <div className="text-center py-8 text-gray-600">
                  <div className="text-3xl mb-2">✓</div>
                  <div className="text-xs">待機なし</div>
                </div>
              )}
              {scheduled.map((o, i) => {
                const waitSec = Math.floor((now - o.addedAt) / 1000)
                const isDanger = waitSec >= settings.dangerThresholdSec
                const isWarn = waitSec >= settings.warningThresholdSec
                return (
                  <div key={o.id}>
                    {o.isBatchLeader && (
                      <div className="text-xs text-green-400 font-bold bg-green-950 border border-green-800 px-2 py-0.5 rounded-full mb-1 inline-block">
                        まとめて{o.batchCount}件
                      </div>
                    )}
                    <div className={`rounded-xl p-2.5 mb-2 border ${
                      o.batchCount > 1 ? 'border-l-4 border-l-green-500 ' : ''
                    }${isDanger ? 'bg-red-950 border-red-700' : isWarn ? 'bg-amber-950 border-amber-700' : 'bg-gray-800 border-gray-700'}`}>
                      <div className="flex items-start gap-2 mb-2">
                        <span className={`text-lg font-black w-6 text-center flex-shrink-0 ${
                          isDanger ? 'text-red-400' : isWarn ? 'text-amber-400' : 'text-gray-500'
                        }`}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-black text-sm leading-tight">{o.menu.name}</div>
                          <div className="text-xs text-amber-400 font-bold">{o.table}卓</div>
                          <div className="text-xs text-gray-500">{EQUIP_LABEL[o.menu.equip]} · {o.menu.cookTime}分</div>
                          {waitSec > 0 && <div className="text-xs text-gray-500">待機{formatWait(waitSec)}</div>}
                          {isDanger && <div className="text-xs text-red-400 font-black animate-pulse">遅延!</div>}
                        </div>
                      </div>
                      <button onClick={() => handleStartPress(o)}
                        className="w-full bg-blue-600 active:scale-95 text-white py-2.5 rounded-lg text-sm font-black">
                        開始
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="bg-gray-900 px-3 py-2 border-b border-gray-800 sticky top-0 z-10">
              <div className="text-xs font-black text-blue-400 uppercase tracking-wider">
                調理中 ({cooking.length})
              </div>
            </div>
            <div className="p-2">
              {cooking.length === 0 && (
                <div className="text-center py-8 text-gray-600">
                  <div className="text-3xl mb-2">🍳</div>
                  <div className="text-xs">調理中なし</div>
                </div>
              )}
              {cooking.map(o => (
                <div key={o.id} className="bg-blue-950 border border-blue-700 rounded-xl p-2.5 mb-2">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-blue-400 text-lg font-black">▶</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-sm leading-tight">{o.menu.name}</div>
                      <div className="text-xs text-amber-400 font-bold">{o.table}卓</div>
                      <div className="text-xs text-gray-500">{EQUIP_LABEL[o.menu.equip]} · {o.menu.cookTime}分</div>
                    </div>
                  </div>
                  <button onClick={() => setStatus(o.id, 'served')}
                    className="w-full bg-green-600 active:scale-95 text-white py-2.5 rounded-lg text-sm font-black">
                    完了
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
                  <div className="text-xs text-gray-400 mb-1">{t}卓</div>
                  {ws !== null ? (
                    <div className={`text-2xl font-black ${isDanger ? 'text-red-400' : isWarn ? 'text-amber-400' : 'text-green-400'}`}>
                      {formatWait(ws)}
                    </div>
                  ) : (
                    <div className="text-lg font-black text-gray-600">空き</div>
                  )}
                  {(pendingCount > 0 || cookingCount > 0) && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {cookingCount > 0 && <span className="text-xs bg-blue-800 text-blue-200 px-1.5 py-0.5 rounded">{cookingCount}調理中</span>}
                      {pendingCount > 0 && <span className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">{pendingCount}待機</span>}
                    </div>
                  )}
                  {isDanger && <div className="text-xs text-red-400 font-black animate-pulse mt-1">遅延!</div>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {activeTab === 'add' && (
        <div className="p-3 pb-24">
          <div className="bg-gray-900 rounded-2xl p-4 mb-3">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">卓番号</div>
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

          <div className="bg-gray-900 rounded-2xl p-4 mb-3">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">メニュー</div>
            <div className="grid grid-cols-2 gap-2">
              {menuList.map(m => (
                <button key={m.id} onClick={() => setSelMenu(m.id)}
                  className={`p-3 rounded-xl text-left transition-all active:scale-95 border-2 ${
                    selMenu === m.id ? 'bg-amber-900 border-amber-500' : 'bg-gray-800 border-gray-700'
                  }`}>
                  <div className="font-bold text-sm">{m.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{m.cookTime}分 · {EQUIP_LABEL[m.equip]}</div>
                </button>
              ))}
            </div>
          </div>

          <button onClick={addOrder}
            className="w-full bg-amber-500 active:scale-98 text-black font-black py-5 rounded-2xl text-xl transition-all">
            {selTable}卓に注文する
          </button>

          {orders.filter(o => o.table === Number(selTable)).length > 0 && (
            <div className="mt-4 bg-gray-900 rounded-2xl p-4">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">{selTable}卓の現在の注文</div>
              {orders.filter(o => o.table === Number(selTable)).map(o => (
                <div key={o.id} className="flex items-center gap-3 py-3 border-b border-gray-800 last:border-0">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    o.status === 'pending' ? 'bg-amber-400' : o.status === 'cooking' ? 'bg-blue-400' : 'bg-green-400'
                  }`} />
                  <div className="flex-1 font-bold text-sm">{o.menu.name}</div>
                  <div className="flex gap-2">
                    {o.status === 'pending' && (
                      <button onClick={() => setStatus(o.id, 'cooking')}
                        className="bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold active:scale-95">開始</button>
                    )}
                    {o.status === 'cooking' && (
                      <button onClick={() => setStatus(o.id, 'served')}
                        className="bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-bold active:scale-95">完了</button>
                    )}
                    {o.status === 'served' && (
                      <span className="text-xs text-gray-500 line-through">提供済</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex">
        <Link href="/kitchen" className="flex-1 py-4 text-center text-xs text-amber-400 font-bold border-t-2 border-amber-400">厨房</Link>
        <Link href="/orders" className="flex-1 py-4 text-center text-xs text-gray-400 font-bold">注文</Link>
        <Link href="/menu" className="flex-1 py-4 text-center text-xs text-gray-400 font-bold">メニュー</Link>
        <Link href="/settings" className="flex-1 py-4 text-center text-xs text-gray-400 font-bold">設定</Link>
        <Link href="/analytics" className="flex-1 py-4 text-center text-xs text-gray-400 font-bold">分析</Link>
      </div>
    </div>
  )
}