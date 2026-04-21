import type { MenuItem, OrderItem, ShopSettings, Equipment } from './types'
import { DEFAULT_MENU, DEFAULT_SETTINGS, DEFAULT_EQUIPMENT } from './types'
import { supabase } from './supabase'

const KEYS = {
  MENU: 'kitchen_menu',
  SETTINGS: 'kitchen_settings',
  ORDERS: 'kitchen_orders',
  NEXT_ID: 'kitchen_next_id',
  EQUIPMENT: 'kitchen_equipment',
}

const TENANT_ID = 'default'

export function loadMenu(): MenuItem[] {
  if (typeof window === 'undefined') return DEFAULT_MENU
  try { const s = localStorage.getItem(KEYS.MENU); return s ? JSON.parse(s) : DEFAULT_MENU } catch { return DEFAULT_MENU }
}

export function saveMenu(menu: MenuItem[]): void {
  localStorage.setItem(KEYS.MENU, JSON.stringify(menu))
  supabase.from('menus').delete().eq('tenant_id', TENANT_ID).then(() => {
    supabase.from('menus').insert(menu.map(m => ({ ...m, tenant_id: TENANT_ID }))).then()
  })
}

export async function loadMenuFromDB(): Promise<MenuItem[]> {
  const { data } = await supabase.from('menus').select('*').eq('tenant_id', TENANT_ID)
  if (!data || data.length === 0) return DEFAULT_MENU
  return data.map(({ tenant_id, created_at, ...rest }) => rest as MenuItem)
}

export function loadSettings(): ShopSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try { const s = localStorage.getItem(KEYS.SETTINGS); return s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : DEFAULT_SETTINGS } catch { return DEFAULT_SETTINGS }
}

export function saveSettings(s: ShopSettings): void {
  localStorage.setItem(KEYS.SETTINGS, JSON.stringify(s))
  supabase.from('shop_settings').upsert({ tenant_id: TENANT_ID, settings: s, updated_at: new Date().toISOString() }).then()
}

export async function loadSettingsFromDB(): Promise<ShopSettings> {
  const { data } = await supabase.from('shop_settings').select('*').eq('tenant_id', TENANT_ID).single()
  if (!data) return DEFAULT_SETTINGS
  return { ...DEFAULT_SETTINGS, ...data.settings }
}

export function loadOrders(): OrderItem[] {
  if (typeof window === 'undefined') return []
  try { const s = localStorage.getItem(KEYS.ORDERS); return s ? JSON.parse(s) : [] } catch { return [] }
}

export function saveOrders(orders: OrderItem[]): void {
  localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders))
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

export async function loadOrdersFromDB(): Promise<OrderItem[]> {
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
}

export function loadNextId(): number {
  if (typeof window === 'undefined') return 1
  return parseInt(localStorage.getItem(KEYS.NEXT_ID) ?? '1')
}

export function saveNextId(id: number): void {
  localStorage.setItem(KEYS.NEXT_ID, String(id))
}

export function loadEquipment(): Equipment[] {
  if (typeof window === 'undefined') return DEFAULT_EQUIPMENT
  try { const s = localStorage.getItem(KEYS.EQUIPMENT); return s ? JSON.parse(s) : DEFAULT_EQUIPMENT } catch { return DEFAULT_EQUIPMENT }
}

export function saveEquipment(eq: Equipment[]): void {
  localStorage.setItem(KEYS.EQUIPMENT, JSON.stringify(eq))
  supabase.from('equipments').delete().eq('tenant_id', TENANT_ID).then(() => {
    supabase.from('equipments').insert(eq.map(e => ({ ...e, tenant_id: TENANT_ID }))).then()
  })
}

export async function loadEquipmentFromDB(): Promise<Equipment[]> {
  const { data } = await supabase.from('equipments').select('*').eq('tenant_id', TENANT_ID)
  if (!data || data.length === 0) return DEFAULT_EQUIPMENT
  return data.map(({ tenant_id, ...rest }) => rest as Equipment)
}

export function clearAllOrders(): void {
  localStorage.removeItem(KEYS.ORDERS)
  localStorage.removeItem(KEYS.NEXT_ID)
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