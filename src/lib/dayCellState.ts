export type DayCellState = 'selected' | 'today' | 'outside' | 'normal'

interface DayCellStateOptions {
  isSelected: boolean
  isToday: boolean
  isCurrentMonth: boolean
}

export function getDayCellState({ isSelected, isToday, isCurrentMonth }: DayCellStateOptions): DayCellState {
  if (isSelected) return 'selected'
  if (isToday) return 'today'
  if (!isCurrentMonth) return 'outside'
  return 'normal'
}
