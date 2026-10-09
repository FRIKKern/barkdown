@echo off
setlocal DisableDelayedExpansion
if /I not "%~1"=="eval" exit /b 1
"%C098_ERTS%" -noshell -boot "%C098_BOOT%" -boot_var RELEASE_LIB "%C098_LIB%" -boot_var C098_EXPTY "%C098_CANDIDATE%" -pa "%C098_ELIXIR%" "%C098_LOGGER%" "%C098_CANDIDATE%ebin" -s elixir start_cli -extra "%BARKDOWN_RELEASE_BOOT_SCRIPT%"
exit /b %errorlevel%
