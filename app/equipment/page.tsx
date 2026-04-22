'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Equipment, EquipType } from '../../lib/types'
import { saveEquipment, loadEquipmentFromDB } from '../../lib/storage'

const EQUIP_OPTIONS: { value: EquipType; label: string; color: string }[] = [
  { value: 'cold',  label: '蜀ｷ闖懶ｼ育↓荳崎ｦ・ｼ・, color: 'bg-blue-900 border-blue-600 text-blue-300' },
  { value: 'stove', label: '繧ｳ繝ｳ繝ｭ',         color: 'bg-orange-900 border-orange-600 text-orange-300' },
  { value: 'grill', label: '繧ｰ繝ｪ繝ｫ',         color: 'bg-purple-900 border-purple-600 text-purple-300' },
  { value: 'fryer', label: '繝輔Λ繧､繝､繝ｼ',     color: 'bg-red-900 border-red-600 text-red-300' },
  { value: 'straw', label: '阯∫┥縺・,         color: 'bg-yellow-900 border-yellow-600 text-yellow-300' },
]

const EMPTY = { name: '', type: 'stove' as EquipType, slots: 1 }

export default function EquipmentPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState<string | null>(null)
  const [mode, setMode] = useState<'list' | 'add'>('list')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const fetchAll = async () => {
    const data = await loadEquipmentFromDB()
    setEquipment(data)
    localStorage.setItem('kitchen_equipment', JSON.stringify(data))
  }

  useEffect(() => { fetchAll().then(() => setLoading(false)) }, [])

  const handleSync = async () => { setSyncing(true); await fetchAll(); setSyncing(false) }

  const commit = async (updated: Equipment[]) => {
    setEquipment(updated)
    await saveEquipment(updated)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    const updated = editId
      ? equipment.map(e => e.id === editId ? { ...e, ...form } : e)
      : [...equipment, { id: 'e' + Date.now(), ...form, active: true }]
    await commit(updated)
    setForm(EMPTY); setEditId(null); setMode('list')
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const startEdit = (item: Equipment) => {
    setEditId(item.id)
    setForm({ name: item.name, type: item.type, slots: item.slots })
    setMode('add')
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
      <div className="text-center">
        <div className="text-amber-400 font-bold text-2xl mb-2">KitchenQ</div>
        <div className="text-gray-400">隱ｭ縺ｿ霎ｼ縺ｿ荳ｭ...</div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-20" style={{fontFamily:'system-ui,sans-serif'}}>

      {/* 繝倥ャ繝繝ｼ */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <Link href="/kitchen" className="text-gray-400 text-2xl font-bold">竊・/Link>
        <h1 className="text-lg font-bold text-amber-400">險ｭ蛯咏ｮ｡逅・/h1>
        <button onClick={handleSync}
          className={`text-xs px-3 py-1.5 rounded-lg font-bold ${syncing ? 'bg-blue-900 text-blue-300' : 'bg-blue-700 text-white'}`}>
          {syncing ? '...' : '蜷梧悄'}
        </button>
      </div>

      {/* 繧ｿ繝門・譖ｿ */}
      <div className="flex gap-2 p-4">
        <button onClick={() => { setMode('list'); setEditId(null); setForm(EMPTY) }}
          className={`flex-1 py-3 rounded-2xl font-bold text-sm ${mode === 'list' ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300'}`}>
          逋ｻ骭ｲ貂医∩荳隕ｧ
        </button>
        <button onClick={() => setMode('add')}
          className={`flex-1 py-3 rounded-2xl font-bold text-sm ${mode === 'add' ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300'}`}>
          ・・譁ｰ隕剰ｿｽ蜉
        </button>
      </div>

      {/* 險ｭ蛯吩ｸ隕ｧ */}
      {mode === 'list' && (
        <div className="px-4">
          {saved && (
            <div className="bg-green-800 text-green-200 text-center py-3 rounded-2xl mb-4 font-bold">
              菫晏ｭ倥＠縺ｾ縺励◆・・
            </div>
          )}
          {equipment.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <div className="text-4xl mb-4">肌</div>
              <div className="font-bold mb-2">險ｭ蛯吶′逋ｻ骭ｲ縺輔ｌ縺ｦ縺・∪縺帙ｓ</div>
              <button onClick={() => setMode('add')}
                className="bg-amber-500 text-black font-bold px-6 py-3 rounded-2xl mt-2">
                譛蛻昴・險ｭ蛯吶ｒ霑ｽ蜉縺吶ｋ
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {equipment.map(item => {
              const opt = EQUIP_OPTIONS.find(o => o.value === item.type)
              return (
                <div key={item.id}
                  className={`rounded-2xl p-4 border-2 ${item.active ? 'bg-gray-800 border-gray-700' : 'bg-gray-900 border-gray-800 opacity-50'}`}>
                  <div className="font-bold text-lg mb-1">{item.name}</div>
                  <div className={`inline-block text-xs px-2 py-0.5 rounded-full border mb-2 ${opt?.color || 'bg-gray-700 border-gray-600 text-gray-300'}`}>
                    {opt?.label}
                  </div>
                  <div className="text-xs text-gray-400 mb-3">{item.slots}譫</div>
                  <div className="flex gap-2">
                    <button onClick={() => commit(equipment.map(e => e.id === item.id ? { ...e, active: !e.active } : e))}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold ${item.active ? 'bg-green-800 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                      {item.active ? '譛牙柑' : '辟｡蜉ｹ'}
                    </button>
                    <button onClick={() => startEdit(item)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold bg-blue-800 text-blue-300">
                      邱ｨ髮・
                    </button>
                    <button onClick={() => commit(equipment.filter(e => e.id !== item.id))}
                      className="flex-1 py-2 rounded-xl text-xs font-bold bg-red-900 text-red-300">
                      蜑企勁
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 霑ｽ蜉繝ｻ邱ｨ髮・ヵ繧ｩ繝ｼ繝 */}
      {mode === 'add' && (
        <div className="px-4">
          <div className="text-sm font-bold text-gray-400 text-center mb-4">
            {editId ? '笨擾ｸ・險ｭ蛯吶ｒ邱ｨ髮・ : '・・譁ｰ縺励＞險ｭ蛯吶ｒ霑ｽ蜉'}
          </div>

          {/* 險ｭ蛯吝錐 */}
          <div className="bg-gray-900 rounded-2xl p-4 mb-3">
            <label className="text-xs text-gray-400 block mb-2">險ｭ蛯吝錐</label>
            <input type="text" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="萓具ｼ壹さ繝ｳ繝ｭ1"
              className="w-full bg-gray-800 text-white rounded-xl px-4 py-4 text-lg border-2 border-gray-700 focus:border-amber-500 outline-none" />
          </div>

          {/* 險ｭ蛯吶・遞ｮ鬘・*/}
          <div className="bg-gray-900 rounded-2xl p-4 mb-3">
            <label className="text-xs text-gray-400 block mb-3">險ｭ蛯吶・遞ｮ鬘・/label>
            <div className="grid grid-cols-2 gap-2">
              {EQUIP_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setForm(f => ({ ...f, type: opt.value }))}
                  className={`py-4 rounded-xl font-bold transition-all active:scale-95 ${
                    form.type === opt.value ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 譫謨ｰ */}
          <div className="bg-gray-900 rounded-2xl p-4 mb-4">
            <label className="text-xs text-gray-400 block mb-3">
              蜷梧凾菴ｿ逕ｨ譫謨ｰ・・span className="text-amber-400 font-black text-xl">{form.slots}譫</span>
            </label>
            <div className="flex gap-2">
              {[1,2,3,4,5,6].map(v => (
                <button key={v} onClick={() => setForm(f => ({ ...f, slots: v }))}
                  className={`flex-1 py-4 rounded-xl text-lg font-black transition-all active:scale-95 ${
                    form.slots === v ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-400'
                  }`}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* 菫晏ｭ倥・繧ｿ繝ｳ */}
          <div className="flex gap-3">
            <button onClick={handleSave}
              className="flex-1 bg-amber-500 active:scale-98 text-black font-black py-5 rounded-2xl text-lg">
              {editId ? '譖ｴ譁ｰ縺吶ｋ' : '霑ｽ蜉縺吶ｋ'}
            </button>
            {editId && (
              <button onClick={() => { setEditId(null); setForm(EMPTY); setMode('list') }}
                className="bg-gray-700 text-white font-bold py-5 px-6 rounded-2xl text-lg">
                ﾃ・
              </button>
            )}
          </div>
        </div>
      )}

      {/* 蠎暮Κ繝翫ン */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex">
        <Link href="/kitchen" className="flex-1 py-4 text-center text-xs text-gray-400 font-bold">蜴ｨ謌ｿ</Link>
        <Link href="/orders" className="flex-1 py-4 text-center text-xs text-gray-400 font-bold">豕ｨ譁・/Link>
        <Link href="/menu" className="flex-1 py-4 text-center text-xs text-gray-400 font-bold">繝｡繝九Η繝ｼ</Link>
        <Link href="/analytics" className="flex-1 py-4 text-center text-xs text-gray-400 font-bold">蛻・梵</Link>
      </div>
    </div>
  )
}
