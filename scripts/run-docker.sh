#!/bin/bash
# Qwen3-TTS Docker Compose Runner (auto-detects GPU)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

COMPOSE_CMD="docker compose"
if ! docker compose version >/dev/null 2>&1; then
    if command -v docker-compose >/dev/null 2>&1; then
        COMPOSE_CMD="docker-compose"
    else
        echo "❌ Docker Compose not found. Install Docker Desktop or docker-compose."
        exit 1
    fi
fi

MODE="prod"
FORCE_GPU=""
EXTRA_ARGS=()
VERBOSE=false

detect_amd_gpu() {
    if command -v rocminfo >/dev/null 2>&1; then
        local rocminfo_out
        rocminfo_out="$(rocminfo 2>/dev/null || true)"
        grep -Eqi "gfx|Radeon|Device Type:[[:space:]]+GPU" <<<"$rocminfo_out"
        return $?
    fi
    if [ -x /opt/rocm/bin/rocminfo ]; then
        local rocminfo_out
        rocminfo_out="$(/opt/rocm/bin/rocminfo 2>/dev/null || true)"
        grep -Eqi "gfx|Radeon|Device Type:[[:space:]]+GPU" <<<"$rocminfo_out"
        return $?
    fi
    if command -v rocm-smi >/dev/null 2>&1; then
        rocm-smi -i >/dev/null 2>&1
        return $?
    fi
    if [ -e /dev/kfd ] && [ -d /dev/dri ]; then
        ls /dev/dri/renderD* >/dev/null 2>&1
        return $?
    fi
    if command -v lspci >/dev/null 2>&1; then
        lspci | grep -qi "AMD/ATI"
        return $?
    fi
    return 1
}

if [ "$(uname -s)" = "Darwin" ]; then
    echo "⚠ macOS detected: Docker will run CPU-only (no MPS acceleration)."
    echo "For MPS acceleration, use ./scripts/run-macos.sh instead."
    read -r -p "You have been warned. Proceed? [y/n] " CONFIRM
    case "$CONFIRM" in
        y|Y) ;;
        *) echo "Aborted."; exit 1 ;;
    esac
fi

for arg in "$@"; do
    case "$arg" in
        --dev)
            MODE="dev"
            ;;
        --prod)
            MODE="prod"
            ;;
        --verbose|-v)
            VERBOSE=true
            ;;
        --cpu|--nvidia|--amd)
            FORCE_GPU="${arg#--}"
            ;;
        --help|-h)
            echo "Usage: $0 [--dev|--prod] [--cpu|--nvidia|--amd] [extra docker compose args]"
            exit 0
            ;;
        *)
            EXTRA_ARGS+=("$arg")
            ;;
    esac
done

GPU_TYPE="$FORCE_GPU"
if [ -z "$GPU_TYPE" ]; then
    if command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi >/dev/null 2>&1; then
        GPU_TYPE="nvidia"
    elif detect_amd_gpu; then
        GPU_TYPE="amd"
    else
        GPU_TYPE="cpu"
    fi
fi

COMPOSE_FILES=(-f "$PROJECT_DIR/docker-compose.yml")
if [ "$GPU_TYPE" = "nvidia" ]; then
    COMPOSE_FILES+=(-f "$PROJECT_DIR/docker-compose.nvidia.yml")
elif [ "$GPU_TYPE" = "amd" ]; then
    COMPOSE_FILES+=(-f "$PROJECT_DIR/docker-compose.amd.yml")
fi

if [ "$MODE" = "dev" ]; then
    COMPOSE_FILES+=(-f "$PROJECT_DIR/docker-compose.dev.yml")
fi

echo "▶ Docker mode: $MODE | GPU: $GPU_TYPE"

cleanup() {
    echo ""
    echo "Stopping containers..."
    $COMPOSE_CMD "${COMPOSE_FILES[@]}" down >/dev/null 2>&1 || true
}

trap 'cleanup; exit 130' INT
trap 'cleanup; exit 143' TERM

if [ "$VERBOSE" = true ]; then
    $COMPOSE_CMD "${COMPOSE_FILES[@]}" up --build "${EXTRA_ARGS[@]}"
else
    $COMPOSE_CMD "${COMPOSE_FILES[@]}" up --build -d "${EXTRA_ARGS[@]}"

    if command -v ipconfig >/dev/null 2>&1; then
        LOCAL_IP="$(ipconfig getifaddr en0 2>/dev/null || echo "localhost")"
    elif command -v ip >/dev/null 2>&1; then
        LOCAL_IP="$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i=1;i<=NF;i++) if ($i=="src") {print $(i+1); exit}}')"
    elif command -v hostname >/dev/null 2>&1; then
        LOCAL_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
    fi

    if [ -z "${LOCAL_IP:-}" ]; then
        LOCAL_IP="localhost"
    fi

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🎙️  Qwen3-TTS Studio is running!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "   Local:   http://localhost:3000"
    echo "   LAN:     http://$LOCAL_IP:3000"
    echo "   API:     http://$LOCAL_IP:8000"
    echo ""
    if [ "$GPU_TYPE" = "nvidia" ]; then
        echo "   ✅ NVIDIA GPU acceleration enabled"
    elif [ "$GPU_TYPE" = "amd" ]; then
        echo "   ✅ AMD ROCm acceleration enabled"
    else
        echo "   ⚠ CPU mode (no GPU acceleration)"
    fi
    echo ""
    echo "   Press Ctrl+C to stop"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    while true; do
        sleep 1
    done
fi
