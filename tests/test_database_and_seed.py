import json
import os

from backend import database, fetcher


def test_seed_files_have_no_placeholder_example_urls():
    data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
    for fname in ('seed_problems.json', 'seed_hackathons.json'):
        with open(os.path.join(data_dir, fname), 'r', encoding='utf-8') as f:
            records = json.load(f)
        assert len(records) > 0
        raw = json.dumps(records).lower()
        assert 'github.com/example' not in raw, f'Placeholder repo URL found in {fname}'
        assert 'example.com' not in raw, f'example.com URL found in {fname}'
        assert 'example.org' not in raw, f'example.org URL found in {fname}'

    fetcher_raw = json.dumps(fetcher.DISCOVERABLE_CHALLENGES).lower()
    assert 'github.com/example' not in fetcher_raw


def test_init_db_seeds_problems_hackathons_and_demo_user(isolated_db):
    conn = database.get_db()
    probs = conn.execute('SELECT * FROM problems').fetchall()
    hacks = conn.execute('SELECT * FROM hackathons').fetchall()
    users = conn.execute('SELECT * FROM users').fetchall()
    conn.close()

    assert len(probs) == 25
    assert len(hacks) == 11
    assert len(users) == 1
    assert users[0]['email'] == 'builder@kpriet.ac.in'


def test_password_hashing_roundtrip():
    pw_hash = database.hash_password('secure_pass_2026')
    assert '$' in pw_hash
    assert database.verify_password('secure_pass_2026', pw_hash) is True
    assert database.verify_password('wrong_pass', pw_hash) is False
    assert database.verify_password('any', 'malformed_hash') is False
