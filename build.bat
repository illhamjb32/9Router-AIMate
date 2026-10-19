@echo off
call "D:\Program Files\MVC\VC\Auxiliary\Build\vcvars64.bat"
cd /d "%~dp0src-tauri"
cargo build
if errorlevel 1 exit /b 1
copy /y target\debug\aimate-widget.exe ..\AIMate-Widget.exe
