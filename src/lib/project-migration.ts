interface MigrationDatabase {
  execute: (sql: string, params?: unknown[]) => Promise<unknown>
  select: <T>(sql: string, params?: unknown[]) => Promise<T>
}

/** v3：保留现有任务及完成记录，把旧任务归入默认项目；允许两个窗口同时初始化。 */
export async function migrateProjects(db: MigrationDatabase): Promise<void> {
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      createdAt TEXT NOT NULL
    )`)
    await db.execute(
      'INSERT OR IGNORE INTO projects (id, name, createdAt) VALUES (1, ?, ?)',
      ['默认项目', new Date().toISOString()],
    )
    const columns = await db.select<{ name: string }[]>('PRAGMA table_info(tasks)')
    if (!columns.some((column) => column.name === 'projectId')) {
      try {
        // SQLite 对已有数据的表不允许新增「非空默认值 + REFERENCES」列；用触发器校验归属，避免重建任务表。
        await db.execute('ALTER TABLE tasks ADD COLUMN projectId INTEGER NOT NULL DEFAULT 1')
      } catch (error) {
        // 另一个窗口可能刚完成同一迁移；仅在列确实已存在时允许继续。
        const latest = await db.select<{ name: string }[]>('PRAGMA table_info(tasks)')
        if (!latest.some((column) => column.name === 'projectId')) throw error
      }
    }
    await db.execute(`CREATE TRIGGER IF NOT EXISTS tasks_project_insert
      BEFORE INSERT ON tasks WHEN NOT EXISTS (SELECT 1 FROM projects WHERE id = NEW.projectId)
      BEGIN SELECT RAISE(ABORT, '任务所属项目不存在'); END`)
    await db.execute(`CREATE TRIGGER IF NOT EXISTS tasks_project_update
      BEFORE UPDATE OF projectId ON tasks WHEN NOT EXISTS (SELECT 1 FROM projects WHERE id = NEW.projectId)
      BEGIN SELECT RAISE(ABORT, '任务所属项目不存在'); END`)
    await db.execute('CREATE INDEX IF NOT EXISTS idx_tasks_project_dueDate ON tasks(projectId, dueDate)')
    await db.execute('PRAGMA user_version = 3')
  } catch (error) {
    console.error('项目数据升级失败:', error)
    throw new Error('项目数据升级失败，请关闭日历后重新打开')
  }
}
