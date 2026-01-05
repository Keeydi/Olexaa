@echo off
REM ============================================
REM  FreshTrack Backend Runner (Windows .bat)
REM ============================================
REM  1) Keep your secrets in backend\.env (NOT in system env).
REM  2) Then just double–click this file to start the backend.

REM --- Do not edit below unless you know what you’re doing ---
REM Resolve backend directory
set "BACKEND_DIR=%~dp0backend"

REM Load environment variables from backend\.env if it exists
REM Expected format (one per line), e.g.:
REM   GEMINI_API_KEY=your-secret-key-here
if exist "%BACKEND_DIR%\.env" (
  for /f "usebackq tokens=1* delims==" %%A in ("%BACKEND_DIR%\.env") do (
    set "%%A=%%B"
  )
)

cd /d "%BACKEND_DIR%"
python main.py

pause


