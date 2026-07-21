@echo off
title Sistema de Stock - Consultorio Odontologico
cd /d "%~dp0"
echo.
echo   Iniciando el Sistema de Stock...
echo   (No cierres esta ventana mientras uses el sistema)
echo.

REM Abre el navegador en la app despues de 2 segundos
start "" /min cmd /c "timeout /t 2 >nul & start http://localhost:4321"

node server.js

echo.
echo   El sistema se detuvo. Podes cerrar esta ventana.
pause
