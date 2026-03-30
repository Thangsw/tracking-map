@echo off
echo ========================================
echo    TRACKING MAP - Khoi dong he thong
echo ========================================
echo.
echo [1/2] Dang khoi dong Backend (port 3001)...
start "Tracking Map - Backend" cmd /k "cd /d %~dp0 && node server.cjs"

timeout /t 2 /nobreak > nul

echo [2/2] Dang khoi dong Frontend (port 5173)...
start "Tracking Map - Frontend" cmd /k "cd /d %~dp0 && npm run dev"

timeout /t 3 /nobreak > nul

echo.
echo ========================================
echo  Mo trinh duyet: http://localhost:5173
echo ========================================
start http://localhost:5173

exit
