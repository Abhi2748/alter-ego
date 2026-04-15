"""One-off: generate assets/sounds/focus_session_complete.wav (short chime)."""
import math
import os
import struct

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
path = os.path.join(ROOT, "assets", "sounds", "focus_session_complete.wav")
os.makedirs(os.path.dirname(path), exist_ok=True)

hz = 22050
duration = 0.4
samples = int(hz * duration)
data = bytearray()
for i in range(samples):
    t = i / hz
    env = min(1.0, i / (hz * 0.05)) * max(0.0, 1.0 - (i - samples * 0.7) / (samples * 0.3))
    v = int(128 + 110 * env * math.sin(2 * math.pi * 880 * t))
    data.append(max(0, min(255, v)))

data_size = len(data)
header = struct.pack(
    "<4sI4s4sIHHIIHH4sI",
    b"RIFF",
    36 + data_size,
    b"WAVE",
    b"fmt ",
    16,
    1,
    1,
    hz,
    hz,
    1,
    8,
    b"data",
    data_size,
)
with open(path, "wb") as f:
    f.write(header)
    f.write(data)
print("wrote", path)
