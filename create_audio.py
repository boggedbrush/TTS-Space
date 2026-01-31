
import soundfile as sf
import numpy as np
import io

sr = 16000
t = np.linspace(0, 1.0, sr)
# 440Hz sine wave
audio = 0.5 * np.sin(2 * np.pi * 440 * t)

sf.write('test_audio.wav', audio, sr)
