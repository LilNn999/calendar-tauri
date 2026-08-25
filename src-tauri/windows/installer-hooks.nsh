; 日历-安装器钩子：升级时覆盖安装目录，避免残留旧版本文件。
; 用户正式数据保存在 %APPDATA%\com.calendar.desktop，不在 $INSTDIR 内，因此不会被删除。
!macro NSIS_HOOK_PREINSTALL
  DetailPrint "正在停止旧版日历并清理安装目录..."
  nsExec::ExecToLog 'taskkill /F /T /IM calendar-tauri.exe'
  Sleep 1000
  RMDir /r "$INSTDIR"
  CreateDirectory "$INSTDIR"
!macroend
