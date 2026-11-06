@echo off
title Rimba Alam - Mobile Stock App
color 0A
echo ==========================================================
echo        SISTEM MANAJEMEN STOK MOBILE RIMBA ALAM
echo ==========================================================
echo Sedang memulai server lokal...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-mobile-app.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Menjalankan fallback dengan Node.js...
    node "%~dp0server.js"
)

pause
