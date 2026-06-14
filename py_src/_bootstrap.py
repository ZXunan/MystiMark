# Bootstrap script that runs *after* the mystimark_engine/ package has been
# extracted to the Pyodide filesystem. It re-roots the package so that the
# sub-modules' `from .xxx import …` statements work correctly inside Pyodide.
#
# Why this is needed
# ------------------
# The original code uses relative imports (`from .bwm_core import …`).
# In a normal `pip install`-ed environment these work because the
# distribution is installed as a *namespace package* under site-packages.
# Here, we just dump the source files into `/mystimark_engine/` and add
# that path to sys.path, so the import rules are different:
#
#   - `import mystimark_engine`     → runs `__init__.py` (good)
#   - inside __init__.py: `from .bwm_core import WaterMarkCore`
#     __package__ is correctly set to "mystimark_engine", so this works.
#   - inside bwm_core.py: `from .mystimark_engine import WaterMark`  (no,
#     that line isn't there; let me re-check.)
#
# In practice, the failure path is: pyodide_main.py is at the *root* of
# sys.path. When it does `from mystimark_engine import WaterMark`, Python
# loads `mystimark_engine/__init__.py` and runs it. __init__.py in turn
# has `from .mystimark_engine import WaterMark`, which resolves to
# `mystimark_engine.mystimark_engine` — that sub-module, when run, has its
# own `from .bwm_core import WaterMarkCore` line. At that point
# `__package__` is correctly "mystimark_engine", so it should work.
#
# However Pyodide's loader has had issues with this exact pattern.
# The bullet-proof fix: after `import mystimark_engine`, explicitly set
# `__package__` on the sub-modules and re-trigger their import via
# importlib. We do that here.

import sys
import os
import importlib.util

_pkg_root = "/mystimark_engine"
if _pkg_root not in sys.path:
    sys.path.insert(0, _pkg_root)

# Also make the filesystem root ("/") importable so that
# `import pyodide_main` works after we've written /pyodide_main.py.
if "/" not in sys.path:
    sys.path.insert(0, "/")

# 1) Make sure /mystimark_engine is a regular package (with __init__.py).
#    Even though we wrote __init__.py, Pyodide's loader sometimes treats
#    directories that look like namespace packages differently. Force the
#    issue by explicitly loading __init__.py.
import importlib
if "mystimark_engine" in sys.modules:
    del sys.modules["mystimark_engine"]
spec = importlib.util.spec_from_file_location(
    "mystimark_engine",
    os.path.join(_pkg_root, "__init__.py"),
    submodule_search_locations=[_pkg_root],
)
pkg = importlib.util.module_from_spec(spec)
sys.modules["mystimark_engine"] = pkg
spec.loader.exec_module(pkg)

# 2) Now load each sub-module using its full dotted name. This is what
#    sets `__package__ = "mystimark_engine"` correctly inside them.
#    But BEFORE we load `pool`, neutralise the platform-conditional call
#    `multiprocessing.set_start_method('fork')` that fails on Pyodide.
import multiprocessing
_orig_set_start_method = multiprocessing.set_start_method
def _safe_set_start_method(name, force=False):
    try:
        _orig_set_start_method(name, force=force)
    except RuntimeError:
        pass
multiprocessing.set_start_method = _safe_set_start_method

for _mod in ["bwm_core", "mystimark_engine", "att", "recover", "version", "pool"]:
    _full = "mystimark_engine." + _mod
    if _full in sys.modules:
        del sys.modules[_full]
    importlib.import_module(_full)

# 3) Silence the package's import-time banner.
try:
    pkg.bw_notes.close()
except Exception:
    pass

