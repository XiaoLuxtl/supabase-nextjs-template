@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

title Compresor MAXIMO de Videos
echo ===============================================
echo    COMPRESOR MAXIMO - SIN AUDIO
echo ===============================================
echo.

ffmpeg -version >nul 2>&1
if errorlevel 1 (
    echo ERROR: FFmpeg no encontrado.
    pause
    exit /b 1
)

if not exist "videos_max_compression" mkdir "videos_max_compression"

set count=0

:process
if "%~1"=="" goto finish

echo.
echo [%count%] Comprimiendo al maximo: %~nx1

if not "%~x1"==".mp4" (
    if not "%~x1"==".mov" (
        if not "%~x1"==".avi" (
            if not "%~x1"==".mkv" (
                echo   Saltado: No es video
                shift
                goto process
            )
        )
    )
)

set "output=videos_max_compression\%~n1_small.mp4"

echo   Aplicando compresion maxima...
ffmpeg -i "%~1" -c:v libx264 -crf 32 -preset veryslow -tune fastdecode -an -movflags +faststart -y "%output%"

if errorlevel 1 (
    echo   ERROR: No se pudo comprimir
) else (
    echo   ✓ Comprimido al maximo
    set /a count+=1
)

shift
goto process

:finish
echo.
echo ===============================================
echo Videos comprimidos: %count%
echo Reduccion estimada: 80-90%%
echo ===============================================
pause