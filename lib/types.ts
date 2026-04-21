export type EquipType = 'cold' | 'stove' | 'grill' | 'fryer' | 'straw'
export type OrderStatus = 'pending' | 'cooking' | 'served'

export interface Equipment {
  id: string
  name: string
  type: EquipType
  slots: number
  active: boolean
}

export interface MenuItem {
  id: string
  name: string
  cookTime: number
  equip: EquipType
  attn: number
  bonus: number
  active: boolean
}

export interface OrderItem {
  id: number
  table: number
  menu: MenuItem
  status: OrderStatus
  addedAt: number
  startedAt?: number
  servedAt?: number
}

export interface ShopSettings {
  tableCount: number
  stoveSlots: number
  grillSlots: number
  fryerSlots: number
  strawSlots: number
  hasStraw: boolean
  hasFryer: boolean
  warningThresholdSec: number
  dangerThresholdSec: number
  oneOperatorMode: boolean
  soundAlert: boolean
}

export const DEFAULT_SETTINGS: ShopSettings = {
  tableCount: 8,
  stoveSlots: 3,
  grillSlots: 2,
  fryerSlots: 1,
  strawSlots: 1,
  hasStraw: true,
  hasFryer: true,
  warningThresholdSec: 240,
  dangerThresholdSec: 480,
  oneOperatorMode: false,
  soundAlert: true,
}

export const DEFAULT_MENU: MenuItem[] = [
  { id: 'm1', name: '枝豆',          cookTime: 3,  equip: 'cold',  attn: 0, bonus: 0, active: true },
  { id: 'm2', name: '刺身盛り合わせ',  cookTime: 5,  equip: 'cold',  attn: 1, bonus: 5, active: true },
  { id: 'm3', name: '唐揚げ',        cookTime: 10, equip: 'fryer', attn: 2, bonus: 0, active: true },
  { id: 'm4', name: '焼鳥',          cookTime: 12, equip: 'grill', attn: 3, bonus: 0, active: true },
  { id: 'm5', name: 'チャーハン',     cookTime: 8,  equip: 'stove', attn: 5, bonus: 0, active: true },
  { id: 'm6', name: '藁焼きカツオ',   cookTime: 15, equip: 'straw', attn: 4, bonus: 0, active: true },
  { id: 'm7', name: '冷奴',          cookTime: 1,  equip: 'cold',  attn: 0, bonus: 0, active: true },
  { id: 'm8', name: 'もつ煮込み',     cookTime: 6,  equip: 'stove', attn: 1, bonus: 0, active: true },
]

export const DEFAULT_EQUIPMENT: Equipment[] = [
  { id: 'e1', name: 'コンロ1', type: 'stove', slots: 1, active: true },
  { id: 'e2', name: 'コンロ2', type: 'stove', slots: 1, active: true },
  { id: 'e3', name: 'コンロ3', type: 'stove', slots: 1, active: true },
  { id: 'e4', name: 'グリル1', type: 'grill', slots: 2, active: true },
  { id: 'e5', name: 'フライヤー', type: 'fryer', slots: 1, active: true },
  { id: 'e6', name: '藁焼き台', type: 'straw', slots: 1, active: true },
]