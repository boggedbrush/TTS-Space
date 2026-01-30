# Qwen3-TTS Premium Web Application

A state-of-the-art text-to-speech web application featuring Voice Design, Voice Clone, and Custom Voice modes. Built with Next.js 14 (React + TypeScript + Tailwind CSS) and Python FastAPI.

![Qwen3-TTS Studio](https://img.shields.io/badge/Qwen3--TTS-Studio-violet?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109-green?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

## ✨ Features

### Three Powerful TTS Modes

1. **Voice Design** ✨  
   Create entirely new voices from natural language descriptions. No reference audio needed.

2. **Voice Clone** 🎭  
   Clone any voice from a short audio sample (5-15 seconds). High-fidelity reproduction.

3. **Custom Voice** 🎤  
   Use 9 premium pre-trained speakers across multiple languages with style instructions.

### Premium UI/UX

- 🌓 Dark/Light theme with smooth transitions
- 🎨 Gradient glassmorphism design
- 🎵 Advanced audio player with waveform visualization
- ⌨️ Keyboard shortcuts (Space, J, K, L, M)
- 📱 Fully responsive mobile-first design
- ♿ Accessible (WCAG compliant, keyboard navigation, reduced motion)

### Technical Features

- 🚀 97ms end-to-end latency (GPU)
- 🌍 10+ languages supported
- 💾 Local history with IndexedDB
- 🔄 Request cancellation
- 📊 Real-time generation status

## 🖥️ System Requirements

### Hardware

- **GPU (Recommended)**: NVIDIA GPU with CUDA 11.8+ OR AMD GPU with ROCm 6.0+
- **RAM**: 16GB minimum, 32GB recommended
- **VRAM**: 8GB minimum for 0.6B models, 16GB for 1.7B models
- **CPU Fallback**: Works on CPU but significantly slower

### Software

- **Node.js** 18+ and npm
- **Python** 3.10 or higher (3.9 and below are not supported)
- **PyTorch** 2.0+ with CUDA or ROCm support

## 🚀 Quick Start

### Option 1: One-Liner Scripts (Recommended)

These scripts auto-detect your GPU and set everything up for you:

**Linux:**
```bash
git clone https://github.com/boggedbrush/TTS-Space.git && cd TTS-Space
./scripts/run-linux.sh
```

**macOS:**
```bash
git clone https://github.com/boggedbrush/TTS-Space.git && cd TTS-Space
./scripts/run-macos.sh
```

**Windows (PowerShell):**
```powershell
git clone https://github.com/boggedbrush/TTS-Space.git; cd TTS-Space
.\scripts\run-windows.ps1
```

**Windows (CMD):**
```cmd
git clone https://github.com/boggedbrush/TTS-Space.git && cd TTS-Space
scripts\run-windows.bat
```

### Option 2: Manual Setup

#### 1. Clone the Repository

```bash
git clone https://github.com/boggedbrush/TTS-Space.git
cd TTS-Space
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend will be available at `http://localhost:3000`

### 3. Backend Setup

#### For NVIDIA GPUs (CUDA)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### For AMD GPUs (ROCm)

```bash
cd backend
python -m venv venv
source venv/bin/activate

# Install PyTorch with ROCm support
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/rocm6.0

pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### For CPU (Slow, for testing only)

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Backend will be available at `http://localhost:8000`

## 🐳 Docker Deployment

### NVIDIA GPU

```bash
docker compose up --build
```

### AMD GPU (ROCm)

```bash
docker compose -f docker-compose.yml -f docker-compose.amd.yml up --build
```

## 📁 Project Structure

```
TTS-Space/
├── frontend/                 # Next.js frontend
│   ├── src/
│   │   ├── app/             # App Router pages
│   │   │   ├── voice-design/
│   │   │   ├── voice-clone/
│   │   │   └── custom-voice/
│   │   ├── components/      # React components
│   │   │   └── ui/          # shadcn/ui components
│   │   ├── hooks/           # Custom React hooks
│   │   └── lib/             # Utilities and API client
│   ├── package.json
│   └── tailwind.config.ts
├── backend/                  # FastAPI backend
│   ├── app/
│   │   ├── routers/         # API endpoints
│   │   ├── services/        # TTS model manager
│   │   └── main.py          # FastAPI app
│   └── requirements.txt
├── scripts/                  # Native run scripts
│   ├── run-linux.sh         # Linux (CUDA/ROCm/CPU)
│   ├── run-macos.sh         # macOS (MPS/CPU)
│   ├── run-windows.bat      # Windows CMD
│   └── run-windows.ps1      # Windows PowerShell
├── docker-compose.yml        # Docker (base config)
├── docker-compose.amd.yml    # Docker AMD GPU override
├── docker-compose.nvidia.yml # Docker NVIDIA GPU override
└── README.md
```

## 🔌 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/info` | GET | API capabilities |
| `/api/voice-design` | POST | Generate from description |
| `/api/voice-clone` | POST | Clone from audio |
| `/api/custom-voice` | POST | Use pre-trained speaker |

| `/api/custom-voice` | POST | Use pre-trained speaker |

## 🌐 Remote Access / Tunnels

To access the application remotely using Cloudflare Tunnels, ngrok, or other tunneling services where the frontend and backend may be on different URLs:

1. Expose your backend (port 8000) via a tunnel
2. Set the `NEXT_PUBLIC_API_URL` environment variable when building/running the frontend

```bash
# Example with Cloudflare Tunnel
export NEXT_PUBLIC_API_URL="https://your-backend-tunnel.trycloudflare.com/api"
npm run dev
```

This ensures the frontend can communicate with the backend regardless of the domain or port configuration.

### Example: Voice Design

```bash
curl -X POST http://localhost:8000/api/voice-design \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, this is a test.",
    "language": "English",
    "voice_description": "A warm, friendly female voice with American accent"
  }' \
  --output audio.wav
```

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `J` | Rewind 10 seconds |
| `L` | Forward 10 seconds |
| `K` | Play/Pause (alternate) |
| `M` | Toggle mute |

## 🌐 Supported Languages

- Auto (automatic detection)
- Chinese (中文)
- English
- Japanese (日本語)
- Korean (한국어)
- French (Français)
- German (Deutsch)
- Spanish (Español)
- Portuguese (Português)
- Russian (Русский)

## 🎙️ Available Speakers (Custom Voice)

| Speaker | Gender | Native Language | Notes |
|---------|--------|-----------------|-------|
| Aiden | Male | English | Native fluency |
| Ryan | Male | English | Native fluency |
| Dylan | Male | English | Chinese accent |
| Eric | Male | English | Chinese accent |
| Serena | Female | English | Chinese accent |
| Ono Anna | Female | Japanese | |
| Sohee | Female | Korean | |
| Uncle Fu | Male | Chinese | Old man voice |
| Vivian | Female | Chinese | |

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CUDA_VISIBLE_DEVICES` | GPU device(s) to use | `0` |
| `HF_HOME` | Hugging Face cache directory | `~/.cache/huggingface` |

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS) by Alibaba Cloud
- [Next.js](https://nextjs.org/) by Vercel
- [FastAPI](https://fastapi.tiangolo.com/)
- [shadcn/ui](https://ui.shadcn.com/)
