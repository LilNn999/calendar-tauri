export type Skin =
  | 'default'
  | 'aurora'
  | 'warm-wood'
  | 'macos'
  | 'win11'
  | 'minimal'

export interface SkinOption {
  value: Skin
  label: string
  className: string
}

export const SKIN_OPTIONS: SkinOption[] = [
  { value: 'default', label: '默认靛蓝', className: '' },
  { value: 'aurora', label: '极光渐变', className: 'skin-aurora' },
  { value: 'warm-wood', label: '温暖原木', className: 'skin-warm-wood' },
  { value: 'macos', label: 'macOS 原生', className: 'skin-macos' },
  { value: 'win11', label: 'Win11 云母', className: 'skin-win11' },
  { value: 'minimal', label: '极简留白', className: 'skin-minimal' },
]

const SKIN_VALUES = new Set<string>(SKIN_OPTIONS.map((item) => item.value))

export function normalizeSkin(value: unknown): Skin {
  return typeof value === 'string' && SKIN_VALUES.has(value) ? value as Skin : 'default'
}

export function skinClassName(skin: Skin): string {
  return skin === 'default' ? '' : `skin-${skin}`
}
