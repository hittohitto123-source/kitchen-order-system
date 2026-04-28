'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { OrderItem, MenuItem } from '../../lib/types'
import { loadOrders, saveOrders, loadSettings, loadNextId, saveNextId, loadMenuFromDB } from '../../lib/storage'

const EQUIP_LABEL: Record<string, string> = {
  cold: '冷菜', stove: 'コンロ', grill: 'グリル', fryer: 'フライヤー', straw: '藁焼き'
}

const EQUIP_TABS = [
  { key: 'all',   label: 'すべて' },
  { key: 'popular', label: '人気' },
  { key: 'cold',  label: '冷菜' },
  { key: 'straw', label: '藁焼き' },
  { key: 'stove', label: 'コンロ' },
  { key: 'fryer', label: 'フライヤー' },
  { key: 'grill', label: 'グリル' },
]

function formatWait(sec: number) {
  if (sec < 60) return `${sec}秒`
  const m = Math.floor(sec / 60); const s = sec % 60
  return s > 0 ? `${m}分${s}秒` : `${m}分`
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [menuList, setMenuList] = useState<MenuItem[]>([])
  const [tableCount, setTableCount] = useState(8)
  const [now, setNow] = useState(Date.now())
  const [selTable, setSelTable] = useState<number | null>(null)
  const [cart, setCart] = useState<{ menu: MenuItem; qty: number }[]>([])
  const [step, setStep] = useState<'table' | 'menu' | 'confirm'>('table')
  const [activeEquip, setActiveEquip] = useState('all')
  const [loading, setLoading] = useState(true)
  const [orderCount, setOrderCount] = useState<Record<string, number>>({})

  useEffect(() => {
    setTableCount(loadSettings().tableCount)
    const allOrders = loadOrders()
    setOrders(allOrders)

    // 注文回数カウント
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
    if (cart.length === 0 || selTable === null) return
    let id = loadNextId()
    const newOrders: OrderItem[] = []
    for (const item of cart) {
      for (let i = 0; i < item.qty; i++) {
        newOrders.push({ id, table: selTable, menu: item.menu, status: 'pending', addedAt: Date.now() })
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
    setSelTable(null)
  }

  const setStatus = (id: number, status: OrderItem['status']) => {
    commit(orders.map(o => o.id === id ? { ...o, status,
      startedAt: status === 'cooking' ? Date.now() : (o as any).startedAt,
      servedAt: status === 'served' ? Date.now() : (o as any).servedAt,
    } : o))
  }

  const tables = Array.from({ length: tableCount }, (_, i) => i + 1)
  const settings = loadSettings()

  const getWaitSec = (table: number) => {
    const items = orders.filter(o => o.table === table && o.status !== 'served')
    if (!items.length) return null
    return Math.floor((now - Math.min(...items.map(o => o.addedAt))) / 1000)
  }

  // フィルタリング＋ソート
  const filteredMenu = () => {
    let filtered = menuList
    if (activeEquip === 'popular') {
      filtered = [...menuList].sort((a, b) => (orderCount[b.id] || 0) - (orderCount[a.id] || 0))
      return filtered.slice(0, 12)
    }
    if (activeEquip !== 'all') {
      filtered = menuList.filter(m => m.equip === activeEquip)
    }
    return [...filtered].sort((a, b) => (orderCount[b.id] || 0) - (orderCount[a.id] || 0))
  }

  const tableOrders = selTable ? orders.filter(o => o.table === selTable) : []
  const totalCartItems = cart.reduce((s, c) => s + c.qty, 0)

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
      <div className="text-center">
        <div className="text-amber-400 font-bold text-2xl mb-2">KitchenQ</div>
        <div className="text-gray-400">読み込み中...</div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-20" style={{fontFamily:'system-ui,sans-serif'}}>

      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <Link href="/kitchen" className="text-gray-400 text-2xl font-bold">←</Link>
        <h1 className="text-lg font-bold text-amber-400">注文管理</h1>
        <div className="w-8" />
      </div>

      {/* STEP 1: 卓選択 */}
      {step === 'table' && (
        <div className="p-4">
          <div className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 text-center">
            注文する卓を選んでください
          </div>
          <div className="grid grid-cols-4 gap-3 mb-6">
            {tables.map(t => {
              const ws = getWaitSec(t)
              const tOrders = orders.filter(o => o.table === t)
              const hasActive = tOrders.some(o => o.status !== 'served')
              const isDanger = ws !== null && ws >= settings.dangerThresholdSec
              const isWarn = ws !== null && ws >= settings.warningThresholdSec
              return (
                <button key={t} onClick={() => { setSelTable(t); setStep('menu') }}
                  className={`rounded-2xl p-3 flex flex-col items-center justify-center aspect-square transition-all active:scale-95 ${
                    isDanger ? 'bg-red-800 border-2 border-red-500' :
                    isWarn ? 'bg-amber-900 border-2 border-amber-500' :
                    hasActive ? 'bg-blue-900 border-2 border-blue-600' :
                    'bg-gray-800 border-2 border-gray-700'
                  }`}>
                  <span className="text-2xl font-black">{t}</span>
                  <span className="text-xs text-gray-400 mt-0.5">卓</span>
                  {ws !== null && (
                    <span className={`text-xs font-bold mt-1 ${isDanger ? 'text-red-300' : isWarn ? 'text-amber-300' : 'text-green-300'}`}>
                      {formatWait(ws)}
                    </span>
                  )}
                  {isDanger && <span className="text-xs text-red-300 animate-pulse">遅延!</span>}
                </button>
              )
            })}
          </div>

          <div className="bg-gray-900 rounded-2xl p-4">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">現在の注文状況</div>
            {tables.map(t => {
              const tOrders = orders.filter(o => o.table === t)
              const pending = tOrders.filter(o => o.status === 'pending')
              const cooking = tOrders.filter(o => o.status === 'cooking')
              if (!pending.length && !cooking.length) return null
              return (
                <div key={t} className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0">
                  <span className="text-lg font-black text-amber-400 w-8">{t}卓</span>
                  <div className="flex gap-2 flex-1 flex-wrap">
                    {cooking.map(o => (
                      <span key={o.id} className="text-xs bg-blue-800 text-blue-200 px-2 py-1 rounded-lg">{o.menu.name}</span>
                    ))}
                    {pending.map(o => (
                      <span key={o.id} className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded-lg">{o.menu.name}</span>
                    ))}
                  </div>
                  <button onClick={() => { setSelTable(t); setStep('menu') }}
                    className="text-xs bg-amber-600 text-black font-bold px-3 py-1.5 rounded-lg">
                    追加
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* STEP 2: メニュー選択 */}
      {step === 'menu' && selTable !== null && (
        <div>
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800">
            <button onClick={() => { setStep('table'); setCart([]) }}
              className="bg-gray-800 text-white px-4 py-2 rounded-xl font-bold text-sm">← 戻る</button>
            <div className="flex-1 text-center">
              <span className="text-2xl font-black text-amber-400">{selTable}卓</span>
              <span className="text-gray-400 text-sm ml-2">のメニューを選択</span>
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
          <div className="flex overflow-x-auto gap-2 px-4 py-3 bg-gray-900 border-b border-gray-800 no-scrollbar">
            {EQUIP_TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveEquip(tab.key)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                  activeEquip === tab.key ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300'
                }`}>
                {tab.label}
                {tab.key === 'popular' && <span className="ml-1 text-xs">🔥</span>}
              </button>
            ))}
          </div>

          <div className="p-4">
            {/* カート内容 */}
            {cart.length > 0 && (
              <div className="bg-gray-900 rounded-2xl p-3 mb-4 border border-amber-800">
                <div className="text-xs text-amber-400 font-bold mb-2">カート ({totalCartItems}品)</div>
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
                    className={`rounded-2xl p-4 text-left transition-all active:scale-95 relative ${
                      inCart ? 'bg-amber-900 border-2 border-amber-500' : 'bg-gray-800 border-2 border-gray-700'
                    }`}>
                    {count > 0 && (
                      <div className="absolute top-2 left-2 bg-gray-700 text-gray-300 text-xs px-1.5 py-0.5 rounded-full font-bold">
                        {count}回
                      </div>
                    )}
                    <div className="font-bold text-base mb-1 mt-4">{m.name}</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-400">{m.cookTime}分</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        m.equip === 'cold' ? 'bg-blue-900 text-blue-300' :
                        m.equip === 'straw' ? 'bg-yellow-900 text-yellow-300' :
                        m.equip === 'stove' ? 'bg-orange-900 text-orange-300' :
                        m.equip === 'fryer' ? 'bg-red-900 text-red-300' :
                        'bg-purple-900 text-purple-300'
                      }`}>{EQUIP_LABEL[m.equip]}</span>
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

      {/* STEP 3: 確認 */}
      {step === 'confirm' && selTable !== null && (
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setStep('menu')}
              className="bg-gray-800 text-white px-4 py-2 rounded-xl font-bold text-sm">← 戻る</button>
            <div className="flex-1 text-center">
              <span className="text-2xl font-black text-amber-400">{selTable}卓</span>
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
            className="w-full bg-amber-500 active:scale-98 text-black font-black py-5 rounded-2xl text-xl transition-all">
            {selTable}卓に {totalCartItems}品 を注文する
          </button>
          {tableOrders.length > 0 && (
            <div className="mt-4 bg-gray-900 rounded-2xl p-4">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">この卓の現在の注文</div>
              {tableOrders.map(o => (
                <div key={o.id} className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    o.status === 'pending' ? 'bg-amber-400' :
                    o.status === 'cooking' ? 'bg-blue-400' : 'bg-green-400'
                  }`} />
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