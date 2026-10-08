import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { migrateProjects } from './project-migration.ts'
import type { Db } from './db.ts'

// 使用真实 SQLite 执行数据层 SQL；所有数据都在内存中，不打开正式库或测试库。
function sqliteAdapter(database: DatabaseSync) {
  return {
    execute: async (sql: string, params: unknown[] = []) => {
      if (sql.split(';').filter((part) => part.trim()).length > 1) {
        database.exec(sql)
        return { rowsAffected: 0, lastInsertId: undefined }
      }
      const result = database.prepare(sql).run(...params as SQLInputValue[])
      return { rowsAffected: Number(result.changes), lastInsertId: Number(result.lastInsertRowid) }
    },
    select: async <T>(sql: string, params: unknown[] = []): Promise<T> =>
      database.prepare(sql).all(...params as SQLInputValue[]) as T,
  }
}

// 复用 Vite 已有的 esbuild 解析前端路径别名，仅替换桌面数据库连接，业务实现保持原样。
const bundled = await build({
  entryPoints: [fileURLToPath(new URL('./db.ts', import.meta.url))],
  tsconfig: fileURLToPath(new URL('../../tsconfig.app.json', import.meta.url)),
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  plugins: [{
    name: '内存 SQLite 连接',
    setup(builder) {
      builder.onResolve({ filter: /^@tauri-apps\/plugin-sql$/ }, () => ({ path: 'sqlite', namespace: '项目测试' }))
      builder.onLoad({ filter: /.*/, namespace: '项目测试' }, () => ({
        contents: 'export default class Database { static async load() { return globalThis.__calendarProjectTestDb } }',
        loader: 'js',
      }))
    },
  }],
})
const dataLayer = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`) as {
  MemoryDb: new () => Db
  SqliteDb: new () => Db & { connect: () => Promise<void> }
}

function dateOffset(offset = 0): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

for (const kind of ['SQLite', '浏览器内存'] as const) {
  async function makeDb() {
    if (kind === '浏览器内存') return { db: new dataLayer.MemoryDb(), close: () => {} }
    const database = new DatabaseSync(':memory:')
    const testGlobal = globalThis as typeof globalThis & { __calendarProjectTestDb?: ReturnType<typeof sqliteAdapter> }
    testGlobal.__calendarProjectTestDb = sqliteAdapter(database)
    const db = new dataLayer.SqliteDb()
    await db.connect()
    return { db, close: () => { database.close(); delete testGlobal.__calendarProjectTestDb } }
  }

  test(`${kind}：普通及循环任务按项目隔离，全部视图包含两组任务`, async () => {
    const { db, close } = await makeDb()
    try {
      const project = await db.createProject('工作')
      const personal = await db.createTask({ title: '同名任务', dueDate: dateOffset() })
      const recurring = await db.createTask({ title: '同名任务', projectId: project.id, dueDate: dateOffset(), recurrenceType: 'daily', recurrenceEnd: dateOffset(2) })
      assert.equal(personal.projectId, 1)
      assert.deepEqual((await db.listTasks(dateOffset(), dateOffset(2), 1)).map((task) => task.id), [personal.id])
      const workTasks = await db.listTasks(dateOffset(), dateOffset(2), project.id)
      assert.equal(workTasks.length, 3)
      assert.ok(workTasks.every((task) => task.id === recurring.id && task.projectId === project.id && task.isRecurring))
      assert.equal((await db.listTasks(dateOffset(), dateOffset(2), null)).length, 4)
      assert.deepEqual(new Set((await db.taskTrend('month', project.id)).map((task) => task.taskId)), new Set([recurring.id]))
      assert.equal((await db.completion('month', 1)).overall.total, 1)
      assert.equal((await db.completion('month', project.id)).overall.total, 1)
      assert.equal((await db.completion('month', null)).overall.total, 2)
    } finally { close() }
  })

  test(`${kind}：项目选择持久化，拒绝空名称、重名和不存在的归属`, async () => {
    const { db, close } = await makeDb()
    try {
      assert.equal(await db.getSelectedProjectId(), 1)
      const project = await db.createProject('  Study  ')
      assert.equal(project.name, 'Study')
      await db.selectProject(project.id)
      assert.equal(await db.getSelectedProjectId(), project.id)
      await db.selectProject(null)
      assert.equal(await db.getSelectedProjectId(), null)
      await assert.rejects(db.createProject(' '), /项目名称/)
      await assert.rejects(db.createProject('study'), /同名/)
      await assert.rejects(db.selectProject(999), /项目不存在/)
      await assert.rejects(db.createTask({ title: '无效归属', projectId: 999, dueDate: dateOffset() }), /项目不存在/)
      assert.equal((await db.listTasks(dateOffset(), dateOffset(), null)).length, 0)
      assert.equal((await db.listProjects()).length, 2)
    } finally { close() }
  })

  test(`${kind}：项目改名持久化且保留任务、循环记录、回收箱和当前选择`, async () => {
    const { db, close } = await makeDb()
    try {
      const project = await db.createProject('工作')
      const normal = await db.createTask({ title: '普通任务', projectId: project.id, dueDate: dateOffset(), subtasks: ['已完成', '待完成'] })
      const cycle = await db.createTask({ title: '循环任务', projectId: project.id, dueDate: dateOffset(), recurrenceType: 'daily', subtasks: ['循环步骤'] })
      const trashed = await db.createTask({ title: '回收箱任务', projectId: project.id, dueDate: dateOffset() })
      await db.toggleSubtask(normal.subtasks![0].id, dateOffset(), true)
      await db.updateOccurrence(cycle.id, dateOffset(), { isCompleted: true })
      await db.deleteTask(trashed.id)
      await db.selectProject(project.id)
      const before = await db.listTasks(dateOffset(), dateOffset(1), project.id)
      const renamed = await db.renameProject(project.id, '  工作事务  ')
      assert.deepEqual(renamed, { ...project, name: '工作事务' })
      assert.equal((await db.listProjects()).find((item) => item.id === project.id)!.name, '工作事务')
      assert.equal(await db.getSelectedProjectId(), project.id)
      assert.deepEqual(await db.listTasks(dateOffset(), dateOffset(1), project.id), before)
      assert.deepEqual((await db.listDeleted(project.id)).map((task) => task.id), [trashed.id])
      await db.renameProject(1, '个人生活')
      const defaultTask = await db.createTask({ title: '默认归属', dueDate: dateOffset() })
      assert.equal(defaultTask.projectId, 1)
      await assert.rejects(db.renameProject(project.id, '个人生活'), /同名/)
      await assert.rejects(db.renameProject(project.id, ' '), /项目名称/)
      await assert.rejects(db.renameProject(project.id, '字'.repeat(41)), /40/)
      await assert.rejects(db.renameProject(999, '不存在'), /项目不存在/)
      assert.equal((await db.listProjects()).find((item) => item.id === project.id)!.name, '工作事务')
    } finally { close() }
  })

  test(`${kind}：移动普通任务保留子任务真实进度和完成状态`, async () => {
    const { db, close } = await makeDb()
    try {
      const project = await db.createProject('工作')
      const task = await db.createTask({ title: '有子任务', dueDate: dateOffset(), subtasks: ['已完成', '待完成'] })
      await db.toggleSubtask(task.subtasks![0].id, dateOffset(), true)
      await db.updateTask(task.id, { isCompleted: true })
      assert.deepEqual((await db.listTasks(dateOffset(), dateOffset(), 1))[0].subtasks.map((subtask) => subtask.isCompleted), [true, true])
      const moved = await db.updateTask(task.id, { projectId: project.id, isCompleted: false })
      assert.equal(moved.projectId, project.id)
      assert.deepEqual(moved.subtasks!.map((subtask) => subtask.isCompleted), [true, false])
      assert.equal((await db.listTasks(dateOffset(), dateOffset(), 1)).length, 0)
      const workTasks = await db.listTasks(dateOffset(), dateOffset(), project.id)
      assert.equal(workTasks.length, 1)
      assert.deepEqual(workTasks[0].subtasks.map((subtask) => subtask.isCompleted), [true, false])
    } finally { close() }
  })

  test(`${kind}：循环母任务完成展示在重新读取和切换项目后保留，取消完成恢复真实进度`, async () => {
    const { db, close } = await makeDb()
    try {
      const project = await db.createProject('工作')
      const task = await db.createTask({ title: '循环子任务', projectId: project.id, dueDate: dateOffset(), recurrenceType: 'daily', subtasks: ['完成步骤', '未完成步骤'] })
      await db.toggleSubtask(task.subtasks![0].id, dateOffset(), true)
      await db.updateOccurrence(task.id, dateOffset(), { isCompleted: true })
      assert.deepEqual((await db.listTasks(dateOffset(), dateOffset(), project.id))[0].subtasks.map((subtask) => subtask.isCompleted), [true, true])
      assert.deepEqual((await db.listTasks(dateOffset(), dateOffset(), null))[0].subtasks.map((subtask) => subtask.isCompleted), [true, true])
      await db.updateOccurrence(task.id, dateOffset(), { isCompleted: false })
      assert.deepEqual((await db.listTasks(dateOffset(), dateOffset(), project.id))[0].subtasks.map((subtask) => subtask.isCompleted), [true, false])
      const nextDay = (await db.listTasks(dateOffset(1), dateOffset(1), project.id))[0]
      assert.equal(nextDay.isCompleted, false)
      assert.deepEqual(nextDay.subtasks.map((subtask) => subtask.isCompleted), [false, false])
    } finally { close() }
  })

  test(`${kind}：循环任务单日修改保留项目，后续拆分可移动到另一个项目`, async () => {
    const { db, close } = await makeDb()
    try {
      const work = await db.createProject('工作')
      const study = await db.createProject('学习')
      const recurring = await db.createTask({ title: '循环任务', projectId: work.id, dueDate: dateOffset(-2), recurrenceType: 'daily', recurrenceEnd: dateOffset(3), subtasks: ['步骤'] })
      const detached = await db.detachOccurrence(recurring.id, dateOffset(-1), { title: '单日修改', subtasks: [{ id: recurring.subtasks![0].id, title: '步骤', isCompleted: true }] })
      assert.equal(detached!.projectId, work.id)
      const split = await db.splitFromDate(recurring.id, dateOffset(), { title: '后续任务', projectId: study.id, subtasks: [{ id: recurring.subtasks![0].id, title: '步骤', isCompleted: true }] })
      assert.equal(split!.projectId, study.id)
      const workTasks = await db.listTasks(dateOffset(-2), dateOffset(3), work.id)
      assert.deepEqual(workTasks.map((task) => task.dueDate).sort(), [dateOffset(-2), dateOffset(-1)])
      const studyTasks = await db.listTasks(dateOffset(-2), dateOffset(3), study.id)
      assert.equal(studyTasks.length, 4)
      assert.ok(studyTasks.every((task) => task.id === split!.id && task.projectId === study.id))
      assert.equal(studyTasks.find((task) => task.dueDate === dateOffset())!.subtasks[0].isCompleted, true)
      assert.equal((await db.listTasks(dateOffset(-2), dateOffset(3), 1)).length, 0)
    } finally { close() }
  })

  test(`${kind}：回收箱和清空操作仅处理当前项目，打卡在各项目之间共享`, async () => {
    const { db, close } = await makeDb()
    try {
      const project = await db.createProject('工作')
      const personal = await db.createTask({ title: '个人', dueDate: dateOffset() })
      const work = await db.createTask({ title: '工作', projectId: project.id, dueDate: dateOffset() })
      await db.deleteTask(personal.id)
      await db.deleteTask(work.id)
      assert.deepEqual((await db.listDeleted(project.id)).map((task) => task.id), [work.id])
      await db.emptyTrash(project.id)
      assert.deepEqual((await db.listDeleted(null)).map((task) => task.id), [personal.id])
      const restored = await db.restore(personal.id)
      assert.equal(restored.projectId, 1)
      const definition = await db.createCheckinDef({ name: '喝水', type: 'boolean' })
      await db.upsertCheckinEntry({ definitionId: definition.id, entryDate: dateOffset(), value: 'true' })
      await db.selectProject(project.id)
      assert.equal((await db.listCheckinDefs()).length, 1)
      assert.equal((await db.getCheckinEntries(dateOffset(), dateOffset()))[0].value, 'true')
    } finally { close() }
  })
}

test('v2 升级到 v3 不修改旧任务与子任务完成记录，重复迁移保持安全', async () => {
  const database = new DatabaseSync(':memory:')
  try {
    database.exec(`CREATE TABLE tasks (id INTEGER PRIMARY KEY, title TEXT, dueDate TEXT, isCompleted INTEGER);
      CREATE TABLE subtask_occurrences (subtaskId INTEGER, date TEXT, isCompleted INTEGER);
      INSERT INTO tasks VALUES (7, '旧任务', '2026-10-08', 1);
      INSERT INTO subtask_occurrences VALUES (9, '2026-10-08', 1);
      PRAGMA user_version = 2;`)
    const adapter = sqliteAdapter(database)
    await migrateProjects(adapter)
    await migrateProjects(adapter)
    const task = database.prepare('SELECT * FROM tasks').get()!
    assert.equal(task.projectId, 1)
    assert.equal(task.isCompleted, 1)
    assert.equal(task.title, '旧任务')
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM projects').get()!.count, 1)
    assert.equal(database.prepare('SELECT isCompleted FROM subtask_occurrences').get()!.isCompleted, 1)
    assert.equal(database.prepare('PRAGMA user_version').get()!.user_version, 3)
  } finally { database.close() }
})
