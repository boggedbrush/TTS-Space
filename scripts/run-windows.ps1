# Qwen3-TTS Native Run Script for Windows (PowerShell)
# Supports: CUDA (NVIDIA), DirectML (AMD/Intel), and CPU

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Qwen3-TTS Studio - Windows Native Setup" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir

# Check Python
try {
    $pythonVersion = python --version 2>&1
    Write-Host "[OK] $pythonVersion found" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Python 3 is required but not installed." -ForegroundColor Red
    Write-Host "Download from: https://www.python.org/downloads/" -ForegroundColor Yellow
    Write-Host "Make sure to check 'Add Python to PATH' during installation." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check Node.js
try {
    $nodeVersion = node --version 2>&1
    Write-Host "[OK] Node.js $nodeVersion found" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js is required but not installed." -ForegroundColor Red
    Write-Host "Download from: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Detect GPU
$gpuType = "cpu"

# Check for NVIDIA GPU first
try {
    nvidia-smi 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $gpuType = "cuda"
        Write-Host "[OK] NVIDIA GPU detected - CUDA acceleration available" -ForegroundColor Green
    }
} catch {
    # NVIDIA not found, continue checking
}

# If no NVIDIA, check for AMD or Intel GPU (use DirectML)
if ($gpuType -eq "cpu") {
    $gpus = Get-WmiObject Win32_VideoController | Select-Object -ExpandProperty Name
    foreach ($gpu in $gpus) {
        if ($gpu -match "AMD|Radeon") {
            $gpuType = "directml"
            Write-Host "[OK] AMD GPU detected: $gpu - DirectML acceleration available" -ForegroundColor Green
            break
        }
        if ($gpu -match "Intel") {
            $gpuType = "directml"
            Write-Host "[OK] Intel GPU detected: $gpu - DirectML acceleration available" -ForegroundColor Green
            break
        }
    }
}

if ($gpuType -eq "cpu") {
    Write-Host "[WARN] No supported GPU detected, using CPU (will be slower)" -ForegroundColor Yellow
}

# Setup backend virtual environment
Write-Host ""
Write-Host "Setting up Python backend..." -ForegroundColor Cyan
Set-Location "$ProjectDir\backend"

if (-not (Test-Path "venv")) {
    Write-Host "Creating virtual environment..."
    python -m venv venv
}

& ".\venv\Scripts\Activate.ps1"

# Install PyTorch with appropriate backend
Write-Host "Installing dependencies..."
python -m pip install --upgrade pip

if ($gpuType -eq "cuda") {
    Write-Host "Installing PyTorch with CUDA support..." -ForegroundColor Cyan
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
} elseif ($gpuType -eq "directml") {
    Write-Host "Installing PyTorch with DirectML support..." -ForegroundColor Cyan
    pip install torch torchvision torchaudio
    pip install torch-directml
} else {
    Write-Host "Installing PyTorch CPU version..." -ForegroundColor Cyan
    pip install torch torchvision torchaudio
}

pip install -r requirements.txt

# Setup frontend
Write-Host ""
Write-Host "Setting up Node.js frontend..." -ForegroundColor Cyan
Set-Location "$ProjectDir\frontend"

if (-not (Test-Path "node_modules")) {
    npm install
}

# Start services
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Starting services..." -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "  Backend:  http://localhost:8000" -ForegroundColor White
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
if ($gpuType -eq "directml") {
    Write-Host "[INFO] Using DirectML for AMD/Intel GPU acceleration" -ForegroundColor Magenta
}
Write-Host "Press Ctrl+C to stop both services" -ForegroundColor Yellow
Write-Host ""

# Start backend in a new PowerShell window
Set-Location "$ProjectDir\backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& { Set-Location '$ProjectDir\backend'; & '.\venv\Scripts\Activate.ps1'; python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 }"

# Start frontend in current window
Set-Location "$ProjectDir\frontend"
npm run dev
