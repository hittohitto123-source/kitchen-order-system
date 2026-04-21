import type { MenuItem, OrderItem, ShopSettings, Equipment } from './types'
import { DEFAULT_MENU, DEFAULT_SETTINGS, DEFAULT_EQUIPMENT } from './types'

const KEYS = {
  MENU: 'kitchen_menu',
  SETTINGS: 'kitchen_settings',
  ORDERS: 'kitchen_orders',
  NEXT_ID: 'kitchen_next_id',
  EQUIPMENT: 'kitchen_equipment',
}

export function loadMenu(): MenuItem[] {
  if (typeof window === 'undefined') return DEFAULT_MENU
  try { const s = localStorage.getItem(KEYS.MENU); return s ? JSON.parse(s) : DEFAULT_MENU } catch { return DEFAULT_MENU }
}
export function saveMenu(menu: MenuItem[]): void { localStorage.setItem(KEYS.MENU, JSON.stringify(menu)) }

export function loadSettings(): ShopSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try { const s = localStorage.getItem(KEYS.SETTINGS); return s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : DEFAULT_SETTINGS } catch { return DEFAULT_SETTINGS }
}
export function saveSettings(s: ShopSettings): void { localStorage.setItem(KEYS.SETTINGS, JSON.stringify(s)) }

export function loadOrders(): OrderItem[] {
  if (typeof window === 'undefined') return []
  try { const s = localStorage.getItem(KEYS.ORDERS); return s ? JSON.parse(s) : [] } catch { return [] }
}
export function saveOrders(orders: OrderItem[]): void { localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders)) }

export function loadNextId(): number {
  if (typeof window === 'undefined') return 1
  return parseInt(localStorage.getItem(KEYS.NEXT_ID) ?? '1')
}
export function saveNextId(id: number): void { localStorage.setItem(KEYS.NEXT_ID, String(id)) }

export function loadEquipment(): Equipment[] {
  if (typeof window === 'undefined') return DEFAULT_EQUIPMENT
  try { const s = localStorage.getItem(KEYS.EQUIPMENT); return s ? JSON.parse(s) : DEFAULT_EQUIPMENT } catch { return DEFAULT_EQUIPMENT }
}
export function saveEquipment(eq: Equipment[]): void { localStorage.setItem(KEYS.EQUIPMENT, JSON.stringify(eq)) }

export function clearAllOrders(): void {
  localStorage.removeItem(KEYS.ORDERS)
  localStorage.removeItem(KEYS.NEXT_ID)
}