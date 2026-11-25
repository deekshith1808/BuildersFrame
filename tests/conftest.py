import os
import sys
import tempfile
import pytest

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backend import database


@pytest.fixture()
def isolated_db(monkeypatch):
    """Provide an isolated temporary SQLite database initialized with seed data."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_file = os.path.join(tmpdir, 'test_buildersframe.db')
        monkeypatch.setattr(database, 'DB_PATH', db_file)
        database.init_db()
        yield db_file
