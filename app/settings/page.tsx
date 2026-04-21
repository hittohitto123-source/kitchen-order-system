'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { ShopSettings } from '../../lib/types'
import { loadSettings, saveSettings } from '../../lib/storage'

export default function SettingsPage() {
  const [s, setS] = useState<ShopSettings | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setS(loadSettings()) }, [])

  if (!s) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">読み込み中...</div>

  const update = (patch: Partial<ShopSettings>) => setS(prev => prev ? { ...prev, ...patch } : prev)

  const handleSave = () => {
    if (s) { saveSettings(s); setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-amber-400">店舗設定</h1>
        <Link href="/kitchen" className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm font-bold">厨房へ</Link>
      </div>

      {/* 基本設定 */}
      <div className="bg-gray-900 rounded-xl p-4 mb-4">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">基本設定</h2>

        <div className="mb-4">
          <label className="text-xs text-gray-400 mb-1 block">
            卓数：<span className="text-amber-400 font-bold">{s.tableCount}卓</span>
          </label>
          <input type="range" min={2} max={20} step={1} value={s.tableCount}
            onChange={e => update({ tableCount: Number(e.target.value) })}
            className="w-full accent-amber-500" />
          <div className="flex justify-between text-xs text-gray-600 mt-1"><span>2卓</span><span>10卓</span><span>20卓</span></div>
        </div>

        <div className="mb-2">
          <label className="text-xs text-gray-400 mb-2 block">ワンオペモード</label>
          <button onClick={() => update({ oneOperatorMode: !s.oneOperatorMode })}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-colors ${s.oneOperatorMode ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300'}`}>
            {s.oneOperatorMode ? 'ワンオペモード ON（付きっきり料理を下げる）' : 'ワンオペモード OFF'}
          </button>
        </div>
      </div>

      {/* 設備設定 */}
      <div className="bg-gray-900 rounded-xl p-4 mb-4">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">設備設定</h2>

        {[
          { key: 'stoveSlots', label: 'コンロ口数', min: 1, max: 6 },
          { key: 'grillSlots', label: 'グリル枠数', min: 1, max: 6 },
        ].map(({ key, label, min, max }) => (
          <div key={key} className="mb-4">
            <label className="text-xs text-gray-400 mb-1 block">
              {label}：<span className="text-amber-400 font-bold">{s[key as keyof ShopSettings] as number}口</span>
            </label>
            <input type="range" min={min} max={max} step={1} value={s[key as keyof ShopSettings] as number}
              onChange={e => update({ [key]: Number(e.target.value) } as Partial<ShopSettings>)}
              className="w-full accent-amber-500" />
          </div>
        ))}

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-gray-400">フライヤー</label>
            <button onClick={() => update({ hasFryer: !s.hasFryer })}
              className={`px-3 py-1 rounded-lg text-xs font-bold ${s.hasFryer ? 'bg-green-800 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
              {s.hasFryer ? 'あり' : 'なし'}
            </button>
          </div>
          {s.hasFryer && (
            <input type="range" min={1} max={3} step={1} value={s.fryerSlots}
              onChange={e => update({ fryerSlots: Number(e.target.value) })}
              className="w-full accent-amber-500" />
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-gray-400">藁焼き設備</label>
            <button onClick={() => update({ hasStraw: !s.hasStraw })}
              className={`px-3 py-1 rounded-lg text-xs font-bold ${s.hasStraw ? 'bg-green-800 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
              {s.hasStraw ? 'あり' : 'なし'}
            </button>
          </div>
        </div>
      </div>

      {/* 遅延設定 */}
      <div className="bg-gray-900 rounded-xl p-4 mb-6">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">遅延アラート設定</h2>

        <div className="mb-4">
          <label className="text-xs text-gray-400 mb-1 block">
            注意（黄色）：<span className="text-amber-400 font-bold">{Math.floor(s.warningThresholdSec / 60)}分</span>で警告
          </label>
          <input type="range" min={60} max={600} step={30} value={s.warningThresholdSec}
            onChange={e => update({ warningThresholdSec: Number(e.target.value) })}
            className="w-full accent-amber-500" />
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">
            危険（赤）：<span className="text-red-400 font-bold">{Math.floor(s.dangerThresholdSec / 60)}分</span>で危険
          </label>
          <input type="range" min={120} max={900} step={30} value={s.dangerThresholdSec}
            onChange={e => update({ dangerThresholdSec: Number(e.target.value) })}
            className="w-full accent-amber-500" />
        </div>
      </div>

      <button onClick={handleSave}
        className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-4 rounded-xl text-lg transition-colors">
        {saved ? '✓ 保存しました！' : '設定を保存する'}
      </button>
    </div>
  )
}