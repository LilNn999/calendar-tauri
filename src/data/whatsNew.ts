export interface VersionNote {
  version: string
  date: string
  features?: string[]
  fixes?: string[]
}

/** 更新历史（最新版本在最前） */
export const VERSION_NOTES: VersionNote[] = [
  {
    version: '0.2.0',
    date: '2026-08-23',
    features: [
      '新增“更新公告”，可查看各版本更新内容',
      '完成母任务时，子任务自动标记完成',
      '暗色模式任务勾选更醒目',
    ],
    fixes: [
      '修复完成任务后侧栏闪烁的问题',
      '修复添加日程后任务不显示的问题',
      '修复悬浮窗拖动卡顿的问题',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-08-23',
    features: [
      '全新重构：日历、任务、打卡、备注、统计',
      '支持托盘、置顶悬浮窗、开机自启、全局快捷键',
      '数据本地存储，隐私安全',
      '深浅双主题，自动跟随系统',
    ],
  },
]
