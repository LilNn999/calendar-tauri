import { stat, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

if (process.argv.includes('--force')) {
  console.log('1')
  process.exit(0)
}

const exePath = path.join(root, 'src-tauri', 'target', 'release', 'calendar-tauri.exe')
const watchedDirs = ['src', 'src-tauri', 'dist']
const watchedFiles = [
  'package.json',
  'package-lock.json',
  'vite.config.ts',
  'tsconfig.json',
  'tsconfig.node.json',
  'index.html',
  'widget.html',
]
const skipDirs = new Set(['node_modules', 'target', '.git', '.codex', '.cache'])

async function exists(filePath) {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

async function newestInDirectory(dir, latest) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return latest
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name)) {
        latest = await newestInDirectory(fullPath, latest)
      }
      continue
    }
    if (!entry.isFile()) continue
    try {
      const info = await stat(fullPath)
      if (info.mtimeMs > latest) latest = info.mtimeMs
    } catch {
      // 忽略瞬时不可读文件
    }
  }

  return latest
}

async function newestSourceTime() {
  let latest = 0

  for (const dir of watchedDirs) {
    const fullPath = path.join(root, dir)
    if (await exists(fullPath)) {
      latest = await newestInDirectory(fullPath, latest)
    } else if (dir === 'dist') {
      return Number.POSITIVE_INFINITY
    }
  }

  for (const file of watchedFiles) {
    const fullPath = path.join(root, file)
    if (!(await exists(fullPath))) continue
    try {
      const info = await stat(fullPath)
      if (info.mtimeMs > latest) latest = info.mtimeMs
    } catch {
      // 忽略瞬时不可读文件
    }
  }

  return latest
}

if (!(await exists(exePath))) {
  console.log('1')
  process.exit(0)
}

const distIndex = path.join(root, 'dist', 'index.html')
if (!(await exists(distIndex))) {
  console.log('1')
  process.exit(0)
}

const exeTime = (await stat(exePath)).mtimeMs
const sourceTime = await newestSourceTime()

console.log(sourceTime > exeTime ? '1' : '0')