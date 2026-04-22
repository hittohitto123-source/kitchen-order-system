'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { MenuItem, EquipType, Equipment } from '../../lib/types'
import { saveMenu, loadEquipmentFromDB, loadMenuFromDB } from '../../lib/storage'

const EQUIP_LABEL: Record<string, string> = {
  cold: '蜀ｷ闖・, stove: '繧ｳ繝ｳ繝ｭ', grill: '繧ｰ繝ｪ繝ｫ', fryer: '繝輔Λ繧､繝､繝ｼ', straw: '阯∫┥縺・
}

const EQUIP_COLOR: Record<string, string> = {
  cold: 'bg-blue-900 border-blue-600 text-blue-300',
  stove: 'bg-orange-900 border-orange-600 text-orange-300',
  grill: 'bg-purple-900 border-purple-600 text-purple-300',
  fryer: 'bg-red-900 border-red-600 text-red-300',
  straw: 'bg-yellow-900 border-yellow-600 text-yellow-300',
}

const EMPTY = { name: '', cookTime: 5, equip: 'cold' as EquipType, attn: 0, bonus: 0 }

export default function MenuPage() {
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState<string | null>(null)
  const [mode, setMode] = useState<'list' | 'add'>('list')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [dbStatus, setDbStatus] = useState<'ok' | 'error' | 'unknown'>('unknown')

  const fetchAll = async () => {
    try {
      const [menuData, equipData] = await Promise.all([loadMenuFromDB(), loadEquipmentFromDB()])
      setMenu(menuData)
      setEquipment(equipData.filter(e => e.active))
      setDbStatus('ok')
    } catch {
      setDbStatus('error')
    }
  }

  useEffect(() => { fetchAll().then(() => setLoading(false)) }, [])

  const handleSync = async () => { setSyncing(true); await fetchAll(); setSyncing(false) }

  const commit = async (updated: MenuItem[]) => { setMenu(updated); await saveMenu(updated) }

  const handleSave = async () => {
    if (!form.name.trim()) return
    const updated = editId
      ? menu.map(m => m.id === editId ? { ...m, ...form } : m)
      : [...menu, { id: 'm' + Date.now(), ...form, active: true }]
    await commit(updated)
    setForm(EMPTY); setEditId(null); setMode('list')
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const startEdit = (item: MenuItem) => {
    setEditId(item.id)
    setForm({ name: item.name, cookTime: item.cookTime, equip: item.equip, attn: item.attn, bonus: item.bonus })
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
        <div className="text-center">
          <h1 className="text-lg font-bold text-amber-400">繝｡繝九Η繝ｼ邂｡逅・/h1>
          <span className={`text-xs ${dbStatus === 'ok' ? 'text-green-400' : dbStatus === 'error' ? 'text-red-400' : 'text-gray-500'}`}>
            {dbStatus === 'ok' ? 'DB謗･邯壽ｸ・ : dbStatus === 'error' ? 'DB謗･邯壹お繝ｩ繝ｼ' : '遒ｺ隱堺ｸｭ...'}
          </span>
        </div>
        <button onClick={handleSync}
          className={`text-xs px-3 py-1.5 rounded-lg font-bold ${syncing ? 'bg-blue-900 text-blue-300' : 'bg-blue-700 text-white'}`}>
          {syncing ? '...' : '蜷梧悄'}
        </button>
      </div>

      {/* 繧ｿ繝門・譖ｿ */}
      <div className="flex gap-2 p-4">
        <button onClick={() => { setMode('list'); setEditId(null); setForm(EMPTY) }}
          className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all ${mode === 'list' ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300'}`}>
          逋ｻ骭ｲ貂医∩荳隕ｧ
        </button>
        <button onClick={() => setMode('add')}
          className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all ${mode === 'add' ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300'}`}>
          ・・譁ｰ隕剰ｿｽ蜉
        </button>
      </div>

      {/* 繝｡繝九Η繝ｼ荳隕ｧ */}
      {mode === 'list' && (
        <div className="px-4">
          {saved && (
            <div className="bg-green-800 text-green-200 text-center py-3 rounded-2xl mb-4 font-bold">
              菫晏ｭ倥＠縺ｾ縺励◆・・            </div>
          )}
          {menu.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <div className="text-4xl mb-4">鎖</div>
              <div className="font-bold mb-2">繝｡繝九Η繝ｼ縺後≠繧翫∪縺帙ｓ</div>
              <button onClick={() => setMode('add')}
                className="bg-amber-500 text-black font-bold px-6 py-3 rounded-2xl mt-2">
                譛蛻昴・繝｡繝九Η繝ｼ繧定ｿｽ蜉縺吶ｋ
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {menu.map(item => (
              <div key={item.id}
                className={`rounded-2xl p-4 border-2 transition-all ${item.active ? 'bg-gray-800 border-gray-700' : 'bg-gray-900 border-gray-800 opacity-50'}`}>
                <div className="font-bold text-base mb-1">{item.name}</div>
                <div className={`inline-block text-xs px-2 py-0.5 rounded-full border mb-2 ${EQUIP_COLOR[item.equip] || 'bg-gray-700 border-gray-600 text-gray-300'}`}>
                  {EQUIP_LABEL[item.equip]}
                </div>
                <div className="text-xs text-gray-400 mb-3">
                  {item.cookTime}蛻・ﾂｷ 莉倥″縺｣縺阪ｊ{item.attn}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => commit(menu.map(m => m.id === item.id ? { ...m, active: !m.active } : m))}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold ${item.active ? 'bg-green-800 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                    {item.active ? '譛牙柑' : '辟｡蜉ｹ'}
                  </button>
                  <button onClick={() => startEdit(item)}
                    className="flex-1 py-2 rounded-xl text-xs font-bold bg-blue-800 text-blue-300">
                    邱ｨ髮・                  </button>
                  <button onClick={() => commit(menu.filter(m => m.id !== item.id))}
                    className="flex-1 py-2 rounded-xl text-xs font-bold bg-red-900 text-red-300">
                    蜑企勁
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 霑ｽ蜉繝ｻ邱ｨ髮・ヵ繧ｩ繝ｼ繝 */}
      {mode === 'add' && (
        <div className="px-4">
          <div className="text-sm font-bold text-gray-400 text-center mb-4">
            {editId ? '笨擾ｸ・繝｡繝九Η繝ｼ繧堤ｷｨ髮・ : '・・譁ｰ縺励＞繝｡繝九Η繝ｼ繧定ｿｽ蜉'}
          </div>

          {/* 譁咏炊蜷・*/}
          <div className="bg-gray-900 rounded-2xl p-4 mb-3">
            <label className="text-xs text-gray-400 block mb-2">譁咏炊蜷・/label>
            <input type="text" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="萓具ｼ壼柏謠壹￡"
              className="w-full bg-gray-800 text-white rounded-xl px-4 py-4 text-lg border-2 border-gray-700 focus:border-amber-500 outline-none" />
          </div>

          {/* 隱ｿ逅・凾髢・*/}
          <div className="bg-gray-900 rounded-2xl p-4 mb-3">
            <label className="text-xs text-gray-400 block mb-2">
              隱ｿ逅・凾髢難ｼ・span className="text-amber-400 font-black text-lg">{form.cookTime}蛻・/span>
            </label>
            <div className="grid grid-cols-6 gap-2 mb-3">
              {[1,3,5,8,10,12,15,20,25,30].map(v => (
                <button key={v} onClick={() => setForm(f => ({ ...f, cookTime: v }))}
                  className={`py-3 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                    form.cookTime === v ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300'
                  }`}>
                  {v}蛻・                </button>
              ))}
            </div>
            <input type="range" min={1} max={30} step={1} value={form.cookTime}
              onChange={e => setForm(f => ({ ...f, cookTime: Number(e.target.value) }))}
              className="w-full accent-amber-500" />
          </div>

          {/* 隱ｿ逅・ｨｭ蛯・*/}
          <div className="bg-gray-900 rounded-2xl p-4 mb-3">
            <label className="text-xs text-gray-400 block mb-3">隱ｿ逅・ｨｭ蛯・/label>
            <div className="grid grid-cols-2 gap-2">
              {equipment.length > 0 ? equipment.map(eq => (
                <button key={eq.id} onClick={() => setForm(f => ({ ...f, equip: eq.type }))}
                  className={`py-4 rounded-xl font-bold transition-all active:scale-95 ${
                    form.equip === eq.type ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300'
                  }`}>
                  <div className="text-base">{eq.name}</div>
                  <div className={`text-xs mt-1 ${form.equip === eq.type ? 'text-black opacity-70' : 'text-gray-500'}`}>
                    {EQUIP_LABEL[eq.type]}
                  </div>
                </button>
              )) : (
                Object.entries(EQUIP_LABEL).map(([value, label]) => (
                  <button key={value} onClick={() => setForm(f => ({ ...f, equip: value as EquipType }))}
                    className={`py-4 rounded-xl font-bold transition-all active:scale-95 ${
                      form.equip === value ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300'
                    }`}>
                    {label}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* 莉倥″縺｣縺阪ｊ蠎ｦ */}
          <div className="bg-gray-900 rounded-2xl p-4 mb-4">
            <label className="text-xs text-gray-400 block mb-3">
              莉倥″縺｣縺阪ｊ蠎ｦ・・span className="text-amber-400 font-black">{['荳崎ｦ・,'菴弱＞','蟆代＠','譎ｮ騾・,'鬮倥＞','蟶ｸ縺ｫ'][form.attn]}</span>
            </label>
            <div className="flex gap-2">
              {[0,1,2,3,4,5].map(v => (
                <button key={v} onClick={() => setForm(f => ({ ...f, attn: v }))}
                  className={`flex-1 py-4 rounded-xl text-lg font-black transition-all active:scale-95 ${
                    form.attn === v ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-400'
                  }`}>
                  {v}
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-600 mt-2 text-center">0=謾ｾ鄂ｮOK・亥・闖懊↑縺ｩ・峨5=蟶ｸ縺ｫ逶ｮ縺碁屬縺帙↑縺・/div>
          </div>

          {/* 菫晏ｭ倥・繧ｿ繝ｳ */}
          <div className="flex gap-3">
            <button onClick={handleSave}
              className="flex-1 bg-amber-500 hover:bg-amber-400 active:scale-98 text-black font-black py-5 rounded-2xl text-lg">
              {saved ? '笨・菫晏ｭ俶ｸ医∩・・ : editId ? '譖ｴ譁ｰ縺吶ｋ' : '霑ｽ蜉縺吶ｋ'}
            </button>
            {editId && (
              <button onClick={() => { setEditId(null); setForm(EMPTY); setMode('list') }}
                className="bg-gray-700 text-white font-bold py-5 px-6 rounded-2xl text-lg">
                ﾃ・              </button>
            )}
          </div>
        </div>
      )}

      {/* 蠎暮Κ繝翫ン */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex">
        <Link href="/kitchen" className="flex-1 py-4 text-center text-xs text-gray-400 font-bold">蜴ｨ謌ｿ</Link>
        <Link href="/orders" className="flex-1 py-4 text-center text-xs text-gray-400 font-bold">豕ｨ譁・/Link>
        <Link href="/menu" className="flex-1 py-4 text-center text-xs text-amber-400 font-bold border-t-2 border-amber-400">繝｡繝九Η繝ｼ</Link>
        <Link href="/analytics" className="flex-1 py-4 text-center text-xs text-gray-400 font-bold">蛻・梵</Link>
      </div>
    </div>
  )
}
