@echo off
chcp 65001 >nul
cd /d "%~dp0"

if exist "dist\index.html" goto run

echo.
echo   首次运行，正在构建，请稍候...
echo.
call npm run build
if errorlevel 1 (
  echo.
  echo   构建失败，请检查 Node 环境是否就绪。
  pause
  exit /b 1
)

:run
node serve.mjs
if errorlevel 1 pause
