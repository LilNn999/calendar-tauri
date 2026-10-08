/** 待办项目，对应 SQLite projects 表。 */
export interface Project {
  id: number
  name: string
  createdAt: string
}

/** null 表示查看全部项目。 */
export type ProjectScope = number | null
