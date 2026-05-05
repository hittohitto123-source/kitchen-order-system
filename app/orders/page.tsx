'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { OrderItem, MenuItem, TableConfig } from '../../lib/types'
import { loadOrders, saveOrders, loadSettings, loadNextId, saveNextId, loadMenuFromDB } from '../../lib/storage'

const EQUIP_LABEL: Record<string, string> = {
  cold: '冷菜', stove: 'コンロ', grill: 'グリル', fryer: 'フライヤー', straw: '藁焼き'
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

function formatWait(sec: number) {
  if (sec < 60) return `${sec}秒`
  const m = Math.floor(sec / 60); const s = sec % 60
  return s > 0 ? `${m}分${s}秒` : `${m}分`
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [menuList, setMenuList] = useState<MenuItem[]>([])
  const [tableConfigs, setTableConfigs] = useState<TableConfig[]>([])
  const [now, setNow] = useState(Date.now())
  const [selectedSeats, setSelectedSeats] = useState<string[]>([])
  const [cart, setCart] = useState<{ menu: MenuItem; qty: number }[]>([])
  const [step, setStep] = useState<'table' | 'menu' | 'confirm'>('table')
  const [activeEquip, setActiveEquip] = useState('all')
  const [loading, setLoading] = useState(true)
  const [orderCount, setOrderCount] = useState<Record<string, number>>({})
  const [settings, setSettings] = useState<any>(null)

  useEffect(() => {
    const s = loadSettings()
    setSettings(s)
    setTableConfigs(s.tableConfigs || [])
    const allOrders = loadOrders()
    setOrders(allOrders)
    const count: Record<string, number> = {}
    allOrders.forEach(o => { count[o.menu.id] = (count[o.menu.id] || 0) + 1 })
    setOrderCount(count)
    loadMenuFromDB().then(menuData => {
      setMenuList(menuData.filter(m => m.active))
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now())
      const allOrders = loadOrders()
      setOrders(allOrders)
      const count: Record<string, number> = {}
      allOrders.forEach(o => { count[o.menu.id] = (count[o.menu.id] || 0) + 1 })
      setOrderCount(count)
    }, 3000)
    return () => clearInterval(t)
  }, [])

  const commit = (updated: OrderItem[]) => { setOrders(updated); saveOrders(updated) }

  // 選択中の卓名を結合して生成
  const selectedTableName = selectedSeats.join('・')

  const toggleSeat = (name: string, type: 'counter' | 'table') => {
    if (type === 'table') {
      // テーブル席は単独選択
      setSelectedSeats([name])
    } else {
      // カウンター席は複数選択可能
      setSelectedSeats(prev =>
        prev.includes(name)
          ? prev.filter(s => s !== name)
          : [...prev, name]
      )
    }
  }

  const addToCart = (menu: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.menu.id === menu.id)
      if (existing) return prev.map(c => c.menu.id === menu.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { menu, qty: 1 }]
    })
  }

  const removeFromCart = (menuId: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.menu.id === menuId)
      if (!existing) return prev
      if (existing.qty > 1) return prev.map(c => c.menu.id === menuId ? { ...c, qty: c.qty - 1 } : c)
      return prev.filter(c => c.menu.id !== menuId)
    })
  }

  const submitCart = () => {
    if (cart.length === 0 || selectedSeats.length === 0) return
    let id = loadNextId()
    const newOrders: OrderItem[] = []
    for (const item of cart) {
      for (let i = 0; i < item.qty; i++) {
        newOrders.push({
          id,
          table: selectedTableName,
          menu: item.menu,
          status: 'pending',
          addedAt: Date.now()
        })
        id++
      }
    }
    commit([...orders, ...newOrders])
    saveNextId(id)
    const count = { ...orderCount }
    cart.forEach(c => { count[c.menu.id] = (count[c.menu.id] || 0) + c.qty })
    setOrderCount(count)
    setCart([])
    setStep('table')
    setSelectedSeats([])
  }

  const setStatus = (id: number, status: OrderItem['status']) => {
    commit(orders.map(o => o.id === id ? {
      ...o, status,
      startedAt: status === 'cooking' ? Date.now() : (o as any).startedAt,
      servedAt: status === 'served' ? Date.now() : (o as any).servedAt,
    } : o))
  }

  const filteredMenu = () => {
    let filtered = menuList
    if (activeEquip === 'popular') {
      return [...menuList].sort((a, b) => (orderCount[b.id] || 0) - (orderCount[a.id] || 0)).slice(0, 12)
    }
    if (activeEquip !== 'all') filtered = menuList.filter(m => m.equip === activeEquip)
    return [...filtered].sort((a, b) => (orderCount[b.id] || 0) - (orderCount[a.id] || 0))
  }

  const getWaitSec = (tableName: string) => {
    const items = orders.filter(o => o.table === tableName && o.status !== 'served')
    if (!items.length) return null
    return Math.floor((now - Math.min(...items.map(o => o.addedAt))) / 1000)
  }

  const totalCartItems = cart.reduce((s, c) => s + c.qty, 0)
  const counterConfigs = tableConfigs.filter(c => c.type === 'counter')
  const tableConfigsOnly = tableConfigs.filter(c => c.type === 'table')

  // 現在アクティブな卓一覧（注文がある卓）
  const activeTables = Array.from(new Set(
    orders.filter(o => o.status !== 'served').map(o => o.table)
  ))

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
      <div className="text-center">
        <div className="text-amber-400 font-bold text-2xl mb-2">KitchenQ</div>
        <div className="text-gray-400">読み込み中...</div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-20" style={{ fontFamily: 'system-ui,sans-serif' }}>

      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <Link href="/kitchen" className="text-gray-400 text-2xl font-bold">←</Link>
        <h1 className="text-lg font-bold text-amber-400">注文管理</h1>
        <div className="w-8" />
      </div>

      {/* STEP 1：卓・席選択 */}
      {step === 'table' && (
        <div className="p-4">

          {/* カウンター席 */}
          {counterConfigs.length > 0 && (
            <div className="mb-5">
              <div className="text-sm font-black text-blue-400 mb-2">
                カウンター席
                <span className="text-xs text-gray-500 ml-2">複数タップで合席可能</span>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {counterConfigs.map(c => {
                  const ws = getWaitSec(c.name)
                  const isSelected = selectedSeats.includes(c.name)
                  const hasOrder = orders.some(o => o.table === c.name && o.status !== 'served')
                  const isDanger = ws !== null && settings && ws >= settings.dangerThresholdSec
                  return (
                    <button key={c.id} onClick={() => toggleSeat(c.name, 'counter')}
                      className="rounded-2xl p-3 text-center active:scale-95 transition-all border-2 min-w-16"
                      style={{
                        backgroundColor: isSelected ? '#f59e0b' : isDanger ? 'rgba(127,29,29,0.6)' : hasOrder ? '#1e3a5f' : '#1f2937',
                        borderColor: isSelected ? '#f59e0b' : isDanger ? '#dc2626' : hasOrder ? '#3b82f6' : '#374151',
                        color: isSelected ? 'black' : 'white',
                      }}>
                      <div className="font-black text-lg">{c.name}</div>
                      {ws !== null && (
                        <div style={{ fontSize: '10px', color: isSelected ? '#78350f' : isDanger ? '#fca5a5' : '#93c5fd' }}>
                          {formatWait(ws)}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* 選択中の席表示 */}
              {selectedSeats.length > 0 && (
                <div className="bg-amber-900 border border-amber-600 rounded-xl p-3 mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-amber-400 font-bold">選択中の席</div>
                    <div className="text-xl font-black text-white">{selectedTableName}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedSeats([])}
                      className="bg-gray-700 text-gray-300 px-3 py-2 rounded-xl text-sm font-bold active:scale-95">
                      クリア
                    </button>
                    <button onClick={() => { if (selectedSeats.length > 0) setStep('menu') }}
                      className="bg-amber-500 text-black px-4 py-2 rounded-xl text-sm font-black active:scale-95">
                      注文する →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* テーブル席 */}
          {tableConfigsOnly.length > 0 && (
            <div className="mb-5">
              <div className="text-sm font-black text-green-400 mb-2">テーブル席</div>
              <div className="grid grid-cols-4 gap-3">
                {tableConfigsOnly.map(c => {
                  const ws = getWaitSec(c.name)
                  const isSelected = selectedSeats.includes(c.name) && selectedSeats.length === 1
                  const hasOrder = orders.some(o => o.table === c.name && o.status !== 'served')
                  const isDanger = ws !== null && settings && ws >= settings.dangerThresholdSec
                  const isWarn = ws !== null && settings && ws >= settings.warningThresholdSec
                  return (
                    <button key={c.id} onClick={() => { toggleSeat(c.name, 'table'); setStep('menu') }}
                      className="rounded-2xl p-4 text-center active:scale-95 border-2 transition-all"
                      style={{
                        backgroundColor: isDanger ? 'rgba(127,29,29,0.6)' : isWarn ? 'rgba(120,53,15,0.6)' : hasOrder ? '#1e3a5f' : '#1f2937',
                        borderColor: isDanger ? '#dc2626' : isWarn ? '#d97706' : hasOrder ? '#3b82f6' : '#374151',
                      }}>
                      <div className="text-2xl font-black text-white">{c.name}</div>
                      {ws !== null ? (
                        <div className="text-xs mt-1" style={{ color: isDanger ? '#fca5a5' : isWarn ? '#fcd34d' : '#93c5fd' }}>
                          {formatWait(ws)}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-600 mt-1">空き</div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 現在の注文状況 */}
          {activeTables.length > 0 && (
            <div className="bg-gray-900 rounded-2xl p-4">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">現在の注文状況</div>
              {activeTables.map(tableName => {
                const tOrders = orders.filter(o => o.table === tableName)
                const pending = tOrders.filter(o => o.status === 'pending')
                const cooking = tOrders.filter(o => o.status === 'cooking')
                if (!pending.length && !cooking.length) return null
                return (
                  <div key={tableName} className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0">
                    <span className="text-lg font-black text-amber-400 w-16 flex-shrink-0">{tableName}</span>
                    <div className="flex gap-2 flex-1 flex-wrap">
                      {cooking.map(o => (
                        <span key={o.id} className="text-xs bg-blue-800 text-blue-200 px-2 py-1 rounded-lg">{o.menu.name}</span>
                      ))}
                      {pending.map(o => (
                        <span key={o.id} className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded-lg">{o.menu.name}</span>
                      ))}
                    </div>
                    <button onClick={() => { setSelectedSeats([tableName]); setStep('menu') }}
                      className="text-xs bg-amber-600 text-black font-bold px-3 py-1.5 rounded-lg flex-shrink-0">
                      追加
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* STEP 2：メニュー選択 */}
      {step === 'menu' && selectedSeats.length > 0 && (
        <div>
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800">
            <button onClick={() => { setStep('table'); setCart([]) }}
              className="bg-gray-800 text-white px-4 py-2 rounded-xl font-bold text-sm">← 戻る</button>
            <div className="flex-1 text-center">
              <span className="text-2xl font-black text-amber-400">{selectedTableName}</span>
              <span className="text-gray-400 text-sm ml-2">のメニュー</span>
            </div>
            {totalCartItems > 0 && (
              <button onClick={() => setStep('confirm')}
                className="bg-amber-500 text-black font-black px-4 py-2 rounded-xl text-sm relative">
                確認
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {totalCartItems}
                </span>
              </button>
            )}
          </div>

          {/* ジャンルタブ */}
          <div className="flex overflow-x-auto gap-2 px-4 py-3 bg-gray-900 border-b border-gray-800">
            {EQUIP_TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveEquip(tab.key)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold active:scale-95 ${activeEquip === tab.key ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {/* カート */}
            {cart.length > 0 && (
              <div className="bg-gray-900 rounded-2xl p-3 mb-4 border border-amber-800">
                <div className="text-xs text-amber-400 font-bold mb-2">カート（{totalCartItems}品）</div>
                <div className="flex flex-wrap gap-2">
                  {cart.map(c => (
                    <div key={c.menu.id} className="flex items-center gap-1 bg-amber-900 border border-amber-600 px-2 py-1 rounded-lg">
                      <span className="text-xs font-bold text-white">{c.menu.name}</span>
                      <span className="text-xs text-amber-300 font-black">×{c.qty}</span>
                      <button onClick={() => removeFromCart(c.menu.id)}
                        className="text-gray-400 text-xs ml-1 font-black active:scale-95">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {filteredMenu().map(m => {
                const inCart = cart.find(c => c.menu.id === m.id)
                const count = orderCount[m.id] || 0
                return (
                  <button key={m.id} onClick={() => addToCart(m)}
                    className="rounded-2xl p-4 text-left active:scale-95 relative"
                    style={{
                      backgroundColor: inCart ? 'rgba(180,83,9,0.3)' : '#1f2937',
                      border: inCart ? '2px solid #f59e0b' : '2px solid #374151',
                    }}>
                    {count > 0 && (
                      <div className="absolute top-2 left-2 bg-gray-700 text-gray-300 text-xs px-1.5 py-0.5 rounded-full font-bold">
                        {count}回
                      </div>
                    )}
                    <div className="font-bold text-base mb-1 mt-4 text-white">{m.name}</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-400">{m.cookTime}分</span>
                      <span className="text-xs text-gray-500">{EQUIP_LABEL[m.equip]}</span>
                    </div>
                    {inCart && (
                      <div className="absolute top-2 right-2 bg-amber-500 text-black font-black text-sm w-7 h-7 rounded-full flex items-center justify-center">
                        {inCart.qty}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* STEP 3：確認 */}
      {step === 'confirm' && selectedSeats.length > 0 && (
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setStep('menu')}
              className="bg-gray-800 text-white px-4 py-2 rounded-xl font-bold text-sm">← 戻る</button>
            <div className="flex-1 text-center">
              <span className="text-2xl font-black text-amber-400">{selectedTableName}</span>
              <span className="text-gray-400 text-sm ml-2">の注文確認</span>
            </div>
          </div>
          <div className="bg-gray-900 rounded-2xl p-4 mb-4">
            {cart.map(c => (
              <div key={c.menu.id} className="flex items-center gap-3 py-3 border-b border-gray-800 last:border-0">
                <div className="flex-1">
                  <div className="font-bold text-base">{c.menu.name}</div>
                  <div className="text-xs text-gray-400">{c.menu.cookTime}分 · {EQUIP_LABEL[c.menu.equip]}</div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => removeFromCart(c.menu.id)}
                    className="w-10 h-10 bg-gray-700 rounded-xl text-white font-black text-xl flex items-center justify-center active:scale-95">
                    −
                  </button>
                  <span className="text-xl font-black text-amber-400 w-8 text-center">{c.qty}</span>
                  <button onClick={() => addToCart(c.menu)}
                    className="w-10 h-10 bg-gray-700 rounded-xl text-white font-black text-xl flex items-center justify-center active:scale-95">
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={submitCart}
            className="w-full bg-amber-500 text-black font-black py-5 rounded-2xl text-xl active:scale-98">
            {selectedTableName}に {totalCartItems}品 を注文する
          </button>

          {/* この席の現在の注文 */}
          {orders.filter(o => o.table === selectedTableName).length > 0 && (
            <div className="mt-4 bg-gray-900 rounded-2xl p-4">
              <div className="text-xs font-bold text-gray-400 mb-3">この席の現在の注文</div>
              {orders.filter(o => o.table === selectedTableName).map(o => (
                <div key={o.id} className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${o.status === 'pending' ? 'bg-amber-400' : o.status === 'cooking' ? 'bg-blue-400' : 'bg-green-400'}`} />
                  <div className="flex-1 font-bold text-sm">{o.menu.name}</div>
                  <div className="flex gap-2">
                    {o.status === 'pending' && (
                      <button onClick={() => setStatus(o.id, 'cooking')}
                        className="text-xs bg-blue-700 text-white px-3 py-1.5 rounded-lg font-bold active:scale-95">開始</button>
                    )}
                    {o.status === 'cooking' && (
                      <button onClick={() => setStatus(o.id, 'served')}
                        className="text-xs bg-green-700 text-white px-3 py-1.5 rounded-lg font-bold active:scale-95">完了</button>
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
        <Link href="/kitchen" className="flex-1 py-4 text-center text-xs text-gray-400 font-bold">厨房</Link>
        <Link href="/orders" className="flex-1 py-4 text-center text-xs text-amber-400 font-bold border-t-2 border-amber-400">注文</Link>
        <Link href="/menu" className="flex-1 py-4 text-center text-xs text-gray-400 font-bold">メニュー</Link>
        <Link href="/settings" className="flex-1 py-4 text-center text-xs text-gray-400 font-bold">設定</Link>
        <Link href="/analytics" className="flex-1 py-4 text-center text-xs text-gray-400 font-bold">分析</Link>
      </div>
    </div>
  )
}