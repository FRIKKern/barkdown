@echo off
setlocal DisableDelayedExpansion
call "C:/Program Files/Microsoft Visual Studio/18/Community/Common7/Tools/VsDevCmd.bat" -arch=x64 -host_arch=x64
if errorlevel 1 exit /b %errorlevel%
"C:\Program Files\nodejs\node.exe" "C:\Users\Frikk\Documents\GitHub\barkdown\.git\c098-pty-lifecycle-build-01.mjs" --worker "C:\Users\Frikk\Documents\GitHub\barkdown\.git\c098-pty-lifecycle-build-01/state.json"
exit /b %errorlevel%
