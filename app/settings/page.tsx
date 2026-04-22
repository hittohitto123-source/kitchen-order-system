'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { ShopSettings } from '../../lib/types'
import { loadSettings, saveSettings } from '../../lib/storage'

export default function SettingsPage() {
  const [s, setS] = useState<ShopSettings | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setS(loadSettings()) }, [])

  if (!s) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
      <div className="text-amber-400 font-bold text-2xl">KitchenQ</div>
    </div>
  )

  const update = (patch: Partial<ShopSettings>) => setS(prev => prev ? { ...prev, ...patch } : prev)

  const handleSave = () => {
    if (s) { saveSettings(s); setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-24" style={{fontFamily:'system-ui,sans-serif'}}>

      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <Link href="/kitchen" className="text-gray-400 text-2xl font-bold">←</Link>
        <h1 className="text-lg font-bold text-amber-400">店舗設定</h1>
        <div className="w-8" />
      </div>

      <div className="p-4 flex flex-col gap-4">

        {/* 卓数 */}
        <div className="bg-gray-900 rounded-2xl p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">卓数</div>
          <div className="text-center mb-3">
            <span className="text-5xl font-black text-amber-400">{s.tableCount}</span>
            <span className="text-xl text-gray-400 ml-2">卓</span>
          </div>
          <div className="grid grid-cols-5 gap-2 mb-3">
            {[2,4,6,8,10,12,15,18,20].map(v => (
              <button key={v} onClick={() => update({ tableCount: v })}
                className={`py-3 rounded-xl font-black text-lg transition-all active:scale-95 ${
                  s.tableCount === v ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300'
                }`}>
                {v}
              </button>
            ))}
          </div>
          <input type="range" min={2} max={20} step={1} value={s.tableCount}
            onChange={e => update({ tableCount: Number(e.target.value) })}
            className="w-full accent-amber-500" />
        </div>

        {/* ワンオペモード */}
        <div className="bg-gray-900 rounded-2xl p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">営業モード</div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => update({ oneOperatorMode: false })}
              className={`py-5 rounded-2xl font-bold text-base transition-all active:scale-95 ${
                !s.oneOperatorMode ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300'
              }`}>
              通常モード
            </button>
            <button onClick={() => update({ oneOperatorMode: true })}
              className={`py-5 rounded-2xl font-bold text-base transition-all active:scale-95 ${
                s.oneOperatorMode ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300'
              }`}>
              ワンオペ
            </button>
          </div>
          {s.oneOperatorMode && (
            <div className="mt-3 bg-amber-900 text-amber-200 text-xs p-3 rounded-xl text-center">
              付きっきり料理を下げ・冷菜と放置可能料理を優先します
            </div>
          )}
        </div>

        {/* 遅延アラート */}
        <div className="bg-gray-900 rounded-2xl p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-4">遅延アラート設定</div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-amber-400">注意（黄色）</span>
              <span className="text-xl font-black text-amber-400">{Math.floor(s.warningThresholdSec / 60)}分</span>
            </div>
            <div className="grid grid-cols-5 gap-2 mb-2">
              {[2,3,4,5,6].map(v => (
                <button key={v} onClick={() => update({ warningThresholdSec: v * 60 })}
                  className={`py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                    s.warningThresholdSec === v * 60 ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300'
                  }`}>
                  {v}分
                </button>
              ))}
            </div>
            <input type="range" min={60} max={600} step={30} value={s.warningThresholdSec}
              onChange={e => update({ warningThresholdSec: Number(e.target.value) })}
              className="w-full accent-amber-500" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-red-400">危険（赤）</span>
              <span className="text-xl font-black text-red-400">{Math.floor(s.dangerThresholdSec / 60)}分</span>
            </div>
            <div className="grid grid-cols-5 gap-2 mb-2">
              {[5,6,7,8,10].map(v => (
                <button key={v} onClick={() => update({ dangerThresholdSec: v * 60 })}
                  className={`py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                    s.dangerThresholdSec === v * 60 ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300'
                  }`}>
                  {v}分
                </button>
              ))}
            </div>
            <input type="range" min={120} max={900} step={30} value={s.dangerThresholdSec}
              onChange={e => update({ dangerThresholdSec: Number(e.target.value) })}
              className="w-full accent-red-500" />
          </div>
        </div>

        {/* 設備設定 */}
        <div className="bg-gray-900 rounded-2xl p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-4">設備設定</div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold">コンロ口数</span>
              <span className="text-xl font-black text-amber-400">{s.stoveSlots}口</span>
            </div>
            <div className="flex gap-2">
              {[1,2,3,4,5,6].map(v => (
                <button key={v} onClick={() => update({ stoveSlots: v })}
                  className={`flex-1 py-3 rounded-xl font-black text-lg transition-all active:scale-95 ${
                    s.stoveSlots === v ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-400'
                  }`}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold">グリル枠数</span>
              <span className="text-xl font-black text-amber-400">{s.grillSlots}枠</span>
            </div>
            <div className="flex gap-2">
              {[1,2,3,4,5,6].map(v => (
                <button key={v} onClick={() => update({ grillSlots: v })}
                  className={`flex-1 py-3 rounded-xl font-black text-lg transition-all active:scale-95 ${
                    s.grillSlots === v ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-400'
                  }`}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold">フライヤー</span>
            <div className="flex gap-2">
              <button onClick={() => update({ hasFryer: false })}
                className={`px-5 py-2 rounded-xl font-bold text-sm ${!s.hasFryer ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300'}`}>
                なし
              </button>
              <button onClick={() => update({ hasFryer: true })}
                className={`px-5 py-2 rounded-xl font-bold text-sm ${s.hasFryer ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300'}`}>
                あり
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">藁焼き設備</span>
            <div className="flex gap-2">
              <button onClick={() => update({ hasStraw: false })}
                className={`px-5 py-2 rounded-xl font-bold text-sm ${!s.hasStraw ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300'}`}>
                なし
              </button>
              <button onClick={() => update({ hasStraw: true })}
                className={`px-5 py-2 rounded-xl font-bold text-sm ${s.hasStraw ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300'}`}>
                あり
              </button>
            </div>
          </div>
        </div>

        {/* 保存ボタン */}
        <button onClick={handleSave}
          className="w-full bg-amber-500 hover:bg-amber-400 active:scale-98 text-black font-black py-5 rounded-2xl text-xl transition-all">
          {saved ? '✓ 保存しました！' : '設定を保存する'}
        </button>

        {/* 設備管理へのリンク */}
        <Link href="/equipment"
          className="w-full bg-gray-800 text-white font-bold py-4 rounded-2xl text-center block text-sm">
          設備管理画面へ
        </Link>
      </div>

      {/* 底部ナビ */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex">
        <Link href="/kitchen" className="flex-1 py-4 text-center text-xs text-gray-400 font-bold">厨房</Link>
        <Link href="/orders" className="flex-1 py-4 text-center text-xs text-gray-400 font-bold">注文</Link>
        <Link href="/menu" className="flex-1 py-4 text-center text-xs text-gray-400 font-bold">メニュー</Link>
        <Link href="/analytics" className="flex-1 py-4 text-center text-xs text-gray-400 font-bold">分析</Link>
      </div>
    </div>
  )
}