@echo off
REM Qwen3-TTS Native Run Script for Windows
REM Supports: CUDA (NVIDIA), DirectML (AMD/Intel), and CPU

echo.
echo =========================================
echo   Qwen3-TTS Studio - Windows Native Setup
echo =========================================
echo.

set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%.."

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python 3 is required but not installed.
    echo Download from: https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)

for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo [OK] Python %PYTHON_VERSION% found

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is required but not installed.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=1" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js %NODE_VERSION% found

REM Detect GPU
set GPU_TYPE=cpu

REM Check for NVIDIA GPU first
nvidia-smi >nul 2>&1
if not errorlevel 1 (
    echo [OK] NVIDIA GPU detected - CUDA acceleration available
    set GPU_TYPE=cuda
    goto :gpu_done
)

REM Check for AMD GPU using wmic
for /f "tokens=*" %%a in ('wmic path win32_videocontroller get name ^| findstr /i "AMD Radeon"') do (
    echo [OK] AMD GPU detected - DirectML acceleration available
    set GPU_TYPE=directml
    goto :gpu_done
)

REM Check for Intel GPU
for /f "tokens=*" %%a in ('wmic path win32_videocontroller get name ^| findstr /i "Intel"') do (
    echo [OK] Intel GPU detected - DirectML acceleration available
    set GPU_TYPE=directml
    goto :gpu_done
)

echo [WARN] No supported GPU detected, using CPU (will be slower)

:gpu_done

REM Setup backend virtual environment
echo.
echo Setting up Python backend...
cd /d "%PROJECT_DIR%\backend"

if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate.bat

REM Install PyTorch with appropriate backend
echo Installing dependencies...
python -m pip install --upgrade pip

if "%GPU_TYPE%"=="cuda" (
    echo Installing PyTorch with CUDA support...
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
) else if "%GPU_TYPE%"=="directml" (
    echo Installing PyTorch with DirectML support...
    pip install torch torchvision torchaudio
    pip install torch-directml
) else (
    echo Installing PyTorch CPU version...
    pip install torch torchvision torchaudio
)

pip install -r requirements.txt

REM Setup frontend
echo.
echo Setting up Node.js frontend...
cd /d "%PROJECT_DIR%\frontend"

if not exist "node_modules" (
    call npm install
)

REM Start services
echo.
echo =========================================
echo   Starting services...
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:8000
echo =========================================
echo.
if "%GPU_TYPE%"=="directml" (
    echo [INFO] Using DirectML for AMD/Intel GPU acceleration
)
echo Press Ctrl+C to stop both services
echo.

REM Start backend in a new window
cd /d "%PROJECT_DIR%\backend"
start "Qwen3-TTS Backend" cmd /c "call venv\Scripts\activate.bat && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

REM Start frontend in current window
cd /d "%PROJECT_DIR%\frontend"
call npm run dev

pause
