'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

interface AnalyticsLog {
  id: number
  menu_id: string
  menu_name: string
  menu_equip: string
  table_number: number
  cook_time_actual: number | null
  served_at: string
}

const EQUIP_LABEL: Record<string, string> = {
  cold: '冷菜', stove: 'コンロ', grill: 'グリル', fryer: 'フライヤー', straw: '藁焼き'
}

export default function AnalyticsPage() {
  const [logs, setLogs] = useState<AnalyticsLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('analytics_logs')
      .select('*')
      .eq('tenant_id', 'default')
      .order('served_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setLogs(data ?? [])
        setLoading(false)
      })
  }, [])

  const menuRanking = Object.values(
    logs.reduce((acc, log) => {
      if (!acc[log.menu_id]) acc[log.menu_id] = { name: log.menu_name, equip: log.menu_equip, count: 0, totalTime: 0, timeCount: 0 }
      acc[log.menu_id].count++
      if (log.cook_time_actual) { acc[log.menu_id].totalTime += log.cook_time_actual; acc[log.menu_id].timeCount++ }
      return acc
    }, {} as Record<string, { name: string; equip: string; count: number; totalTime: number; timeCount: number }>)
  ).sort((a, b) => b.count - a.count)

  const equipStats = Object.values(
    logs.reduce((acc, log) => {
      if (!acc[log.menu_equip]) acc[log.menu_equip] = { equip: log.menu_equip, count: 0 }
      acc[log.menu_equip].count++
      return acc
    }, {} as Record<string, { equip: string; count: number }>)
  ).sort((a, b) => b.count - a.count)

  const hourStats = logs.reduce((acc, log) => {
    const hour = new Date(log.served_at).getHours()
    acc[hour] = (acc[hour] || 0) + 1
    return acc
  }, {} as Record<number, number>)

  const peakHour = Object.entries(hourStats).sort((a, b) => b[1] - a[1])[0]

  const avgCookTime = logs.filter(l => l.cook_time_actual).length > 0
    ? Math.round(logs.filter(l => l.cook_time_actual).reduce((s, l) => s + (l.cook_time_actual ?? 0), 0) / logs.filter(l => l.cook_time_actual).length)
    : 0

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">読み込み中...</div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-amber-400">分析レポート</h1>
        <Link href="/kitchen" className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm font-bold">厨房へ</Link>
      </div>

      {logs.length === 0 ? (
        <div className="bg-gray-900 rounded-xl p-8 text-center">
          <div className="text-gray-400 text-sm">データがまだありません</div>
          <div className="text-gray-600 text-xs mt-2">注文を完了すると分析データが蓄積されます</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-gray-800 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-amber-400">{logs.length}</div>
              <div className="text-xs text-gray-400">総提供数</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-blue-400">{avgCookTime}秒</div>
              <div className="text-xs text-gray-400">平均調理時間</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-green-400">{peakHour ? `${peakHour[0]}時` : '-'}</div>
              <div className="text-xs text-gray-400">ピーク時間帯</div>
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl p-4 mb-4">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">人気メニューランキング</h2>
            {menuRanking.slice(0, 10).map((item, i) => (
              <div key={item.name} className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0">
                <div className={`text-lg font-black w-7 text-center ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-700' : 'text-gray-600'}`}>
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm">{item.name}</div>
                  <div className="text-xs text-gray-400">
                    {EQUIP_LABEL[item.equip]}
                    {item.timeCount > 0 && ` · 平均${Math.round(item.totalTime / item.timeCount)}秒`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-amber-400">{item.count}件</div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gray-900 rounded-xl p-4 mb-4">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">設備別使用頻度</h2>
            {equipStats.map(item => (
              <div key={item.equip} className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-bold">{EQUIP_LABEL[item.equip]}</span>
                  <span className="text-amber-400">{item.count}件</span>
                </div>
                <div className="bg-gray-800 rounded-full h-2">
                  <div className="bg-amber-500 h-2 rounded-full"
                    style={{ width: `${Math.round(item.count / logs.length * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gray-900 rounded-xl p-4">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">時間帯別提供数</h2>
            <div className="flex items-end gap-1 h-24">
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="flex-1 flex flex-col items-center justify-end">
                  <div className="w-full bg-amber-500 rounded-sm"
                    style={{ height: `${hourStats[h] ? Math.round(hourStats[h] / Math.max(...Object.values(hourStats)) * 80) : 0}px` }} />
                  {h % 6 === 0 && <div className="text-xs text-gray-600 mt-1">{h}</div>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}