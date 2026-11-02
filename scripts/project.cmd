@echo off
setlocal EnableExtensions DisableDelayedExpansion
for /f "tokens=2 delims=:" %%C in ('chcp') do set "AGT_PREVIOUS_CP=%%C"
chcp 65001 >nul
pushd "%~dp0.."
if errorlevel 1 goto locationFailed
if "%~1"=="" (
    call npm.cmd test
) else (
    call npm.cmd run "%~1"
)
set "AGT_EXIT_CODE=%errorlevel%"
popd
chcp %AGT_PREVIOUS_CP% >nul
exit /b %AGT_EXIT_CODE%

:locationFailed
chcp %AGT_PREVIOUS_CP% >nul
exit /b 1
