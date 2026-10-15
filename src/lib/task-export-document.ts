import { format, parseISO } from "date-fns";
// 文档样式随 HTML 一起内联，避免外部资源路径与打印时的样式缺失。
import documentCss from "@/styles/task-export-document.css?inline";
import type { TaskExportItem, TaskExportSnapshot } from "./task-export-model";

/** 只把预览需要的皮肤令牌传入隔离 iframe，PDF 使用文档自己的浅色令牌。 */
export const TASK_EXPORT_PREVIEW_TOKENS = [
  "--foreground", "--muted-foreground", "--primary", "--success",
  "--surface-raised", "--surface-subtle", "--surface-inset", "--border-strong",
  "--task-high-fg", "--task-high-bg", "--task-medium-fg", "--task-medium-bg",
  "--task-low-fg", "--task-low-bg", "--task-done-bg", "--scrollbar-thumb",
  "--font-display", "--shadow-raised", "--shadow-inset",
] as const;

export interface TaskExportPreviewAppearance {
  colorScheme: "light" | "dark";
  variables: Partial<Record<typeof TASK_EXPORT_PREVIEW_TOKENS[number], string>>;
}

/**
 * 未完成任务清单的唯一 HTML 渲染器。
 *
 * 预览 iframe 与原生打印的 request.html 都使用这个函数的返回值，
 * 因此不存在“两份排版”。文档是纯静态 HTML：
 * - 全部文本转义，任务标题与备注不会被解释为富文本或脚本；
 * - 不引用外部字体、图片、脚本，也不包含示例 PDF 的 base64；
 * - 预览可接收当前皮肤令牌，原生打印不传预览参数，始终保持白底文档；
 * - 页边距与页码由文档 CSS 的 @page 控制，原生侧不再叠加默认页边距。
 */

const PRIORITY_LABELS: Record<string, string> = {
  high: "高优先级",
  medium: "中优先级",
  low: "低优先级",
};

const RECURRENCE_LABELS: Record<string, string> = {
  daily: "每日重复",
  weekday: "工作日重复",
  weekend: "周末重复",
  weekly: "每周重复",
  monthly: "每月重复",
};

const CALENDAR_ICON = `<svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/></svg>`;
const FOLDER_ICON = `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>`;
const CHECK_ICON = `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>`;
const REPEAT_ICON = `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>`;

/** 全量转义：任务标题、备注、项目名都不可成为 HTML 或脚本。 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 日期文案：documents 里跨年不能产生年份歧义，因此日期标题始终带年份。 */
function dateHeading(dateStr: string, today: string, isOverdue: boolean): string {
  const date = parseISO(dateStr);
  if (Number.isNaN(date.getTime())) return escapeHtml(dateStr);
  const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
  const sameYear = dateStr.slice(0, 4) === today.slice(0, 4);
  const label = sameYear ? format(date, "M月d日") : format(date, "yyyy年M月d日");
  const tag = dateStr === today
    ? `<span class="paper-date-tag">今天</span>`
    : isOverdue
      ? `<span class="paper-date-tag overdue">已逾期</span>`
      : "";
  return `${escapeHtml(label)} <span class="paper-date-tag">${escapeHtml(weekday)}</span>${tag}`;
}

/** 生成时间：使用快照确定的 capturedAt，预览与 PDF 展示同一时间。 */
function formatCapturedAt(capturedAt: string): string {
  const date = new Date(capturedAt);
  if (Number.isNaN(date.getTime())) return capturedAt;
  return format(date, "yyyy年M月d日 HH:mm");
}

function renderSubtask(subtask: TaskExportItem["subtasks"][number]): string {
  const done = subtask.isCompleted;
  return `<li class="${done ? "done" : ""}">`
    + `<span class="paper-checkbox">${done ? CHECK_ICON : ""}</span>`
    + `<span class="paper-subtask-title">${escapeHtml(subtask.title)}</span>`
    + `<span class="paper-state">${done ? "已完成" : "待完成"}</span>`
    + `</li>`;
}

function renderTask(item: TaskExportItem, index: number): string {
  const number = String(index + 1).padStart(2, "0");
  const priority = PRIORITY_LABELS[item.priority]
    ? `<span class="paper-priority ${item.priority}">${PRIORITY_LABELS[item.priority]}</span>`
    : "";
  const recurrence = item.recurrenceType
    ? `<span class="paper-recurrence">${REPEAT_ICON}${escapeHtml(RECURRENCE_LABELS[item.recurrenceType] ?? "循环任务")}</span>`
    : "";
  const total = item.subtasks.length;
  const doneCount = item.subtasks.filter((subtask) => subtask.isCompleted).length;
  // 无子任务的母任务保留，但不显示 0/0 进度。
  const progress = total > 0
    ? `<span class="paper-progress">子任务 <b>${doneCount}</b> / ${total}</span>`
    : "";
  const note = item.notes && item.notes.trim()
    ? `<p class="paper-note">${escapeHtml(item.notes)}</p>`
    : "";
  const subtasks = total > 0
    ? `<ul class="paper-subtasks">${item.subtasks.map(renderSubtask).join("")}</ul>`
    : "";
  // 子任务很多时允许该任务块跨页，避免整块被推走造成大片空白。
  const longClass = total >= 12 ? " long" : "";

  return `<section class="paper-task${longClass}" data-task-id="${item.taskId}" data-due-date="${escapeHtml(item.dueDate)}">`
    + `<div class="paper-task-heading">`
    + `<span class="paper-task-number">${number}</span>`
    + `<h3>${escapeHtml(item.title)}</h3>`
    + priority
    + `</div>`
    + `<div class="paper-task-meta">`
    + `<span class="paper-project">${FOLDER_ICON}${escapeHtml(item.projectName)}</span>`
    + `<span>未完成</span>`
    + recurrence
    + progress
    + `</div>`
    + note
    + subtasks
    + `</section>`;
}

/** 按 dueDate 分组；snapshot.tasks 已经排序，这里只按相邻日期归组。 */
function renderGroups(tasks: TaskExportItem[], today: string): string {
  const groups: string[] = [];
  let current = "";
  let buffer: string[] = [];
  let counter = 0;

  const flush = () => {
    if (!current) return;
    const isOverdue = current < today;
    groups.push(
      `<section class="paper-group"><h2 class="paper-date">${dateHeading(current, today, isOverdue)}</h2>`
      + `${buffer.join("")}</section>`,
    );
    buffer = [];
  };

  for (const item of tasks) {
    if (item.dueDate !== current) {
      flush();
      current = item.dueDate;
    }
    buffer.push(renderTask(item, counter));
    counter += 1;
  }
  flush();
  return groups.join("");
}

/**
 * 渲染完整的静态 HTML 文档。
 *
 * 返回内容可直接作为 iframe 的 srcDoc，也可直接交给原生打印适配器。
 */
export function renderTaskExportHtml(snapshot: TaskExportSnapshot, preview?: TaskExportPreviewAppearance): string {
  const { summary, today } = snapshot;
  const scope = snapshot.project?.name ?? "全部项目";
  const scopeNote = `${scope} · 不限日期 · ${snapshot.includeRecurring
    ? "含循环任务（每条仅最近一次待完成）"
    : "不含循环任务"}`;
  const previewVariables = preview ? TASK_EXPORT_PREVIEW_TOKENS.map((token) => {
    const value = preview.variables[token];
    // 令牌来自应用 CSS；限定属性名并排除样式结束符，避免生成可执行节点。
    return value ? `${token}:${value.replace(/[{};<>\u0000]/g, "")};` : "";
  }).join("") : "";
  const previewCss = preview
    ? `@media screen{:root{color-scheme:${preview.colorScheme};${previewVariables}}}`
    : "";
  const body = snapshot.tasks.length === 0
    ? `<p class="paper-empty">当前没有可导出的未完成任务</p>`
    : renderGroups(snapshot.tasks, today);

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">`
    + `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">`
    + `<title>未完成任务清单</title><style>${documentCss}${previewCss}</style></head>`
    + `<body class="paper${preview ? " paper-preview" : ""}">`
    + `<div class="paper-topline"><span class="paper-brand">${CALENDAR_ICON}日历 / 任务清单</span>`
    + `<span>数据生成时间：${escapeHtml(formatCapturedAt(snapshot.capturedAt))}</span></div>`
    + `<h1>未完成任务清单</h1>`
    + `<div class="paper-meta"><span>生成日期：${escapeHtml(today)}</span><span>范围：${escapeHtml(scopeNote)}</span></div>`
    + `<div class="paper-summary">`
    + `<div class="paper-stat"><strong>${summary.taskCount}</strong><span>未完成母任务</span></div>`
    + `<div class="paper-stat"><strong>${summary.subtaskCount}</strong><span>子任务总数</span></div>`
    + `<div class="paper-stat"><strong>${summary.completedSubtaskCount}</strong><span>子任务已完成</span></div>`
    + `</div>`
    + body
    + `<footer class="paper-footer"><p>未完成母任务及其全部子任务均已保留。<br>已完成子任务以勾选和划线标记。</p>`
    + `<span>由日历导出 · 全部数据保存在本机</span></footer>`
    + `</body></html>`;
}
