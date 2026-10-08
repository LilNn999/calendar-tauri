import { useEffect, useState } from 'react'
import { useProjectStore } from '@/store/useProjectStore'
import { DEFAULT_PROJECT_ID } from '@/lib/projects'

export function defaultTaskProjectId(): number {
  return useProjectStore.getState().selectedProjectId ?? DEFAULT_PROJECT_ID
}

export function useNewTaskProject() {
  const selectedProjectId = useProjectStore((state) => state.selectedProjectId)
  const [projectId, setProjectId] = useState(defaultTaskProjectId)
  useEffect(() => { setProjectId(selectedProjectId ?? DEFAULT_PROJECT_ID) }, [selectedProjectId])
  return [projectId, setProjectId] as const
}

export function TaskProjectField({ value, onChange }: { value: number; onChange: (projectId: number) => void }) {
  const projects = useProjectStore((state) => state.projects)
  return (
    <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
      所属项目
      <select
        aria-label="任务所属项目"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="control-inset h-9 w-full rounded-xl px-3 bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
      >
        {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
      </select>
    </label>
  )
}

/** 全部项目视图中区分来源，同名任务也能识别。 */
export function TaskProjectBadge({ projectId, compact = false }: { projectId: number; compact?: boolean }) {
  const { projects, selectedProjectId } = useProjectStore()
  if (selectedProjectId !== null) return null
  const name = projects.find((project) => project.id === projectId)?.name ?? '默认项目'
  return <span title={name} className={`shrink-0 truncate rounded-md bg-secondary px-1.5 py-0.5 leading-tight text-muted-foreground ${compact ? 'max-w-10 text-[9px]' : 'max-w-24 text-[10px]'}`}>{name}</span>
}
