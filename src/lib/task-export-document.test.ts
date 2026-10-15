import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import type { TaskExportSnapshot } from "./task-export-model.ts";
import { makeRaw, type Seed } from "./task-export-model.test.ts";

/**
 * 共用文档渲染器的静态内容与安全性测试。
 *
 * 被测模块经 esbuild 打包，因此 ?inline 的样式导入与路径别名都能解析。
 */

const bundled = await build({
  stdin: {
    contents:
      "export { renderTaskExportHtml } from './src/lib/task-export-document.ts';" +
      "export { buildTaskExportSnapshot } from './src/lib/task-export-model.ts';",
    resolveDir: fileURLToPath(new URL("../../", import.meta.url)),
    loader: "ts",
  },
  tsconfig: fileURLToPath(new URL("../../tsconfig.app.json", import.meta.url)),
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  loader: { ".css": "text" },
});
const renderer = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
) as {
  renderTaskExportHtml: (snapshot: TaskExportSnapshot, preview?: { colorScheme: "light" | "dark"; variables: Record<string, string> }) => string;
  buildTaskExportSnapshot: (
    raw: ReturnType<typeof makeRaw>,
    options: { includeRecurring: boolean; projectId?: number | null },
  ) => TaskExportSnapshot;
};
const { renderTaskExportHtml, buildTaskExportSnapshot } = renderer;

test("指定项目的文档范围使用快照项目名并转义", () => {
  const raw = makeRaw({ tasks: [{ id: 1, title: "项目任务", projectId: 2, dueDate: "2026-10-14" }] });
  raw.projects = raw.projects.map((project) => project.id === 2 ? { ...project, name: "工作 <&>" } : project);
  const snapshot = buildTaskExportSnapshot(raw, { includeRecurring: false, projectId: 2 });
  const body = bodyOf(renderTaskExportHtml(snapshot));
  assert.match(body, /范围：工作 &lt;&amp;&gt; · 不限日期/);
  assert.doesNotMatch(body, /范围：全部项目/);
});

test("皮肤预览注入当前颜色但正文与白底 PDF 完全相同", () => {
  const snapshot = sampleSnapshot();
  const preview = renderTaskExportHtml(snapshot, {
    colorScheme: "dark",
    variables: { "--surface-raised": "#27211b", "--foreground": "35 30% 90%" },
  });
  const pdf = renderTaskExportHtml(snapshot);
  assert.match(preview, /<body class="paper paper-preview">/);
  assert.match(preview, /--surface-raised:\s*#27211b/);
  assert.equal(bodyOf(preview), bodyOf(pdf), "预览与导出必须保留相同任务、统计与范围");
  assert.match(pdf, /<body class="paper">/);
  assert.match(pdf, /--paper-bg:\s*#ffffff/);
  assert.doesNotMatch(pdf, /#27211b|35 30% 90%/, "皮肤颜色不能进入 PDF");
});

/** 已确认样式的 4 母任务 / 11 子任务 / 4 已完成子任务示例。 */
const SAMPLE_SEED: Seed = {
  tasks: [
    {
      id: 1,
      title: "完成日历导出功能设计",
      dueDate: "2026-10-14",
      projectId: 1,
      priority: "high",
      notes: "先确认导出界面和文件排版，再接入正式任务数据。",
      subtaskTitles: ["整理导出范围与规则", "确认弹窗布局", "完成导出清单排版", "检查深浅主题与打印效果"],
    },
    {
      id: 2,
      title: "准备产品迭代评审",
      dueDate: "2026-10-14",
      projectId: 2,
      priority: "medium",
      subtaskTitles: ["汇总本周变更", "整理待确认的问题", "准备演示材料"],
    },
    {
      id: 3,
      title: "整理个人学习计划",
      dueDate: "2026-10-15",
      projectId: 1,
      priority: "low",
      notes: "给每个目标留出实际可执行的时间。",
      subtaskTitles: ["回顾上周的学习记录", "选定本周学习主题", "安排两次专注学习"],
    },
    {
      id: 4,
      title: "补充项目进度小结",
      dueDate: "2026-10-16",
      projectId: 2,
      subtaskTitles: ["补充下一步的时间安排"],
    },
  ],
  subtaskOccurrences: [
    { subtaskId: 100, date: "2026-10-14", isCompleted: true },
    { subtaskId: 101, date: "2026-10-14", isCompleted: true },
    { subtaskId: 200, date: "2026-10-14", isCompleted: true },
    { subtaskId: 300, date: "2026-10-15", isCompleted: true },
  ],
};

function sampleSnapshot(): TaskExportSnapshot {
  return buildTaskExportSnapshot(makeRaw(SAMPLE_SEED), { includeRecurring: false });
}

/**
 * 只取文档正文：样式表里也有同名类选择器，断言必须落在实际渲染的节点上。
 */
function bodyOf(html: string): string {
  const match = /<body[^>]*>([\s\S]*)<\/body>/.exec(html);
  if (!match) {
    throw new Error(`文档缺少 body，实际长度 ${html.length}，开头：${html.slice(0, 80)}`);
  }
  return match[1];
}

/** 正文里独立的 paper-task / paper-subtasks 节点数量（排除 heading 等同前缀类名）。 */
function countNodes(body: string, className: string): number {
  const pattern = new RegExp(`class="${className}(?:[ "])`, "g");
  return (body.match(pattern) ?? []).length;
}

test("样例统计为 4 母任务 / 11 子任务 / 4 已完成", () => {
  const snapshot = sampleSnapshot();
  assert.deepEqual(snapshot.summary, { taskCount: 4, subtaskCount: 11, completedSubtaskCount: 4 });
});

test("样例文档包含全部母标题、子标题与完成状态", () => {
  const html = renderTaskExportHtml(sampleSnapshot());
  for (const title of ["完成日历导出功能设计", "准备产品迭代评审", "整理个人学习计划", "补充项目进度小结"]) {
    assert.ok(html.includes(title), `缺少母任务标题：${title}`);
  }
  for (const title of [
    "整理导出范围与规则", "确认弹窗布局", "完成导出清单排版", "检查深浅主题与打印效果",
    "汇总本周变更", "整理待确认的问题", "准备演示材料",
    "回顾上周的学习记录", "选定本周学习主题", "安排两次专注学习",
    "补充下一步的时间安排",
  ]) {
    assert.ok(html.includes(title), `缺少子任务标题：${title}`);
  }
  // 4 个已完成子任务显示“已完成”，其余显示“待完成”（4 完成 + 7 待完成）。
  assert.equal((html.match(/>已完成</g) ?? []).length, 4, "已完成子任务数量应为 4");
  assert.equal((html.match(/>待完成</g) ?? []).length, 7, "待完成任务数量应为 7");
  assert.equal((html.match(/class="done"/g) ?? []).length, 4, "已完成行必须带 done 类（勾选+划线）");
  assert.ok(html.includes("高优先级") && html.includes("中优先级") && html.includes("低优先级"));
  assert.ok(html.includes("先确认导出界面和文件排版，再接入正式任务数据。"), "备注必须完整输出");
  assert.ok(html.includes("<strong>4</strong>") && html.includes("<strong>11</strong>"));
});

test("特殊字符不会生成可执行节点", () => {
  const snapshot = buildTaskExportSnapshot(
    makeRaw({
      tasks: [
        {
          id: 9,
          title: '<script>alert("x")</script>',
          dueDate: "2026-10-14",
          notes: '引号 " 与 & 与换行\n第二行 <img src=x onerror=alert(1)>',
          subtaskTitles: ['</li><script>bad()</script>'],
        },
      ],
    }),
    { includeRecurring: false },
  );
  const html = renderTaskExportHtml(snapshot);
  const body = bodyOf(html);
  assert.equal(body.includes("<script"), false, "文档正文中不能出现 script 标签");
  assert.equal(body.includes("<img"), false, "注入的标签必须被转义");
  // 转义后属性名会变成普通文本，但仍不能由标签界定：这里按标签起始符号判断。
  assert.equal(/<\w+[^>]*onerror/i.test(body), false, "不能生成带事件属性的标签");
  assert.ok(body.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"), "标题需转义为实体");
  assert.ok(body.includes("&lt;img src=x onerror=alert(1)&gt;"), "备注里的标签也要转义");
  assert.ok(body.includes("&amp;"), "& 必须转义");
  assert.ok(body.includes("第二行"), "换行后的内容必须保留");
});

test("含循环任务时输出正确日期、循环标签与范围说明", () => {
  const snapshot = buildTaskExportSnapshot(
    makeRaw({
      tasks: [
        { id: 20, title: "每日站会", dueDate: "2026-10-14", recurrenceType: "daily", subtaskTitles: ["同步进度"] },
      ],
      occurrences: [
        { taskId: 20, date: "2026-10-14", isCompleted: true },
        { taskId: 20, date: "2026-10-15", isSkipped: true },
      ],
    }),
    { includeRecurring: true },
  );
  const html = renderTaskExportHtml(snapshot);
  assert.ok(html.includes("2026-10-16"), "必须输出所选发生日期");
  assert.ok(html.includes("每日重复"), "循环任务必须有循环标签");
  assert.ok(html.includes("含循环任务"), "范围说明要写明包含循环任务");
  assert.ok(html.includes("每条仅最近一次待完成"), "范围说明要写明循环任务口径");

  const withoutRecurring = renderTaskExportHtml(
    buildTaskExportSnapshot(makeRaw(SAMPLE_SEED), { includeRecurring: false }),
  );
  assert.ok(withoutRecurring.includes("不含循环任务"));
});

test("跨年日期带年份，避免年份歧义", () => {
  const snapshot = buildTaskExportSnapshot(
    makeRaw({
      tasks: [
        { id: 10, title: "今年任务", dueDate: "2026-10-14" },
        { id: 11, title: "明年任务", dueDate: "2027-01-05" },
      ],
      today: "2026-10-14",
    }),
    { includeRecurring: false },
  );
  const html = renderTaskExportHtml(snapshot);
  assert.ok(html.includes("10月14日"), "同年日期不带年份");
  assert.ok(html.includes("2027年1月5日"), "跨年日期必须带年份");
});

test("文档不引用外部资源，也不携带示例 PDF", () => {
  const html = renderTaskExportHtml(sampleSnapshot());
  assert.equal(/<link\b/i.test(html), false, "不能有外链样式");
  assert.equal(/https?:\/\//i.test(html), false, "不能有外部地址");
  assert.equal(/@import/i.test(html), false, "不能有 @import");
  assert.equal(/<img\b/i.test(html), false, "不能有图片资源");
  assert.equal(/base64/i.test(html), false, "不能内嵌示例 PDF 的 base64");
  assert.equal(/task-export-sample/i.test(html), false, "不能引用示例文档");
  assert.ok(html.includes("Content-Security-Policy"), "文档需要限制资源来源");
  assert.ok(html.includes("default-src 'none'"));
});

test("分页样式遵守约束：整块尽量不断、长任务允许分页、不锁死整份清单", () => {
  const html = renderTaskExportHtml(sampleSnapshot());
  assert.ok(html.includes("break-after: avoid"), "日期标题与任务标题需要避免孤立在页底");
  assert.ok(html.includes("break-inside: avoid"), "子任务行与页脚不能被裁掉");
  assert.ok(html.includes(".paper-task.long"), "长任务必须有允许分页的例外规则");
  assert.ok(html.includes("@page"), "必须有 A4 页面设置");
  assert.ok(html.includes("size: A4"));
  assert.ok(html.includes("margin: 14mm 15mm 16mm"), "页边距必须与设计一致");
  assert.ok(html.includes("counter(page)") && html.includes("counter(pages)"), "页脚必须有页码与总页数");
  assert.equal(/overflow:\s*hidden/.test(html), false, "不能用 overflow:hidden 裁切内容");
  assert.equal(/height:\s*100vh/.test(html), false, "不能强制整份清单高度");
  assert.equal(
    /\.paper\s*\{[^}]*break-inside:\s*avoid/s.test(html),
    false,
    "不能对整个清单避分页",
  );
});

test("空清单显示空态且不渲染任务块", () => {
  const html = renderTaskExportHtml(
    buildTaskExportSnapshot(makeRaw({ tasks: [] }), { includeRecurring: false }),
  );
  const body = bodyOf(html);
  assert.ok(body.includes("当前没有可导出的未完成任务"));
  assert.equal(countNodes(body, "paper-task"), 0, "空清单不应有任务块");
  assert.equal(countNodes(body, "paper-group"), 0, "空清单不应有日期分组");
  assert.ok(body.includes("<strong>0</strong>"));
});

test("无子任务的母任务不显示进度，也不渲染空子任务列表", () => {
  const html = renderTaskExportHtml(
    buildTaskExportSnapshot(
      makeRaw({ tasks: [{ id: 30, title: "没有子任务", dueDate: "2026-10-14" }] }),
      { includeRecurring: false },
    ),
  );
  const body = bodyOf(html);
  assert.ok(body.includes("没有子任务"));
  assert.equal(body.includes("子任务 <b>"), false, "无子任务时不显示 0/0 进度");
  assert.equal(countNodes(body, "paper-subtasks"), 0, "无子任务时不渲染列表");
});

test("大量母任务时不丢项", () => {
  const tasks = Array.from({ length: 100 }, (_, index) => ({
    id: 1000 + index,
    title: `批量任务 ${index + 1}`,
    dueDate: `2026-10-${String((index % 28) + 1).padStart(2, "0")}`,
    subtaskTitles: [`步骤 ${index + 1}`],
  }));
  const html = renderTaskExportHtml(
    buildTaskExportSnapshot(makeRaw({ tasks }), { includeRecurring: false }),
  );
  const body = bodyOf(html);
  for (const index of [1, 50, 100]) {
    assert.ok(body.includes(`批量任务 ${index}`), `缺少第 ${index} 条母任务`);
    assert.ok(body.includes(`步骤 ${index}`), `缺少第 ${index} 条子任务`);
  }
  assert.equal(
    countNodes(body, "paper-task"),
    100,
    `100 条母任务全部输出；实际正文中 paper-task 出现 ${(body.match(/paper-task/g) ?? []).length} 次`,
  );
});

test("单母任务超长时允许分页且每条子任务都在", () => {
  const subtaskTitles = Array.from({ length: 100 }, (_, index) => `长清单步骤 ${index + 1}`);
  const html = renderTaskExportHtml(
    buildTaskExportSnapshot(
      makeRaw({
        tasks: [
          {
            id: 40,
            title: "超长任务",
            dueDate: "2026-10-14",
            notes: "长".repeat(500),
            subtaskTitles,
          },
        ],
      }),
      { includeRecurring: false },
    ),
  );
  assert.equal((html.match(/<li class="(done|)">/g) ?? []).length, 100, "100 条子任务全部输出");
  assert.ok(html.includes("长清单步骤 100"));
  assert.ok(html.includes("long"), "超长子任务清单必须使用允许分页的类");
  assert.ok(html.includes("长".repeat(500)), "500 字中文备注必须完整输出");
});

test("emoji 与多行标题完整保留", () => {
  const html = renderTaskExportHtml(
    buildTaskExportSnapshot(
      makeRaw({
        tasks: [
          {
            id: 50,
            title: "🎉 庆祝\n第二行标题",
            dueDate: "2026-10-14",
            notes: "备注 emoji 🚀 与换行\n下一行",
            subtaskTitles: ["✅ 已完成项"],
          },
        ],
      }),
      { includeRecurring: false },
    ),
  );
  assert.ok(html.includes("🎉 庆祝"));
  assert.ok(html.includes("第二行标题"));
  assert.ok(html.includes("🚀"));
  assert.ok(html.includes("✅ 已完成项"));
  assert.ok(html.includes("white-space: pre-wrap"), "换行需要依赖 pre-wrap 保留");
});

test("文档是静态字符串：同样输入产生同样输出", () => {
  const snapshot = sampleSnapshot();
  assert.equal(renderTaskExportHtml(snapshot), renderTaskExportHtml(snapshot));
  assert.equal(typeof renderTaskExportHtml(snapshot), "string");
  assert.ok(renderTaskExportHtml(snapshot).startsWith("<!doctype html>"));
});
