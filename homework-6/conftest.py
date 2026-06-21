"""Root conftest: put the project directory on the import path so tests can
``from agents import ...`` regardless of how pytest is invoked.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
