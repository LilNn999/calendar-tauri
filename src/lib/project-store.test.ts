import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import type { Task, CreateTaskPayload, Project } from '@shared/types'
import type { TaskExportSnapshot } from './task-export-model.ts'
import type { useTaskStore as TaskStoreType } from '../store/useTaskStore'
import type { useProjectStore as ProjectStoreType } from '../store/useProjectStore'

function task(id: number, projectId: number): Task {
  return { id, projectId, title: `任务 ${id}`, priority: 'none', dueDate: '2026-10-08', isCompleted: false, isFailed: false, completedAt: null, notes: null, recurrenceType: null, recurrenceEnd: null, createdAt: '', updatedAt: '' }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

const projects: Project[] = [
  { id: 1, name: '默认项目', createdAt: '' },
  { id: 2, name: '工作', createdAt: '' },
]
let savedProjectId: number | null = 1
// 记录数据变更通知次数：导出快照必须是纯只读，不能触发任何通知
let widgetNotifyCount = 0
let lastExportOptions: { includeRecurring: boolean } | null = null
let exportSnapshotResult: TaskExportSnapshot | null = null
const api = {
  tasksApi: {
    list: async (_start: string, _end: string, _scope?: number | null): Promise<Task[]> => [],
    create: async (payload: CreateTaskPayload): Promise<Task> => task(1, payload.projectId ?? 1),
    update: async (_id: number, _patch: unknown): Promise<Task> => task(1, 1),
    exportSnapshot: async (options: { includeRecurring: boolean }): Promise<TaskExportSnapshot> => {
      lastExportOptions = options
      if (!exportSnapshotResult) throw new Error('测试未设置导出快照结果')
      return exportSnapshotResult
    },
    toggleSubtask: async () => { widgetNotifyCount += 1 },
  },
  projectsApi: {
    list: async () => projects,
    getSelection: async (): Promise<number | null> => savedProjectId,
    select: async (scope: number | null) => { savedProjectId = scope },
    rename: async (id: number, name: string): Promise<Project> => ({ ...projects.find((item) => item.id === id)!, name }),
  },
}
const listeners = new Map<string, () => void>()
Object.defineProperty(globalThis, '__calendarProjectApi', { value: api, configurable: true })
Object.defineProperty(globalThis, 'window', {
  value: { electronAPI: { invoke: async () => undefined, on: (channel: string, listener: () => void) => { listeners.set(channel, listener); return () => listeners.delete(channel) } } },
  configurable: true,
})

const bundle = await build({
  stdin: { contents: "export { useTaskStore } from './src/store/useTaskStore'; export { useProjectStore } from './src/store/useProjectStore';", resolveDir: fileURLToPath(new URL('../../', import.meta.url)), loader: 'ts' },
  tsconfig: fileURLToPath(new URL('../../tsconfig.app.json', import.meta.url)),
  bundle: true, write: false, platform: 'node', format: 'esm',
  plugins: [{ name: '可控异步 API', setup(builder) {
    builder.onResolve({ filter: /^@\/api$/ }, () => ({ path: 'api', namespace: '项目状态测试' }))
    builder.onLoad({ filter: /.*/, namespace: '项目状态测试' }, () => ({ contents: 'export const tasksApi = globalThis.__calendarProjectApi.tasksApi; export const projectsApi = globalThis.__calendarProjectApi.projectsApi;', loader: 'js' }))
  } }],
})
const { useTaskStore, useProjectStore } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`) as {
  useTaskStore: typeof TaskStoreType
  useProjectStore: typeof ProjectStoreType
}

test('快速切换项目：立即清空旧任务，较晚返回的旧项目请求不会覆盖新列表', async () => {
  const oldRequest = deferred<Task[]>()
  const newRequest = deferred<Task[]>()
  api.tasksApi.list = (_start, _end, scope) => scope === 1 ? oldRequest.promise : newRequest.promise
  useProjectStore.setState({ selectedProjectId: 1 })
  useTaskStore.setState({ tasks: [task(1, 1)] })
  const first = useTaskStore.getState().fetchTasks('2026-10-08', '2026-10-08')
  useProjectStore.setState({ selectedProjectId: 2 })
  assert.deepEqual(useTaskStore.getState().tasks, [])
  const second = useTaskStore.getState().fetchTasks('2026-10-08', '2026-10-08')
  newRequest.resolve([task(2, 2)])
  await second
  oldRequest.resolve([task(1, 1)])
  await first
  assert.deepEqual(useTaskStore.getState().tasks.map((item) => item.projectId), [2])
  assert.equal(useTaskStore.getState().loading, false)
})

test('新建尚未完成时切换项目：保存到最初选择的归属，不插入新项目列表', async () => {
  const response = deferred<Task>()
  let capturedProjectId: number | undefined
  api.tasksApi.create = (payload) => { capturedProjectId = payload.projectId; return response.promise }
  useProjectStore.setState({ selectedProjectId: 1 })
  const pending = useTaskStore.getState().createTask({ title: '任务', dueDate: '2026-10-08' })
  useProjectStore.setState({ selectedProjectId: 2 })
  response.resolve(task(3, 1))
  await pending
  assert.equal(capturedProjectId, 1)
  assert.deepEqual(useTaskStore.getState().tasks, [])
})

test('移动待办后从原项目列表移除，全部项目下默认新建到默认项目', async () => {
  useProjectStore.setState({ selectedProjectId: 1 })
  useTaskStore.setState({ tasks: [task(4, 1)] })
  api.tasksApi.update = async () => task(4, 2)
  await useTaskStore.getState().updateTask(4, { projectId: 2 })
  assert.deepEqual(useTaskStore.getState().tasks, [])
  useProjectStore.setState({ selectedProjectId: null })
  api.tasksApi.create = async (payload) => task(5, payload.projectId!)
  await useTaskStore.getState().createTask({ title: '任务', dueDate: '2026-10-08' })
  assert.equal(useTaskStore.getState().tasks[0].projectId, 1)
})

test('另一窗口项目变更通知会刷新项目及选择，并清空旧范围任务', async () => {
  savedProjectId = 1
  await useProjectStore.getState().initialize()
  useTaskStore.setState({ tasks: [task(6, 1)] })
  savedProjectId = 2
  listeners.get('push:projectsChanged')!()
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(useProjectStore.getState().selectedProjectId, 2)
  assert.equal(useProjectStore.getState().projects.length, 2)
  assert.deepEqual(useTaskStore.getState().tasks, [])
  await useProjectStore.getState().selectProject(null)
  assert.equal(savedProjectId, null)
  assert.equal(useProjectStore.getState().selectedProjectId, null)
})

test('旧的项目设置读取请求不会覆盖刚保存的新选择', async () => {
  const response = deferred<number | null>()
  api.projectsApi.getSelection = () => response.promise
  const oldRefresh = useProjectStore.getState().refresh()
  await useProjectStore.getState().selectProject(2)
  response.resolve(1)
  await oldRefresh
  assert.equal(useProjectStore.getState().selectedProjectId, 2)
  assert.equal(savedProjectId, 2)
})

test('改名只刷新名称：保留当前选择与已加载的任务，另一窗口通知可更新项目名称', async () => {
  const renamed = { ...projects[1], name: '工作事务' }
  useProjectStore.setState({ projects: projects.map((item) => ({ ...item })), selectedProjectId: 2 })
  const tasks = [task(7, 2)]
  useTaskStore.setState({ tasks })
  await useProjectStore.getState().renameProject(2, renamed.name)
  assert.equal(useProjectStore.getState().projects.find((item) => item.id === 2)!.name, renamed.name)
  assert.equal(useProjectStore.getState().selectedProjectId, 2)
  assert.equal(useTaskStore.getState().tasks, tasks)

  api.projectsApi.list = async () => [projects[0], { ...renamed, name: '跨窗口改名' }]
  savedProjectId = 2
  api.projectsApi.getSelection = async () => savedProjectId
  listeners.get('push:projectsChanged')!()
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(useProjectStore.getState().projects[1].name, '跨窗口改名')
  assert.equal(useTaskStore.getState().tasks, tasks)
})

test('改名前发出的旧列表不会恢复旧名称，同时仍同步另一窗口的项目选择', async () => {
  const oldList = deferred<Project[]>()
  api.projectsApi.list = () => oldList.promise
  api.projectsApi.getSelection = async () => 1
  useProjectStore.setState({ projects: projects.map((item) => ({ ...item })), selectedProjectId: 2 })
  const refresh = useProjectStore.getState().refresh()
  await useProjectStore.getState().renameProject(2, '最新名称')
  oldList.resolve(projects)
  await refresh
  assert.equal(useProjectStore.getState().projects[1].name, '最新名称')
  assert.equal(useProjectStore.getState().selectedProjectId, 1)
})

test('导出快照是只读操作：不改 tasks、不改项目选择、不发数据变更通知', async () => {
  const existingTasks = [task(7, 2)]
  exportSnapshotResult = {
    capturedAt: '2026-10-14T09:30:00.000Z',
    today: '2026-10-14',
    includeRecurring: true,
    project: null,
    tasks: [{
      key: '7:2026-10-14',
      taskId: 7,
      projectId: 2,
      projectName: '工作',
      title: '任务 7',
      priority: 'none',
      dueDate: '2026-10-14',
      notes: null,
      recurrenceType: null,
      isOverdue: false,
      subtasks: [],
    }],
    summary: { taskCount: 1, subtaskCount: 0, completedSubtaskCount: 0 },
  }
  useTaskStore.setState({ tasks: existingTasks })
  useProjectStore.setState({ selectedProjectId: 2 })
  widgetNotifyCount = 0
  // 前面的用例可能改过项目选择，store 订阅会按“切换项目即清空列表”的既有约定清空任务；
  // 因此在设置完项目之后、调用导出之前取基线。
  const tasksBeforeExport = useTaskStore.getState().tasks
  const selectionBeforeExport = useProjectStore.getState().selectedProjectId

  const result = await useTaskStore.getState().fetchExportSnapshot({ includeRecurring: true })

  assert.deepEqual(lastExportOptions, { includeRecurring: true }, '必须把选项原样传给数据层')
  assert.equal(result.tasks[0].taskId, 7)
  assert.equal(result.summary.taskCount, 1)
  assert.deepEqual(useTaskStore.getState().tasks, tasksBeforeExport, '导出不能覆盖可见任务列表')
  assert.equal(useProjectStore.getState().selectedProjectId, selectionBeforeExport, '导出不能改动当前项目选择')
  assert.equal(widgetNotifyCount, 0, '导出不能触发悬浮窗刷新或完成事件')
})

test('导出快照不勾选循环任务时只传选项，不额外改动 store', async () => {
  exportSnapshotResult = {
    capturedAt: '2026-10-14T09:30:00.000Z',
    today: '2026-10-14',
    includeRecurring: false,
    project: null,
    tasks: [],
    summary: { taskCount: 0, subtaskCount: 0, completedSubtaskCount: 0 },
  }
  const before = useTaskStore.getState().tasks
  const result = await useTaskStore.getState().fetchExportSnapshot({ includeRecurring: false })
  assert.deepEqual(lastExportOptions, { includeRecurring: false })
  assert.deepEqual(result.tasks, [])
  assert.equal(useTaskStore.getState().tasks, before, '空结果也不能清空可见任务列表')
})

test.after(() => {
  Reflect.deleteProperty(globalThis, '__calendarProjectApi')
  Reflect.deleteProperty(globalThis, 'window')
})
