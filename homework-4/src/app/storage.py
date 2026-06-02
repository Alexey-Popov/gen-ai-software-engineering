from pathlib import Path

BASE_DIR = Path("vault")


def read_holocron(name: str) -> str:
    path = BASE_DIR / name          # SECURITY: no confinement -> path traversal
    return path.read_text()         # BUG #1: FileNotFoundError propagates -> 500


def write_holocron(name: str, body: str) -> None:
    path = BASE_DIR / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body)           # BUG #2: silently overwrites existing holocron


def holocron_exists(name: str) -> bool:
    return (BASE_DIR / name).exists()
