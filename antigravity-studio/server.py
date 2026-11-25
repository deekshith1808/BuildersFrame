import json
import os
import uuid
import tornado.ioloop
import tornado.web

from backend import agent_engine, storage, tools

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, 'static')
PORT = int(os.environ.get('ANTIGRAVITY_STUDIO_PORT', '8100'))


class BaseAPIHandler(tornado.web.RequestHandler):
    def set_default_headers(self):
        self.set_header('Cache-Control', 'no-store')
        self.set_header('X-Content-Type-Options', 'nosniff')
        self.set_header('X-Frame-Options', 'SAMEORIGIN')
        self.set_header('Referrer-Policy', 'strict-origin-when-cross-origin')

    def write_json(self, payload, status_code=200):
        self.set_status(status_code)
        self.set_header('Content-Type', 'application/json')
        self.write(json.dumps(payload))

    def parse_json_body(self):
        try:
            raw = self.request.body.decode('utf-8') if self.request.body else '{}'
            return json.loads(raw)
        except Exception:
            return {}


class MainPageHandler(tornado.web.RequestHandler):
    def get(self):
        self.render(os.path.join(STATIC_DIR, 'index.html'))


class WorkbenchStateHandler(BaseAPIHandler):
    def get(self):
        conn = storage.get_db()
        projects = [dict(r) for r in conn.execute('SELECT * FROM projects ORDER BY created_at ASC').fetchall()]
        conversations = [
            dict(r) for r in conn.execute('SELECT * FROM conversations ORDER BY updated_at DESC').fetchall()
        ]
        scheduled = [
            dict(r) for r in conn.execute('SELECT * FROM scheduled_tasks ORDER BY created_at DESC').fetchall()
        ]
        conn.close()

        settings = storage.get_settings_dict()
        # Mask API key when returning to UI
        raw_key = settings.get('gemini_api_key', '')
        settings['gemini_api_key_set'] = bool(raw_key.strip())
        settings['gemini_api_key_preview'] = f"...{raw_key[-4:]}" if len(raw_key) > 6 else ''
        settings.pop('gemini_api_key', None)

        active_proj = projects[0] if projects else {'root_path': storage.DEFAULT_PARENT_WORKSPACE}
        customizations = tools.discover_customizations(active_proj['root_path'])

        self.write_json({
            'status': 'success',
            'projects': projects,
            'conversations': conversations,
            'scheduled_tasks': scheduled,
            'settings': settings,
            'customizations': customizations,
        })


class ProjectsHandler(BaseAPIHandler):
    def post(self):
        body = self.parse_json_body()
        name = (body.get('name') or '').strip()
        root_path = os.path.abspath((body.get('root_path') or '').strip())
        if not name or not root_path or not os.path.isdir(root_path):
            return self.write_json({'status': 'error', 'message': 'Valid directory path and name required'}, 400)

        proj_id = f'proj-{uuid.uuid4().hex[:8]}'
        conn = storage.get_db()
        try:
            conn.execute('INSERT INTO projects (id, name, root_path) VALUES (?, ?, ?)', (proj_id, name, root_path))
            conn.commit()
        except Exception as exc:
            conn.close()
            return self.write_json({'status': 'error', 'message': str(exc)}, 409)
        conn.close()
        self.write_json({'status': 'success', 'project': {'id': proj_id, 'name': name, 'root_path': root_path}})


class ConversationsHandler(BaseAPIHandler):
    def post(self):
        body = self.parse_json_body()
        project_id = body.get('project_id') or 'proj-builders-frame'
        title = (body.get('title') or 'New Conversation').strip()
        model = body.get('model') or 'gemini-2.5-flash'
        conv_id = f'conv-{uuid.uuid4().hex[:8]}'
        conn = storage.get_db()
        conn.execute(
            'INSERT INTO conversations (id, project_id, title, model) VALUES (?, ?, ?, ?)',
            (conv_id, project_id, title, model),
        )
        conn.commit()
        row = dict(conn.execute('SELECT * FROM conversations WHERE id=?', (conv_id,)).fetchone())
        conn.close()
        self.write_json({'status': 'success', 'conversation': row})


class ConversationDetailHandler(BaseAPIHandler):
    def get(self, conv_id):
        conn = storage.get_db()
        conv = conn.execute('SELECT * FROM conversations WHERE id=?', (conv_id,)).fetchone()
        if not conv:
            conn.close()
            return self.write_json({'status': 'error', 'message': 'Conversation not found'}, 404)

        messages = []
        for m in conn.execute(
            'SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at ASC, rowid ASC', (conv_id,)
        ).fetchall():
            d = dict(m)
            d['thoughts'] = json.loads(d.pop('thoughts_json') or '[]')
            d['tool_calls'] = json.loads(d.pop('tool_calls_json') or '[]')
            d['mentions'] = json.loads(d.pop('mentions_json') or '[]')
            d['attachments'] = json.loads(d.pop('attachments_json') or '[]')
            messages.append(d)

        subagents = [dict(r) for r in conn.execute('SELECT * FROM subagents WHERE conversation_id=? ORDER BY created_at DESC', (conv_id,)).fetchall()]
        artifacts = [dict(r) for r in conn.execute('SELECT * FROM artifacts WHERE conversation_id=? ORDER BY created_at DESC', (conv_id,)).fetchall()]
        tasks = [dict(r) for r in conn.execute('SELECT * FROM checklist_tasks WHERE conversation_id=? ORDER BY created_at ASC', (conv_id,)).fetchall()]
        proj = conn.execute('SELECT * FROM projects WHERE id=?', (conv['project_id'],)).fetchone()
        conn.close()

        root_path = proj['root_path'] if proj else storage.DEFAULT_PARENT_WORKSPACE
        git_changes = tools.get_git_changes(root_path)

        self.write_json({
            'status': 'success',
            'conversation': dict(conv),
            'messages': messages,
            'subagents': subagents,
            'artifacts': artifacts,
            'tasks': tasks,
            'git_changes': git_changes,
        })


class ChatHandler(BaseAPIHandler):
    def post(self):
        body = self.parse_json_body()
        conv_id = body.get('conversation_id')
        message_text = (body.get('message') or '').strip()
        model = body.get('model') or 'gemini-2.5-flash'
        attachments = body.get('attachments') or []

        if not conv_id or not message_text:
            return self.write_json({'status': 'error', 'message': 'conversation_id and message required'}, 400)

        conn = storage.get_db()
        conv = conn.execute('SELECT * FROM conversations WHERE id=?', (conv_id,)).fetchone()
        if not conv:
            conn.close()
            return self.write_json({'status': 'error', 'message': 'Conversation not found'}, 404)

        proj = conn.execute('SELECT * FROM projects WHERE id=?', (conv['project_id'],)).fetchone()
        workspace_root = proj['root_path'] if proj else storage.DEFAULT_PARENT_WORKSPACE

        # Auto-rename untitled conversation on first user message
        if conv['title'] == 'New Conversation':
            new_title = message_text[:48] + ('...' if len(message_text) > 48 else '')
            conn.execute('UPDATE conversations SET title=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', (new_title, conv_id))
        else:
            conn.execute('UPDATE conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=?', (conv_id,))

        user_msg_id = f'msg-{uuid.uuid4().hex[:8]}'
        conn.execute(
            '''INSERT INTO messages (id, conversation_id, role, content, attachments_json)
               VALUES (?, ?, 'user', ?, ?)''',
            (user_msg_id, conv_id, message_text, json.dumps(attachments)),
        )
        conn.commit()
        conn.close()

        result = agent_engine.run_agent_turn(
            conversation_id=conv_id,
            workspace_root=workspace_root,
            user_message=message_text,
            model=model,
            attachments=attachments,
        )

        asst_msg_id = f'msg-{uuid.uuid4().hex[:8]}'
        conn = storage.get_db()
        conn.execute(
            '''INSERT INTO messages (id, conversation_id, role, content, thoughts_json, tool_calls_json, runtime_mode)
               VALUES (?, ?, 'assistant', ?, ?, ?, ?)''',
            (
                asst_msg_id,
                conv_id,
                result['content'],
                json.dumps(result.get('thoughts', [])),
                json.dumps(result.get('tool_calls', [])),
                result.get('runtime_mode', 'local-agent'),
            ),
        )
        conn.commit()
        conn.close()

        self.write_json({'status': 'success', 'assistant_message_id': asst_msg_id, 'result': result})


class MentionsHandler(BaseAPIHandler):
    def get(self):
        project_id = self.get_argument('project_id', 'proj-builders-frame')
        q = (self.get_argument('q', '') or '').strip().lower()
        conn = storage.get_db()
        proj = conn.execute('SELECT * FROM projects WHERE id=?', (project_id,)).fetchone()
        convs = [dict(r) for r in conn.execute('SELECT id, title FROM conversations ORDER BY updated_at DESC LIMIT 8').fetchall()]
        conn.close()

        root = proj['root_path'] if proj else storage.DEFAULT_PARENT_WORKSPACE
        files = tools.list_workspace_files(root, limit=120)
        custom = tools.discover_customizations(root)

        items = []
        for f in files:
            if not q or q in f['path'].lower():
                items.append({'type': 'file', 'label': f['path'], 'insert': f"@{f['path']}"})
        for s in custom['skills'][:15]:
            if not q or q in s['name'].lower():
                items.append({'type': 'skill', 'label': f"skill:{s['name']}", 'insert': f"@{s['name']}"})
        for c in convs:
            if not q or q in c['title'].lower():
                items.append({'type': 'chat', 'label': c['title'], 'insert': f"@{c['id']}"})

        self.write_json({'status': 'success', 'items': items[:25]})


class ScheduledTasksHandler(BaseAPIHandler):
    def post(self):
        body = self.parse_json_body()
        action = body.get('action', 'create')
        conn = storage.get_db()

        if action == 'toggle':
            tid = body.get('id')
            conn.execute('UPDATE scheduled_tasks SET enabled = CASE WHEN enabled=1 THEN 0 ELSE 1 END WHERE id=?', (tid,))
            conn.commit()
            conn.close()
            return self.write_json({'status': 'success'})

        if action == 'delete':
            tid = body.get('id')
            conn.execute('DELETE FROM scheduled_tasks WHERE id=?', (tid,))
            conn.commit()
            conn.close()
            return self.write_json({'status': 'success'})

        if action == 'run_now':
            tid = body.get('id')
            row = conn.execute('SELECT * FROM scheduled_tasks WHERE id=?', (tid,)).fetchone()
            if not row:
                conn.close()
                return self.write_json({'status': 'error', 'message': 'Task not found'}, 404)
            proj = conn.execute('SELECT * FROM projects WHERE id=?', (row['project_id'],)).fetchone()
            root = proj['root_path'] if proj else storage.DEFAULT_PARENT_WORKSPACE
            conn.close()

            res = agent_engine.run_agent_turn('conv-welcome', root, row['prompt'])
            conn = storage.get_db()
            conn.execute(
                'UPDATE scheduled_tasks SET last_run=?, last_status=?, last_output=? WHERE id=?',
                (storage.utc_now(), 'completed', res['content'][:400], tid),
            )
            conn.commit()
            conn.close()
            return self.write_json({'status': 'success', 'output': res['content'][:400]})

        name = (body.get('name') or 'Untitled Automation').strip()
        cron_expr = (body.get('cron_expr') or '0 * * * *').strip()
        prompt = (body.get('prompt') or '/review').strip()
        project_id = body.get('project_id') or 'proj-builders-frame'
        tid = f'sched-{uuid.uuid4().hex[:8]}'
        conn.execute(
            'INSERT INTO scheduled_tasks (id, project_id, name, cron_expr, prompt, enabled, last_status) VALUES (?, ?, ?, ?, ?, 1, ?)',
            (tid, project_id, name, cron_expr, prompt, 'ready'),
        )
        conn.commit()
        conn.close()
        self.write_json({'status': 'success', 'id': tid})


class TerminalHandler(BaseAPIHandler):
    def get(self):
        project_id = self.get_argument('project_id', 'proj-builders-frame')
        conn = storage.get_db()
        logs = [
            dict(r)
            for r in conn.execute(
                'SELECT * FROM terminal_logs WHERE project_id=? ORDER BY id DESC LIMIT 20', (project_id,)
            ).fetchall()
        ]
        conn.close()
        self.write_json({'status': 'success', 'logs': list(reversed(logs))})

    def post(self):
        body = self.parse_json_body()
        project_id = body.get('project_id') or 'proj-builders-frame'
        command = (body.get('command') or '').strip()
        approved = bool(body.get('approved', False))

        settings = storage.get_settings_dict()
        policy = settings.get('tool_execution_policy', 'proceed-in-sandbox')

        conn = storage.get_db()
        proj = conn.execute('SELECT * FROM projects WHERE id=?', (project_id,)).fetchone()
        root = proj['root_path'] if proj else storage.DEFAULT_PARENT_WORKSPACE
        conn.close()

        res = tools.run_sandboxed_command(root, command, policy=policy, approved=approved)
        if res.get('needs_approval'):
            return self.write_json({'status': 'approval_required', 'execution': res})

        conn = storage.get_db()
        conn.execute(
            '''INSERT INTO terminal_logs (project_id, command, exit_code, stdout, stderr, policy_decision)
               VALUES (?, ?, ?, ?, ?, ?)''',
            (project_id, command, res['exit_code'], res['stdout'], res['stderr'], res['policy_decision']),
        )
        conn.commit()
        conn.close()
        self.write_json({'status': 'success', 'execution': res})


class SettingsHandler(BaseAPIHandler):
    def post(self):
        body = self.parse_json_body()
        allowed = {
            'model', 'tool_execution_policy', 'terminal_sandbox',
            'non_workspace_access', 'internet_access', 'theme', 'gemini_api_key',
        }
        updates = {k: v for k, v in body.items() if k in allowed}
        # Only update api key if non-empty explicitly passed
        if updates.get('gemini_api_key') == '':
            updates.pop('gemini_api_key', None)
        storage.update_settings_dict(updates)
        self.write_json({'status': 'success'})


def make_app():
    return tornado.web.Application(
        [
            (r'/', MainPageHandler),
            (r'/api/state', WorkbenchStateHandler),
            (r'/api/projects', ProjectsHandler),
            (r'/api/conversations', ConversationsHandler),
            (r'/api/conversations/([^/]+)', ConversationDetailHandler),
            (r'/api/chat', ChatHandler),
            (r'/api/mentions', MentionsHandler),
            (r'/api/scheduled-tasks', ScheduledTasksHandler),
            (r'/api/terminal', TerminalHandler),
            (r'/api/settings', SettingsHandler),
            (r'/(.*)', tornado.web.StaticFileHandler, {'path': STATIC_DIR}),
        ],
        debug=True,
    )


if __name__ == '__main__':
    storage.init_db()
    app = make_app()
    app.listen(PORT)
    print(f'Antigravity Studio running at http://localhost:{PORT}', flush=True)
    tornado.ioloop.IOLoop.current().start()
