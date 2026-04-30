@echo off
echo [RentalManagement] Starting servers...

start "Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 3 /nobreak > nul

start "Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo Backend: http://localhost:8000
echo Frontend: http://localhost:3000
