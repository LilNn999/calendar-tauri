export type Skin =
  | 'minimal'
  | 'neu'
  | 'warm-wood'
  | 'cny'
  | 'press'
  | 'vapor'

export interface SkinOption {
  value: Skin
  label: string
  className: string
}

export const SKIN_OPTIONS: SkinOption[] = [
  { value: 'minimal', label: '极简留白', className: 'skin-minimal' },
  { value: 'neu', label: '新拟态', className: 'skin-neu' },
  { value: 'warm-wood', label: '温暖原木', className: 'skin-warm-wood' },
  { value: 'cny', label: '新年中国红', className: 'skin-cny' },
  { value: 'press', label: '报纸印刷', className: 'skin-press' },
  { value: 'vapor', label: '蒸汽波', className: 'skin-vapor' },
]

const SKIN_VALUES = new Set<string>(SKIN_OPTIONS.map((item) => item.value))

export function normalizeSkin(value: unknown): Skin {
  return typeof value === 'string' && SKIN_VALUES.has(value) ? value as Skin : 'minimal'
}

export function skinClassName(skin: Skin): string {
  return `skin-${skin}`
}
