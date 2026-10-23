"""Aplicación IMPULSE y salida de consola UTF-8 en Windows."""
import sys

# PowerShell puede redirigir stdout/stderr usando cp1252; los logs contienen emoji.
if sys.platform == "win32":
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="backslashreplace")
