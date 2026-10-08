export const IPC = {
  // 待办项目
  PROJECTS_LIST: 'projects:list',
  PROJECTS_CREATE: 'projects:create',
  PROJECTS_RENAME: 'projects:rename',
  PROJECTS_GET_SELECTION: 'projects:getSelection',
  PROJECTS_SELECT: 'projects:select',
  // 任务
  TASKS_LIST: 'tasks:list',
  TASKS_CREATE: 'tasks:create',
  TASKS_UPDATE: 'tasks:update',
  TASKS_UPDATE_OCCURRENCE: 'tasks:updateOccurrence',
  TASKS_DELETE: 'tasks:delete',
  TASKS_MARK_FAILED: 'tasks:markFailed',
  TASKS_LIST_DELETED: 'tasks:listDeleted',   // 查询回收箱（软删除的任务）
  TASKS_RESTORE: 'tasks:restore',             // 恢复已删除任务
  TASKS_PURGE_TRASHED: 'tasks:purgeTrashed', // 彻底永久删除某个任务
  TASKS_EMPTY_TRASH: 'tasks:emptyTrash',     // 清空回收箱
  TASKS_SKIP_OCCURRENCE: 'tasks:skipOccurrence',       // 仅跳过某一天（删除单日）
  TASKS_DELETE_FROM_DATE: 'tasks:deleteFromDate',      // 删除当天及之后所有
  TASKS_DELETE_BEFORE_DATE: 'tasks:deleteBeforeDate',  // 删除当天及之前所有（循环任务）
  TASKS_DETACH_OCCURRENCE: 'tasks:detachOccurrence',   // 仅修改单日（解绑+创建独立任务）
  TASKS_SPLIT_FROM_DATE: 'tasks:splitFromDate',        // 修改当天及之后（截断+创建新循环任务）
  SUBTASKS_TOGGLE: 'subtasks:toggle',                  // 切换子任务当天完成状态
  SUBTASKS_UPDATE: 'subtasks:update',                  // 全量更新任务的子任务列表（增删改）

  // 打卡定义
  CHECKINS_LIST_DEFS: 'checkins:listDefs',
  CHECKINS_CREATE_DEF: 'checkins:createDef',
  CHECKINS_UPDATE_DEF: 'checkins:updateDef',
  CHECKINS_ARCHIVE_DEF: 'checkins:archiveDef',
  CHECKINS_DELETE_DEF: 'checkins:deleteDef', // 循环打卡按范围删除（this/before/future）
  CHECKINS_REORDER_DEFS: 'checkins:reorderDefs',

  // 打卡记录
  CHECKINS_GET_ENTRIES: 'checkins:getEntries',
  CHECKINS_UPSERT_ENTRY: 'checkins:upsertEntry',

  // 每日备注
  NOTES_GET: 'notes:get',
  NOTES_UPSERT: 'notes:upsert',

  // 统计分析
  ANALYTICS_COMPLETION: 'analytics:completion',
  ANALYTICS_NUMERIC_TREND: 'analytics:numericTrend',
  ANALYTICS_STREAK_SUMMARY: 'analytics:streakSummary',
  ANALYTICS_TASK_TREND: 'analytics:taskTrend',

  // 成就
  ACHIEVEMENTS_LIST: 'achievements:list',

  // 系统
  SYSTEM_GET_WIDGET_PREFS: 'system:getWidgetPrefs',
  SYSTEM_SAVE_WIDGET_PREFS: 'system:saveWidgetPrefs',
  SYSTEM_SET_ALWAYS_ON_TOP: 'system:setAlwaysOnTop',
  SYSTEM_SET_OPACITY: 'system:setOpacity',
  SYSTEM_TOGGLE_AUTO_LAUNCH: 'system:toggleAutoLaunch',
  SYSTEM_GET_AUTO_LAUNCH: 'system:getAutoLaunch',
  SYSTEM_GET_THEME: 'system:getTheme',
  SYSTEM_SET_THEME: 'system:setTheme',
  SYSTEM_GET_SKIN: 'system:getSkin',
  SYSTEM_SET_SKIN: 'system:setSkin',
  SYSTEM_GET_VERSION: 'system:getVersion',
  SYSTEM_SHOW_WIDGET: 'system:showWidget',
  SYSTEM_HIDE_WIDGET: 'system:hideWidget',
  SYSTEM_MINIMIZE_TO_TRAY: 'system:minimizeToTray',
  SYSTEM_SHOW_MAIN_WINDOW: 'system:showMainWindow',
  SYSTEM_QUIT: 'system:quit',
  SYSTEM_TOGGLE_FULLSCREEN: 'system:toggleFullscreen',
  SYSTEM_ZOOM_IN: 'system:zoomIn',
  SYSTEM_ZOOM_OUT: 'system:zoomOut',
  SYSTEM_ZOOM_RESET: 'system:zoomReset',

  // 推送（主进程 → 渲染器）
  PUSH_TASKS_FAILED: 'push:tasksFailed',
  PUSH_ACHIEVEMENT_UNLOCKED: 'push:achievementUnlocked',
  PUSH_WIDGET_DATA_REFRESH: 'push:widgetDataRefresh',
  PUSH_PROJECTS_CHANGED: 'push:projectsChanged',
  PUSH_THEME_CHANGED: 'push:themeChanged',
  PUSH_SKIN_CHANGED: 'push:skinChanged',
  PUSH_FULLSCREEN_CHANGED: 'push:fullscreenChanged',
} as const

export type IpcChannel = typeof IPC[keyof typeof IPC]
