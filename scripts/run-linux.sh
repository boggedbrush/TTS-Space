#!/bin/bash
# Qwen3-TTS Native Run Script for Linux
# Supports: CUDA (NVIDIA), ROCm (AMD), and CPU

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🎙️ Qwen3-TTS Studio - Linux Native Setup"
echo "=========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Python - try versioned installations first
PYTHON_CMD=""
for version in python3.13 python3.12 python3.11 python3.10 python3; do
    if command -v $version &> /dev/null; then
        PYTHON_CMD=$version
        break
    fi
done

if [ -z "$PYTHON_CMD" ]; then
    echo -e "${RED}❌ Python 3 is required but not installed.${NC}"
    echo "Install with: sudo apt install python3 python3-pip python3-venv"
    echo "Or on Arch: sudo pacman -S python"
    exit 1
fi

PYTHON_VERSION=$($PYTHON_CMD -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
PYTHON_MAJOR=$($PYTHON_CMD -c 'import sys; print(sys.version_info.major)')
PYTHON_MINOR=$($PYTHON_CMD -c 'import sys; print(sys.version_info.minor)')

# Check if Python version is 3.10-3.13 (3.14+ has compatibility issues)
if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 10 ]); then
    echo -e "${RED}❌ Python 3.10+ is required, but Python $PYTHON_VERSION is installed.${NC}"
    echo "Install with: sudo apt install python3.11 python3.11-venv"
    echo "Or on Arch: sudo pacman -S python311"
    exit 1
fi

if [ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -ge 14 ]; then
    echo -e "${RED}❌ Python 3.14+ is too new. Python 3.10-3.13 is required.${NC}"
    echo "Install Python 3.13: sudo apt install python3.13 python3.13-venv"
    echo "Or on Arch: sudo pacman -S python313"
    exit 1
fi

echo -e "${GREEN}✓ Python $PYTHON_VERSION found (using $PYTHON_CMD)${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is required but not installed.${NC}"
    echo "Install with: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js $NODE_VERSION found${NC}"

# Detect GPU
GPU_TYPE="cpu"
if command -v nvidia-smi &> /dev/null && nvidia-smi &> /dev/null; then
    GPU_TYPE="cuda"
    GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -n1)
    echo -e "${GREEN}✓ NVIDIA GPU detected: $GPU_NAME${NC}"
elif command -v rocminfo &> /dev/null; then
    # Check if ROCm can actually detect GPU
    if rocminfo | grep -qi "gfx\|Radeon"; then
        GPU_TYPE="rocm"
        GPU_NAME=$(rocminfo | grep "Marketing Name:" | grep -i "radeon" | head -n1 | cut -d: -f2 | xargs)
        if [ -z "$GPU_NAME" ]; then
            GPU_NAME="AMD GPU"
        fi
        echo -e "${GREEN}✓ AMD GPU detected: $GPU_NAME${NC}"
    else
        echo -e "${YELLOW}⚠ rocminfo found but no GPU detected, using CPU${NC}"
    fi
else
    echo -e "${YELLOW}⚠ No GPU detected, using CPU (will be slower)${NC}"
fi

# Setup backend virtual environment
echo ""
echo "📦 Setting up Python backend..."
cd "$PROJECT_DIR/backend"

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    $PYTHON_CMD -m venv venv
fi

source venv/bin/activate

# Install PyTorch with appropriate backend
echo "Installing dependencies..."
if [ "$GPU_TYPE" == "cuda" ]; then
    pip install --upgrade pip
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
elif [ "$GPU_TYPE" == "rocm" ]; then
    pip install --upgrade pip
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/rocm6.0
else
    pip install --upgrade pip
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
fi

pip install -r requirements.txt

# Setup frontend
echo ""
echo "📦 Setting up Node.js frontend..."
cd "$PROJECT_DIR/frontend"

if [ ! -d "node_modules" ]; then
    npm install
fi

# Start services
echo ""
echo "🚀 Starting services..."
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both services${NC}"
echo ""

# Start backend in background
cd "$PROJECT_DIR/backend"
source venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Start frontend
cd "$PROJECT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

# Trap Ctrl+C to kill both processes
trap "echo ''; echo 'Shutting down...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM

# Wait for both processes
wait
