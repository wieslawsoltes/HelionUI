@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  py -3 serve-helion.py --open %*
  goto done
)
where python >nul 2>nul
if not errorlevel 1 (
  python serve-helion.py --open %*
  goto done
)
echo Python 3 is required for this launcher. The source package also supports npm start with Node installed.
:done
if errorlevel 1 pause
endlocal
