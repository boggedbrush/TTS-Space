#!/bin/bash
# Qwen3-TTS Native Run Script for macOS
# Supports: MPS (Apple Silicon) and CPU (Intel)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🎙️ Qwen3-TTS Studio - macOS Native Setup"
echo "=========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is required but not installed.${NC}"
    echo "Install with: brew install python3"
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
PYTHON_MAJOR=$(python3 -c 'import sys; print(sys.version_info.major)')
PYTHON_MINOR=$(python3 -c 'import sys; print(sys.version_info.minor)')

# Check if Python version is 3.10 or higher
if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 10 ]); then
    echo -e "${RED}❌ Python 3.10+ is required, but Python $PYTHON_VERSION is installed.${NC}"
    echo "Upgrade with: brew install python@3.11"
    echo "Or download from: https://www.python.org/downloads/"
    exit 1
fi

echo -e "${GREEN}✓ Python $PYTHON_VERSION found${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is required but not installed.${NC}"
    echo "Install with: brew install node"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js $NODE_VERSION found${NC}"

# Detect Apple Silicon vs Intel
ARCH=$(uname -m)
if [ "$ARCH" == "arm64" ]; then
    echo -e "${GREEN}✓ Apple Silicon detected - MPS acceleration available${NC}"
    GPU_TYPE="mps"
else
    echo -e "${YELLOW}⚠ Intel Mac detected - CPU only (no GPU acceleration)${NC}"
    GPU_TYPE="cpu"
fi

# Setup backend virtual environment
echo ""
echo "📦 Setting up Python backend..."
cd "$PROJECT_DIR/backend"

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install --upgrade pip
pip install torch torchvision torchaudio  # PyTorch auto-detects MPS on macOS
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
if [ "$GPU_TYPE" == "mps" ]; then
    echo -e "${GREEN}🍎 Using Metal Performance Shaders (MPS) for acceleration${NC}"
fi
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
