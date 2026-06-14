"""
pyodide_main.py 鈥?entry points the JS UI calls.

This module is concatenated into a single Python source string and executed
inside Pyodide via runPython(). It uses the bundled DWT-DCT-SVD engine
loaded into the Pyodide filesystem before this module runs.

The engine depends on opencv-python, which IS available in Pyodide
as a built-in package (4.11.0.86 at the time of writing).

Exposed functions:
    embed_str(img_bytes, wm_str, pwd_wm=1, pwd_img=1) -> png_bytes
    extract_str(img_bytes, wm_shape, pwd_wm=1, pwd_img=1) -> str
    embed_img(img_bytes, wm_img_bytes, pwd_wm=1, pwd_img=1) -> png_bytes
    extract_img(img_bytes, wm_shape, pwd_wm=1, pwd_img=1) -> png_bytes
    attack(img_bytes, kind) -> png_bytes
        where kind in {'resize', 'crop', 'rotate', 'brightness', 'saltpepper', 'mask', 'jpeg'}
"""

import io
import os
import sys
import json
import numpy as np
import cv2

# Make sure the bundled engine package is importable.
# It is placed under /mystimark_engine/ in the Pyodide FS at boot.
if "/mystimark_engine" not in sys.path:
    sys.path.insert(0, "/mystimark_engine")

from mystimark_engine import WaterMark  # noqa: E402
from mystimark_engine import att as engine_att  # noqa: E402


# ---------------- bytes <-> numpy ----------------
#
# We deliberately use cv2 instead of Pillow for image IO. cv2 is already
# a dependency of the engine (it ships with the runtime), so we get
# PNG/JPEG decode + encode for free without paying the ~4MB cost of
# loading Pillow as a separate Pyodide wheel.

def _img_to_bgr(img_bytes):
    """Decode PNG/JPEG bytes (RGB) -> BGR uint8 HxWx3 array (cv2 ordering)."""
    arr = np.frombuffer(img_bytes, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        # Some inputs are grayscale 鈥?try that path
        bgr = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
        if bgr is None:
            raise ValueError("could not decode image bytes")
        return bgr
    return bgr


def _bgr_to_png(bgr):
    """Encode a BGR (or grayscale) array back to PNG bytes."""
    if bgr.ndim == 3 and bgr.shape[2] == 3:
        pass  # already BGR
    elif bgr.ndim == 2:
        pass  # grayscale, cv2 handles
    else:
        bgr = np.clip(bgr, 0, 255).astype(np.uint8)
    ok, buf = cv2.imencode(".png", bgr)
    if not ok:
        raise RuntimeError("cv2 PNG encode failed")
    return bytes(buf.tobytes())


# ---------------- embed / extract text ----------------

def embed_str(img_bytes, wm_str, pwd_wm=1, pwd_img=1):
    bwm = WaterMark(password_wm=int(pwd_wm), password_img=int(pwd_img))
    # The original WaterMark.read_img expects a BGR ndarray.
    bwm.read_img(img=_img_to_bgr(img_bytes))
    bwm.read_wm(wm_str, mode="str")
    bgr_out = bwm.embed()
    return _bgr_to_png(bgr_out)


def extract_str(img_bytes, wm_shape, pwd_wm=1, pwd_img=1):
    bwm = WaterMark(password_wm=int(pwd_wm), password_img=int(pwd_img))
    return bwm.extract(
        embed_img=_img_to_bgr(img_bytes),
        wm_shape=wm_shape,
        mode="str",
    )


# ---------------- embed / extract image ----------------

def embed_img(img_bytes, wm_img_bytes, pwd_wm=1, pwd_img=1):
    bwm = WaterMark(password_wm=int(pwd_wm), password_img=int(pwd_img))
    bwm.read_img(img=_img_to_bgr(img_bytes))
    bwm.read_wm(wm_img_bytes, mode="img")
    bgr_out = bwm.embed()
    return _bgr_to_png(bgr_out)


def extract_img(img_bytes, wm_shape, pwd_wm=1, pwd_img=1):
    bwm = WaterMark(password_wm=int(pwd_wm), password_img=int(pwd_img))
    bgr = bwm.extract(
        embed_img=_img_to_bgr(img_bytes),
        wm_shape=wm_shape,
        mode="img",
    )
    return _bgr_to_png(bgr)


# ---------------- attacks (use original att functions) ----------------

def attack(img_bytes, kind="resize", **kwargs):
    bgr = _img_to_bgr(img_bytes)
    if kind == "resize":
        out = engine_att.resize_att(input_img=bgr, out_shape=kwargs.get("out_shape", (500, 500)))
    elif kind == "crop":
        out = engine_att.cut_att3(input_img=bgr, loc=kwargs.get("loc"), scale=kwargs.get("scale"))
    elif kind == "rotate":
        out = engine_att.rot_att(input_img=bgr, angle=kwargs.get("angle", 45))
    elif kind == "brightness":
        out = engine_att.bright_att(input_img=bgr, ratio=kwargs.get("ratio", 0.8))
    elif kind == "saltpepper":
        out = engine_att.salt_pepper_att(input_img=bgr, ratio=kwargs.get("ratio", 0.01))
    elif kind == "mask":
        out = engine_att.shelter_att(input_img=bgr, ratio=kwargs.get("ratio", 0.1), n=kwargs.get("n", 3))
    elif kind == "jpeg":
        quality = kwargs.get("quality", 50)
        ok, buf = cv2.imencode(".jpg", bgr, [int(cv2.IMWRITE_JPEG_QUALITY), int(quality)])
        if not ok:
            raise RuntimeError("cv2 JPEG encode failed")
        bgr = cv2.imdecode(np.frombuffer(buf, np.uint8), cv2.IMREAD_COLOR)
        return _bgr_to_png(bgr)
    else:
        raise ValueError(f"unknown attack kind: {kind}")
    return _bgr_to_png(out)


# ---------------- probe ----------------

def probe():
    import sys
    import numpy as np
    import cv2
    return {
        "python": sys.version.split()[0],
        "numpy": np.__version__,
        "cv2": cv2.__version__,
        "engine": "loaded",
    }


# Helper: the original library's `read_wm(msg, mode='str')` encodes the
# string as a bit stream with a peculiar quirk 鈥?it goes through
#   bin(int(hex(utf8), 16))[2:]
# which produces a bit string of length `len(hex)` * 4 minus however many
# leading zeros `bin()` strips. The bit length is therefore:
#   bit_len = (utf8_byte_len * 8) - leading_zero_bits(utf8_hex)
# We compute it by replicating the exact library logic.
def wm_str_bit_length(wm_str):
    byte = bin(int(wm_str.encode("utf-8").hex(), base=16))[2:]
    return len(byte)


# The bit length for an image signature is just h*w (binary bits).
def wm_img_bit_length(img_bytes):
    bgr = _img_to_bgr(bytes(img_bytes))
    # We need grayscale; convert from BGR if needed
    if bgr.ndim == 3:
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    else:
        gray = bgr
    return int(gray.size)

