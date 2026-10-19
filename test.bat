@echo off
call "D:\Program Files\MVC\VC\Auxiliary\Build\vcvars64.bat"
cd /d "%~dp0src-tauri"
cargo test
