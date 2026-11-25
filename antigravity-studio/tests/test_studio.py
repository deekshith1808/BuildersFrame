import asyncio
import inspect
import json
import os
import sys
import tempfile
import unittest
import tornado.concurrent
import tornado.httputil

STUDIO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if STUDIO_ROOT not in sys.path:
    sys.path.insert(0, STUDIO_ROOT)

import server as studio_server
from backend import storage, tools


class _InMemoryConnection(tornado.httputil.HTTPConnection):
    def __init__(self):
        self.status_code = 200
        self.headers = tornado.httputil.HTTPHeaders()
        self.chunks = []
        self.done = asyncio.Event()

    def write_headers(self, start_line, headers, chunk=None):
        self.status_code = start_line.code
        self.headers = headers
        if chunk:
            self.chunks.append(chunk)
        f = tornado.concurrent.Future()
        f.set_result(None)
        return f

    def write(self, chunk):
        self.chunks.append(chunk)
        f = tornado.concurrent.Future()
        f.set_result(None)
        return f

    def finish(self):
        self.done.set()

    def set_close_callback(self, callback):
        pass


def dispatch_tornado(app, path, method='GET', body=None):
    async def _run():
        conn = _InMemoryConnection()
        hdrs = tornado.httputil.HTTPHeaders({'Host': 'localhost'})
        body_bytes = body.encode('utf-8') if isinstance(body, str) else (body or b'')
        if body_bytes:
            hdrs['Content-Length'] = str(len(body_bytes))
        start_line = tornado.httputil.RequestStartLine(method, path, 'HTTP/1.1')
        req = tornado.httputil.HTTPServerRequest(
            start_line=start_line, headers=hdrs, body=body_bytes, connection=conn
        )
        delegate = app.find_handler(req)
        res = delegate.headers_received(start_line, req.headers)
        if inspect.isawaitable(res):
            await res
        if body_bytes:
            res = delegate.data_received(body_bytes)
            if inspect.isawaitable(res):
                await res
        res = delegate.finish()
        if inspect.isawaitable(res):
            await res
        await asyncio.wait_for(conn.done.wait(), timeout=5.0)
        return conn.status_code, conn.headers, b''.join(conn.chunks)

    return asyncio.run(_run())


class TestAntigravityStudio(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self._orig_db = storage.DB_PATH
        storage.DB_PATH = os.path.join(self._tmpdir.name, 'test_studio.db')
        storage.init_db()
        self.app = studio_server.make_app()

    def tearDown(self):
        storage.DB_PATH = self._orig_db
        self._tmpdir.cleanup()

    def test_path_traversal_and_sandbox_terminal_policy(self):
        root = storage.DEFAULT_PARENT_WORKSPACE
        blocked = False
        try:
            tools.resolve_safe_path(root, '../../etc/passwd')
        except ValueError:
            blocked = True
        assert blocked is True

        strict_res = tools.run_sandboxed_command(root, 'echo hello', policy='strict')
        assert strict_res['policy_decision'] == 'denied-strict'

        chained_res = tools.run_sandboxed_command(root, 'ls && whoami', policy='proceed-in-sandbox')
        assert chained_res['policy_decision'] == 'blocked'

        review_res = tools.run_sandboxed_command(root, 'echo hello', policy='request-review', approved=False)
        assert review_res.get('needs_approval') is True

        ok_res = tools.run_sandboxed_command(root, 'ls -1', policy='proceed-in-sandbox')
        assert ok_res['exit_code'] == 0

    def test_workbench_state_and_chat_endpoints(self):
        code, _, body = dispatch_tornado(self.app, '/api/state')
        assert code == 200
        state_data = json.loads(body)
        assert len(state_data['projects']) >= 2
        assert len(state_data['conversations']) >= 1

        code, _, body = dispatch_tornado(
            self.app,
            '/api/chat',
            method='POST',
            body=json.dumps({
                'conversation_id': 'conv-welcome',
                'message': '/plan Test automated studio route',
                'model': 'local-agent',
            }),
        )
        assert code == 200
        chat_data = json.loads(body)
        assert chat_data['status'] == 'success'
        assert 'Artifact' in chat_data['result']['content']
