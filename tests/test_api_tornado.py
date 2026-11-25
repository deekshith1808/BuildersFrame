import asyncio
import inspect
import json
import os
import tempfile
import unittest
import tornado.concurrent
import tornado.httputil

from backend import database, server


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


def dispatch_tornado(app, path, method='GET', body=None, headers=None):
    async def _run():
        conn = _InMemoryConnection()
        hdrs = tornado.httputil.HTTPHeaders(headers or {})
        if 'Host' not in hdrs:
            hdrs['Host'] = 'localhost'
        body_bytes = body.encode('utf-8') if isinstance(body, str) else (body or b'')
        if body_bytes and 'Content-Length' not in hdrs:
            hdrs['Content-Length'] = str(len(body_bytes))
        start_line = tornado.httputil.RequestStartLine(method, path, 'HTTP/1.1')
        req = tornado.httputil.HTTPServerRequest(
            start_line=start_line,
            headers=hdrs,
            body=body_bytes,
            connection=conn,
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


class TestBuildersFrameAPI(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self._orig_db_path = database.DB_PATH
        database.DB_PATH = os.path.join(self._tmpdir.name, 'api_test.db')
        database.init_db()
        self.app = server.make_app()

    def tearDown(self):
        database.DB_PATH = self._orig_db_path
        self._tmpdir.cleanup()

    def test_pages_and_catalog_endpoints(self):
        code, hdrs, body = dispatch_tornado(self.app, '/')
        assert code == 200
        assert b'BuildersFrame' in body
        assert 'no-store' in hdrs.get('Cache-Control', '')

        code, _, body = dispatch_tornado(self.app, '/login')
        assert code == 200
        assert b'Sign In' in body

        code, hdrs, body = dispatch_tornado(self.app, '/api/problems')
        assert code == 200
        assert hdrs.get('X-Content-Type-Options') == 'nosniff'
        assert hdrs.get('X-Frame-Options') == 'SAMEORIGIN'
        probs_data = json.loads(body)
        assert probs_data['status'] == 'success'
        assert probs_data['count'] == 25

        code, _, body = dispatch_tornado(self.app, '/api/hackathons')
        assert code == 200
        hacks_data = json.loads(body)
        assert hacks_data['count'] == 11

    def test_stack_brief_and_community_endpoints(self):
        code, _, body = dispatch_tornado(
            self.app,
            '/api/stack',
            method='POST',
            body=json.dumps({'user_id': 'student-local-session', 'problem_id': 'sih-1601', 'stage': 'validating'}),
        )
        assert code == 200
        assert json.loads(body)['status'] == 'success'

        code, _, body = dispatch_tornado(self.app, '/api/stack?user_id=student-local-session')
        assert code == 200
        stack_rows = json.loads(body)['stack']
        assert any(r['problem_id'] == 'sih-1601' and r['stage'] == 'validating' for r in stack_rows)

        code, _, body = dispatch_tornado(
            self.app,
            '/api/project-brief',
            method='POST',
            body=json.dumps({'problem_id': 'sih-1601', 'team_name': 'UnitTest Squad'}),
        )
        assert code == 200
        assert 'SIH1601' in json.loads(body)['markdown']

        code, _, _ = dispatch_tornado(self.app, '/api/stack?user_id=student-local-session&problem_id=sih-1601', method='DELETE')
        assert code == 200

    def test_create_problem_and_auth_session_lifecycle(self):
        # 1. Register new student account
        reg_body = json.dumps({
            'full_name': 'Priya Test',
            'email': 'priya@kpriet.ac.in',
            'password': 'password123',
            'college': 'KPRIET',
            'level': 'Intermediate',
            'skills': ['Python', 'React', 'FastAPI'],
            'domains': ['Smart Education'],
            'location': 'Coimbatore, Tamil Nadu',
            'team_size': 3,
        })
        code, hdrs, body = dispatch_tornado(self.app, '/api/auth/register', method='POST', body=reg_body)
        assert code == 200
        reg_data = json.loads(body)
        assert reg_data['authenticated'] is True
        cookie = hdrs.get('Set-Cookie', '').split(';', 1)[0]
        assert 'bf_session=' in cookie

        # 2. Check /api/auth/me with session cookie
        code, _, body = dispatch_tornado(self.app, '/api/auth/me', headers={'Cookie': cookie})
        assert code == 200
        me_data = json.loads(body)
        assert me_data['authenticated'] is True
        assert me_data['user']['email'] == 'priya@kpriet.ac.in'

        # 3. Create a new problem statement in DB
        new_prob = json.dumps({
            'code': 'BF901',
            'title': 'Campus Energy Audit Tracker',
            'domain': 'Renewable Energy',
            'category': 'Software',
            'difficulty': 'Beginner',
            'summary': 'Track lab AC and lighting idle draw across academic blocks.',
            'required_skills': ['Python', 'React'],
        })
        code, _, body = dispatch_tornado(self.app, '/api/problems', method='POST', body=new_prob)
        assert code == 200
        assert json.loads(body)['code'] == 'BF901'

        # 4. Run profile-aware recommendations & starter planner
        code, _, body = dispatch_tornado(
            self.app,
            '/api/recommendations',
            method='POST',
            headers={'Cookie': cookie},
            body=json.dumps({'level': 'Intermediate', 'skills': ['Python', 'React'], 'domains': ['Renewable Energy'], 'team_size': 3}),
        )
        assert code == 200
        rec_data = json.loads(body)
        assert rec_data['authenticated'] is True
        assert len(rec_data['ranked_problems']) == 26
        assert 'score_breakdown' in rec_data['ranked_problems'][0]['personalization']

        code, _, body = dispatch_tornado(
            self.app,
            '/api/ai-agent/analyze',
            method='POST',
            headers={'Cookie': cookie},
            body=json.dumps({'problem_id': 'BF901'}),
        )
        assert code == 200
        analyze_data = json.loads(body)
        assert 'profile_tailoring' in analyze_data['research_report']

        # 5. Logout clears session
        code, _, _ = dispatch_tornado(self.app, '/api/auth/logout', method='POST', headers={'Cookie': cookie}, body='{}')
        assert code == 200
        _, _, me_after_body = dispatch_tornado(self.app, '/api/auth/me', headers={'Cookie': cookie})
        assert json.loads(me_after_body)['authenticated'] is False
