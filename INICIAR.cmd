@echo off
cd /d "%~dp0"
echo Gimnasio UNT - http://localhost:3180
echo Mantener esta ventana abierta mientras se usa la vista local.
call npm run dev
pause
