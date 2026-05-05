'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { ShopSettings, TableConfig } from '../../lib/types'
import { DEFAULT_TABLE_CONFIGS } from '../../lib/types'
import { loadSettings, saveSettings } from '../../lib/storage'

export default function SettingsPage() {
  const [settings, setSettings] = useState<ShopSettings | null>(null)
  const [saved, setSaved] = useState(false)

  // テーブル設定の編集用
  const [editingConfigs, setEditingConfigs] = useState<TableConfig[]>([])
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'counter' | 'table'>('counter')

  useEffect(() => {
    const s = loadSettings()
    setSettings(s)
    setEditingConfigs(s.tableConfigs || DEFAULT_TABLE_CONFIGS)
  }, [])

  const update = (key: keyof ShopSettings, value: any) => {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
  }

  const handleSave = () => {
    if (!settings) return
    const updated = { ...settings, tableConfigs: editingConfigs }
    saveSettings(updated)
    setSettings(updated)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const addTable = () => {
    const name = newName.trim()
    if (!name) return
    const id = `${newType === 'counter' ? 'c' : 't'}${Date.now()}`
    setEditingConfigs([...editingConfigs, { id, name, type: newType }])
    setNewName('')
  }

  const removeTable = (id: string) => {
    setEditingConfigs(editingConfigs.filter(c => c.id !== id))
  }

  const moveTable = (id: string, dir: 'up' | 'down') => {
    const idx = editingConfigs.findIndex(c => c.id === id)
    if (idx < 0) return
    const newConfigs = [...editingConfigs]
    const target = dir === 'up' ? idx - 1 : idx + 1
    if (target < 0 || target >= newConfigs.length) return
    const tmp = newConfigs[idx]
    newConfigs[idx] = newConfigs[target]
    newConfigs[target] = tmp
    setEditingConfigs(newConfigs)
  }

  const resetTableConfigs = () => {
    setEditingConfigs(DEFAULT_TABLE_CONFIGS)
  }

  if (!settings) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
      読み込み中...
    </div>
  )

  const counterConfigs = editingConfigs.filter(c => c.type === 'counter')
  const tableConfigs = editingConfigs.filter(c => c.type === 'table')

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-24" style={{ fontFamily: 'system-ui,sans-serif' }}>
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-black text-amber-400">設定</h1>
        <button onClick={handleSave}
          className={`px-5 py-2 rounded-xl font-black text-sm transition-all ${saved ? 'bg-green-600 text-white' : 'bg-amber-500 text-black'}`}>
          {saved ? '保存しました！' : '保存する'}
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4">

        {/* ━━━ 卓・席の設定 ━━━ */}
        <div className="bg-gray-900 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-black text-amber-400">卓・席の設定</h2>
            <button onClick={resetTableConfigs}
              className="text-xs text-gray-400 bg-gray-800 px-3 py-1.5 rounded-lg">
              デフォルトに戻す
            </button>
          </div>

          {/* カウンター席 */}
          <div className="mb-4">
            <div className="text-sm font-bold text-blue-400 mb-2">
              カウンター席（{counterConfigs.length}席）
              <span className="text-xs text-gray-500 ml-2">※複数選択して注文可能</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {counterConfigs.map(c => (
                <div key={c.id} className="flex items-center gap-1 bg-gray-800 border border-gray-700 px-2 py-1 rounded-lg">
                  <button onClick={() => moveTable(c.id, 'up')} className="text-gray-500 text-xs px-1">↑</button>
                  <span className="text-white font-bold text-sm">{c.name}</span>
                  <button onClick={() => moveTable(c.id, 'down')} className="text-gray-500 text-xs px-1">↓</button>
                  <button onClick={() => removeTable(c.id)} className="text-red-400 text-xs ml-1 font-black">×</button>
                </div>
              ))}
            </div>
          </div>

          {/* テーブル席 */}
          <div className="mb-4">
            <div className="text-sm font-bold text-green-400 mb-2">
              テーブル席（{tableConfigs.length}卓）
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {tableConfigs.map(c => (
                <div key={c.id} className="flex items-center gap-1 bg-gray-800 border border-gray-700 px-2 py-1 rounded-lg">
                  <button onClick={() => moveTable(c.id, 'up')} className="text-gray-500 text-xs px-1">↑</button>
                  <span className="text-white font-bold text-sm">{c.name}</span>
                  <button onClick={() => moveTable(c.id, 'down')} className="text-gray-500 text-xs px-1">↓</button>
                  <button onClick={() => removeTable(c.id)} className="text-red-400 text-xs ml-1 font-black">×</button>
                </div>
              ))}
            </div>
          </div>

          {/* 追加フォーム */}
          <div className="border-t border-gray-800 pt-3">
            <div className="text-xs text-gray-400 mb-2">新しい席を追加</div>
            <div className="flex gap-2">
              <select
                value={newType}
                onChange={e => setNewType(e.target.value as 'counter' | 'table')}
                className="bg-gray-800 text-white text-sm rounded-xl px-3 py-2 border border-gray-700">
                <option value="counter">カウンター</option>
                <option value="table">テーブル</option>
              </select>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="席名（例：C9、E）"
                className="flex-1 bg-gray-800 text-white text-sm rounded-xl px-3 py-2 border border-gray-700"
              />
              <button onClick={addTable}
                className="bg-amber-500 text-black font-black px-4 py-2 rounded-xl text-sm active:scale-95">
                追加
              </button>
            </div>
          </div>
        </div>

        {/* ━━━ 警告・遅延の設定 ━━━ */}
        <div className="bg-gray-900 rounded-2xl p-4">
          <h2 className="font-black text-amber-400 mb-4">警告・遅延の設定</h2>

          <div className="flex flex-col gap-4">
            <div>
              <div className="text-sm text-gray-400 mb-1">黄色警告（分）</div>
              <div className="flex items-center gap-3">
                {[3, 5, 7, 10].map(m => (
                  <button key={m} onClick={() => update('warningThresholdSec', m * 60)}
                    className={`px-4 py-2 rounded-xl font-black text-sm ${settings.warningThresholdSec === m * 60 ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300'}`}>
                    {m}分
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-400 mb-1">赤色遅延（分）</div>
              <div className="flex items-center gap-3">
                {[8, 10, 12, 15].map(m => (
                  <button key={m} onClick={() => update('dangerThresholdSec', m * 60)}
                    className={`px-4 py-2 rounded-xl font-black text-sm ${settings.dangerThresholdSec === m * 60 ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300'}`}>
                    {m}分
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ━━━ 設備の設定 ━━━ */}
        <div className="bg-gray-900 rounded-2xl p-4">
          <h2 className="font-black text-amber-400 mb-4">設備の設定</h2>

          <div className="flex flex-col gap-4">
            <div>
              <div className="text-sm text-gray-400 mb-1">コンロ口数</div>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <button key={n} onClick={() => update('stoveSlots', n)}
                    className={`w-10 h-10 rounded-xl font-black ${settings.stoveSlots === n ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-400 mb-1">グリル口数</div>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <button key={n} onClick={() => update('grillSlots', n)}
                    className={`w-10 h-10 rounded-xl font-black ${settings.grillSlots === n ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold">フライヤー</div>
                <div className="text-xs text-gray-400">フライヤーを使用する</div>
              </div>
              <button onClick={() => update('hasFryer', !settings.hasFryer)}
                className={`px-4 py-2 rounded-xl font-black text-sm ${settings.hasFryer ? 'bg-amber-500 text-black' : 'bg-gray-700 text-gray-400'}`}>
                {settings.hasFryer ? 'あり' : 'なし'}
              </button>
            </div>

            {settings.hasFryer && (
              <div>
                <div className="text-sm text-gray-400 mb-1">フライヤー口数</div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map(n => (
                    <button key={n} onClick={() => update('fryerSlots', n)}
                      className={`w-10 h-10 rounded-xl font-black ${settings.fryerSlots === n ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold">藁焼き台</div>
                <div className="text-xs text-gray-400">藁焼き台を使用する</div>
              </div>
              <button onClick={() => update('hasStraw', !settings.hasStraw)}
                className={`px-4 py-2 rounded-xl font-black text-sm ${settings.hasStraw ? 'bg-amber-500 text-black' : 'bg-gray-700 text-gray-400'}`}>
                {settings.hasStraw ? 'あり' : 'なし'}
              </button>
            </div>
          </div>
        </div>

        {/* ━━━ モード設定 ━━━ */}
        <div className="bg-gray-900 rounded-2xl p-4">
          <h2 className="font-black text-amber-400 mb-4">モード設定</h2>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold">ワンオペモード</div>
                <div className="text-xs text-gray-400">一人で調理する場合に最適化</div>
              </div>
              <button onClick={() => update('oneOperatorMode', !settings.oneOperatorMode)}
                className={`px-4 py-2 rounded-xl font-black text-sm ${settings.oneOperatorMode ? 'bg-amber-500 text-black' : 'bg-gray-700 text-gray-400'}`}>
                {settings.oneOperatorMode ? 'ON' : 'OFF'}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold">遅延アラート音</div>
                <div className="text-xs text-gray-400">遅延時に音で知らせる</div>
              </div>
              <button onClick={() => update('soundAlert', !settings.soundAlert)}
                className={`px-4 py-2 rounded-xl font-black text-sm ${settings.soundAlert ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
                {settings.soundAlert ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>

        <button onClick={handleSave}
          className={`w-full py-5 rounded-2xl font-black text-xl transition-all ${saved ? 'bg-green-600 text-white' : 'bg-amber-500 text-black'}`}>
          {saved ? '保存しました！' : '設定を保存する'}
        </button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex">
        <Link href="/kitchen" className="flex-1 py-3 text-center text-xs text-gray-400 font-bold">厨房</Link>
        <Link href="/orders" className="flex-1 py-3 text-center text-xs text-gray-400 font-bold">注文</Link>
        <Link href="/menu" className="flex-1 py-3 text-center text-xs text-gray-400 font-bold">メニュー</Link>
        <Link href="/settings" className="flex-1 py-3 text-center text-xs text-amber-400 font-bold border-t-2 border-amber-400">設定</Link>
        <Link href="/analytics" className="flex-1 py-3 text-center text-xs text-gray-400 font-bold">分析</Link>
      </div>
    </div>
  )
}