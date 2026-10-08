export const DEFAULT_PROJECT_ID = 1
export const DEFAULT_PROJECT_NAME = '默认项目'
export const PROJECT_SELECTION_KEY = 'selectedProjectId'
export const PROJECT_NAME_MAX_LENGTH = 40

export function normalizeProjectName(name: string): string {
  const normalized = name.trim()
  if (!normalized) throw new Error('请输入项目名称')
  if (normalized.length > PROJECT_NAME_MAX_LENGTH) throw new Error('项目名称最多 40 个字')
  return normalized
}

export function matchesProject(projectId: number, scope?: number | null): boolean {
  return scope == null || projectId === scope
}
