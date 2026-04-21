'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { ShopSettings } from '../../lib/types'
import { loadSettings, saveSettings } from '../../lib/storage'

export default function SettingsPage() {
  const [s, setS] = useState<ShopSettings | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setS(loadSettings()) }, [])

  if (!s) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">隱ｭ縺ｿ霎ｼ縺ｿ荳ｭ...</div>

  const update = (patch: Partial<ShopSettings>) => setS(prev => prev ? { ...prev, ...patch } : prev)

  const handleSave = () => {
    if (s) { saveSettings(s); setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-amber-400">蠎苓・險ｭ螳・/h1>
        <Link href="/kitchen" className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm font-bold">蜴ｨ謌ｿ縺ｸ</Link>
      </div>

      {/* 蝓ｺ譛ｬ險ｭ螳・*/}
      <div className="bg-gray-900 rounded-xl p-4 mb-4">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">蝓ｺ譛ｬ險ｭ螳・/h2>

        <div className="mb-4">
          <label className="text-xs text-gray-400 mb-1 block">
            蜊捺焚・・span className="text-amber-400 font-bold">{s.tableCount}蜊・/span>
          </label>
          <input type="range" min={2} max={20} step={1} value={s.tableCount}
            onChange={e => update({ tableCount: Number(e.target.value) })}
            className="w-full accent-amber-500" />
          <div className="flex justify-between text-xs text-gray-600 mt-1"><span>2蜊・/span><span>10蜊・/span><span>20蜊・/span></div>
        </div>

        <div className="mb-2">
          <label className="text-xs text-gray-400 mb-2 block">繝ｯ繝ｳ繧ｪ繝壹Δ繝ｼ繝・/label>
          <button onClick={() => update({ oneOperatorMode: !s.oneOperatorMode })}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-colors ${s.oneOperatorMode ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300'}`}>
            {s.oneOperatorMode ? '繝ｯ繝ｳ繧ｪ繝壹Δ繝ｼ繝・ON・井ｻ倥″縺｣縺阪ｊ譁咏炊繧剃ｸ九￡繧具ｼ・ : '繝ｯ繝ｳ繧ｪ繝壹Δ繝ｼ繝・OFF'}
          </button>
        </div>
      </div>

      {/* 險ｭ蛯呵ｨｭ螳・*/}
      <div className="bg-gray-900 rounded-xl p-4 mb-4">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">險ｭ蛯呵ｨｭ螳・/h2>

        {[
          { key: 'stoveSlots', label: '繧ｳ繝ｳ繝ｭ蜿｣謨ｰ', min: 1, max: 6 },
          { key: 'grillSlots', label: '繧ｰ繝ｪ繝ｫ譫謨ｰ', min: 1, max: 6 },
        ].map(({ key, label, min, max }) => (
          <div key={key} className="mb-4">
            <label className="text-xs text-gray-400 mb-1 block">
              {label}・・span className="text-amber-400 font-bold">{s[key as keyof ShopSettings] as number}蜿｣</span>
            </label>
            <input type="range" min={min} max={max} step={1} value={s[key as keyof ShopSettings] as number}
              onChange={e => update({ [key]: Number(e.target.value) } as Partial<ShopSettings>)}
              className="w-full accent-amber-500" />
          </div>
        ))}

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-gray-400">繝輔Λ繧､繝､繝ｼ</label>
            <button onClick={() => update({ hasFryer: !s.hasFryer })}
              className={`px-3 py-1 rounded-lg text-xs font-bold ${s.hasFryer ? 'bg-green-800 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
              {s.hasFryer ? '縺ゅｊ' : '縺ｪ縺・}
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
            <label className="text-xs text-gray-400">阯∫┥縺崎ｨｭ蛯・/label>
            <button onClick={() => update({ hasStraw: !s.hasStraw })}
              className={`px-3 py-1 rounded-lg text-xs font-bold ${s.hasStraw ? 'bg-green-800 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
              {s.hasStraw ? '縺ゅｊ' : '縺ｪ縺・}
            </button>
          </div>
        </div>
      </div>

      {/* 驕・ｻｶ險ｭ螳・*/}
      <div className="bg-gray-900 rounded-xl p-4 mb-6">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">驕・ｻｶ繧｢繝ｩ繝ｼ繝郁ｨｭ螳・/h2>

        <div className="mb-4">
          <label className="text-xs text-gray-400 mb-1 block">
            豕ｨ諢擾ｼ磯ｻ・牡・会ｼ・span className="text-amber-400 font-bold">{Math.floor(s.warningThresholdSec / 60)}蛻・/span>縺ｧ隴ｦ蜻・
          </label>
          <input type="range" min={60} max={600} step={30} value={s.warningThresholdSec}
            onChange={e => update({ warningThresholdSec: Number(e.target.value) })}
            className="w-full accent-amber-500" />
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">
            蜊ｱ髯ｺ・郁ｵ､・会ｼ・span className="text-red-400 font-bold">{Math.floor(s.dangerThresholdSec / 60)}蛻・/span>縺ｧ蜊ｱ髯ｺ
          </label>
          <input type="range" min={120} max={900} step={30} value={s.dangerThresholdSec}
            onChange={e => update({ dangerThresholdSec: Number(e.target.value) })}
            className="w-full accent-amber-500" />
        </div>
      </div>

      <button onClick={handleSave}
        className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-4 rounded-xl text-lg transition-colors">
        {saved ? '笨・菫晏ｭ倥＠縺ｾ縺励◆・・ : '險ｭ螳壹ｒ菫晏ｭ倥☆繧・}
      </button>
    </div>
  )
}
