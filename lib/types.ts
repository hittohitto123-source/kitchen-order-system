export type EquipType = 'cold' | 'stove' | 'grill' | 'fryer' | 'straw'

export interface TableConfig {
  id: string
  name: string
  type: 'counter' | 'table'
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
  table: string
  menu: MenuItem
  status: 'pending' | 'cooking' | 'served'
  addedAt: number
  startedAt?: number
  servedAt?: number
}

export interface ShopSettings {
  tableCount: number
  tableConfigs: TableConfig[]
  warningThresholdSec: number
  dangerThresholdSec: number
  oneOperatorMode: boolean
  soundAlert: boolean
  stoveSlots: number
  grillSlots: number
  hasFryer: boolean
  fryerSlots: number
  hasStraw: boolean
}

export interface Equipment {
  id: string
  name: string
  type: EquipType
  slots: number
  active: boolean
}

export const DEFAULT_TABLE_CONFIGS: TableConfig[] = [
  { id: 'c1', name: 'C1', type: 'counter' },
  { id: 'c2', name: 'C2', type: 'counter' },
  { id: 'c3', name: 'C3', type: 'counter' },
  { id: 'c4', name: 'C4', type: 'counter' },
  { id: 'c5', name: 'C5', type: 'counter' },
  { id: 'c6', name: 'C6', type: 'counter' },
  { id: 'c7', name: 'C7', type: 'counter' },
  { id: 'c8', name: 'C8', type: 'counter' },
  { id: 'tA', name: 'A', type: 'table' },
  { id: 'tB', name: 'B', type: 'table' },
  { id: 'tC', name: 'C', type: 'table' },
  { id: 'tD', name: 'D', type: 'table' },
]

export const DEFAULT_SETTINGS: ShopSettings = {
  tableCount: 12,
  tableConfigs: DEFAULT_TABLE_CONFIGS,
  warningThresholdSec: 300,
  dangerThresholdSec: 600,
  oneOperatorMode: false,
  soundAlert: true,
  stoveSlots: 4,
  grillSlots: 3,
  hasFryer: true,
  fryerSlots: 2,
  hasStraw: true,
}

export const DEFAULT_MENU: MenuItem[] = []
export const DEFAULT_EQUIPMENT: Equipment[] = []