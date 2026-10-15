import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import type { Priority, Project, RecurrenceType, Task } from "@shared/types";
import type { Subtask } from "@shared/types";
import type { TaskOccurrenceRow, SubtaskOccurrenceRow } from "./db.ts";
import type {
  TaskExportOptions,
  TaskExportRaw,
  TaskExportSnapshot,
} from "./task-export-model.ts";
import type { matchesRecurrence as MatchesRecurrenceType } from "./task-recurrence.ts";

/**
 * 统一导出选择器的纯规则测试。
 *
 * today 固定为 2026-10-14，不依赖机器当天日期；所有数据由下面的工厂构造。
 * 被测模块经 esbuild 打包，以便解析 @shared 与 @/lib 路径别名（与其它数据层测试一致）。
 */

const bundled = await build({
  stdin: {
    contents:
      "export { buildTaskExportSnapshot } from './src/lib/task-export-model.ts';" +
      "export { matchesRecurrence } from './src/lib/task-recurrence.ts';",
    resolveDir: fileURLToPath(new URL("../../", import.meta.url)),
    loader: "ts",
  },
  tsconfig: fileURLToPath(new URL("../../tsconfig.app.json", import.meta.url)),
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
});
const selector = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
) as {
  buildTaskExportSnapshot: (raw: TaskExportRaw, options: TaskExportOptions) => TaskExportSnapshot;
  matchesRecurrence: typeof MatchesRecurrenceType;
};
const { buildTaskExportSnapshot, matchesRecurrence } = selector;

export const TODAY = "2026-10-14";
export const CAPTURED_AT = "2026-10-14T09:30:00.000Z";
const PROJECTS: Project[] = [
  { id: 1, name: "个人生活", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: 2, name: "工作", createdAt: "2026-01-02T00:00:00.000Z" },
];

export interface TaskSeed {
  id: number;
  title: string;
  dueDate: string;
  projectId?: number;
  priority?: Priority;
  isCompleted?: boolean;
  isFailed?: boolean;
  notes?: string | null;
  recurrenceType?: RecurrenceType | null;
  recurrenceEnd?: string | null;
  deletedAt?: string | null;
  createdAt?: string;
  subtaskTitles?: string[];
}

function makeTask(seed: TaskSeed): Task {
  return {
    id: seed.id,
    projectId: seed.projectId ?? 1,
    title: seed.title,
    priority: seed.priority ?? "none",
    dueDate: seed.dueDate,
    isCompleted: seed.isCompleted ?? false,
    isFailed: seed.isFailed ?? false,
    completedAt: seed.isCompleted ? "2026-10-01T00:00:00.000Z" : null,
    notes: seed.notes ?? null,
    recurrenceType: seed.recurrenceType ?? null,
    recurrenceEnd: seed.recurrenceEnd ?? null,
    deletedAt: seed.deletedAt ?? null,
    createdAt: seed.createdAt ?? `2026-01-${String(seed.id).padStart(2, "0")}T00:00:00.000Z`,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

/** 建立子任务时按母任务顺序分配 id：taskId * 100 + 序号，便于断言。 */
function makeSubtasks(taskIds: number[], seeds: TaskSeed[]): Subtask[] {
  const result: Subtask[] = [];
  for (const taskId of taskIds) {
    const seed = seeds.find((item) => item.id === taskId)!;
    (seed.subtaskTitles ?? []).forEach((title, index) => {
      result.push({
        id: taskId * 100 + index,
        taskId,
        title,
        sortOrder: index,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });
    });
  }
  return result;
}

export interface Seed {
  tasks: TaskSeed[];
  occurrences?: Array<Partial<TaskOccurrenceRow> & { taskId: number; date: string }>;
  subtaskOccurrences?: Array<Partial<SubtaskOccurrenceRow> & { subtaskId: number; date: string }>;
  projects?: Project[];
  today?: string;
}

export function makeRaw(seed: Seed): TaskExportRaw {
  const tasks = seed.tasks.map(makeTask);
  const occurrences: TaskOccurrenceRow[] = (seed.occurrences ?? []).map((item) => ({
    id: item.id ?? item.taskId * 10,
    taskId: item.taskId,
    date: item.date,
    isCompleted: item.isCompleted ?? false,
    isFailed: item.isFailed ?? false,
    isSkipped: item.isSkipped ?? false,
  }));
  const subtasks = makeSubtasks(seed.tasks.map((task) => task.id), seed.tasks);
  const subtaskOccurrences: SubtaskOccurrenceRow[] = (seed.subtaskOccurrences ?? []).map((item) => ({
    id: item.id ?? item.subtaskId,
    subtaskId: item.subtaskId,
    date: item.date,
    isCompleted: item.isCompleted ?? false,
  }));
  return {
    tasks,
    occurrences,
    subtasks,
    subtaskOccurrences,
    capturedAt: CAPTURED_AT,
    today: seed.today ?? TODAY,
    projects: seed.projects ?? PROJECTS,
  };
}

/** 计划固定的基线数据：普通任务 10/11/12/13 与循环任务 20/21。 */
const BASE_SEED: Seed = {
  tasks: [
    { id: 10, title: "逾期未完成", dueDate: "2026-10-13", isFailed: true, subtaskTitles: ["已完成步骤", "未完成步骤"] },
    { id: 11, title: "远期任务", dueDate: "2027-01-05", subtaskTitles: ["远期步骤一", "远期步骤二"] },
    { id: 12, title: "已完成任务", dueDate: "2026-10-12", isCompleted: true },
    { id: 13, title: "回收箱任务", dueDate: "2026-10-10", deletedAt: "2026-10-11T00:00:00.000Z" },
    { id: 14, title: "无子任务", dueDate: "2026-10-20", projectId: 2, priority: "high" },
    {
      id: 20,
      title: "每日循环",
      dueDate: "2026-10-14",
      projectId: 2,
      recurrenceType: "daily",
      subtaskTitles: ["循环步骤一", "循环步骤二"],
    },
  ],
  occurrences: [
    { taskId: 20, date: "2026-10-14", isCompleted: true },
    { taskId: 20, date: "2026-10-15", isSkipped: true },
  ],
  subtaskOccurrences: [
    // 15 日已完成、16 日未完成，用来验证不能串日读取状态。
    { subtaskId: 2000, date: "2026-10-15", isCompleted: true },
    { subtaskId: 2001, date: "2026-10-15", isCompleted: true },
  ],
};

test("默认不勾选循环任务：只导出普通未完成任务并统计真实子任务", () => {
  const snapshot = buildTaskExportSnapshot(makeRaw(BASE_SEED), { includeRecurring: false });
  // dueDate 升序：10（10-13）、14（10-20）、11（2027-01-05）
  assert.deepEqual(snapshot.tasks.map((task) => task.taskId), [10, 14, 11]);
  assert.deepEqual(snapshot.summary, { taskCount: 3, subtaskCount: 4, completedSubtaskCount: 0 });
  assert.equal(snapshot.includeRecurring, false);
  assert.equal(snapshot.capturedAt, CAPTURED_AT);
  assert.equal(snapshot.today, TODAY);
  assert.equal(snapshot.tasks.some((task) => task.taskId === 20), false, "循环任务必须完全不出现");
  assert.equal(snapshot.tasks.some((task) => task.taskId === 12), false, "已完成任务不导出");
  assert.equal(snapshot.tasks.some((task) => task.taskId === 13), false, "回收箱任务不导出");
  assert.equal(
    snapshot.tasks.find((task) => task.taskId === 14)!.subtasks.length,
    0,
    "无子任务的母任务仍然保留",
  );
});

test("计划基线：默认结果与统计与设计一致", () => {
  // 与 BASE_SEED 相同的结构，但只保留计划里点名的 10/11 两条普通任务。
  const raw = makeRaw({
    tasks: [
      { id: 10, title: "逾期未完成", dueDate: "2026-10-13", isFailed: true, subtaskTitles: ["已完成步骤", "未完成步骤"] },
      { id: 11, title: "远期任务", dueDate: "2027-01-05", subtaskTitles: ["远期步骤一", "远期步骤二"] },
      { id: 12, title: "已完成任务", dueDate: "2026-10-12", isCompleted: true },
      { id: 13, title: "回收箱任务", dueDate: "2026-10-10", deletedAt: "2026-10-11T00:00:00.000Z" },
      {
        id: 20,
        title: "每日循环",
        dueDate: "2026-10-14",
        recurrenceType: "daily",
        subtaskTitles: ["循环步骤一", "循环步骤二"],
      },
    ],
    occurrences: [
      { taskId: 20, date: "2026-10-14", isCompleted: true },
      { taskId: 20, date: "2026-10-15", isSkipped: true },
    ],
    subtaskOccurrences: [
      { subtaskId: 1000, date: "2026-10-13", isCompleted: true },
      { subtaskId: 1100, date: "2027-01-05", isCompleted: true },
      { subtaskId: 1101, date: "2027-01-05", isCompleted: true },
    ],
  });
  const snapshot = buildTaskExportSnapshot(raw, { includeRecurring: false });
  assert.deepEqual(snapshot.tasks.map((task) => task.taskId), [10, 11]);
  assert.deepEqual(snapshot.summary, { taskCount: 2, subtaskCount: 4, completedSubtaskCount: 3 });
  assert.deepEqual(
    snapshot.tasks.find((task) => task.taskId === 10)!.subtasks.map((subtask) => subtask.isCompleted),
    [true, false],
  );
  assert.deepEqual(
    snapshot.tasks.find((task) => task.taskId === 11)!.subtasks.map((subtask) => subtask.isCompleted),
    [true, true],
    "母任务未完成时全部子任务保留，已完成数量照常统计",
  );
});

test("勾选循环任务：只保留今天之后最近一次有效发生并读取该日子任务状态", () => {
  const snapshot = buildTaskExportSnapshot(makeRaw(BASE_SEED), { includeRecurring: true });
  const recurring = snapshot.tasks.filter((task) => task.taskId === 20);
  assert.equal(recurring.length, 1, "每条循环母任务只能出现一次");
  assert.equal(recurring[0].dueDate, "2026-10-16", "14 日已完成、15 日跳过，应选 16 日");
  assert.equal(recurring[0].key, "20:2026-10-16");
  assert.deepEqual(
    recurring[0].subtasks.map((subtask) => subtask.isCompleted),
    [false, false],
    "必须读取 16 日的状态，不能串到 15 日",
  );
  assert.deepEqual(snapshot.tasks.map((task) => task.taskId), [10, 20, 14, 11]);
});

test("循环模板标记不代表整个序列：模板失败但未来发生有效时仍纳入", () => {
  const raw = makeRaw({
    tasks: [
      {
        id: 30,
        title: "模板已标记失败",
        dueDate: "2026-10-14",
        isFailed: true,
        recurrenceType: "daily",
        subtaskTitles: ["步骤"],
      },
    ],
  });
  const snapshot = buildTaskExportSnapshot(raw, { includeRecurring: true });
  assert.deepEqual(
    snapshot.tasks.map((task) => [task.taskId, task.dueDate, task.recurrenceType]),
    [[30, "2026-10-14", "daily"]],
    "模板 isFailed 不能排除全部未来发生",
  );
  assert.equal(snapshot.summary.taskCount, 1);
});

test("模板已完成的循环任务仍按今天的具体发生状态判断", () => {
  // 历史发生（昨天）已完成，但今天这一次未完成：仍应纳入并读取今天的子任务状态。
  const raw = makeRaw({
    tasks: [
      {
        id: 31,
        title: "模板已完成但今天未完成",
        dueDate: "2026-10-01",
        isCompleted: true,
        recurrenceType: "daily",
        subtaskTitles: ["今日步骤"],
      },
    ],
    subtaskOccurrences: [{ subtaskId: 3100, date: "2026-10-14", isCompleted: true }],
  });
  const snapshot = buildTaskExportSnapshot(raw, { includeRecurring: true });
  assert.deepEqual(snapshot.tasks.map((task) => task.dueDate), ["2026-10-14"]);
  assert.deepEqual(snapshot.tasks[0].subtasks.map((subtask) => subtask.isCompleted), [true]);
});

test("月循环 31 日在缺失该日期的月份跳过，不夹成月底", () => {
  const raw = makeRaw({
    tasks: [
      {
        id: 21,
        title: "每月 31 日",
        dueDate: "2026-01-31",
        recurrenceType: "monthly",
      },
    ],
    today: "2026-02-01",
  });
  const snapshot = buildTaskExportSnapshot(raw, { includeRecurring: true });
  assert.deepEqual(snapshot.tasks.map((task) => task.dueDate), ["2026-03-31"]);
});

test("循环任务的有效日期恰好等于截止日期时仍然纳入", () => {
  const raw = makeRaw({
    tasks: [
      {
        id: 22,
        title: "截止当天仍有效",
        dueDate: "2026-10-17",
        recurrenceType: "daily",
        recurrenceEnd: "2026-10-17",
      },
    ],
  });
  const snapshot = buildTaskExportSnapshot(raw, { includeRecurring: true });
  assert.deepEqual(snapshot.tasks.map((task) => task.dueDate), ["2026-10-17"]);
});

test("截止日期之后的循环任务没有候选时不导出", () => {
  const raw = makeRaw({
    tasks: [
      {
        id: 23,
        title: "已结束循环",
        dueDate: "2026-09-01",
        recurrenceType: "daily",
        recurrenceEnd: "2026-10-01",
      },
    ],
  });
  const snapshot = buildTaskExportSnapshot(raw, { includeRecurring: true });
  assert.equal(snapshot.tasks.length, 0);
  assert.deepEqual(snapshot.summary, { taskCount: 0, subtaskCount: 0, completedSubtaskCount: 0 });
});

test("未来的失败发生被跳过，继续寻找后续有效日期", () => {
  const raw = makeRaw({
    tasks: [
      { id: 24, title: "未来失败发生", dueDate: "2026-10-14", recurrenceType: "daily" },
    ],
    occurrences: [{ taskId: 24, date: "2026-10-14", isFailed: true }],
  });
  const snapshot = buildTaskExportSnapshot(raw, { includeRecurring: true });
  assert.deepEqual(snapshot.tasks.map((task) => task.dueDate), ["2026-10-15"]);
});

test("无结束日期且未来多次已完成时不展开无限未来", () => {
  // 14~20 日全部标记完成，应选 21 日，而不是展开到更远或抛出错误。
  const occurrences = Array.from({ length: 7 }, (_, index) => ({
    taskId: 25,
    date: `2026-10-${String(14 + index).padStart(2, "0")}`,
    isCompleted: true,
  }));
  const raw = makeRaw({
    tasks: [{ id: 25, title: "连续完成", dueDate: "2026-10-01", recurrenceType: "daily" }],
    occurrences,
  });
  const snapshot = buildTaskExportSnapshot(raw, { includeRecurring: true });
  assert.deepEqual(snapshot.tasks.map((task) => task.dueDate), ["2026-10-21"]);
});

test("同名任务跨项目时各自保留并可区分项目名", () => {
  const raw = makeRaw({
    tasks: [
      { id: 40, title: "同名任务", dueDate: "2026-10-20", projectId: 1 },
      { id: 41, title: "同名任务", dueDate: "2026-10-20", projectId: 2, priority: "high" },
    ],
  });
  const snapshot = buildTaskExportSnapshot(raw, { includeRecurring: false });
  assert.deepEqual(
    snapshot.tasks.map((task) => [task.projectId, task.projectName]),
    [[2, "工作"], [1, "个人生活"]],
    "同日期按优先级排序，高优先级在前",
  );
  assert.equal(new Set(snapshot.tasks.map((task) => task.key)).size, 2, "key 必须唯一");
});

test("缺失项目时不静默丢任务，使用可读占位项目名", () => {
  const raw = makeRaw({
    tasks: [{ id: 42, title: "孤儿任务", dueDate: "2026-10-20", projectId: 99 }],
  });
  const snapshot = buildTaskExportSnapshot(raw, { includeRecurring: false });
  assert.deepEqual(snapshot.tasks.map((task) => task.projectName), ["项目 #99"]);
});

test("选择器不修改原始数据：冻结 raw 后仍可运行且输出独立", () => {
  const raw = makeRaw(BASE_SEED);
  const deepFreeze = (value: unknown): void => {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.freeze(value);
      for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    }
  };
  deepFreeze(raw);
  const snapshot = buildTaskExportSnapshot(raw, { includeRecurring: true });
  assert.ok(snapshot.tasks.length > 0);
  // 修改输出不影响 raw（输出是新建对象）。
  snapshot.tasks[0].title = "被改动";
  assert.notEqual(raw.tasks.find((task) => task.id === snapshot.tasks[0].taskId)!.title, "被改动");
});

test("非法日期返回明确错误而不是继续搜索", () => {
  const badToday = makeRaw({ tasks: [], today: "2026-13-45" });
  assert.throws(
    () => buildTaskExportSnapshot(badToday, { includeRecurring: false }),
    /不是有效日期/,
  );
  const badDue = makeRaw({ tasks: [{ id: 50, title: "坏日期", dueDate: "2026-02-30" }] });
  assert.throws(
    () => buildTaskExportSnapshot(badDue, { includeRecurring: false }),
    /不是有效日期/,
  );
  const badRecurring = makeRaw({
    tasks: [{ id: 51, title: "坏循环日期", dueDate: "not-a-date", recurrenceType: "daily" }],
  });
  assert.throws(
    () => buildTaskExportSnapshot(badRecurring, { includeRecurring: true }),
    /不是有效日期/,
  );
});

test("非法选项类型被拒绝", () => {
  const raw = makeRaw({ tasks: [] });
  assert.throws(
    () => buildTaskExportSnapshot(raw, { includeRecurring: "yes" as unknown as boolean }),
    /布尔值/,
  );
});

test("逾期标记与失败任务可读性", () => {
  const raw = makeRaw({
    tasks: [
      { id: 60, title: "逾期未失败", dueDate: "2026-10-01" },
      { id: 61, title: "逾期且失败", dueDate: "2026-10-02", isFailed: true },
      { id: 62, title: "今天", dueDate: "2026-10-14" },
      { id: 63, title: "未来", dueDate: "2026-10-15" },
    ],
  });
  const snapshot = buildTaskExportSnapshot(raw, { includeRecurring: false });
  assert.deepEqual(
    snapshot.tasks.map((task) => [task.taskId, task.isOverdue]),
    [[60, true], [61, false], [62, false], [63, false]],
  );
  assert.equal(snapshot.tasks.find((task) => task.taskId === 61)!.title, "逾期且失败");
});

test("提取后的 matchesRecurrence 与既有循环语义一致", () => {
  const start = new Date(2026, 4, 15); // 2026-05-15 星期五
  assert.equal(matchesRecurrence(new Date(2026, 4, 16), start, "daily"), true);
  assert.equal(matchesRecurrence(new Date(2026, 4, 16), start, "weekday"), false);
  assert.equal(matchesRecurrence(new Date(2026, 4, 16), start, "weekend"), true);
  assert.equal(matchesRecurrence(new Date(2026, 4, 22), start, "weekly"), true);
  assert.equal(matchesRecurrence(new Date(2026, 5, 15), start, "monthly"), true);
  assert.equal(matchesRecurrence(new Date(2026, 5, 30), start, "monthly"), false);
  assert.equal(matchesRecurrence(new Date(2026, 4, 16), start, "unknown"), false);
});

test("循环任务跨年时窗口内的最近有效日期用完整年份表示", () => {
  // today 是 2026-12-15，开始日期 2027-01-31 在窗口内且跨年。
  const raw = makeRaw({
    tasks: [
      { id: 70, title: "跨年循环", dueDate: "2027-01-31", recurrenceType: "monthly" },
    ],
    today: "2026-12-15",
  });
  const snapshot = buildTaskExportSnapshot(raw, { includeRecurring: true });
  assert.deepEqual(snapshot.tasks.map((task) => task.dueDate), ["2027-01-31"]);
  assert.equal(snapshot.tasks[0].dueDate.startsWith("2027"), true);
});

test("结束日期早于起点时没有任何候选", () => {
  // 循环已经结束：结束日期在起点（今天）之前，不再展开任何未来发生。
  const raw = makeRaw({
    tasks: [
      {
        id: 71,
        title: "已结束的每日循环",
        dueDate: "2026-09-01",
        recurrenceType: "daily",
        recurrenceEnd: "2026-10-13",
      },
    ],
    today: "2026-10-14",
  });
  const snapshot = buildTaskExportSnapshot(raw, { includeRecurring: true });
  assert.deepEqual(snapshot.tasks, [], "已结束的循环任务不导出");
  assert.deepEqual(snapshot.summary, { taskCount: 0, subtaskCount: 0, completedSubtaskCount: 0 });
});

test("结束日期在窗口内时按结束日期包含边界选取", () => {
  const raw = makeRaw({
    tasks: [
      {
        id: 73,
        title: "即将结束",
        dueDate: "2026-10-01",
        recurrenceType: "daily",
        recurrenceEnd: "2026-11-02",
      },
    ],
    today: "2026-10-14",
    // 窗口内 10-14 到 10-31 全部跳过，下一次有效日期是 11-01。
    occurrences: Array.from({ length: 18 }, (_, index) => ({
      taskId: 73,
      date: `2026-10-${String(14 + index).padStart(2, "0")}`,
      isSkipped: true,
    })),
  });
  const snapshot = buildTaskExportSnapshot(raw, { includeRecurring: true });
  assert.deepEqual(snapshot.tasks.map((task) => task.dueDate), ["2026-11-01"]);
});

test("未来开始的循环任务在窗口内时按开始日期导出", () => {
  const raw = makeRaw({
    tasks: [
      { id: 72, title: "下月才开始", dueDate: "2026-11-20", recurrenceType: "daily" },
    ],
    today: "2026-10-14",
  });
  const snapshot = buildTaskExportSnapshot(raw, { includeRecurring: true });
  assert.deepEqual(snapshot.tasks.map((task) => task.dueDate), ["2026-11-20"]);
});

test("weekday 循环跳过周末", () => {
  const raw = makeRaw({
    tasks: [
      { id: 80, title: "工作日循环", dueDate: "2026-10-01", recurrenceType: "weekday" },
    ],
    // 2026-10-16 是星期五，10-17/18 是周末，下一次有效日期是 10-19 星期一。
    today: "2026-10-16",
    occurrences: [{ taskId: 80, date: "2026-10-16", isCompleted: true }],
  });
  const snapshot = buildTaskExportSnapshot(raw, { includeRecurring: true });
  assert.deepEqual(snapshot.tasks.map((task) => task.dueDate), ["2026-10-19"]);
});

test("普通任务不受 sortOrder 影响：子任务按 sortOrder 与 id 稳定排序", () => {
  const raw = makeRaw({
    tasks: [
      { id: 90, title: "多子任务", dueDate: "2026-10-20", subtaskTitles: ["一", "二", "三"] },
    ],
  });
  // 打乱输入顺序，输出仍按 sortOrder 升序。
  raw.subtasks.reverse();
  const snapshot = buildTaskExportSnapshot(raw, { includeRecurring: false });
  assert.deepEqual(
    snapshot.tasks[0].subtasks.map((subtask) => subtask.title),
    ["一", "二", "三"],
  );
  assert.deepEqual(
    snapshot.tasks[0].subtasks.map((subtask) => subtask.sortOrder),
    [0, 1, 2],
  );
});

test("指定导出项目只保留该项目的母子任务并重新统计", () => {
  const raw = makeRaw({
    tasks: [
      { id: 1, title: "个人任务", dueDate: "2026-10-14", projectId: 1, subtaskTitles: ["个人步骤"] },
      { id: 2, title: "工作任务", dueDate: "2026-10-14", projectId: 2, subtaskTitles: ["工作甲", "工作乙"] },
      { id: 3, title: "工作循环", dueDate: "2026-10-14", projectId: 2, recurrenceType: "daily" },
    ],
    subtaskOccurrences: [{ subtaskId: 200, date: "2026-10-14", isCompleted: true }],
  });
  const snapshot = buildTaskExportSnapshot(raw, { includeRecurring: false, projectId: 2 });
  assert.deepEqual(snapshot.tasks.map((task) => task.taskId), [2]);
  assert.deepEqual(snapshot.project, { id: 2, name: "工作" });
  assert.deepEqual(snapshot.summary, { taskCount: 1, subtaskCount: 2, completedSubtaskCount: 1 });
  assert.deepEqual(snapshot.tasks[0].subtasks.map((subtask) => subtask.title), ["工作甲", "工作乙"]);
});

test("全部项目选项保留跨项目任务", () => {
  const raw = makeRaw({ tasks: [
    { id: 1, title: "个人", dueDate: "2026-10-14", projectId: 1 },
    { id: 2, title: "工作", dueDate: "2027-01-05", projectId: 2 },
  ] });
  const snapshot = buildTaskExportSnapshot(raw, { includeRecurring: false, projectId: null });
  assert.deepEqual(snapshot.tasks.map((task) => task.taskId), [1, 2]);
  assert.equal(snapshot.project, null);
});

test("没有未完成任务的项目仍保留所选项目名", () => {
  const snapshot = buildTaskExportSnapshot(makeRaw({ tasks: [] }), { includeRecurring: false, projectId: 2 });
  assert.deepEqual(snapshot.project, { id: 2, name: "工作" });
  assert.deepEqual(snapshot.summary, { taskCount: 0, subtaskCount: 0, completedSubtaskCount: 0 });
});

test("非法或不存在的导出项目被明确拒绝", () => {
  const raw = makeRaw({ tasks: [] });
  for (const projectId of [0, -1, 1.5, "2" as unknown as number]) {
    assert.throws(() => buildTaskExportSnapshot(raw, { includeRecurring: false, projectId }), /导出项目/);
  }
  assert.throws(() => buildTaskExportSnapshot(raw, { includeRecurring: false, projectId: 99 }), /项目不存在/);
});
