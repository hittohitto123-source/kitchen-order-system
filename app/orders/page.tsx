'use client'

import { useState, useEffect, useCallback } from 'react'
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
  const [selMenu, setSelMenu] = useState('')
  const [openTable, setOpenTable] = useState<number | null>(null)

  useEffect(() => {
    const m = loadMenu().filter(m => m.active)
    setMenuList(m)
    if (m.length) setSelMenu(m[0].id)
    setOrders(loadOrders())
    setTableCount(loadSettings().tableCount)
  }, [])

  useEffect(() => {
    const t = setInterval(() => { setNow(Date.now()); setOrders(loadOrders()) }, 3000)
    return () => clearInterval(t)
  }, [])

  const commit = (updated: OrderItem[]) => { setOrders(updated); saveOrders(updated) }

  const addOrder = (table: number) => {
    const menu = menuList.find(m => m.id === selMenu)
    if (!menu) return
    const id = loadNextId()
    commit([...orders, { id, table, menu, status: 'pending', addedAt: Date.now() }])
    saveNextId(id + 1)
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

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold text-amber-400">注文管理</h1>
        <Link href="/kitchen" className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm font-bold">厨房へ</Link>
      </div>

      {/* メニュー選択（共通） */}
      <div className="bg-gray-900 rounded-xl p-3 mb-4">
        <div className="text-xs text-gray-400 mb-2">追加するメニューを選択</div>
        <select value={selMenu} onChange={e => setSelMenu(e.target.value)}
          className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm">
          {menuList.map(m => (
            <option key={m.id} value={m.id}>{m.name}（{m.cookTime}分・{['冷菜','コンロ','グリル','フライヤー','藁焼き'][['cold','stove','grill','fryer','straw'].indexOf(m.equip)]}）</option>
          ))}
        </select>
      </div>

      {/* 卓グリッド */}
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
          const isDanger = oldestWait !== null && oldestWait >= loadSettings().dangerThresholdSec
          const isWarn = oldestWait !== null && oldestWait >= loadSettings().warningThresholdSec
          const isOpen = openTable === t

          return (
            <div key={t} className={`rounded-xl border transition-colors ${
              isDanger ? 'bg-red-950 border-red-700' : isWarn ? 'bg-amber-950 border-amber-800' : hasActive ? 'bg-gray-800 border-gray-700' : 'bg-gray-900 border-gray-800 opacity-50'
            }`}>
              {/* 卓ヘッダー */}
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

              {/* 展開時の詳細 */}
              {isOpen && (
                <div className="border-t border-gray-700 p-3">
                  {/* 注文一覧 */}
                  {tableOrders.length === 0 && <div className="text-xs text-gray-500 text-center py-2">注文なし</div>}
                  {tableOrders.map(o => (
                    <div key={o.id} className={`flex items-center gap-2 py-2 border-b border-gray-700 last:border-0`}>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        o.status === 'pending' ? 'bg-amber-400' : o.status === 'cooking' ? 'bg-blue-400' : 'bg-green-400'
                      }`} />
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

                  {/* 注文追加 */}
                  <button onClick={() => addOrder(t)}
                    className="w-full mt-3 bg-amber-500 hover:bg-amber-400 text-black font-bold py-2 rounded-lg text-sm">
                    ＋ この卓に追加
                  </button>

                  {/* テーブルクローズ */}
                  {tableOrders.length > 0 && (
                    <button onClick={() => closeTable(t)}
                      className="w-full mt-2 bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-2 rounded-lg text-sm">
                      この卓の注文をすべてクリア
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