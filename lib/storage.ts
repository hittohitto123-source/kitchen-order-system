import type { MenuItem, OrderItem, ShopSettings, Equipment } from './types'
import { DEFAULT_MENU, DEFAULT_SETTINGS, DEFAULT_EQUIPMENT } from './types'
import { supabase } from './supabase'

const TENANT_ID = 'default'

export function loadMenu(): MenuItem[] {
  if (typeof window === 'undefined') return DEFAULT_MENU
  try {
    const s = localStorage.getItem('kitchen_menu')
    return s ? JSON.parse(s) : DEFAULT_MENU
  } catch { return DEFAULT_MENU }
}

export async function loadMenuFromDB(): Promise<MenuItem[]> {
  try {
    const { data, error } = await supabase
      .from('menus')
      .select('*')
      .eq('tenant_id', TENANT_ID)
    if (error || !data || data.length === 0) return loadMenu()
    const menus = data.map(({ tenant_id, created_at, cook_time, ...rest }) => ({
      ...rest,
      cookTime: cook_time,
    })) as MenuItem[]
    localStorage.setItem('kitchen_menu', JSON.stringify(menus))
    return menus
  } catch { return loadMenu() }
}

export async function saveMenu(menu: MenuItem[]): Promise<void> {
  localStorage.setItem('kitchen_menu', JSON.stringify(menu))
  try {
    const rows = menu.map(m => ({
      id: m.id,
      tenant_id: TENANT_ID,
      name: m.name,
      cook_time: m.cookTime,
      equip: m.equip,
      attn: m.attn,
      bonus: m.bonus,
      active: m.active,
    }))
    const { error } = await supabase.from('menus').upsert(rows)
    if (error) console.error('saveMenu error:', error)
    const existingIds = menu.map(m => m.id)
    const { data: allRows } = await supabase.from('menus').select('id').eq('tenant_id', TENANT_ID)
    if (allRows) {
      const toDelete = allRows.map(r => r.id).filter(id => !existingIds.includes(id))
      if (toDelete.length > 0) {
        await supabase.from('menus').delete().in('id', toDelete)
      }
    }
  } catch (e) { console.error('saveMenu error:', e) }
}

export function loadSettings(): ShopSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const s = localStorage.getItem('kitchen_settings')
    return s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : DEFAULT_SETTINGS
  } catch { return DEFAULT_SETTINGS }
}

export async function loadSettingsFromDB(): Promise<ShopSettings> {
  try {
    const { data } = await supabase
      .from('shop_settings')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .single()
    if (!data) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...data.settings }
  } catch { return DEFAULT_SETTINGS }
}

export async function saveSettings(s: ShopSettings): Promise<void> {
  localStorage.setItem('kitchen_settings', JSON.stringify(s))
  try {
    await supabase.from('shop_settings').upsert({
      tenant_id: TENANT_ID,
      settings: s,
      updated_at: new Date().toISOString()
    })
  } catch (e) { console.error('saveSettings error:', e) }
}

export function loadOrders(): OrderItem[] {
  if (typeof window === 'undefined') return []
  try {
    const s = localStorage.getItem('kitchen_orders')
    return s ? JSON.parse(s) : []
  } catch { return [] }
}

export async function loadOrdersFromDB(): Promise<OrderItem[]> {
  try {
    const { data } = await supabase
      .from('kitchen_order_items')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .order('added_at', { ascending: true })
    if (!data) return []
    return data.map(row => ({
      id: row.id,
      table: row.table_number,
      menu: row.menu_data,
      status: row.status,
      addedAt: row.added_at,
      startedAt: row.started_at ?? undefined,
      servedAt: row.served_at ?? undefined,
    }))
  } catch { return [] }
}

export function saveOrders(orders: OrderItem[]): void {
  localStorage.setItem('kitchen_orders', JSON.stringify(orders))
  const rows = orders.map(o => ({
    id: o.id,
    tenant_id: TENANT_ID,
    table_number: o.table,
    menu_data: o.menu,
    status: o.status,
    added_at: o.addedAt,
    started_at: o.startedAt ?? null,
    served_at: o.servedAt ?? null,
  }))
  supabase.from('kitchen_order_items').upsert(rows).then()
}

export function loadNextId(): number {
  if (typeof window === 'undefined') return 1
  return parseInt(localStorage.getItem('kitchen_next_id') ?? '1')
}

export function saveNextId(id: number): void {
  localStorage.setItem('kitchen_next_id', String(id))
}

export function loadEquipment(): Equipment[] {
  if (typeof window === 'undefined') return DEFAULT_EQUIPMENT
  try {
    const s = localStorage.getItem('kitchen_equipment')
    return s ? JSON.parse(s) : DEFAULT_EQUIPMENT
  } catch { return DEFAULT_EQUIPMENT }
}

export async function loadEquipmentFromDB(): Promise<Equipment[]> {
  try {
    const { data, error } = await supabase
      .from('equipments')
      .select('*')
      .eq('tenant_id', TENANT_ID)
    if (error || !data || data.length === 0) return loadEquipment()
    const eq = data.map(({ tenant_id, ...rest }) => rest as Equipment)
    localStorage.setItem('kitchen_equipment', JSON.stringify(eq))
    return eq
  } catch { return loadEquipment() }
}

export async function saveEquipment(eq: Equipment[]): Promise<void> {
  localStorage.setItem('kitchen_equipment', JSON.stringify(eq))
  try {
    const rows = eq.map(e => ({
      id: e.id,
      tenant_id: TENANT_ID,
      name: e.name,
      type: e.type,
      slots: e.slots,
      active: e.active,
    }))
    const { error } = await supabase.from('equipments').upsert(rows)
    if (error) console.error('saveEquipment error:', error)
    const existingIds = eq.map(e => e.id)
    const { data: allRows } = await supabase.from('equipments').select('id').eq('tenant_id', TENANT_ID)
    if (allRows) {
      const toDelete = allRows.map(r => r.id).filter(id => !existingIds.includes(id))
      if (toDelete.length > 0) {
        await supabase.from('equipments').delete().in('id', toDelete)
      }
    }
  } catch (e) { console.error('saveEquipment error:', e) }
}

export function clearAllOrders(): void {
  localStorage.removeItem('kitchen_orders')
  localStorage.removeItem('kitchen_next_id')
  supabase.from('kitchen_order_items').delete().eq('tenant_id', TENANT_ID).then()
}

export async function logAnalytics(order: OrderItem): Promise<void> {
  const cookTimeActual = order.servedAt && order.startedAt
    ? Math.floor((order.servedAt - order.startedAt) / 1000)
    : null
  await supabase.from('analytics_logs').insert({
    tenant_id: TENANT_ID,
    menu_id: order.menu.id,
    menu_name: order.menu.name,
    menu_equip: order.menu.equip,
    table_number: order.table,
    cook_time_actual: cookTimeActual,
  })
}