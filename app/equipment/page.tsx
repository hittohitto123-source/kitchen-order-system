'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Equipment, EquipType } from '../../lib/types'
import { loadEquipment, saveEquipment } from '../../lib/storage'

const EQUIP_OPTIONS: { value: EquipType; label: string }[] = [
  { value: 'cold',  label: '冷菜（火不要）' },
  { value: 'stove', label: 'コンロ' },
  { value: 'grill', label: 'グリル' },
  { value: 'fryer', label: 'フライヤー' },
  { value: 'straw', label: '藁焼き' },
]

const EMPTY = { name: '', type: 'stove' as EquipType, slots: 1 }

export default function EquipmentPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setEquipment(loadEquipment()) }, [])

  const commit = (updated: Equipment[]) => { setEquipment(updated); saveEquipment(updated) }

  const handleSave = () => {
    if (!form.name.trim()) return
    const updated = editId
      ? equipment.map(e => e.id === editId ? { ...e, ...form } : e)
      : [...equipment, { id: 'e' + Date.now(), ...form, active: true }]
    commit(updated)
    setForm(EMPTY); setEditId(null)
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-amber-400">設備管理</h1>
        <div className="flex gap-2">
          <Link href="/settings" className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm font-bold">店舗設定</Link>
          <Link href="/kitchen" className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm font-bold">厨房へ</Link>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl p-4 mb-6">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
          {editId ? '設備を編集' : '新しい設備を追加'}
        </h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">設備名</label>
            <input type="text" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="例：コンロ4"
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:border-amber-500 outline-none" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-2 block">設備の種類</label>
            <div className="grid grid-cols-3 gap-2">
              {EQUIP_OPTIONS.map(opt => (
                <button key={opt.value}
                  onClick={() => setForm(f => ({ ...f, type: opt.value }))}
                  className={`py-2 px-3 rounded-lg text-sm font-bold transition-colors ${form.type === opt.value ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">
              同時使用枠数：<span className="text-amber-400 font-bold">{form.slots}枠</span>
            </label>
            <input type="range" min={1} max={6} step={1} value={form.slots}
              onChange={e => setForm(f => ({ ...f, slots: Number(e.target.value) }))}
              className="w-full accent-amber-500" />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>1枠</span><span>3枠</span><span>6枠</span>
            </div>
          </div>
          <div className="flex gap-2 mt-1">
            <button onClick={handleSave}
              className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-xl text-sm">
              {saved ? '保存しました！' : editId ? '更新する' : '追加する'}
            </button>
            {editId && (
              <button onClick={() => { setEditId(null); setForm(EMPTY) }}
                className="bg-gray-700 text-white font-bold py-3 px-4 rounded-xl text-sm">
                キャンセル
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl p-4">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
          登録設備（{equipment.filter(e => e.active).length}台 有効）
        </h2>
        {equipment.length === 0 && (
          <p className="text-gray-500 text-center py-8">設備がありません</p>
        )}
        {equipment.map(item => (
          <div key={item.id}
            className={`flex items-center gap-3 p-3 rounded-xl mb-2 border ${item.active ? 'bg-gray-800 border-gray-700' : 'bg-gray-900 border-gray-800 opacity-40'}`}>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold">{item.name}</span>
                <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                  {EQUIP_OPTIONS.find(e => e.value === item.type)?.label}
                </span>
                <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                  {item.slots}枠
                </span>
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => commit(equipment.map(e => e.id === item.id ? { ...e, active: !e.active } : e))}
                className={`text-xs px-2 py-1 rounded-lg font-bold ${item.active ? 'bg-green-800 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                {item.active ? '有効' : '無効'}
              </button>
              <button onClick={() => { setEditId(item.id); setForm({ name: item.name, type: item.type, slots: item.slots }) }}
                className="text-xs px-2 py-1 rounded-lg font-bold bg-blue-800 text-blue-300">編集</button>
              <button onClick={() => commit(equipment.filter(e => e.id !== item.id))}
                className="text-xs px-2 py-1 rounded-lg font-bold bg-red-900 text-red-300">削除</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}