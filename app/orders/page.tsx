'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { OrderItem, MenuItem } from '../../lib/types'
import { loadOrders, saveOrders, loadMenu, loadSettings, loadNextId, saveNextId } from '../../lib/storage'

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
  const [openTable, setOpenTable] = useState<number | null>(null)
  const [cart, setCart] = useState<{ menu: MenuItem; qty: number }[]>([])
  const [selTable, setSelTable] = useState(1)

  useEffect(() => {
    const m = loadMenu().filter(m => m.active)
    setMenuList(m)
    setOrders(loadOrders())
    setTableCount(loadSettings().tableCount)
  }, [])

  useEffect(() => {
    const t = setInterval(() => { setNow(Date.now()); setOrders(loadOrders()) }, 3000)
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
      if (existing && existing.qty > 1) return prev.map(c => c.menu.id === menuId ? { ...c, qty: c.qty - 1 } : c)
      return prev.filter(c => c.menu.id !== menuId)
    })
  }

  const submitCart = () => {
    if (cart.length === 0) return
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
    setCart([])
  }

  const setStatus = (id: number, status: OrderItem['status']) => {
    commit(orders.map(o => o.id === id ? {
      ...o, status,
      startedAt: status === 'cooking' ? Date.now() : o.startedAt,
      servedAt: status === 'served' ? Date.now() : o.servedAt,
    } : o))
  }

  const closeTable = (table: number) => {
    commit(orders.filter(o => o.table !== table))
    if (openTable === table) setOpenTable(null)
  }

  const tables = Array.from({ length: tableCount }, (_, i) => i + 1)
  const settings = loadSettings()

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold text-amber-400">注文管理</h1>
        <Link href="/kitchen" className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm font-bold">厨房へ</Link>
      </div>

      <div className="bg-gray-900 rounded-xl p-4 mb-4">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">一括注文入力</h2>
        <div className="mb-3">
          <label className="text-xs text-gray-400 mb-2 block">卓番号を選択</label>
          <div className="flex gap-2 flex-wrap">
            {tables.map(t => (
              <button key={t} onClick={() => setSelTable(t)}
                className={`w-12 h-12 rounded-xl font-bold text-sm transition-colors ${selTable === t ? 'bg-amber-500 text-black' : 'bg-gray-800 text-white hover:bg-gray-700'}`}>
                {t}卓
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <label className="text-xs text-gray-400 mb-2 block">メニューをタップして追加</label>
          <div className="grid grid-cols-2 gap-2">
            {menuList.map(m => {
              const inCart = cart.find(c => c.menu.id === m.id)
              return (
                <button key={m.id} onClick={() => addToCart(m)}
                  className={`p-3 rounded-xl text-left transition-colors ${inCart ? 'bg-amber-900 border border-amber-600' : 'bg-gray-800 hover:bg-gray-700'}`}>
                  <div className="font-bold text-sm">{m.name}</div>
                  <div className="text-xs text-gray-400">{m.cookTime}分</div>
                  {inCart && <div className="text-xs text-amber-400 font-bold mt-1">×{inCart.qty} 追加済</div>}
                </button>
              )
            })}
          </div>
        </div>

        {cart.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-3 mb-3">
            <div className="text-xs text-gray-400 mb-2">{selTable}卓への注文内容</div>
            {cart.map(c => (
              <div key={c.menu.id} className="flex items-center justify-between py-1.5 border-b border-gray-700 last:border-0">
                <span className="text-sm font-bold">{c.menu.name}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => removeFromCart(c.menu.id)}
                    className="w-7 h-7 bg-gray-700 rounded-lg text-white font-bold text-sm">−</button>
                  <span className="text-amber-400 font-bold w-6 text-center">{c.qty}</span>
                  <button onClick={() => addToCart(c.menu)}
                    className="w-7 h-7 bg-gray-700 rounded-lg text-white font-bold text-sm">＋</button>
                </div>
              </div>
            ))}
            <button onClick={submitCart}
              className="w-full mt-3 bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-xl text-sm">
              {selTable}卓に {cart.reduce((s, c) => s + c.qty, 0)}品 を注文する
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {tables.map(t => {
          const tableOrders = orders.filter(o => o.table === t)
          const pending = tableOrders.filter(o => o.status === 'pending')
          const cooking = tableOrders.filter(o => o.status === 'cooking')
          const served = tableOrders.filter(o => o.status === 'served')
          const hasActive = pending.length + cooking.length > 0
          const oldestWait = hasActive
            ? Math.floor((now - Math.min(...tableOrders.filter(o => o.status !== 'served').map(o => o.addedAt))) / 1000)
            : null
          const isDanger = oldestWait !== null && oldestWait >= settings.dangerThresholdSec
          const isWarn = oldestWait !== null && oldestWait >= settings.warningThresholdSec
          const isOpen = openTable === t

          return (
            <div key={t} className={`rounded-xl border transition-colors ${isDanger ? 'bg-red-950 border-red-700' : isWarn ? 'bg-amber-950 border-amber-800' : hasActive ? 'bg-gray-800 border-gray-700' : 'bg-gray-900 border-gray-800 opacity-50'}`}>
              <div className="flex items-center justify-between p-3 cursor-pointer" onClick={() => setOpenTable(isOpen ? null : t)}>
                <div>
                  <div className="font-bold text-base">{t}卓</div>
                  <div className="text-xs text-gray-400">{pending.length}待機 / {cooking.length}調理中 / {served.length}済</div>
                </div>
                <div className="text-right">
                  {oldestWait !== null && (
                    <div className={`text-lg font-black ${isDanger ? 'text-red-400' : isWarn ? 'text-amber-400' : 'text-green-400'}`}>
                      {formatWait(oldestWait)}
                    </div>
                  )}
                  <div className="text-xs text-gray-500">{isOpen ? '▲ 閉じる' : '▼ 詳細'}</div>
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-gray-700 p-3">
                  {tableOrders.length === 0 && <div className="text-xs text-gray-500 text-center py-2">注文なし</div>}
                  {tableOrders.map(o => (
                    <div key={o.id} className="flex items-center gap-2 py-2 border-b border-gray-700 last:border-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${o.status === 'pending' ? 'bg-amber-400' : o.status === 'cooking' ? 'bg-blue-400' : 'bg-green-400'}`} />
                      <div className="flex-1 text-sm">{o.menu.name}</div>
                      <div className="flex gap-1">
                        {o.status === 'pending' && (
                          <button onClick={() => setStatus(o.id, 'cooking')}
                            className="text-xs bg-blue-800 text-blue-300 px-2 py-1 rounded font-bold">開始</button>
                        )}
                        {o.status === 'cooking' && (
                          <button onClick={() => setStatus(o.id, 'served')}
                            className="text-xs bg-green-800 text-green-300 px-2 py-1 rounded font-bold">完了</button>
                        )}
                        {o.status === 'served' && (
                          <span className="text-xs text-gray-500 line-through">提供済</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {tableOrders.length > 0 && (
                    <button onClick={() => closeTable(t)}
                      className="w-full mt-2 bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-2 rounded-lg text-sm">
                      この卓をクリア
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}