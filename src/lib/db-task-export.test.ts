import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import type { Db } from "./db.ts";

/**
 * 全量只读导出查询的双实现对照测试。
 *
 * 参考 db-projects.test.ts：真实内存 SQLite adapter + MemoryDb，都不打开正式库或测试库。
 * 日期用相对偏移构造，避免依赖机器当天。
 */

// 使用真实 SQLite 执行数据层 SQL；所有数据都在内存中。
function sqliteAdapter(database: DatabaseSync) {
  return {
    execute: async (sql: string, params: unknown[] = []) => {
      if (sql.split(";").filter((part) => part.trim()).length > 1) {
        database.exec(sql);
        return { rowsAffected: 0, lastInsertId: undefined };
      }
      const result = database.prepare(sql).run(...(params as SQLInputValue[]));
      return { rowsAffected: Number(result.changes), lastInsertId: Number(result.lastInsertRowid) };
    },
    select: async <T>(sql: string, params: unknown[] = []): Promise<T> =>
      database.prepare(sql).all(...(params as SQLInputValue[])) as T,
  };
}

const bundled = await build({
  entryPoints: [fileURLToPath(new URL("./db.ts", import.meta.url))],
  tsconfig: fileURLToPath(new URL("../../tsconfig.app.json", import.meta.url)),
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  plugins: [{
    name: "内存 SQLite 连接",
    setup(builder) {
      builder.onResolve({ filter: /^@tauri-apps\/plugin-sql$/ }, () => ({ path: "sqlite", namespace: "导出查询测试" }));
      builder.onLoad({ filter: /.*/, namespace: "导出查询测试" }, () => ({
        contents: "export default class Database { static async load() { return globalThis.__calendarExportTestDb } }",
        loader: "js",
      }));
    },
  }],
});
const dataLayer = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`) as {
  MemoryDb: new () => Db;
  SqliteDb: new () => Db & { connect: () => Promise<void> };
};

function dateOffset(offset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** 只比较与实现无关的部分：capturedAt 由各自捕获时间决定。 */
function comparable(snapshot: { tasks: unknown[]; summary: unknown; today: string }): unknown {
  return { tasks: snapshot.tasks, summary: snapshot.summary, today: snapshot.today };
}

/** 导出前后的原始数据指纹，用来证明导出没有写回。 */
function fingerprint(database: DatabaseSync): string {
  const dump = (sql: string) => JSON.stringify(database.prepare(sql).all());
  return [
    dump("SELECT * FROM tasks ORDER BY id"),
    dump("SELECT * FROM subtasks ORDER BY id"),
    dump("SELECT * FROM task_occurrences ORDER BY id"),
    dump("SELECT * FROM subtask_occurrences ORDER BY id"),
    dump("SELECT * FROM settings ORDER BY key"),
  ].join("\n");
}

for (const kind of ["SQLite", "浏览器内存"] as const) {
  async function makeDb() {
    if (kind === "浏览器内存") return { db: new dataLayer.MemoryDb(), database: null, close: () => {} };
    const database = new DatabaseSync(":memory:");
    const testGlobal = globalThis as typeof globalThis & { __calendarExportTestDb?: ReturnType<typeof sqliteAdapter> };
    testGlobal.__calendarExportTestDb = sqliteAdapter(database);
    const db = new dataLayer.SqliteDb();
    await db.connect();
    return { db, database, close: () => { database.close(); delete testGlobal.__calendarExportTestDb; } };
  }

  test(`${kind}：导出快照覆盖跨项目与远期任务，而当前月列表看不到远期任务`, async () => {
    const { db, close } = await makeDb();
    try {
      const other = await db.createProject("工作");
      const today = dateOffset();
      const thisMonth = await db.createTask({ title: "本月任务", dueDate: today, subtasks: ["本月步骤"] });
      const nextYear = await db.createTask({ title: "远期任务", projectId: other.id, dueDate: dateOffset(120), subtasks: ["远期步骤"] });
      const overdue = await db.createTask({ title: "逾期任务", dueDate: dateOffset(-30), subtasks: ["逾期步骤"] });

      // 当前可见月（本月 1 日到本月末）看不到 120 天后的普通任务。
      const monthStart = `${today.slice(0, 7)}-01`;
      const monthEnd = `${today.slice(0, 7)}-28`;
      const visible = await db.listTasks(monthStart, monthEnd, null);
      assert.equal(visible.some((task) => task.id === nextYear.id), false, "listTasks 不应包含远期任务");

      const snapshot = await db.getTaskExportSnapshot({ includeRecurring: false });
      assert.deepEqual(
        snapshot.tasks.map((task) => task.title),
        ["逾期任务", "本月任务", "远期任务"],
        "导出必须包含本月、逾期与跨项目远期任务，并按 dueDate 升序",
      );
      assert.deepEqual(
        snapshot.tasks.map((task) => task.taskId),
        [overdue.id, thisMonth.id, nextYear.id],
      );
      assert.equal(snapshot.tasks.find((task) => task.taskId === nextYear.id)!.projectName, "工作");
      assert.equal(snapshot.summary.taskCount, 3);
      assert.equal(snapshot.summary.subtaskCount, 3);
      assert.deepEqual(snapshot.summary.completedSubtaskCount, 0);
    } finally { close(); }
  });

  test(`${kind}：不勾选循环任务时循环 taskId 完全不出现，勾选后每条只出现一次`, async () => {
    const { db, close } = await makeDb();
    try {
      const recurring = await db.createTask({
        title: "每日循环",
        dueDate: dateOffset(),
        recurrenceType: "daily",
        subtasks: ["循环步骤一", "循环步骤二"],
      });
      const plain = await db.createTask({ title: "普通任务", dueDate: dateOffset(1) });

      const withoutRecurring = await db.getTaskExportSnapshot({ includeRecurring: false });
      assert.deepEqual(withoutRecurring.tasks.map((task) => task.taskId), [plain.id]);
      assert.equal(
        withoutRecurring.tasks.some((task) => task.taskId === recurring.id),
        false,
        "循环模板、发生和子任务必须全部排除",
      );

      const withRecurring = await db.getTaskExportSnapshot({ includeRecurring: true });
      assert.deepEqual(
        withRecurring.tasks.filter((task) => task.taskId === recurring.id).length,
        1,
        "每条循环母任务只出现一次",
      );
      assert.equal(withRecurring.tasks.find((task) => task.taskId === recurring.id)!.dueDate, dateOffset());
      assert.equal(withRecurring.includeRecurring, true);
    } finally { close(); }
  });

  test(`${kind}：导出的发生状态不会串日，母任务未完成但子任务全完成仍纳入`, async () => {
    const { db, close } = await makeDb();
    try {
      const recurring = await db.createTask({
        title: "隔日循环",
        dueDate: dateOffset(),
        recurrenceType: "daily",
        subtasks: ["步骤一"],
      });
      // 今天完成、明天跳过：最近的有效发生是后天。
      await db.updateOccurrence(recurring.id, dateOffset(), { isCompleted: true });
      await db.skipOccurrence(recurring.id, dateOffset(1));

      const snapshot = await db.getTaskExportSnapshot({ includeRecurring: true });
      const item = snapshot.tasks.find((task) => task.taskId === recurring.id)!;
      assert.equal(item.dueDate, dateOffset(2), "必须跳过已完成与已跳过的日期");
      assert.deepEqual(item.subtasks.map((subtask) => subtask.isCompleted), [false], "不能串读今天的状态");

      // 全部子任务完成但母任务未完成（普通任务）：仍然纳入并统计 n/n。
      const normal = await db.createTask({ title: "子任务全完成", dueDate: dateOffset(), subtasks: ["甲", "乙"] });
      await db.toggleSubtask(normal.subtasks![0].id, dateOffset(), true);
      await db.toggleSubtask(normal.subtasks![1].id, dateOffset(), true);
      const second = await db.getTaskExportSnapshot({ includeRecurring: false });
      const plainItem = second.tasks.find((task) => task.taskId === normal.id)!;
      assert.deepEqual(plainItem.subtasks.map((subtask) => subtask.isCompleted), [true, true]);
      assert.equal(second.summary.completedSubtaskCount, 2);
    } finally { close(); }
  });

  test(`${kind}：已完成任务与回收箱任务不导出`, async () => {
    const { db, close } = await makeDb();
    try {
      const done = await db.createTask({ title: "已完成", dueDate: dateOffset() });
      await db.updateTask(done.id, { isCompleted: true });
      const trashed = await db.createTask({ title: "回收箱", dueDate: dateOffset() });
      await db.deleteTask(trashed.id);
      const kept = await db.createTask({ title: "保留", dueDate: dateOffset() });

      const snapshot = await db.getTaskExportSnapshot({ includeRecurring: true });
      assert.deepEqual(snapshot.tasks.map((task) => task.taskId), [kept.id]);
    } finally { close(); }
  });

  test(`${kind}：导出前后原始数据逐项一致，失败标记不被修改`, async () => {
    const { db, database, close } = await makeDb();
    try {
      await db.createProject("工作");
      // 直接写入的逾期普通任务：createTask 会把过去日期的普通任务标成失败，
      // 因此先用一个未来日期创建，再把 dueDate 改成过去，得到“逾期但未失败”的真实状态。
      const plain = await db.createTask({ title: "逾期未完成", dueDate: dateOffset(3), subtasks: ["甲"] });
      await db.updateTask(plain.id, { dueDate: dateOffset(-5) });
      const recurring = await db.createTask({ title: "循环任务", dueDate: dateOffset(), recurrenceType: "daily", subtasks: ["乙"] });
      await db.toggleSubtask(recurring.subtasks![0].id, dateOffset(), true);
      await db.updateOccurrence(recurring.id, dateOffset(), { isCompleted: true });

      // 导出必须在“既有读取路径的写库副作用”之前完成，
      // 这样才能证明导出自己不会写库、也不会标记逾期失败。
      const beforeSetting = await db.getSetting<string>("lastFailedCheckDate", "");
      const before = database ? fingerprint(database) : null;

      const exported = await db.getTaskExportSnapshot({ includeRecurring: false });
      await db.getTaskExportSnapshot({ includeRecurring: true });

      if (database && before !== null) {
        assert.equal(fingerprint(database), before, "导出不得写入 tasks/subtasks/occurrences/settings");
      }
      assert.equal(await db.getSetting<string>("lastFailedCheckDate", ""), beforeSetting, "导出不得写入失败检查日期");
      assert.equal(beforeSetting, "", "全新库不应有失败检查记录");
      const overdueItem = exported.tasks.find((task) => task.taskId === plain.id)!;
      assert.equal(overdueItem.dueDate, dateOffset(-5));
      assert.equal(
        overdueItem.isOverdue,
        true,
        `逾期普通任务保留并标记逾期 ${JSON.stringify(overdueItem)}`,
      );

      // 既有读取路径会写入失败标记；导出之后的这次调用才产生副作用。
      const beforeTasks = await db.listTasks(dateOffset(-30), dateOffset(30), null);
      assert.equal(
        beforeTasks.find((task) => task.id === plain.id)!.isFailed,
        true,
        "既有 listTasks 仍保留原有失败标记行为",
      );
      assert.notEqual(await db.getSetting<string>("lastFailedCheckDate", ""), beforeSetting);
    } finally { close(); }
  });

  test(`${kind}：两个实现的导出结果一致`, async () => {
    const offline = await makeDb();
    const online = await makeDb();
    try {
      for (const { db } of [offline, online]) {
        const other = await db.createProject("工作");
        await db.createTask({ title: "本月任务", dueDate: dateOffset(), priority: "high", subtasks: ["甲", "乙"] });
        await db.createTask({ title: "远期任务", projectId: other.id, dueDate: dateOffset(200), notes: "备注" });
        const done = await db.createTask({ title: "已完成", dueDate: dateOffset(2) });
        await db.updateTask(done.id, { isCompleted: true });
        const cycle = await db.createTask({ title: "循环任务", dueDate: dateOffset(), recurrenceType: "daily", subtasks: ["丙"] });
        await db.updateOccurrence(cycle.id, dateOffset(), { isCompleted: true });
      }
      const offlineSnapshot = await offline.db.getTaskExportSnapshot({ includeRecurring: true });
      const onlineSnapshot = await online.db.getTaskExportSnapshot({ includeRecurring: true });
      assert.deepEqual(comparable(onlineSnapshot), comparable(offlineSnapshot));
      assert.equal(onlineSnapshot.includeRecurring, offlineSnapshot.includeRecurring);

      // 不勾选循环任务时同样一致（循环组整体消失）。
      const offlinePlain = await offline.db.getTaskExportSnapshot({ includeRecurring: false });
      const onlinePlain = await online.db.getTaskExportSnapshot({ includeRecurring: false });
      assert.deepEqual(comparable(onlinePlain), comparable(offlinePlain));
      assert.equal(offlinePlain.tasks.some((task) => task.recurrenceType), false);
    } finally {
      offline.close();
      online.close();
    }
  });

  test(`${kind}：非法选项被拒绝，不返回伪造快照`, async () => {
    const { db, close } = await makeDb();
    try {
      await assert.rejects(
        db.getTaskExportSnapshot({ includeRecurring: "yes" as unknown as boolean }),
        /布尔值/,
      );
    } finally { close(); }
  });

  test(`${kind}：缺失项目的任务仍然保留并使用真实项目名`, async () => {
    const { db, close } = await makeDb();
    try {
      const task = await db.createTask({ title: "默认项目任务", dueDate: dateOffset() });
      const snapshot = await db.getTaskExportSnapshot({ includeRecurring: false });
      const item = snapshot.tasks.find((entry) => entry.taskId === task.id)!;
      assert.equal(item.projectId, 1, "默认归属为 1 号项目");
      assert.equal(item.projectName, "默认项目", "默认项目存在时给出真实名称");
      assert.equal(item.projectName.startsWith("项目 #"), false);
    } finally { close(); }
  });
}
