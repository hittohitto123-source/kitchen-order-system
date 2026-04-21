'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { MenuItem, EquipType } from '../../lib/types'
import { loadMenu, saveMenu } from '../../lib/storage'

const EQUIP_OPTIONS: { value: EquipType; label: string }[] = [
  { value: 'cold',  label: '蜀ｷ闖懶ｼ育↓荳崎ｦ・ｼ・ },
  { value: 'stove', label: '繧ｳ繝ｳ繝ｭ' },
  { value: 'grill', label: '繧ｰ繝ｪ繝ｫ' },
  { value: 'fryer', label: '繝輔Λ繧､繝､繝ｼ' },
  { value: 'straw', label: '阯∫┥縺・ },
]

const EMPTY = { name: '', cookTime: 5, equip: 'cold' as EquipType, attn: 0, bonus: 0 }

export default function MenuPage() {
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setMenu(loadMenu()) }, [])

  const commit = (updated: MenuItem[]) => { setMenu(updated); saveMenu(updated) }

  const handleSave = () => {
    if (!form.name.trim()) return
    const updated = editId
      ? menu.map(m => m.id === editId ? { ...m, ...form } : m)
      : [...menu, { id: 'm' + Date.now(), ...form, active: true }]
    commit(updated)
    setForm(EMPTY); setEditId(null)
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-amber-400">繝｡繝九Η繝ｼ邂｡逅・/h1>
        <div className="flex gap-2">
          <Link href="/settings" className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm font-bold">蠎苓・險ｭ螳・/Link>
          <Link href="/kitchen" className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm font-bold">蜴ｨ謌ｿ縺ｸ</Link>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl p-4 mb-6">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
          {editId ? '笨擾ｸ・邱ｨ髮・ｸｭ' : '・・譁ｰ縺励＞繝｡繝九Η繝ｼ繧定ｿｽ蜉'}
        </h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">譁咏炊蜷・/label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="萓具ｼ壼柏謠壹￡"
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:border-amber-500 outline-none" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">
              隱ｿ逅・凾髢難ｼ・span className="text-amber-400 font-bold">{form.cookTime}蛻・/span>
            </label>
            <input type="range" min={1} max={30} step={1} value={form.cookTime}
              onChange={e => setForm(f => ({ ...f, cookTime: Number(e.target.value) }))}
              className="w-full accent-amber-500" />
            <div className="flex justify-between text-xs text-gray-600 mt-1"><span>1蛻・/span><span>15蛻・/span><span>30蛻・/span></div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-2 block">隱ｿ逅・ｨｭ蛯・/label>
            <div className="grid grid-cols-3 gap-2">
              {EQUIP_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setForm(f => ({ ...f, equip: opt.value }))}
                  className={`py-2 px-3 rounded-lg text-sm font-bold transition-colors ${form.equip === opt.value ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">
              莉倥″縺｣縺阪ｊ蠎ｦ・・span className="text-amber-400 font-bold ml-1">{['荳崎ｦ・,'菴・,'蟆代＠','譎ｮ騾・,'鬮倥＞','蟶ｸ縺ｫ'][form.attn]}</span>
            </label>
            <div className="flex gap-2">
              {[0,1,2,3,4,5].map(v => (
                <button key={v} onClick={() => setForm(f => ({ ...f, attn: v }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold ${form.attn === v ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-400'}`}>
                  {v}
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-600 mt-1">0=謾ｾ鄂ｮOK / 5=蟶ｸ縺ｫ逶ｮ縺碁屬縺帙↑縺・/div>
          </div>
          <div className="flex gap-2 mt-1">
            <button onClick={handleSave}
              className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-xl text-sm">
              {saved ? '笨・菫晏ｭ倥＠縺ｾ縺励◆・・ : editId ? '譖ｴ譁ｰ縺吶ｋ' : '霑ｽ蜉縺吶ｋ'}
            </button>
            {editId && (
              <button onClick={() => { setEditId(null); setForm(EMPTY) }}
                className="bg-gray-700 text-white font-bold py-3 px-4 rounded-xl text-sm">
                繧ｭ繝｣繝ｳ繧ｻ繝ｫ
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl p-4">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
          逋ｻ骭ｲ繝｡繝九Η繝ｼ・・menu.filter(m => m.active).length}蜩・譛牙柑・・
        </h2>
        {menu.map(item => (
          <div key={item.id}
            className={`flex items-center gap-3 p-3 rounded-xl mb-2 border ${item.active ? 'bg-gray-800 border-gray-700' : 'bg-gray-900 border-gray-800 opacity-40'}`}>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold">{item.name}</span>
                <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                  {EQUIP_OPTIONS.find(e => e.value === item.equip)?.label}
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                隱ｿ逅・凾髢・<span className="text-amber-400 font-bold">{item.cookTime}蛻・/span>
                縲莉倥″縺｣縺阪ｊ <span className="text-blue-400 font-bold">{item.attn}</span>
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => commit(menu.map(m => m.id === item.id ? { ...m, active: !m.active } : m))}
                className={`text-xs px-2 py-1 rounded-lg font-bold ${item.active ? 'bg-green-800 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                {item.active ? '譛牙柑' : '辟｡蜉ｹ'}
              </button>
              <button onClick={() => { setEditId(item.id); setForm({ name: item.name, cookTime: item.cookTime, equip: item.equip, attn: item.attn, bonus: item.bonus }) }}
                className="text-xs px-2 py-1 rounded-lg font-bold bg-blue-800 text-blue-300">邱ｨ髮・/button>
              <button onClick={() => commit(menu.filter(m => m.id !== item.id))}
                className="text-xs px-2 py-1 rounded-lg font-bold bg-red-900 text-red-300">蜑企勁</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
