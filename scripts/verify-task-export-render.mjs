// 临时验证工具：把 renderTaskExportHtml 的真实输出渲染成截图与 PDF，仅用于样式核对。
// 不进入运行时依赖，也不随应用打包。
import { createServer } from "node:http";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";

const outDir = process.env.VERIFY_OUT_DIR ?? join(process.env.TEMP ?? ".", "task-export-verify");
mkdirSync(outDir, { recursive: true });

const bundled = await build({
  stdin: {
    contents:
      'export { renderTaskExportHtml } from "./src/lib/task-export-document.ts";' +
      'export { buildTaskExportSnapshot } from "./src/lib/task-export-model.ts";',
    resolveDir: process.cwd(),
    loader: "ts",
  },
  tsconfig: "./tsconfig.app.json",
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  loader: { ".css": "text" },
});
const { renderTaskExportHtml, buildTaskExportSnapshot } = await import(
  "data:text/javascript;base64," + Buffer.from(bundled.outputFiles[0].text).toString("base64")
);

const raw = {
  tasks: [
    {
      id: 1, projectId: 1, title: "完成日历导出功能设计", priority: "high", dueDate: "2026-10-14",
      isCompleted: false, isFailed: false, completedAt: null,
      notes: "先确认导出界面和文件排版，再接入正式任务数据。", recurrenceType: null,
      recurrenceEnd: null, deletedAt: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: 2, projectId: 2, title: "准备产品迭代评审", priority: "medium", dueDate: "2026-10-14",
      isCompleted: false, isFailed: false, completedAt: null, notes: null, recurrenceType: null,
      recurrenceEnd: null, deletedAt: null, createdAt: "2026-01-02T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z",
    },
    {
      id: 3, projectId: 1, title: "整理个人学习计划", priority: "low", dueDate: "2026-10-15",
      isCompleted: false, isFailed: false, completedAt: null,
      notes: "给每个目标留出实际可执行的时间。", recurrenceType: null, recurrenceEnd: null,
      deletedAt: null, createdAt: "2026-01-03T00:00:00.000Z", updatedAt: "2026-01-03T00:00:00.000Z",
    },
    {
      id: 4, projectId: 2, title: "补充项目进度小结", priority: "none", dueDate: "2026-10-16",
      isCompleted: false, isFailed: false, completedAt: null, notes: null, recurrenceType: null,
      recurrenceEnd: null, deletedAt: null, createdAt: "2026-01-04T00:00:00.000Z", updatedAt: "2026-01-04T00:00:00.000Z",
    },
    {
      id: 5, projectId: 1, title: "每日站会", priority: "none", dueDate: "2026-10-16",
      isCompleted: false, isFailed: false, completedAt: null, notes: null, recurrenceType: "daily",
      recurrenceEnd: null, deletedAt: null, createdAt: "2026-01-05T00:00:00.000Z", updatedAt: "2026-01-05T00:00:00.000Z",
    },
    {
      id: 6, projectId: 2, title: "非常长的中文标题用来检查换行与断词行为是否正常，包含 emoji 🎉 与英文 long-token-without-spaces-abcdefghijklmnop",
      priority: "high", dueDate: "2027-01-05", isCompleted: false, isFailed: false, completedAt: null,
      notes: "备注也有换行：\n第二行备注内容，用来确认 pre-wrap 生效。", recurrenceType: null,
      recurrenceEnd: null, deletedAt: null, createdAt: "2026-01-06T00:00:00.000Z", updatedAt: "2026-01-06T00:00:00.000Z",
    },
  ],
  occurrences: [{ id: 1, taskId: 5, date: "2026-10-14", isCompleted: true, isFailed: false, isSkipped: false }],
  subtasks: [
    { id: 100, taskId: 1, title: "整理导出范围与规则", sortOrder: 0, createdAt: "", updatedAt: "" },
    { id: 101, taskId: 1, title: "确认弹窗布局", sortOrder: 1, createdAt: "", updatedAt: "" },
    { id: 102, taskId: 1, title: "完成导出清单排版", sortOrder: 2, createdAt: "", updatedAt: "" },
    { id: 103, taskId: 1, title: "检查深浅主题与打印效果", sortOrder: 3, createdAt: "", updatedAt: "" },
    { id: 200, taskId: 2, title: "汇总本周变更", sortOrder: 0, createdAt: "", updatedAt: "" },
    { id: 201, taskId: 2, title: "整理待确认的问题", sortOrder: 1, createdAt: "", updatedAt: "" },
    { id: 202, taskId: 2, title: "准备演示材料", sortOrder: 2, createdAt: "", updatedAt: "" },
    { id: 300, taskId: 3, title: "回顾上周的学习记录", sortOrder: 0, createdAt: "", updatedAt: "" },
    { id: 301, taskId: 3, title: "选定本周学习主题", sortOrder: 1, createdAt: "", updatedAt: "" },
    { id: 302, taskId: 3, title: "安排两次专注学习", sortOrder: 2, createdAt: "", updatedAt: "" },
    { id: 400, taskId: 4, title: "补充下一步的时间安排", sortOrder: 0, createdAt: "", updatedAt: "" },
    { id: 500, taskId: 5, title: "同步进度", sortOrder: 0, createdAt: "", updatedAt: "" },
  ],
  subtaskOccurrences: [
    { id: 1, subtaskId: 100, date: "2026-10-14", isCompleted: true },
    { id: 2, subtaskId: 101, date: "2026-10-14", isCompleted: true },
    { id: 3, subtaskId: 200, date: "2026-10-14", isCompleted: true },
    { id: 4, subtaskId: 300, date: "2026-10-15", isCompleted: true },
  ],
  capturedAt: "2026-10-14T09:30:00.000Z",
  today: "2026-10-14",
  projects: [
    { id: 1, name: "日历重构", createdAt: "" },
    { id: 2, name: "工作计划", createdAt: "" },
  ],
};

for (const [name, includeRecurring] of [["4-11-4", false], ["with-recurring", true]]) {
  const html = renderTaskExportHtml(buildTaskExportSnapshot(raw, { includeRecurring }));
  writeFileSync(join(outDir, `document-${name}.html`), html, "utf8");
}

// 长清单：100 条母任务，检查分页与不丢项。
const longTasks = Array.from({ length: 100 }, (_, index) => ({
  id: 1000 + index,
  projectId: 1,
  title: `批量任务 ${index + 1}`,
  priority: "none",
  dueDate: `2026-10-${String((index % 28) + 1).padStart(2, "0")}`,
  isCompleted: false,
  isFailed: false,
  completedAt: null,
  notes: index % 7 === 0 ? `第 ${index + 1} 条备注` : null,
  recurrenceType: null,
  recurrenceEnd: null,
  deletedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}));
const longSubtasks = longTasks.map((task, index) => ({
  id: 9000 + index, taskId: task.id, title: `步骤 ${index + 1}`, sortOrder: 0, createdAt: "", updatedAt: "",
}));
const longHtml = renderTaskExportHtml(
  buildTaskExportSnapshot(
    { ...raw, tasks: longTasks, subtasks: longSubtasks, occurrences: [], subtaskOccurrences: [] },
    { includeRecurring: false },
  ),
);
writeFileSync(join(outDir, "document-long.html"), longHtml, "utf8");

const server = createServer((request, response) => {
  const name = (request.url ?? "/").replace(/^\//, "") || "document-4-11-4.html";
  const html = name === "document-long.html" ? longHtml : renderTaskExportHtml(
    buildTaskExportSnapshot(raw, { includeRecurring: name.includes("with-recurring") }),
  );
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(html);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
console.log(`SERVER_PORT=${server.address().port}`);
console.log(`OUT_DIR=${outDir}`);
