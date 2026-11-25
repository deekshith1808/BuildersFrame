import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone

STUDIO_DIR = os.path.dirname(os.path.dirname(__file__))
DB_PATH = os.path.join(STUDIO_DIR, 'antigravity_studio.db')
DEFAULT_PARENT_WORKSPACE = os.path.dirname(STUDIO_DIR)


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_db()
    cur = conn.cursor()

    cur.execute('''
    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        root_path TEXT UNIQUE NOT NULL,
        policy_override TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    cur.execute('''
    CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        model TEXT DEFAULT 'gemini-flash',
        mode TEXT DEFAULT 'auto',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(project_id) REFERENCES projects(id)
    )
    ''')

    cur.execute('''
    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL, -- user, assistant, system
        content TEXT NOT NULL,
        thoughts_json TEXT DEFAULT '[]',
        tool_calls_json TEXT DEFAULT '[]',
        mentions_json TEXT DEFAULT '[]',
        attachments_json TEXT DEFAULT '[]',
        runtime_mode TEXT DEFAULT 'local',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(conversation_id) REFERENCES conversations(id)
    )
    ''')

    cur.execute('''
    CREATE TABLE IF NOT EXISTS subagents (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        model TEXT DEFAULT 'gemini-flash',
        status TEXT DEFAULT 'completed', -- running, completed, waiting, killed
        prompt TEXT NOT NULL,
        summary TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(conversation_id) REFERENCES conversations(id)
    )
    ''')

    cur.execute('''
    CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        title TEXT NOT NULL,
        kind TEXT DEFAULT 'markdown',
        content TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(conversation_id) REFERENCES conversations(id)
    )
    ''')

    cur.execute('''
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        cron_expr TEXT NOT NULL,
        prompt TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        last_run TEXT DEFAULT '',
        last_status TEXT DEFAULT 'pending',
        last_output TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    cur.execute('''
    CREATE TABLE IF NOT EXISTS checklist_tasks (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT DEFAULT 'done', -- pending, in_progress, done
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    cur.execute('''
    CREATE TABLE IF NOT EXISTS terminal_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        command TEXT NOT NULL,
        exit_code INTEGER DEFAULT 0,
        stdout TEXT DEFAULT '',
        stderr TEXT DEFAULT '',
        policy_decision TEXT DEFAULT 'sandboxed',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    cur.execute('''
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    conn.commit()

    # Seed default settings
    default_settings = {
        'model': 'gemini-2.5-flash',
        'tool_execution_policy': 'proceed-in-sandbox',
        'terminal_sandbox': 'true',
        'non_workspace_access': 'ask',
        'internet_access': 'ask',
        'theme': 'dark',
        'gemini_api_key': os.environ.get('GEMINI_API_KEY', ''),
    }
    for k, v in default_settings.items():
        cur.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', (k, v))

    # Seed default workspace projects
    cur.execute('SELECT COUNT(*) as cnt FROM projects')
    if cur.fetchone()['cnt'] == 0:
        cur.execute(
            'INSERT INTO projects (id, name, root_path) VALUES (?, ?, ?)',
            ('proj-builders-frame', os.path.basename(DEFAULT_PARENT_WORKSPACE) or 'Builders_Frame', DEFAULT_PARENT_WORKSPACE),
        )
        cur.execute(
            'INSERT INTO projects (id, name, root_path) VALUES (?, ?, ?)',
            ('proj-antigravity-studio', 'antigravity-studio', STUDIO_DIR),
        )

    # Seed welcome conversation if none exist
    cur.execute('SELECT COUNT(*) as cnt FROM conversations')
    if cur.fetchone()['cnt'] == 0:
        conv_id = 'conv-welcome'
        cur.execute(
            'INSERT INTO conversations (id, project_id, title, model) VALUES (?, ?, ?, ?)',
            (conv_id, 'proj-builders-frame', 'Workspace Overview & Antigravity 2.0 Tour', 'gemini-2.5-flash'),
        )
        cur.execute(
            '''INSERT INTO messages (id, conversation_id, role, content, thoughts_json, tool_calls_json, runtime_mode)
               VALUES (?, ?, ?, ?, ?, ?, ?)''',
            (
                f'msg-{uuid.uuid4().hex[:8]}',
                conv_id,
                'assistant',
                (
                    'Welcome to **Antigravity Studio**.\n\n'
                    'You can interact with your active workspace using:\n'
                    '- **`/` Slash Commands**: `/plan`, `/goal`, `/teamwork`, `/review`, `/search`, `/schedule`\n'
                    '- **`@` Mentions**: Attach real workspace files (`@backend/server.py`), skills, or conversations\n'
                    '- **Auxiliary Inspector Pane** on the right: Inspect **Subagents**, **Tasks**, **Artifacts**, **Files Changed**, and **Terminals**.\n\n'
                    'By default this runs with a **Local Workspace Tool-Agent** (no API key needed). '
                    'Add a `GEMINI_API_KEY` in **Settings** anytime to switch to live Gemini tool-calling.'
                ),
                json.dumps([
                    'Initialized workspace index for Builders_Frame and antigravity-studio.',
                    'Loaded skills and git inspection tools in sandboxed mode.'
                ]),
                json.dumps([
                    {
                        'tool': 'list_files',
                        'args': {'limit': 12},
                        'status': 'ok',
                        'summary': 'Indexed active workspace tree'
                    }
                ]),
                'local',
            ),
        )
        cur.execute(
            '''INSERT INTO artifacts (id, conversation_id, title, kind, content)
               VALUES (?, ?, ?, ?, ?)''',
            (
                'art-architecture',
                conv_id,
                'Antigravity Studio Architecture',
                'markdown',
                (
                    '# Antigravity Studio 2.0\n\n'
                    '## Surfaces\n'
                    '- **Left Sidebar**: Workspaces, conversations, cron schedules, skills/MCP discovery, and safety settings.\n'
                    '- **Chat Canvas**: Slash commands (`/`), file/skill mentions (`@`), thoughts accordion, and tool call traces.\n'
                    '- **Inspector Pane**: Subagents, task checklist, rendered Markdown artifacts, git diff, and sandboxed terminal.\n'
                ),
            ),
        )
        cur.execute(
            '''INSERT INTO checklist_tasks (id, conversation_id, title, status) VALUES (?, ?, ?, ?)''',
            ('chk-1', conv_id, 'Index active project workspace', 'done'),
        )
        cur.execute(
            '''INSERT INTO checklist_tasks (id, conversation_id, title, status) VALUES (?, ?, ?, ?)''',
            ('chk-2', conv_id, 'Try /plan or @filename in chat composer', 'pending'),
        )
        cur.execute(
            '''INSERT INTO scheduled_tasks (id, project_id, name, cron_expr, prompt, enabled, last_status)
               VALUES (?, ?, ?, ?, ?, ?, ?)''',
            (
                'sched-health',
                'proj-builders-frame',
                'Workspace Git & Syntax Audit',
                '0 9 * * *',
                '/review Check git status and report modified files',
                1,
                'ready',
            ),
        )

    conn.commit()
    conn.close()


def get_settings_dict() -> dict:
    conn = get_db()
    rows = conn.execute('SELECT key, value FROM settings').fetchall()
    conn.close()
    return {r['key']: r['value'] for r in rows}


def update_settings_dict(updates: dict) -> dict:
    conn = get_db()
    for k, v in updates.items():
        if v is None:
            continue
        conn.execute(
            'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) '
            'ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP',
            (str(k), str(v)),
        )
    conn.commit()
    conn.close()
    return get_settings_dict()
