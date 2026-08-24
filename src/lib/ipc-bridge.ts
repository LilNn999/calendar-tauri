// src/lib/ipc-bridge.ts
// 双通道桥接：让源项目依赖的 window.electronAPI 在 Tauri / 浏览器两种环境都可用。
// - 数据类通道：走 db.ts（Tauri→SQLite，浏览器→内存）
// - 系统类通道：Tauri 环境走 Tauri API；浏览器环境降级为空实现
import { getDb, initDb, isTauri } from "@/lib/db";
import { VERSION_NOTES } from "@/data/whatsNew";
import { IPC, type IpcChannel } from "@shared/ipc-channels";
import type { WidgetPrefs } from "@shared/types";
import { invoke as invokeCore } from "@tauri-apps/api/core";

// ==================== 本地事件总线 ====================
type Listener = (...args: unknown[]) => void;
const listeners = new Map<string, Set<Listener>>();

function emitLocal(channel: string, ...args: unknown[]) {
  const set = listeners.get(channel);
  if (!set) return;
  for (const fn of [...set]) {
    try {
      fn(...args);
    } catch (e) {
      console.error(`本地事件处理失败 ${channel}:`, e);
    }
  }
}

function on(channel: IpcChannel, callback: (...args: unknown[]) => void): () => void {
  if (!listeners.has(channel)) listeners.set(channel, new Set());
  listeners.get(channel)!.add(callback);
  return () => {
    listeners.get(channel)?.delete(callback);
  };
}

function removeAllListeners(channel: IpcChannel): void {
  listeners.delete(channel);
}

// ==================== 设置持久化（settings 表，跨窗口共享） ====================
const THEME_KEY = "theme";
const SKIN_KEY = "skin";
const WIDGET_PREFS_KEY = "widgetPrefs";

const DEFAULT_WIDGET_PREFS: WidgetPrefs = {
  posX: 100,
  posY: 100,
  opacity: 0.95,
  alwaysOnTop: true,
  width: 320,
  height: 480,
};

async function getWidgetPrefs(): Promise<WidgetPrefs> {
  const saved = await getDb().getSetting<Partial<WidgetPrefs> | null>(WIDGET_PREFS_KEY, null);
  return { ...DEFAULT_WIDGET_PREFS, ...(saved ?? {}) };
}

async function saveWidgetPrefs(prefs: Partial<WidgetPrefs>): Promise<void> {
  const current = await getWidgetPrefs();
  await getDb().setSetting(WIDGET_PREFS_KEY, { ...current, ...prefs });
}// ==================== 窗口助手 ====================
async function getFloatingWindow() {
  if (!isTauri) return null;
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  return WebviewWindow.getByLabel("floating");
}

async function getMainWindow() {
  if (!isTauri) return null;
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  return WebviewWindow.getByLabel("main");
}

// ==================== 数据变更通知 ====================
function notifyDataChanged(): void {
  if (isTauri) {
    import("@tauri-apps/api/event")
      .then(async ({ emitTo }) => {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const selfLabel = getCurrentWindow().label;
        // 与源项目一致：只通知“另一个”窗口，避免当前窗口因自身操作重复加载导致侧栏闪回
        const target = selfLabel === "floating" ? "main" : "floating";
        await emitTo(target, IPC.PUSH_WIDGET_DATA_REFRESH);
      })
      .catch(() => {});
  } else {
    emitLocal(IPC.PUSH_WIDGET_DATA_REFRESH);
  }
}

// 完成任务后检测成就解锁并推送
async function maybeUnlock(): Promise<void> {
  try {
    const unlocked = await getDb().checkAndUnlockAchievements();
    for (const a of unlocked) {
      emitLocal(IPC.PUSH_ACHIEVEMENT_UNLOCKED, a);
      if (isTauri) {
        import("@tauri-apps/api/event")
          .then(({ emitTo }) => emitTo("main", IPC.PUSH_ACHIEVEMENT_UNLOCKED, a))
          .catch(() => {});
      }
    }
  } catch (e) {
    console.error("成就检测失败:", e);
  }
}

// ==================== 系统功能 ====================
let zoomFactor = 1;

async function applyZoom(): Promise<void> {
  if (!isTauri) return;
  const { getCurrentWebview } = await import("@tauri-apps/api/webview");
  await getCurrentWebview().setZoom(zoomFactor);
}

// ==================== 通道路由 ====================
async function invoke(channel: IpcChannel, ...args: unknown[]): Promise<unknown> {
  const db = await initDb();
  switch (channel) {
    // ---------- 任务 ----------
    case IPC.TASKS_LIST: {
      const range = (args[0] ?? {}) as { start?: string; end?: string };
      return db.listTasks(range.start ?? "", range.end ?? "");
    }
    case IPC.TASKS_CREATE: {
      const task = await db.createTask(args[0] as never);
      notifyDataChanged();
      return task;
    }
    case IPC.TASKS_UPDATE: {
      const id = args[0] as number;
      const patch = args[1] as { isCompleted?: boolean } & Record<string, unknown>;
      const task = await db.updateTask(id, patch as never);
      if (patch.isCompleted) await maybeUnlock();
      notifyDataChanged();
      return task;
    }
    case IPC.TASKS_UPDATE_OCCURRENCE: {
      const taskId = args[0] as number;
      const date = args[1] as string;
      const patch = args[2] as { isCompleted?: boolean; isFailed?: boolean };
      await db.updateOccurrence(taskId, date, patch);
      if (patch.isCompleted) await maybeUnlock();
      notifyDataChanged();
      return;
    }
    case IPC.TASKS_DELETE:
      await db.deleteTask(args[0] as number);
      notifyDataChanged();
      return;
    case IPC.TASKS_MARK_FAILED:
      await db.markFailed(args[0] as number[]);
      notifyDataChanged();
      return;
    case IPC.TASKS_SKIP_OCCURRENCE:
      await db.skipOccurrence(args[0] as number, args[1] as string);
      notifyDataChanged();
      return;
    case IPC.TASKS_DELETE_FROM_DATE:
      await db.deleteFromDate(args[0] as number, args[1] as string);
      notifyDataChanged();
      return;
    case IPC.TASKS_DETACH_OCCURRENCE:
      return db.detachOccurrence(args[0] as number, args[1] as string, args[2] as never);
    case IPC.TASKS_SPLIT_FROM_DATE:
      return db.splitFromDate(args[0] as number, args[1] as string, args[2] as never);
    case IPC.SUBTASKS_TOGGLE:
      await db.toggleSubtask(args[0] as number, args[1] as string, args[2] as boolean);
      notifyDataChanged();
      return;
    case IPC.SUBTASKS_UPDATE:
      await db.updateSubtasks(args[0] as number, args[1] as never);
      notifyDataChanged();
      return;
    case IPC.TASKS_LIST_DELETED:
      return db.listDeleted();
    case IPC.TASKS_RESTORE:
      return db.restore(args[0] as number);
    case IPC.TASKS_PURGE_TRASHED:
      await db.purgeTrashed(args[0] as number);
      return;
    case IPC.TASKS_EMPTY_TRASH:
      await db.emptyTrash();
      return;
    // ---------- 打卡 ----------
    case IPC.CHECKINS_LIST_DEFS:
      return db.listCheckinDefs();
    case IPC.CHECKINS_CREATE_DEF:
      return db.createCheckinDef(args[0] as never);
    case IPC.CHECKINS_UPDATE_DEF:
      return db.updateCheckinDef(args[0] as number, args[1] as never);
    case IPC.CHECKINS_ARCHIVE_DEF:
      await db.archiveCheckinDef(args[0] as number);
      notifyDataChanged();
      return;
    case IPC.CHECKINS_REORDER_DEFS:
      await db.reorderCheckinDefs(args[0] as number[]);
      return;
    case IPC.CHECKINS_GET_ENTRIES: {
      const range = (args[0] ?? {}) as { start?: string; end?: string };
      return db.getCheckinEntries(range.start ?? "", range.end ?? "");
    }
    case IPC.CHECKINS_UPSERT_ENTRY: {
      const entry = await db.upsertCheckinEntry(args[0] as never);
      notifyDataChanged();
      return entry;
    }

    // ---------- 每日备注 ----------
    case IPC.NOTES_GET:
      return db.getNote(args[0] as string);
    case IPC.NOTES_UPSERT: {
      const note = await db.upsertNote(args[0] as string, args[1] as string);
      notifyDataChanged();
      return note;
    }

    // ---------- 统计分析 ----------
    case IPC.ANALYTICS_COMPLETION:
      return db.completion(args[0] as never);
    case IPC.ANALYTICS_NUMERIC_TREND:
      return db.numericTrend(args[0] as number, args[1] as never);
    case IPC.ANALYTICS_STREAK_SUMMARY:
      return db.streakSummary();
    case IPC.ANALYTICS_TASK_TREND:
      return db.taskTrend(args[0] as never);

    // ---------- 成就 ----------
    case IPC.ACHIEVEMENTS_LIST:
      return db.listAchievements();

    // ---------- 系统 ----------
    case IPC.SYSTEM_GET_WIDGET_PREFS:
      return getWidgetPrefs();
    case IPC.SYSTEM_SAVE_WIDGET_PREFS: {
      const prefs = (args[0] ?? {}) as Partial<WidgetPrefs>;
      await saveWidgetPrefs(prefs);
      if (isTauri) {
        const win = await getFloatingWindow();
        if (win) {
          if (prefs.alwaysOnTop !== undefined) await win.setAlwaysOnTop(prefs.alwaysOnTop);
        }
      }
      return;
    }
    case IPC.SYSTEM_SET_ALWAYS_ON_TOP: {
      const v = Boolean(args[0]);
      await saveWidgetPrefs({ alwaysOnTop: v });
      if (isTauri) {
        const win = await getFloatingWindow();
        if (win) await win.setAlwaysOnTop(v);
        // 同步到 Rust 状态：托盘/快捷键重新显示悬浮窗时按此偏好应用
        try {
          await invokeCore("set_floating_always_on_top", { enabled: v });
        } catch (e) {
          console.error("同步悬浮窗置顶状态失败:", e);
        }
      }
      return;
    }
    case IPC.SYSTEM_SET_OPACITY: {
      const v = Math.max(0.1, Math.min(1, Number(args[0])));
      await saveWidgetPrefs({ opacity: v });
      return;
    }
    case IPC.SYSTEM_TOGGLE_AUTO_LAUNCH: {
      if (isTauri) {
        const { enable, disable } = await import("@tauri-apps/plugin-autostart");
        if (args[0]) await enable();
        else await disable();
      }
      return;
    }
    case IPC.SYSTEM_GET_AUTO_LAUNCH:
      if (!isTauri) return false;
      {
        const { isEnabled } = await import("@tauri-apps/plugin-autostart");
        return isEnabled();
      }
    case IPC.SYSTEM_GET_VERSION:
      if (isTauri) {
        try {
          return (await invokeCore("app_version")) as string;
        } catch (e) {
          console.error("获取应用版本失败:", e);
        }
      }
      return VERSION_NOTES[0].version;
    case IPC.SYSTEM_GET_THEME:
      return db.getSetting<string>(THEME_KEY, "system");
    case IPC.SYSTEM_SET_THEME:
      await db.setSetting(THEME_KEY, String(args[0]));
      return;
    case IPC.SYSTEM_GET_SKIN:
      return db.getSetting<string>(SKIN_KEY, "default");
    case IPC.SYSTEM_SET_SKIN:
      await db.setSetting(SKIN_KEY, String(args[0]));
      return;
    case IPC.SYSTEM_SHOW_WIDGET: {
      const win = await getFloatingWindow();
      if (win) await win.show();
      return;
    }
    case IPC.SYSTEM_HIDE_WIDGET: {
      const win = await getFloatingWindow();
      if (win) await win.hide();
      return;
    }
    case IPC.SYSTEM_MINIMIZE_TO_TRAY: {
      const win = await getMainWindow();
      if (win) await win.hide();
      return;
    }
    case IPC.SYSTEM_SHOW_MAIN_WINDOW: {
      const win = await getMainWindow();
      if (win) {
        await win.show();
        await win.setFocus();
      }
      return;
    }
    case IPC.SYSTEM_QUIT:
      if (isTauri) {
        try {
          await invokeCore("quit_app");
        } catch (e) {
          console.error("退出失败:", e);
        }
      }
      return;
    case IPC.SYSTEM_TOGGLE_FULLSCREEN: {
      if (isTauri) {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();
        const fs = await win.isFullscreen();
        await win.setFullscreen(!fs);
        emitLocal(IPC.PUSH_FULLSCREEN_CHANGED, !fs);
      } else {
        emitLocal(IPC.PUSH_FULLSCREEN_CHANGED, false);
      }
      return;
    }
    case IPC.SYSTEM_ZOOM_IN:
      zoomFactor = Math.min(zoomFactor + 0.1, 2);
      await applyZoom();
      return;
    case IPC.SYSTEM_ZOOM_OUT:
      zoomFactor = Math.max(zoomFactor - 0.1, 0.5);
      await applyZoom();
      return;
    case IPC.SYSTEM_ZOOM_RESET:
      zoomFactor = 1;
      await applyZoom();
      return;

    // ---------- 推送（主进程→渲染器，这里做本地/跨窗口转发） ----------
    case IPC.PUSH_WIDGET_DATA_REFRESH:
      notifyDataChanged();
      return;
    case IPC.PUSH_TASKS_FAILED:
    case IPC.PUSH_ACHIEVEMENT_UNLOCKED:
    case IPC.PUSH_FULLSCREEN_CHANGED:
    case IPC.PUSH_THEME_CHANGED:
    case IPC.PUSH_SKIN_CHANGED:
      return;

    default: {
      const never: never = channel;
      throw new Error(`未知 IPC 通道: ${String(never)}`);
    }
  }
}

// ==================== 安装 electronAPI ====================
function install(): void {
  const api = { invoke, on, removeAllListeners };
  if (!window.electronAPI) {
    Object.defineProperty(window, "electronAPI", {
      value: api,
      writable: true,
      configurable: true,
    });
  }
}

// ==================== 初始化 ====================
export async function initBridge(): Promise<void> {
  install();
  await initDb();
  if (isTauri) {
    const { listen } = await import("@tauri-apps/api/event");
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const selfLabel = getCurrentWindow().label;
    const channels: IpcChannel[] = [
      IPC.PUSH_WIDGET_DATA_REFRESH,
      IPC.PUSH_ACHIEVEMENT_UNLOCKED,
      IPC.PUSH_TASKS_FAILED,
      IPC.PUSH_THEME_CHANGED,
      IPC.PUSH_SKIN_CHANGED,
    ];
    for (const c of channels) {
      // 与源项目一致：只接收发往本窗口的事件（对应 Electron 的定向 webContents.send），避免收到自己发出的刷新信号
      void listen(c, (e) => emitLocal(c, e.payload), { target: selfLabel }).catch(() => {});
    }
    // 监听窗口全屏状态变化（系统级触发）
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      void win.onResized(() => {
        win
          .isFullscreen()
          .then((fs) => emitLocal(IPC.PUSH_FULLSCREEN_CHANGED, fs))
          .catch(() => {});
      });
    } catch {
      /* 忽略：浏览器降级 */
    }
  }
}
