import { cn } from '@/lib/utils'

interface SliderProps {
  value: number
  onValueChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
}

function Slider({ value, onValueChange, min = 0, max = 100, step = 1, className }: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100

  return (
    <div className={cn('relative flex w-full touch-none select-none items-center', className)}>
      <div className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-secondary">
        <div
          className="absolute h-full bg-gradient-brand rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onValueChange(Number(e.target.value))}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
      />
      <div
        className="absolute block h-4 w-4 rounded-full border-2 border-primary bg-white shadow-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 pointer-events-none"
        style={{ left: `calc(${percentage}% - 8px)` }}
      />
    </div>
  )
}

export { Slider }
