'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { OrderItem, MenuItem, ShopSettings } from '../../lib/types'
import { loadOrders, saveOrders, loadMenu, loadSettings, saveSettings, loadNextId, saveNextId } from '../../lib/storage'
import { buildSchedule } from '../../lib/priorityEngine'

const EQUIP_LABEL: Record<string, string> = {
  cold: '冷菜', stove: 'コンロ', grill: 'グリル', fryer: 'フライヤー', straw: '藁焼き'
}

function formatWait(sec: number) {
  if (sec < 60) return `${sec}秒`
  const m = Math.floor(sec / 60); const s = sec % 60
  return s > 0 ? `${m}分${s}秒` : `${m}分`
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [menuList, setMenuList] = useState<MenuItem[]>([])
  const [settings, setSettings] = useState<ShopSettings | null>(null)
  const [now, setNow] = useState(Date.now())
  const [selTable, setSelTable] = useState('1')
  const [selMenu, setSelMenu] = useState('')

  useEffect(() => {
    const m = loadMenu().filter(m => m.active)
    setMenuList(m)
    if (m.length) setSelMenu(m[0].id)
    setOrders(loadOrders())
    setSettings(loadSettings())
  }, [])

  useEffect(() => {
    const t = setInterval(() => { setNow(Date.now()); setOrders(loadOrders()) }, 1000)
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

  const setStatus = (id: number, status: OrderItem['status']) => {
    commit(orders.map(o => o.id === id ? {
      ...o, status,
      startedAt: status === 'cooking' ? Date.now() : o.startedAt,
      servedAt: status === 'served' ? Date.now() : o.servedAt,
    } : o))
  }

  const toggleOneOp = () => {
    if (!settings) return
    const updated = { ...settings, oneOperatorMode: !settings.oneOperatorMode }
    setSettings(updated); saveSettings(updated)
  }

  if (!settings) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">読み込み中...</div>
  )

  const scheduled = buildSchedule(orders, settings, now)
  const cooking = orders.filter(o => o.status === 'cooking')
  const pending = orders.filter(o => o.status === 'pending')
  const dangerTables = new Set(
    orders.filter(o => o.status === 'pending' && (now - o.addedAt) / 1000 >= settings.dangerThresholdSec).map(o => o.table)
  )

  const getWaitSec = (table: number) => {
    const items = orders.filter(o => o.table === table && o.status !== 'served')
    if (!items.length) return null
    return Math.floor((now - Math.min(...items.map(o => o.addedAt))) / 1000)
  }

  const tables = Array.from({ length: settings.tableCount }, (_, i) => i + 1)

  return (
    <div className="min-h-screen bg-gray-950 text-white p-3">

      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-3">
        <h1 className="text-lg font-bold text-amber-400">厨房司令塔 PRO</h1>
        <div className="flex gap-2 items-center">
          <Link href="/orders" className="bg-gray-700 hover:bg-gray-600 text-white px-2 py-1.5 rounded-lg text-xs font-bold">注文管理</Link>
          <Link href="/menu" className="bg-gray-700 hover:bg-gray-600 text-white px-2 py-1.5 rounded-lg text-xs font-bold">メニュー</Link>
          <Link href="/settings" className="bg-gray-700 hover:bg-gray-600 text-white px-2 py-1.5 rounded-lg text-xs font-bold">設定</Link>
          <button onClick={toggleOneOp}
            className={`px-3 py-1.5 rounded-full text-xs font-bold ${settings.oneOperatorMode ? 'bg-amber-500 text-black' : 'bg-gray-700 text-white'}`}>
            {settings.oneOperatorMode ? 'ワンオペ中' : '通常'}
          </button>
        </div>
      </div>

      {/* 統計 */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="bg-gray-800 rounded-xl p-2 text-center">
          <div className="text-xl font-bold text-amber-400">{pending.length}</div>
          <div className="text-xs text-gray-400">待機</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-2 text-center">
          <div className="text-xl font-bold text-blue-400">{cooking.length}</div>
          <div className="text-xs text-gray-400">調理中</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-2 text-center">
          <div className="text-xl font-bold text-green-400">{orders.filter(o => o.status === 'served').length}</div>
          <div className="text-xs text-gray-400">提供済</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-2 text-center">
          <div className="text-xl font-bold text-red-400">{dangerTables.size}</div>
          <div className="text-xs text-gray-400">遅延卓</div>
        </div>
      </div>

      {/* 優先順位リスト */}
      <div className="bg-gray-900 rounded-xl p-3 mb-3">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">今やること（優先順位）</h2>
        {scheduled.length === 0 && cooking.length === 0 && (
          <p className="text-gray-500 text-center py-6 text-sm">注文がありません</p>
        )}
        {scheduled.map((o, i) => {
          const waitSec = Math.floor((now - o.addedAt) / 1000)
          const isDanger = waitSec >= settings.dangerThresholdSec
          const isWarn = waitSec >= settings.warningThresholdSec
          return (
            <div key={o.id}>
              {o.isBatchLeader && (
                <div className="flex items-center gap-2 mb-1 mt-1">
                  <span className="text-xs text-green-400 font-bold bg-green-950 border border-green-800 px-2 py-0.5 rounded-full">
                    ★ まとめて調理 {o.batchCount}件
                  </span>
                </div>
              )}
              <div className={`flex items-center gap-2 p-3 rounded-xl mb-1.5 ${
                o.batchCount > 1 ? 'border-l-4 border-l-green-500 ' : ''
              }${isDanger ? 'bg-red-950 border border-red-700' : isWarn ? 'bg-amber-950 border border-amber-700' : 'bg-gray-800'}`}>
                <div className={`text-xl font-black w-7 text-center flex-shrink-0 ${
                  isDanger ? 'text-red-400' : isWarn ? 'text-amber-400' : 'text-gray-500'
                }`}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold">{o.menu.name}</div>
                  <div className="flex gap-1.5 text-xs mt-0.5 flex-wrap">
                    <span className="text-amber-400 font-bold">{o.table}卓</span>
                    <span className="text-gray-400">{EQUIP_LABEL[o.menu.equip]}</span>
                    <span className="text-gray-500">{o.menu.cookTime}分</span>
                    {waitSec > 0 && <span className="text-gray-500">待機{formatWait(waitSec)}</span>}
                    {isDanger && <span className="text-red-400 font-bold animate-pulse">遅延!</span>}
                  </div>
                </div>
                <button onClick={() => setStatus(o.id, 'cooking')}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-xs font-bold flex-shrink-0">
                  開始
                </button>
              </div>
            </div>
          )
        })}
        {cooking.map(o => (
          <div key={o.id} className="flex items-center gap-2 p-3 rounded-xl mb-1.5 bg-blue-950 border border-blue-700">
            <div className="text-xl font-black w-7 text-center text-blue-400 flex-shrink-0">▶</div>
            <div className="flex-1">
              <div className="font-bold">{o.menu.name}</div>
              <div className="flex gap-1.5 text-xs mt-0.5">
                <span className="text-amber-400 font-bold">{o.table}卓</span>
                <span className="text-blue-400">調理中</span>
              </div>
            </div>
            <button onClick={() => setStatus(o.id, 'served')}
              className="bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-lg text-xs font-bold flex-shrink-0">
              完了
            </button>
          </div>
        ))}
      </div>

      {/* 注文追加 */}
      <div className="bg-gray-900 rounded-xl p-3 mb-3">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">注文追加</h2>
        <div className="flex gap-2 flex-wrap">
          <select value={selTable} onChange={e => setSelTable(e.target.value)}
            className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm">
            {tables.map(t => <option key={t} value={t}>{t}卓</option>)}
          </select>
          <select value={selMenu} onChange={e => setSelMenu(e.target.value)}
            className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm flex-1 min-w-0">
            {menuList.map(m => <option key={m.id} value={m.id}>{m.name}（{m.cookTime}分）</option>)}
          </select>
          <button onClick={addOrder}
            className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2 rounded-lg text-sm flex-shrink-0">
            ＋注文
          </button>
        </div>
      </div>

      {/* 卓一覧 */}
      <div className="bg-gray-900 rounded-xl p-3">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">卓一覧</h2>
        <div className="grid grid-cols-4 gap-2">
          {tables.map(t => {
            const ws = getWaitSec(t)
            const items = orders.filter(o => o.table === t)
            const isDanger = ws !== null && ws >= settings.dangerThresholdSec
            const isWarn = ws !== null && ws >= settings.warningThresholdSec
            return (
              <div key={t} onClick={() => setSelTable(String(t))}
                className={`p-2.5 rounded-xl cursor-pointer transition-colors ${
                  isDanger ? 'bg-red-950 border border-red-600' :
                  items.length ? 'bg-gray-800 border border-gray-600' :
                  'bg-gray-900 border border-gray-800 opacity-40'
                }`}>
                <div className="text-xs text-gray-400">{t}卓</div>
                {ws !== null && (
                  <div className={`text-base font-black leading-tight ${
                    isDanger ? 'text-red-400' : isWarn ? 'text-amber-400' : 'text-green-400'
                  }`}>{formatWait(ws)}</div>
                )}
                {isDanger && <div className="text-xs text-red-400 font-bold animate-pulse">遅延!</div>}
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}