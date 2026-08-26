param(
  [string]$SourceDb = "",
  [string]$TargetDb = "",
  [string]$BackupDir = "",
  [switch]$Overwrite,
  [switch]$Merge,
  [switch]$Force,
  [switch]$Yes
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$SQLITE_OPEN_READONLY = 1
$SQLITE_OPEN_READWRITE = 2
$SQLITE_OPEN_CREATE = 4

$nativeCode = @"
using System;
using System.Runtime.InteropServices;

public static class MigrationSqlite
{
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern int sqlite3_open_v2(byte[] filename, out IntPtr db, int flags, byte[] vfs);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern int sqlite3_close(IntPtr db);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern IntPtr sqlite3_errmsg(IntPtr db);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern int sqlite3_busy_timeout(IntPtr db, int milliseconds);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern int sqlite3_exec(IntPtr db, byte[] sql, IntPtr callback, IntPtr arg, out IntPtr errmsg);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern long sqlite3_last_insert_rowid(IntPtr db);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern int sqlite3_prepare_v2(IntPtr db, byte[] sql, int nByte, out IntPtr stmt, out IntPtr tail);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern int sqlite3_step(IntPtr stmt);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern int sqlite3_finalize(IntPtr stmt);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern int sqlite3_column_count(IntPtr stmt);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern IntPtr sqlite3_column_name(IntPtr stmt, int index);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern int sqlite3_column_type(IntPtr stmt, int index);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern long sqlite3_column_int64(IntPtr stmt, int index);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern double sqlite3_column_double(IntPtr stmt, int index);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern IntPtr sqlite3_column_text(IntPtr stmt, int index);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern int sqlite3_column_bytes(IntPtr stmt, int index);
}
"@

if (-not ("MigrationSqlite" -as [type])) {
  Add-Type -TypeDefinition $nativeCode
}

function To-Utf8([string]$Text) {
  return [System.Text.Encoding]::UTF8.GetBytes($Text)
}

function Get-SqliteError([IntPtr]$Db) {
  if ($Db -eq [IntPtr]::Zero) { return "" }
  $ptr = [MigrationSqlite]::sqlite3_errmsg($Db)
  if ($ptr -eq [IntPtr]::Zero) { return "" }
  return [System.Runtime.InteropServices.Marshal]::PtrToStringAnsi($ptr)
}

function Open-SqliteDatabase([string]$Path, [int]$Flags) {
  $bytes = To-Utf8 $Path
  $db = [IntPtr]::Zero
  $rc = [MigrationSqlite]::sqlite3_open_v2($bytes, [ref]$db, $Flags, $null)
  if ($rc -ne 0) {
    $message = Get-SqliteError $db
    if ($db -ne [IntPtr]::Zero) { [MigrationSqlite]::sqlite3_close($db) | Out-Null }
    throw "无法打开数据库：$Path（$message）"
  }
  [MigrationSqlite]::sqlite3_busy_timeout($db, 5000) | Out-Null
  return $db
}

function Close-SqliteDatabase([IntPtr]$Db) {
  if ($Db -ne [IntPtr]::Zero) {
    [MigrationSqlite]::sqlite3_close($Db) | Out-Null
  }
}

function Invoke-Sql([IntPtr]$Db, [string]$Sql) {
  $err = [IntPtr]::Zero
  $rc = [MigrationSqlite]::sqlite3_exec($Db, (To-Utf8 $Sql), [IntPtr]::Zero, [IntPtr]::Zero, [ref]$err)
  if ($rc -ne 0) {
    $message = ""
    if ($err -ne [IntPtr]::Zero) {
      $message = [System.Runtime.InteropServices.Marshal]::PtrToStringAnsi($err)
    }
    throw "SQLite 执行失败：$message`nSQL：$Sql"
  }
  return [MigrationSqlite]::sqlite3_last_insert_rowid($Db)
}

function Get-SqlRows([IntPtr]$Db, [string]$Sql) {
  $stmt = [IntPtr]::Zero
  $tail = [IntPtr]::Zero
  $rc = [MigrationSqlite]::sqlite3_prepare_v2($Db, (To-Utf8 $Sql), -1, [ref]$stmt, [ref]$tail)
  if ($rc -ne 0) {
    throw "SQLite 查询失败：$(Get-SqliteError $Db)`nSQL：$Sql"
  }
  $rows = @()
  try {
    while ([MigrationSqlite]::sqlite3_step($stmt) -eq 100) {
      $item = [ordered]@{}
      $count = [MigrationSqlite]::sqlite3_column_count($stmt)
      for ($i = 0; $i -lt $count; $i++) {
        $namePtr = [MigrationSqlite]::sqlite3_column_name($stmt, $i)
        $name = [System.Runtime.InteropServices.Marshal]::PtrToStringAnsi($namePtr)
        $type = [MigrationSqlite]::sqlite3_column_type($stmt, $i)
        if ($type -eq 5) {
          $item[$name] = $null
        } elseif ($type -eq 1) {
          $item[$name] = [MigrationSqlite]::sqlite3_column_int64($stmt, $i)
        } elseif ($type -eq 2) {
          $item[$name] = [MigrationSqlite]::sqlite3_column_double($stmt, $i)
        } else {
          $ptr = [MigrationSqlite]::sqlite3_column_text($stmt, $i)
          $length = [MigrationSqlite]::sqlite3_column_bytes($stmt, $i)
          if ($length -gt 0 -and $ptr -ne [IntPtr]::Zero) {
            $buffer = New-Object byte[] $length
            [System.Runtime.InteropServices.Marshal]::Copy($ptr, $buffer, 0, $length)
            $item[$name] = [System.Text.Encoding]::UTF8.GetString($buffer)
          } else {
            $item[$name] = ""
          }
        }
      }
      $rows += [PSCustomObject]$item
    }
  } finally {
    [MigrationSqlite]::sqlite3_finalize($stmt) | Out-Null
  }
  return ,@($rows)
}

function Get-SqlScalar([IntPtr]$Db, [string]$Sql) {
  $row = Get-SqlRows $Db $Sql
  if ($null -eq $row -or $row.Count -eq 0) { return $null }
  $first = if ($row -is [System.Array]) { $row[0] } else { $row }
  $property = $first.PSObject.Properties | Select-Object -First 1
  return $property.Value
}

function Format-SqlValue($Value) {
  if ($null -eq $Value -or $Value -is [System.DBNull]) { return "NULL" }
  if ($Value -is [bool]) { return $(if ($Value) { "1" } else { "0" }) }
  if ($Value -is [int] -or $Value -is [long] -or $Value -is [double]) {
    return ([long]$Value).ToString([System.Globalization.CultureInfo]::InvariantCulture)
  }
  return "'" + ([string]$Value).Replace("'", "''") + "'"
}

function Convert-OldTime($Value) {
  if ($null -eq $Value -or $Value -is [System.DBNull]) { return $null }
  if ($Value -is [int] -or $Value -is [long] -or $Value -is [double]) {
    $ms = [long]$Value
    if ($ms -le 0) { return $null }
    return [DateTimeOffset]::FromUnixTimeMilliseconds($ms).UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ", [System.Globalization.CultureInfo]::InvariantCulture)
  }
  $text = [string]$Value
  if ($text -match "^\d{10,}$") {
    return Convert-OldTime ([long]$text)
  }
  return $text
}

function To-BoolInt($Value) {
  if ($Value -is [bool]) { return $(if ($Value) { 1 } else { 0 }) }
  if ($Value -is [int] -or $Value -is [long]) { return $(if ([long]$Value -ne 0) { 1 } else { 0 }) }
  $text = [string]$Value
  if ($text -eq "true" -or $text -eq "1") { return 1 }
  return 0
}

function Test-SourceDatabase([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return -1 }
  try {
    $db = Open-SqliteDatabase $Path $SQLITE_OPEN_READONLY
    try {
      $table = Get-SqlRows $db "SELECT name FROM sqlite_master WHERE name = 'Task'"
      if ($table.Count -eq 0) { return 0 }
      return [long](Get-SqlScalar $db "SELECT COUNT(*) AS n FROM Task")
    } finally {
      Close-SqliteDatabase $db
    }
  } catch {
    return -1
  }
}

function Resolve-SourceDatabase([string]$Requested) {
  $candidates = @()
  if ($Requested) {
    if (Test-Path -LiteralPath $Requested -PathType Container) {
      $candidates += (Join-Path $Requested "calendar.db")
      $candidates += (Join-Path $Requested "resources\prisma\dev.db")
    } else {
      $candidates += $Requested
    }
  }
  $appDataDir = if ($env:APPDATA) { $env:APPDATA } else { Join-Path $env:USERPROFILE "AppData\Roaming" }
  $candidates += (Join-Path $appDataDir "daily-calendar\calendar.db")
  $candidates += (Join-Path $env:USERPROFILE "AppData\Roaming\daily-calendar\calendar.db")

  foreach ($candidate in $candidates | Select-Object -Unique) {
    if (-not $candidate) { continue }
    $count = Test-SourceDatabase $candidate
    if ($count -gt 0) { return $candidate }
  }
  throw "未找到包含任务数据的旧版日历数据库。默认路径为 %APPDATA%\daily-calendar\calendar.db；安装目录中的 resources\prisma\dev.db 是空模板，不能作为数据源。"
}

function Get-SourceData([string]$SourcePath) {
  $db = Open-SqliteDatabase $SourcePath $SQLITE_OPEN_READONLY
  try {
    $taskCount = [long](Get-SqlScalar $db "SELECT COUNT(*) AS n FROM Task")
    if ($taskCount -eq 0) {
      throw "旧版日历数据库中没有任务数据：$SourcePath"
    }
    $hasOccurrences = (Get-SqlRows $db "SELECT name FROM sqlite_master WHERE name = 'TaskOccurrence'").Count -gt 0
    $hasCheckins = (Get-SqlRows $db "SELECT name FROM sqlite_master WHERE name = 'CheckinDefinition'").Count -gt 0
    $hasNotes = (Get-SqlRows $db "SELECT name FROM sqlite_master WHERE name = 'DailyNote'").Count -gt 0
    $hasAchievements = (Get-SqlRows $db "SELECT name FROM sqlite_master WHERE name = 'EarnedAchievement'").Count -gt 0

    $tasks = Get-SqlRows $db "SELECT id, title, priority, dueDate, isCompleted, isFailed, completedAt, notes, createdAt, updatedAt, recurrenceType, recurrenceEnd, deletedAt FROM Task ORDER BY id"
    $occurrences = @()
    if ($hasOccurrences) {
      $occurrences = Get-SqlRows $db "SELECT id, taskId, date, isCompleted, isFailed, isSkipped FROM TaskOccurrence ORDER BY taskId, date"
    }
    $definitions = @()
    $entries = @()
    if ($hasCheckins) {
      $definitions = Get-SqlRows $db "SELECT id, name, type, unit, sortOrder, archivedAt, startDate, endDate, frequency, createdAt FROM CheckinDefinition ORDER BY id"
      $entries = Get-SqlRows $db "SELECT id, definitionId, entryDate, value, updatedAt FROM CheckinEntry ORDER BY definitionId, entryDate"
    }
    $notes = @()
    if ($hasNotes) {
      $notes = Get-SqlRows $db "SELECT id, noteDate, content, updatedAt FROM DailyNote ORDER BY noteDate"
    }
    $achievementDefs = @()
    $earned = @()
    if ($hasAchievements) {
      $hasAchievementDefs = (Get-SqlRows $db "SELECT name FROM sqlite_master WHERE name = 'AchievementDefinition'").Count -gt 0
      if ($hasAchievementDefs) {
        $achievementDefs = Get-SqlRows $db "SELECT id, key FROM AchievementDefinition ORDER BY id"
      }
      $earned = Get-SqlRows $db "SELECT id, definitionId, earnedAt FROM EarnedAchievement ORDER BY id"
    }
    return [PSCustomObject]@{
      Tasks = $tasks
      Occurrences = $occurrences
      Definitions = $definitions
      Entries = $entries
      Notes = $notes
      AchievementDefinitions = $achievementDefs
      Earned = $earned
      TaskCount = $taskCount
    }
  } finally {
    Close-SqliteDatabase $db
  }
}

function Ensure-TargetSchema([IntPtr]$Db) {
  $schema = @"
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'none',
  dueDate TEXT NOT NULL,
  isCompleted INTEGER NOT NULL DEFAULT 0,
  isFailed INTEGER NOT NULL DEFAULT 0,
  completedAt TEXT,
  notes TEXT,
  recurrenceType TEXT,
  recurrenceEnd TEXT,
  deletedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_dueDate ON tasks(dueDate);
CREATE TABLE IF NOT EXISTS task_occurrences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  taskId INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  isCompleted INTEGER NOT NULL DEFAULT 0,
  isFailed INTEGER NOT NULL DEFAULT 0,
  isSkipped INTEGER NOT NULL DEFAULT 0,
  UNIQUE(taskId, date)
);
CREATE TABLE IF NOT EXISTS subtasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  taskId INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subtasks_taskId ON subtasks(taskId);
CREATE TABLE IF NOT EXISTS subtask_occurrences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subtaskId INTEGER NOT NULL REFERENCES subtasks(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  isCompleted INTEGER NOT NULL DEFAULT 0,
  UNIQUE(subtaskId, date)
);
CREATE TABLE IF NOT EXISTS checkin_definitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'boolean',
  unit TEXT,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  archivedAt TEXT,
  startDate TEXT,
  endDate TEXT,
  frequency TEXT DEFAULT 'daily',
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS checkin_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  definitionId INTEGER NOT NULL REFERENCES checkin_definitions(id) ON DELETE CASCADE,
  entryDate TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  updatedAt TEXT NOT NULL,
  UNIQUE(definitionId, entryDate)
);
CREATE TABLE IF NOT EXISTS daily_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  noteDate TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL DEFAULT '',
  updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS achievement_definitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS earned_achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  definitionId INTEGER NOT NULL UNIQUE REFERENCES achievement_definitions(id) ON DELETE CASCADE,
  earnedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
"@
  $null = Invoke-Sql $Db "PRAGMA busy_timeout = 5000"
  $null = Invoke-Sql $Db $schema
  $null = Invoke-Sql $Db "PRAGMA user_version = 1"
  $seeds = @(
    @("streak_3", "初出茅庐", "连续打卡 3 天", "🌱"),
    @("streak_7", "一周坚持", "连续打卡 7 天", "🔥"),
    @("streak_30", "月度达人", "连续打卡 30 天", "⭐"),
    @("streak_100", "百日坚守", "连续打卡 100 天", "🏆"),
    @("perfect_week", "完美一周", "某一周完成率达到 100%", "💎"),
    @("all_done_today", "今日清零", "完成当天所有任务", "✅")
  )
  foreach ($seed in $seeds) {
    $null = Invoke-Sql $Db "INSERT OR IGNORE INTO achievement_definitions (key, title, description, icon) VALUES ($(Format-SqlValue $seed[0]), $(Format-SqlValue $seed[1]), $(Format-SqlValue $seed[2]), $(Format-SqlValue $seed[3]))"
  }
}

function Get-DataCounts([IntPtr]$Db) {
  return [PSCustomObject]@{
    Tasks = [long](Get-SqlScalar $Db "SELECT COUNT(*) AS n FROM tasks")
    Definitions = [long](Get-SqlScalar $Db "SELECT COUNT(*) AS n FROM checkin_definitions")
    Notes = [long](Get-SqlScalar $Db "SELECT COUNT(*) AS n FROM daily_notes")
    Earned = [long](Get-SqlScalar $Db "SELECT COUNT(*) AS n FROM earned_achievements")
  }
}

function Read-Setting([IntPtr]$Db, [string]$Key) {
  $row = Get-SqlRows $Db "SELECT value FROM settings WHERE key = $(Format-SqlValue $Key)"
  if ($row.Count -eq 0) { return $null }
  try {
    return $row[0].value | ConvertFrom-Json
  } catch {
    return $row[0].value
  }
}

function Write-Setting([IntPtr]$Db, [string]$Key, $Value) {
  $json = ConvertTo-Json -InputObject $Value -Compress
  $null = Invoke-Sql $Db "INSERT INTO settings (key, value) VALUES ($(Format-SqlValue $Key), $(Format-SqlValue $json)) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
}

function Backup-Database([IntPtr]$Db, [string]$TargetPath, [string]$BackupDir, [bool]$TestMode) {
  $dir = if ($BackupDir) { $BackupDir } else { Join-Path (Split-Path -Parent $TargetPath) "migration-backups" }
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $stamp = Get-Date -Format "yyyyMMddHHmmssfff"
  $suffix = if ($TestMode) { "test-calendar" } else { "calendar" }
  $backupPath = Join-Path $dir "$suffix.db-$stamp.bak"
  $null = Invoke-Sql $Db "VACUUM INTO $(Format-SqlValue $backupPath)"
  $hash = (Get-FileHash -LiteralPath $backupPath -Algorithm SHA256).Hash
  return [PSCustomObject]@{ Path = $backupPath; Hash = $hash }
}

function Import-Tasks([IntPtr]$Db, $Source, $ImportedTaskIds, [bool]$Overwrite) {
  $inserted = 0
  foreach ($task in $Source.Tasks) {
    $taskId = [string]$task.id
    if (-not $Overwrite -and $ImportedTaskIds.Contains($taskId)) { continue }
    $createdAt = Convert-OldTime $task.createdAt
    $updatedAt = Convert-OldTime $task.updatedAt
    if (-not $createdAt) { $createdAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ") }
    if (-not $updatedAt) { $updatedAt = $createdAt }
    $completedAt = Convert-OldTime $task.completedAt
    $recurrenceEnd = if ($task.recurrenceEnd) { Format-SqlValue $task.recurrenceEnd } else { "NULL" }
    $recurrenceType = if ($task.recurrenceType) { Format-SqlValue $task.recurrenceType } else { "NULL" }
    $notes = if ($null -ne $task.notes) { Format-SqlValue $task.notes } else { "NULL" }
    $deletedAt = if ($task.deletedAt) { Format-SqlValue (Convert-OldTime $task.deletedAt) } else { "NULL" }
    $sql = "INSERT INTO tasks (title, priority, dueDate, isCompleted, isFailed, completedAt, notes, recurrenceType, recurrenceEnd, deletedAt, createdAt, updatedAt)
      VALUES ($(Format-SqlValue $task.title), $(Format-SqlValue $task.priority), $(Format-SqlValue $task.dueDate), $(To-BoolInt $task.isCompleted), $(To-BoolInt $task.isFailed), $(if ($completedAt) { Format-SqlValue $completedAt } else { "NULL" }), $notes, $recurrenceType, $recurrenceEnd, $deletedAt, $(Format-SqlValue $createdAt), $(Format-SqlValue $updatedAt))"
    $newTaskId = Invoke-Sql $Db $sql
    $ImportedTaskIds.Add($taskId) | Out-Null
    $inserted++

    foreach ($occurrence in $Source.Occurrences) {
      if ([string]$occurrence.taskId -ne $taskId) { continue }
      $null = Invoke-Sql $Db "INSERT INTO task_occurrences (taskId, date, isCompleted, isFailed, isSkipped)
        VALUES ($newTaskId, $(Format-SqlValue $occurrence.date), $(To-BoolInt $occurrence.isCompleted), $(To-BoolInt $occurrence.isFailed), $(To-BoolInt $occurrence.isSkipped))
        ON CONFLICT(taskId, date) DO UPDATE SET isCompleted = excluded.isCompleted, isFailed = excluded.isFailed, isSkipped = excluded.isSkipped"
    }
  }
  return $inserted
}

function Import-Checkins([IntPtr]$Db, $Source, $ImportedDefinitionIds, [bool]$Overwrite) {
  $inserted = 0
  foreach ($definition in $Source.Definitions) {
    $definitionId = [string]$definition.id
    if (-not $Overwrite -and $ImportedDefinitionIds.Contains($definitionId)) { continue }
    $createdAt = Convert-OldTime $definition.createdAt
    if (-not $createdAt) { $createdAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ") }
    $archivedAt = Convert-OldTime $definition.archivedAt
    $startDate = if ($definition.startDate) { Format-SqlValue $definition.startDate } else { "NULL" }
    $endDate = if ($definition.endDate) { Format-SqlValue $definition.endDate } else { "NULL" }
    $unit = if ($definition.unit) { Format-SqlValue $definition.unit } else { "NULL" }
    $frequency = if ($definition.frequency) { Format-SqlValue $definition.frequency } else { "'daily'" }
    $newDefinitionId = Invoke-Sql $Db "INSERT INTO checkin_definitions (name, type, unit, sortOrder, archivedAt, startDate, endDate, frequency, createdAt)
      VALUES ($(Format-SqlValue $definition.name), $(Format-SqlValue $definition.type), $unit, $(Format-SqlValue $definition.sortOrder), $(if ($archivedAt) { Format-SqlValue $archivedAt } else { "NULL" }), $startDate, $endDate, $frequency, $(Format-SqlValue $createdAt))"
    $ImportedDefinitionIds.Add($definitionId) | Out-Null
    $inserted++

    foreach ($entry in $Source.Entries) {
      if ([string]$entry.definitionId -ne $definitionId) { continue }
      $entryTime = Convert-OldTime $entry.updatedAt
      if (-not $entryTime) { $entryTime = $createdAt }
      $null = Invoke-Sql $Db "INSERT INTO checkin_entries (definitionId, entryDate, value, updatedAt)
        VALUES ($newDefinitionId, $(Format-SqlValue $entry.entryDate), $(Format-SqlValue $entry.value), $(Format-SqlValue $entryTime))
        ON CONFLICT(definitionId, entryDate) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt"
    }
  }
  return $inserted
}

function Import-Notes([IntPtr]$Db, $Source) {
  foreach ($note in $Source.Notes) {
    $updatedAt = Convert-OldTime $note.updatedAt
    if (-not $updatedAt) { $updatedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ") }
    $null = Invoke-Sql $Db "INSERT OR IGNORE INTO daily_notes (noteDate, content, updatedAt)
      VALUES ($(Format-SqlValue $note.noteDate), $(Format-SqlValue $note.content), $(Format-SqlValue $updatedAt))"
  }
}

function Import-Achievements([IntPtr]$Db, $Source) {
  if ($Source.AchievementDefinitions.Count -eq 0 -or $Source.Earned.Count -eq 0) { return }
  $sourceKeyMap = @{}
  foreach ($definition in $Source.AchievementDefinitions) {
    $sourceKeyMap[[string]$definition.id] = $definition.key
  }
  $targetKeyMap = @{}
  foreach ($row in (Get-SqlRows $Db "SELECT id, key FROM achievement_definitions")) {
    $targetKeyMap[$row.key] = $row.id
  }
  foreach ($earned in $Source.Earned) {
    $key = $sourceKeyMap[[string]$earned.definitionId]
    if (-not $key -or -not $targetKeyMap.ContainsKey($key)) { continue }
    $earnedAt = Convert-OldTime $earned.earnedAt
    if (-not $earnedAt) { $earnedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ") }
    $null = Invoke-Sql $Db "INSERT OR IGNORE INTO earned_achievements (definitionId, earnedAt)
      VALUES ($(Format-SqlValue $targetKeyMap[$key]), $(Format-SqlValue $earnedAt))"
  }
}

function Import-Settings([IntPtr]$Db) {
  $configPath = Join-Path $env:APPDATA "daily-calendar\config.json"
  if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) { return }
  $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
  if ($null -ne $config.widgetPrefs) {
    $current = Read-Setting $Db "widgetPrefs"
    $merged = @{}
    if ($current -is [System.Management.Automation.PSCustomObject]) {
      foreach ($property in $current.PSObject.Properties) { $merged[$property.Name] = $property.Value }
    } elseif ($current -is [System.Collections.IDictionary]) {
      foreach ($key in $current.Keys) { $merged[$key] = $current[$key] }
    }
    foreach ($property in $config.widgetPrefs.PSObject.Properties) { $merged[$property.Name] = $property.Value }
    Write-Setting $Db "widgetPrefs" $merged
  }
  if ($null -ne $config.theme) { Write-Setting $Db "theme" $config.theme }
  if ($null -ne $config.lastFailedCheckDate) { Write-Setting $Db "lastFailedCheckDate" $config.lastFailedCheckDate }
}

function Save-MigrationMarker([IntPtr]$Db, [string]$SourcePath, $TaskIds, $DefinitionIds) {
  $marker = @{
    version = 1
    source = $SourcePath
    importedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    sourceTaskIds = @($TaskIds)
    sourceDefinitionIds = @($DefinitionIds)
  }
  Write-Setting $Db "dailyCalendarMigration" $marker
}

function Clear-UserData([IntPtr]$Db) {
  $null = Invoke-Sql $Db @"
DELETE FROM subtask_occurrences;
DELETE FROM subtasks;
DELETE FROM task_occurrences;
DELETE FROM tasks;
DELETE FROM checkin_entries;
DELETE FROM checkin_definitions;
DELETE FROM daily_notes;
DELETE FROM earned_achievements;
DELETE FROM settings WHERE key = 'dailyCalendarMigration' OR key = 'focusdayMigration';
"@
}

function Get-RunningApps {
  $apps = @()
  foreach ($process in (Get-Process -ErrorAction SilentlyContinue)) {
    if ($process.ProcessName -eq "calendar-tauri" -or $process.ProcessName -eq "日历" -or $process.ProcessName -eq "daily-calendar") {
      $apps += $process.ProcessName
    }
  }
  return @($apps | Select-Object -Unique)
}

function Main {
  Write-Host "=== 旧版 daily-calendar 数据迁移 ==="
  $testMode = $env:CALENDAR_TEST_MODE -eq "1"
  $sourcePath = Resolve-SourceDatabase $SourceDb
  $defaultTarget = Join-Path $env:APPDATA "com.calendar.desktop\$(if ($testMode) { 'test-calendar.db' } else { 'calendar.db' })"
  $targetPath = if ($TargetDb) { $TargetDb } else { $defaultTarget }
  Write-Host "旧版数据源：$sourcePath"
  Write-Host "目标数据库：$targetPath"

  $running = Get-RunningApps
  if (-not $Force -and $running.Count -gt 0) {
    throw "检测到应用仍在运行（$($running -join '、')）。请先退出旧版日历和当前日历（含托盘图标），或确认安全后加 -Force。"
  }

  $source = Get-SourceData $sourcePath
  Write-Host "旧版数据：任务 $($source.TaskCount) 条；重复任务记录 $($source.Occurrences.Count) 条；打卡定义 $($source.Definitions.Count) 条；打卡记录 $($source.Entries.Count) 条；备注 $($source.Notes.Count) 条。"

  $targetDir = Split-Path -Parent $targetPath
  New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
  $db = Open-SqliteDatabase $targetPath ($SQLITE_OPEN_READWRITE -bor $SQLITE_OPEN_CREATE)
  $inTransaction = $false
  try {
    Ensure-TargetSchema $db
    $before = Get-DataCounts $db
    $hasData = $before.Tasks -gt 0 -or $before.Definitions -gt 0 -or $before.Notes -gt 0 -or $before.Earned -gt 0

    $mode = if ($Overwrite) { "overwrite" } elseif ($Merge) { "merge" } else {
      if ($hasData) {
        Write-Host "目标库已有数据：任务 $($before.Tasks) 条，打卡定义 $($before.Definitions) 条，备注 $($before.Notes) 条，成就 $($before.Earned) 条。"
        $answer = Read-Host "是否覆盖现有数据？输入 Y 覆盖，N 合并导入（不覆盖），其他取消"
        if ($answer -eq "y" -or $answer -eq "Y") { "overwrite" }
        elseif ($answer -eq "n" -or $answer -eq "N") { "merge" }
        else { throw "已取消迁移。" }
      } else {
        "merge"
      }
    }
    Write-Host "迁移方式：$(if ($mode -eq 'overwrite') { '覆盖现有数据' } else { '合并导入（不覆盖现有数据）' })"
    if (-not $Yes) {
      $confirm = Read-Host "确认执行迁移？输入 Y 继续，其他取消"
      if ($confirm -ne "y" -and $confirm -ne "Y") { throw "已取消迁移。" }
    }

    $backup = Backup-Database $db $targetPath $BackupDir $testMode
    Write-Host "备份文件：$($backup.Path)"
    Write-Host "备份 SHA256：$($backup.Hash)"

    $previousMarker = $null
    if ($mode -ne "overwrite") {
      $previousMarker = Read-Setting $db "dailyCalendarMigration"
    }
    $importedTaskIds = New-Object "System.Collections.Generic.HashSet[string]"
    $importedDefinitionIds = New-Object "System.Collections.Generic.HashSet[string]"
    if ($null -ne $previousMarker) {
      foreach ($id in @($previousMarker.sourceTaskIds)) { if ($id) { $importedTaskIds.Add([string]$id) | Out-Null } }
      foreach ($id in @($previousMarker.sourceDefinitionIds)) { if ($id) { $importedDefinitionIds.Add([string]$id) | Out-Null } }
    }

    $null = Invoke-Sql $db "BEGIN IMMEDIATE"
    $inTransaction = $true
    try {
      if ($mode -eq "overwrite") {
        Clear-UserData $db
        $importedTaskIds.Clear()
        $importedDefinitionIds.Clear()
      }
      $taskCount = Import-Tasks $db $source $importedTaskIds ($mode -eq "overwrite")
      $checkinCount = Import-Checkins $db $source $importedDefinitionIds ($mode -eq "overwrite")
      Import-Notes $db $source
      Import-Achievements $db $source
      Import-Settings $db
      Save-MigrationMarker $db $sourcePath $importedTaskIds $importedDefinitionIds
      $null = Invoke-Sql $db "COMMIT"
      $inTransaction = $false
    } catch {
      $null = Invoke-Sql $db "ROLLBACK"
      $inTransaction = $false
      throw
    }

    $after = Get-DataCounts $db
    $occurrenceCount = [long](Get-SqlScalar $db "SELECT COUNT(*) AS n FROM task_occurrences")
    $entryCount = [long](Get-SqlScalar $db "SELECT COUNT(*) AS n FROM checkin_entries")
    Write-Host ""
    Write-Host "迁移完成。"
    Write-Host "  本次新增任务：$taskCount；打卡定义：$checkinCount"
    Write-Host "  目标库统计：任务 $($after.Tasks)，重复任务记录 $occurrenceCount，打卡定义 $($after.Definitions)，打卡记录 $entryCount，备注 $($after.Notes)，成就 $($after.Earned)"
    Write-Host "  提示：重新启动当前日历后查看数据；如无变化请确认使用的是正式版窗口。"
  } finally {
    if ($inTransaction) {
      try { $null = Invoke-Sql $db "ROLLBACK" } catch {}
    }
    Close-SqliteDatabase $db
  }
}

try {
  Main
} catch {
  Write-Host ""
  Write-Host "迁移失败：$($_.Exception.Message)" -ForegroundColor Red
  exit 1
}