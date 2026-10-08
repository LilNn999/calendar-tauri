import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown, LayoutGrid, Pencil, Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { useProjectStore } from '@/store/useProjectStore'
import { PROJECT_NAME_MAX_LENGTH } from '@/lib/projects'
import { cn } from '@/lib/utils'

type ProjectDialog = { mode: 'create' } | { mode: 'rename'; projectId: number }
const PROJECT_DOT_CLASSES = ['bg-primary', 'bg-warning', 'bg-task-low-fg', 'bg-success']

export function ProjectSwitcher({ compact = false }: { compact?: boolean }) {
  const { projects, selectedProjectId, selectProject, createProject, renameProject, switching, error: loadError } = useProjectStore()
  const { addToast } = useToast()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRequested = useRef(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dialog, setDialog] = useState<ProjectDialog | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const selectedProject = projects.find((project) => project.id === selectedProjectId)
  const selectedName = selectedProject?.name ?? (selectedProjectId === null ? '全部项目' : '默认项目')
  const renaming = dialog?.mode === 'rename'

  useEffect(() => { setMenuOpen(false) }, [selectedProjectId])

  const openDialog = (mode: 'create' | 'rename') => {
    if (mode === 'rename' && !selectedProject) return
    dialogRequested.current = true
    setMenuOpen(false)
    setName(mode === 'rename' ? selectedName : '')
    setError('')
    // 保存改名目标，另一窗口切换项目时仍修改打开弹窗时的项目。
    setDialog(mode === 'rename' ? { mode, projectId: selectedProject!.id } : { mode })
  }

  const closeDialog = () => {
    setDialog(null)
    setName('')
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const handleSave = async () => {
    if (saving || !name.trim() || !dialog) return
    setSaving(true)
    setError('')
    try {
      if (dialog.mode === 'rename') await renameProject(dialog.projectId, name)
      else await createProject(name)
      closeDialog()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `${renaming ? '重命名' : '新建'}项目失败，请重试`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
        <DropdownMenu.Trigger asChild>
          <button
            ref={triggerRef}
            type="button"
            aria-label="切换待办项目"
            title={loadError ?? selectedName}
            disabled={switching || saving}
            className={cn(
              'min-w-0 inline-flex items-center gap-2 rounded-lg px-2 font-medium text-foreground hover:bg-foreground/5 data-[state=open]:bg-foreground/10 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
              compact ? 'h-7 w-full text-[11px]' : 'h-8 max-w-48 text-xs',
            )}
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-80 shrink-0" />
            <span className="truncate">{selectedName}</span>
            <ChevronDown className={cn('h-3 w-3 shrink-0 opacity-60', compact && 'ml-auto')} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={8}
            collisionPadding={12}
            className="z-[100] w-64 max-w-[calc(100vw-24px)] max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto rounded-xl border border-border-subtle bg-surface-raised text-popover-foreground shadow-float p-1.5 outline-none"
            onMouseDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onCloseAutoFocus={(event) => {
              if (dialogRequested.current) { event.preventDefault(); dialogRequested.current = false }
            }}
          >
            <DropdownMenu.Label className="px-3 pt-2 pb-2.5 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>切换项目</span><span>{projects.length} 个项目</span>
            </DropdownMenu.Label>
            <DropdownMenu.RadioGroup
              value={selectedProjectId === null ? 'all' : String(selectedProjectId)}
              onValueChange={(value) => {
                void selectProject(value === 'all' ? null : Number(value)).catch((cause: unknown) => {
                  addToast({ title: cause instanceof Error ? cause.message : '切换项目失败，请重试', variant: 'destructive' })
                })
              }}
            >
              <DropdownMenu.RadioItem
                value="all"
                className={cn('flex items-center gap-2.5 min-h-9 px-3 rounded-lg text-xs cursor-pointer outline-none focus:bg-accent', selectedProjectId === null && 'bg-primary/10 text-primary font-semibold')}
              >
                <LayoutGrid className="h-3.5 w-3.5 shrink-0" /><span className="flex-1">全部项目</span>
                <DropdownMenu.ItemIndicator><Check className="h-3.5 w-3.5" /></DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
              <DropdownMenu.Separator className="h-px mx-1 my-1.5 bg-border-subtle" />
              {projects.map((project) => (
                <DropdownMenu.RadioItem
                  key={project.id}
                  value={String(project.id)}
                  title={project.name}
                  className={cn('flex items-center gap-2.5 min-h-9 px-3 rounded-lg text-xs cursor-pointer outline-none focus:bg-accent', selectedProjectId === project.id && 'bg-primary/10 text-primary font-semibold')}
                >
                  <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full shrink-0', PROJECT_DOT_CLASSES[(project.id - 1) % PROJECT_DOT_CLASSES.length])} />
                  <span className="flex-1 min-w-0 truncate">{project.name}</span>
                  <DropdownMenu.ItemIndicator><Check className="h-3.5 w-3.5 shrink-0" /></DropdownMenu.ItemIndicator>
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
            <DropdownMenu.Separator className="h-px mx-1 my-1.5 bg-border-subtle" />
            <DropdownMenu.Item onSelect={() => openDialog('create')} className="flex items-center gap-2.5 min-h-9 px-3 rounded-lg text-xs text-muted-foreground cursor-pointer outline-none focus:bg-accent focus:text-foreground">
              <Plus className="h-3.5 w-3.5 shrink-0" />新建项目
            </DropdownMenu.Item>
            {selectedProject && (
              <DropdownMenu.Item onSelect={() => openDialog('rename')} className="flex items-center gap-2.5 min-h-9 px-3 rounded-lg text-xs text-muted-foreground cursor-pointer outline-none focus:bg-accent focus:text-foreground">
                <Pencil className="h-3.5 w-3.5 shrink-0" /><span className="shrink-0">重命名当前项目</span>
                <span className="ml-auto max-w-20 truncate text-[10px] opacity-60">{selectedName}</span>
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {createPortal(
        <div onMouseDown={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
          <Dialog open={dialog !== null} onOpenChange={(next) => { if (!next && !saving) closeDialog() }}>
            <DialogContent onClose={() => { if (!saving) closeDialog() }} className="max-w-sm mx-auto">
              <DialogHeader><DialogTitle>{renaming ? '重命名项目' : '新建项目'}</DialogTitle></DialogHeader>
              <div className="px-6 py-2 flex flex-col gap-2">
                <label htmlFor={renaming ? 'rename-project-name' : 'new-project-name'} className="text-xs text-muted-foreground">项目名称</label>
                <Input
                  id={renaming ? 'rename-project-name' : 'new-project-name'}
                  autoFocus
                  value={name}
                  maxLength={PROJECT_NAME_MAX_LENGTH}
                  disabled={saving}
                  placeholder="例如：工作、学习、个人生活"
                  onFocus={(event) => { if (renaming) event.currentTarget.select() }}
                  onChange={(event) => { setName(event.target.value); setError('') }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); void handleSave() }
                  }}
                />
                <p className="text-[11px] text-muted-foreground">{renaming ? '修改名称后，已有任务继续保留在这个项目中。' : '创建后自动切换到新项目。打卡和每日备注共享。'}</p>
                {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" disabled={saving} onClick={closeDialog}>取消</Button>
                <Button size="sm" disabled={saving || !name.trim()} onClick={() => { void handleSave() }}>{saving ? '保存中…' : renaming ? '保存名称' : '创建并切换'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>,
        document.body,
      )}
    </>
  )
}
