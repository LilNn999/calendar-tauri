import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Download, FileText, ListChecks, Loader2, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTaskStore } from '@/store/useTaskStore'
import { useProjectStore } from '@/store/useProjectStore'
import { isTauri } from '@/lib/db'
import { renderTaskExportHtml, TASK_EXPORT_PREVIEW_TOKENS, type TaskExportPreviewAppearance } from '@/lib/task-export-document'
import type { TaskExportSnapshot } from '@/lib/task-export-model'
import type { ProjectScope } from '@shared/types'
import { cn } from '@/lib/utils'

/**
 * 未完成任务导出弹窗。
 *
 * - 预览与 PDF 共用文档排版，预览跟随皮肤，PDF 始终使用白底；
 * - 导出项目选择独立于主界面，默认当前项目，可切换为全部项目；
 * - 循环任务是可选内容：默认不勾选，切换后重新读取快照，旧请求结果不会覆盖新选择；
 * - 导出保存的是当前已展示的那一份快照，点击导出后不再重新查库；
 * - 浏览器开发模式禁用导出并说明需要桌面版，不伪造成功。
 */

interface TaskExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ExportPhase = 'idle' | 'exporting' | 'done' | 'error'

/** 由快照生成默认文件名：以快照的本地日期为准。 */
function defaultFileName(today: string): string {
  return `未完成任务清单_${today}.pdf`
}

export function TaskExportDialog({ open, onOpenChange }: TaskExportDialogProps) {
  const fetchExportSnapshot = useTaskStore((state) => state.fetchExportSnapshot)
  const projects = useProjectStore((state) => state.projects)
  const [projectId, setProjectId] = useState<ProjectScope>(() => useProjectStore.getState().selectedProjectId)
  const [includeRecurring, setIncludeRecurring] = useState(false)
  const [previewAppearance, setPreviewAppearance] = useState<TaskExportPreviewAppearance | null>(null)
  const [snapshot, setSnapshot] = useState<TaskExportSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [readError, setReadError] = useState<string | null>(null)
  const [phase, setPhase] = useState<ExportPhase>('idle')
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  // 请求序号：只有最后一次请求的结果可以写入状态，快速切换选项不会串结果
  const requestRef = useRef(0)
  const busy = phase === 'exporting'

  const load = useCallback(async (nextIncludeRecurring: boolean, nextProjectId: ProjectScope) => {
    const request = ++requestRef.current
    setLoading(true)
    setReadError(null)
    setSnapshot(null)
    try {
      const result = await fetchExportSnapshot({ includeRecurring: nextIncludeRecurring, projectId: nextProjectId })
      if (request !== requestRef.current) return
      setSnapshot(result)
    } catch (error) {
      if (request !== requestRef.current) return
      setSnapshot(null)
      setReadError(error instanceof Error ? error.message : '无法读取任务，请重试')
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }, [fetchExportSnapshot])

  // 每次打开默认当前项目且不包含循环任务；关闭后丢弃迟到的读取结果。
  useEffect(() => {
    if (!open) {
      ++requestRef.current
      setSnapshot(null)
      setLoading(false)
      setReadError(null)
      setPhase('idle')
      setExportMessage(null)
      setIncludeRecurring(false)
      return
    }
    const initialProjectId = useProjectStore.getState().selectedProjectId
    setProjectId(initialProjectId)
    setIncludeRecurring(false)
    setPhase('idle')
    setExportMessage(null)
    void load(false, initialProjectId)
  }, [open, load])

  // iframe 不继承父页面样式：读取当前皮肤令牌，根 class 变化时同步（含系统深浅主题）。
  useLayoutEffect(() => {
    if (!open) return
    const root = document.documentElement
    const syncAppearance = () => {
      const style = getComputedStyle(root)
      setPreviewAppearance({
        colorScheme: root.classList.contains('dark') ? 'dark' : 'light',
        variables: Object.fromEntries(TASK_EXPORT_PREVIEW_TOKENS.map((token) => [token, style.getPropertyValue(token).trim()])),
      })
    }
    syncAppearance()
    const observer = new MutationObserver(syncAppearance)
    observer.observe(root, { attributes: true, attributeFilter: ['class', 'style'] })
    return () => observer.disconnect()
  }, [open])

  const html = useMemo(() => (snapshot ? renderTaskExportHtml(snapshot, previewAppearance ?? undefined) : ''), [snapshot, previewAppearance])
  const summary = snapshot?.summary
  const projectLabel = projectId === null ? '全部项目' : projects.find((project) => project.id === projectId)?.name ?? '所选项目'
  const canExport = Boolean(snapshot) && !loading && !busy && (summary?.taskCount ?? 0) > 0

  const handleToggleRecurring = (checked: boolean) => {
    if (busy) return
    setIncludeRecurring(checked)
    // 切换选项立即丢弃旧的可导出快照，避免用旧数据冒名导出。
    setSnapshot(null)
    setPhase('idle')
    setExportMessage(null)
    void load(checked, projectId)
  }

  const handleProjectChange = (nextProjectId: ProjectScope) => {
    if (busy) return
    setProjectId(nextProjectId)
    setPhase('idle')
    setExportMessage(null)
    void load(includeRecurring, nextProjectId)
  }

  const handleExport = async () => {
    if (!snapshot || busy) return
    if (!isTauri) {
      setPhase('error')
      setExportMessage('PDF 导出请在桌面版使用')
      return
    }
    // 保存已展示的这份快照：不重新查库，不改动选项。
    const request = { html: renderTaskExportHtml(snapshot), defaultFileName: defaultFileName(snapshot.today) }
    setPhase('exporting')
    setExportMessage('正在导出…')
    try {
      const { systemApi } = await import('@/api')
      const result = await systemApi.exportTaskPdf(request)
      if (result.status === 'cancelled') {
        // 用户取消：保留预览与选项，不提示成功也不提示错误。
        setPhase('idle')
        setExportMessage(null)
        return
      }
      setPhase('done')
      setExportMessage(`PDF 已导出：${result.path}`)
    } catch (error) {
      setPhase('error')
      setExportMessage(error instanceof Error ? error.message : '导出失败，请重试')
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (!next && busy) return
    onOpenChange(next)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[6px]" />
        <DialogPrimitive.Content
          className={cn(
            'task-export-dialog fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'flex h-[min(760px,calc(100dvh-48px))] w-[min(990px,calc(100vw-32px))] max-h-[calc(100dvh-48px)] flex-col',
            'rounded-2xl border border-border-subtle bg-surface-raised text-card-foreground overflow-hidden',
          )}
          aria-describedby="task-export-description"
        >
          {/* 顶部标题：固定可见 */}
          <div className="flex shrink-0 items-start gap-3 border-b border-border-subtle px-6 py-4">
            <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Download className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-base font-bold leading-tight">
                导出未完成任务
              </DialogPrimitive.Title>
              <DialogPrimitive.Description
                id="task-export-description"
                className="mt-1 text-xs text-muted-foreground"
              >
                保留完整任务层级，让已完成的每一步也清晰可见。
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              disabled={busy}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
              aria-label="关闭导出弹窗"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          {/* 中部：左右分栏，右侧独立滚动 */}
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <aside className="max-h-[32vh] shrink-0 overflow-y-auto border-b border-border-subtle px-6 py-4 md:max-h-none md:w-[280px] md:border-b-0 md:border-r">
              <p className="text-[11px] font-semibold text-muted-foreground">导出范围</p>
              <div className="mt-2 rounded-xl border border-border-subtle bg-surface-subtle/60 px-3 py-2">
                <p className="flex items-center gap-1.5 text-xs font-medium">
                  <ListChecks className="h-3.5 w-3.5 text-primary" />
                  所有未完成任务
                </p>
                <p className="mt-1 break-words text-[11px] text-muted-foreground">{projectLabel} · 不限日期</p>
              </div>

              <label className="mt-3 block text-[11px] font-semibold text-muted-foreground" htmlFor="task-export-project">
                导出项目
              </label>
              <select
                id="task-export-project"
                value={projectId ?? 'all'}
                disabled={busy}
                onChange={(event) => handleProjectChange(event.target.value === 'all' ? null : Number(event.target.value))}
                className="control-inset mt-1.5 h-9 w-full rounded-xl bg-background px-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <option value="all">全部项目</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>

              <div className="mt-4">
                <p className="text-[11px] font-semibold text-muted-foreground">导出内容</p>
                <ul className="mt-2 flex flex-col gap-1.5 text-xs">
                  {['未完成的母任务', '全部子任务', '日期、优先级与备注'].map((label) => (
                    <li key={label} className="flex items-center gap-2">
                      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-[4px] bg-success text-white">
                        <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={3}>
                          <path d="m5 12 4 4L19 6" />
                        </svg>
                      </span>
                      {label}
                    </li>
                  ))}
                  <li className="flex items-center gap-2">
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-[4px] bg-success text-white">
                      <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={3}>
                        <path d="m5 12 4 4L19 6" />
                      </svg>
                    </span>
                    已完成子任务
                    <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      始终保留
                    </span>
                  </li>
                </ul>
                <p className="mt-2 rounded-lg bg-surface-subtle/70 px-2.5 py-2 text-[10px] leading-relaxed text-muted-foreground">
                  只要母任务尚未完成，它下面的子任务就会完整导出。已完成的子任务保留勾选和划线。
                </p>
              </div>

              {/* 循环任务选项：默认不勾选，不持久化 */}
              <div className="mt-4">
                <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border-subtle bg-surface-subtle/50 px-3 py-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-primary"
                    checked={includeRecurring}
                    disabled={busy}
                    onChange={(event) => handleToggleRecurring(event.target.checked)}
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium">包含循环任务</span>
                    <span className="mt-0.5 block text-[10px] leading-relaxed text-muted-foreground">
                      每条循环任务仅导出最近一次待完成（今天或未来）。不勾选时循环任务完全不导出。
                    </span>
                  </span>
                </label>
              </div>

              <div className="mt-4">
                <p className="text-[11px] font-semibold text-muted-foreground">文件格式</p>
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium">PDF 文档</span>
                    <span className="block text-[10px] text-muted-foreground">A4 白底排版 · 适合查看和打印</span>
                  </span>
                </div>
              </div>
            </aside>

            <section className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-subtle px-4 py-2">
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  文件预览
                </span>
                <div className="flex items-center gap-2">
                  {snapshot && (
                    <span className="hidden text-[10px] text-muted-foreground sm:inline">
                      数据生成时间：{new Date(snapshot.capturedAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => void load(includeRecurring, projectId)}
                    disabled={loading || busy}
                    title="重新读取任务"
                    aria-label="重新读取任务"
                    className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
                  >
                    <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
                  </button>
                </div>
              </div>

              <div className="relative min-h-[200px] flex-1 overflow-hidden bg-surface-raised md:min-h-[280px]">
                {loading && (
                  <p className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    正在读取任务…
                  </p>
                )}
                {!loading && readError && (
                  <div className="flex flex-col items-center gap-2 py-10 text-xs">
                    <p className="text-destructive">{readError}</p>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void load(includeRecurring, projectId)}>
                      重试
                    </Button>
                  </div>
                )}
                {!loading && !readError && snapshot && (
                  <iframe
                    title="未完成任务清单预览"
                    className="h-full min-h-[200px] w-full border-0 bg-surface-raised"
                    // sandbox 禁止脚本，预览只是静态文档
                    sandbox=""
                    srcDoc={html}
                  />
                )}
              </div>
            </section>
          </div>

          {/* 底部操作：固定可见 */}
          <div className="flex shrink-0 flex-col gap-2 border-t border-border-subtle bg-surface-subtle/70 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">
                {snapshot ? defaultFileName(snapshot.today) : '未完成任务清单.pdf'}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {summary
                  ? `${summary.taskCount} 条母任务 · ${summary.subtaskCount} 项子任务 · ${summary.completedSubtaskCount} 项子任务已完成`
                  : '正在统计…'}
              </p>
              {exportMessage && (
                <p
                  className={cn(
                    'mt-1 text-[10px] break-all',
                    phase === 'error' ? 'text-destructive' : phase === 'done' ? 'text-success' : 'text-muted-foreground',
                  )}
                >
                  {exportMessage}
                </p>
              )}
              {!isTauri && (
                <p className="mt-1 text-[10px] text-muted-foreground">PDF 导出请在桌面版使用</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={busy}
                onClick={() => handleOpenChange(false)}
              >
                取消
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs"
                disabled={!canExport}
                onClick={() => void handleExport()}
              >
                {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
                {busy ? '正在导出…' : '导出 PDF'}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
