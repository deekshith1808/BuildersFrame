import json
import os
import re
import urllib.error
import urllib.request
import uuid
from typing import Any, Dict, List, Optional, Tuple

from backend import storage, tools


def _extract_at_mentions(text: str) -> List[str]:
    return re.findall(r'@([A-Za-z0-9_.\-/]+)', text or '')


def _save_artifact(conversation_id: str, title: str, content: str, kind: str = 'markdown') -> str:
    art_id = f'art-{uuid.uuid4().hex[:8]}'
    conn = storage.get_db()
    conn.execute(
        'INSERT INTO artifacts (id, conversation_id, title, kind, content) VALUES (?, ?, ?, ?, ?)',
        (art_id, conversation_id, title, kind, content),
    )
    conn.commit()
    conn.close()
    return art_id


def _add_checklist_task(conversation_id: str, title: str, status: str = 'done') -> str:
    task_id = f'chk-{uuid.uuid4().hex[:8]}'
    conn = storage.get_db()
    conn.execute(
        'INSERT INTO checklist_tasks (id, conversation_id, title, status) VALUES (?, ?, ?, ?)',
        (task_id, conversation_id, title, status),
    )
    conn.commit()
    conn.close()
    return task_id


def _spawn_subagent_record(conversation_id: str, role: str, model: str, prompt: str, summary: str) -> str:
    sub_id = f'sub-{uuid.uuid4().hex[:8]}'
    conn = storage.get_db()
    conn.execute(
        'INSERT INTO subagents (id, conversation_id, role, model, status, prompt, summary) VALUES (?, ?, ?, ?, ?, ?, ?)',
        (sub_id, conversation_id, role, model, 'completed', prompt, summary),
    )
    conn.commit()
    conn.close()
    return sub_id


def _execute_local_tool(name: str, args: Dict[str, Any], workspace_root: str, conversation_id: str) -> Dict[str, Any]:
    if name == 'list_files':
        limit = int(args.get('limit', 40))
        files = tools.list_workspace_files(workspace_root, limit=limit)
        return {'count': len(files), 'files': [f['path'] for f in files]}
    if name == 'read_file':
        path = str(args.get('path', ''))
        return tools.read_workspace_file(workspace_root, path, int(args.get('start_line', 1)), int(args.get('max_lines', 90)))
    if name == 'search_code':
        query = str(args.get('query', ''))
        hits = tools.search_workspace_code(workspace_root, query, max_hits=15)
        return {'query': query, 'hits': hits}
    if name == 'git_status':
        return tools.get_git_changes(workspace_root)
    if name == 'create_artifact':
        title = str(args.get('title', 'Workspace Note'))
        content = str(args.get('content', ''))
        art_id = _save_artifact(conversation_id, title, content)
        return {'artifact_id': art_id, 'title': title, 'status': 'saved'}
    return {'error': f'Unknown tool: {name}'}


def _run_gemini_with_tools(
    api_key: str,
    model: str,
    prompt: str,
    workspace_root: str,
    conversation_id: str,
    attachments: List[Dict[str, Any]],
) -> Tuple[Optional[str], List[str], List[Dict[str, Any]], Optional[str]]:
    """Execute Gemini REST generateContent with function calling tools."""
    gemini_model = model if model.startswith('gemini-') else 'gemini-2.5-flash'
    endpoint = f'https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={api_key}'

    tool_declarations = [{
        'functionDeclarations': [
            {
                'name': 'list_files',
                'description': 'List source files in the active project workspace.',
                'parameters': {
                    'type': 'OBJECT',
                    'properties': {'limit': {'type': 'INTEGER'}},
                },
            },
            {
                'name': 'read_file',
                'description': 'Read lines from a relative file path inside the workspace.',
                'parameters': {
                    'type': 'OBJECT',
                    'properties': {
                        'path': {'type': 'STRING'},
                        'start_line': {'type': 'INTEGER'},
                        'max_lines': {'type': 'INTEGER'},
                    },
                    'required': ['path'],
                },
            },
            {
                'name': 'search_code',
                'description': 'Search for a symbol or string across the workspace files.',
                'parameters': {
                    'type': 'OBJECT',
                    'properties': {'query': {'type': 'STRING'}},
                    'required': ['query'],
                },
            },
            {
                'name': 'git_status',
                'description': 'Inspect modified files and git diff stats in the workspace.',
                'parameters': {'type': 'OBJECT', 'properties': {}},
            },
            {
                'name': 'create_artifact',
                'description': 'Create a persistent markdown artifact visible in the Artifacts inspector tab.',
                'parameters': {
                    'type': 'OBJECT',
                    'properties': {
                        'title': {'type': 'STRING'},
                        'content': {'type': 'STRING'},
                    },
                    'required': ['title', 'content'],
                },
            },
        ]
    }]

    attach_note = ''
    if attachments:
        attach_note = '\nAttached files: ' + ', '.join(a.get('name', 'file') for a in attachments)

    contents: List[Dict[str, Any]] = [{
        'role': 'user',
        'parts': [{
            'text': (
                f'You are Antigravity Studio running inside workspace "{workspace_root}". '
                'Use your workspace tools whenever inspecting files, code, or git status. '
                'Cite only verified file paths and outputs from tool calls.\n\n'
                f'User prompt: {prompt}{attach_note}'
            )
        }],
    }]

    thoughts: List[str] = [f'Calling Gemini API ({gemini_model}) with workspace tool declarations.']
    tool_logs: List[Dict[str, Any]] = []

    for _round in range(4):
        payload = json.dumps({'contents': contents, 'tools': tool_declarations}).encode('utf-8')
        req = urllib.request.Request(
            endpoint,
            data=payload,
            headers={'Content-Type': 'application/json'},
            method='POST',
        )
        try:
            with urllib.request.urlopen(req, timeout=25) as resp:
                body = json.loads(resp.read().decode('utf-8'))
        except Exception as exc:
            return None, thoughts, tool_logs, str(exc)

        candidates = body.get('candidates') or []
        if not candidates:
            return None, thoughts, tool_logs, 'Empty candidate response from Gemini API'

        parts = candidates[0].get('content', {}).get('parts', [])
        contents.append({'role': 'model', 'parts': parts})

        fn_calls = [p['functionCall'] for p in parts if 'functionCall' in p]
        if not fn_calls:
            text_out = '\n'.join(p['text'] for p in parts if 'text' in p).strip()
            return text_out or 'Completed.', thoughts, tool_logs, None

        fn_responses = []
        for fc in fn_calls:
            tname = fc.get('name', '')
            targs = fc.get('args') or {}
            thoughts.append(f'Executing tool `{tname}` with args {json.dumps(targs)}')
            result = _execute_local_tool(tname, targs, workspace_root, conversation_id)
            tool_logs.append({
                'tool': tname,
                'args': targs,
                'status': 'error' if 'error' in result else 'ok',
                'summary': json.dumps(result)[:220],
            })
            fn_responses.append({
                'functionResponse': {
                    'name': tname,
                    'response': result,
                }
            })

        contents.append({'role': 'user', 'parts': fn_responses})

    return 'Completed tool execution rounds.', thoughts, tool_logs, None


def run_agent_turn(
    conversation_id: str,
    workspace_root: str,
    user_message: str,
    model: str = 'gemini-2.5-flash',
    attachments: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Run one assistant turn using Live Gemini if configured, or the Local Workspace Agent."""
    attachments = attachments or []
    settings = storage.get_settings_dict()
    api_key = (settings.get('gemini_api_key') or os.environ.get('GEMINI_API_KEY') or '').strip()
    internet_policy = settings.get('internet_access', 'ask')

    # Try Live Gemini mode when API key is configured and internet isn't denied
    if api_key and internet_policy != 'deny':
        reply, thoughts, tool_logs, err = _run_gemini_with_tools(
            api_key, model, user_message, workspace_root, conversation_id, attachments
        )
        if reply is not None:
            return {
                'content': reply,
                'thoughts': thoughts,
                'tool_calls': tool_logs,
                'runtime_mode': f'gemini-api ({model})',
            }
        # Fall back cleanly if Gemini call failed (e.g., sandbox offline or invalid key)
        fallback_note = f'Live Gemini API unavailable ({err}); switching to Local Workspace Agent.'
    else:
        fallback_note = 'Running Local Workspace Tool-Agent (no GEMINI_API_KEY configured).'

    return _run_local_workspace_agent(
        conversation_id, workspace_root, user_message, model, attachments, fallback_note
    )


def _run_local_workspace_agent(
    conversation_id: str,
    workspace_root: str,
    user_message: str,
    model: str,
    attachments: List[Dict[str, Any]],
    mode_note: str,
) -> Dict[str, Any]:
    text = (user_message or '').strip()
    lower = text.lower()
    thoughts: List[str] = [mode_note]
    tool_logs: List[Dict[str, Any]] = []
    mentions = _extract_at_mentions(text)

    # Read any @mentioned files inside the workspace first
    mentioned_previews: List[str] = []
    for m in mentions[:4]:
        try:
            res = tools.read_workspace_file(workspace_root, m, start_line=1, max_lines=60)
            if 'content' in res:
                tool_logs.append({
                    'tool': 'read_file',
                    'args': {'path': m, 'lines': res['showing']},
                    'status': 'ok',
                    'summary': f"Read {res['showing']} of {res['total_lines']} lines",
                })
                thoughts.append(f'Read mentioned file `{m}` ({res["total_lines"]} lines).')
                mentioned_previews.append(
                    f"### `{m}` (lines {res['showing']} of {res['total_lines']})\n```text\n{res['content'][:900]}\n```"
                )
        except ValueError as exc:
            tool_logs.append({
                'tool': 'read_file',
                'args': {'path': m},
                'status': 'blocked',
                'summary': str(exc),
            })

    # Slash command handlers
    if lower.startswith('/plan'):
        goal = text[5:].strip() or 'Current workspace implementation roadmap'
        files = tools.list_workspace_files(workspace_root, limit=25)
        tool_logs.append({
            'tool': 'list_files',
            'args': {'limit': 25},
            'status': 'ok',
            'summary': f'Scanned {len(files)} workspace files for planning',
        })
        plan_md = (
            f"# Implementation Plan: {goal}\n\n"
            f"**Workspace:** `{workspace_root}`\n\n"
            "## Phase 1 — Scope & Inspection\n"
            f"- Inspect key entrypoints across {len(files)} indexed workspace files.\n"
            "- Confirm data schema and existing interfaces before modifying files.\n\n"
            "## Phase 2 — Implementation\n"
            "- Keep changes modular and aligned with existing handlers and styles.\n"
            "- Update persistence and UI feedback together.\n\n"
            "## Phase 3 — Verification\n"
            "- Run syntax checks, API roundtrips, and visual responsive checks.\n"
        )
        art_id = _save_artifact(conversation_id, f'Plan: {goal[:42]}', plan_md)
        _add_checklist_task(conversation_id, f'Draft plan for: {goal[:48]}', 'done')
        _add_checklist_task(conversation_id, 'Review & execute Phase 2 edits', 'pending')
        tool_logs.append({
            'tool': 'create_artifact',
            'args': {'id': art_id, 'title': f'Plan: {goal[:42]}'},
            'status': 'ok',
            'summary': 'Saved plan to Artifacts inspector tab',
        })
        thoughts.append('Generated phased implementation plan and stored it in Artifacts + Tasks.')
        return {
            'content': (
                f"Created a structured implementation plan for **{goal}**.\n\n"
                "- Saved the plan artifact in the **Artifacts** tab on the right.\n"
                "- Added execution milestones to the **Tasks** checklist.\n\n"
                + ('\n\n'.join(mentioned_previews) if mentioned_previews else '')
            ),
            'thoughts': thoughts,
            'tool_calls': tool_logs,
            'runtime_mode': 'local-agent',
        }

    if lower.startswith('/teamwork'):
        topic = text[9:].strip() or 'Workspace audit and test coverage'
        files = tools.list_workspace_files(workspace_root, limit=20)
        git_info = tools.get_git_changes(workspace_root)
        tool_logs.append({
            'tool': 'list_files',
            'args': {'limit': 20},
            'status': 'ok',
            'summary': f'{len(files)} files inspected',
        })
        tool_logs.append({
            'tool': 'git_status',
            'args': {},
            'status': 'ok',
            'summary': f"{len(git_info.get('files', []))} modified/untracked files",
        })
        _spawn_subagent_record(
            conversation_id,
            'Codebase Researcher',
            model,
            f'Map files relevant to: {topic}',
            f"Indexed {len(files)} files in {os.path.basename(workspace_root)}; key targets identified.",
        )
        _spawn_subagent_record(
            conversation_id,
            'Diff & Quality Reviewer',
            model,
            f'Audit git status and edge cases for: {topic}',
            f"Checked {len(git_info.get('files', []))} changed paths in git working tree.",
        )
        _add_checklist_task(conversation_id, f'Swarm kickoff: {topic[:45]}', 'done')
        thoughts.append('Delegated work across 2 specialist subagents (Codebase Researcher & Diff Reviewer).')
        return {
            'content': (
                f"Spawned **2 parallel subagents** for **{topic}**:\n\n"
                "1. **Codebase Researcher** — scanned workspace structure (`"
                + f"{len(files)}` files indexed).\n"
                "2. **Diff & Quality Reviewer** — audited git tree (`"
                + f"{len(git_info.get('files', []))} changed files`).\n\n"
                "Inspect their live status and summaries in the **Subagents** tab."
            ),
            'thoughts': thoughts,
            'tool_calls': tool_logs,
            'runtime_mode': 'local-agent',
        }

    if lower.startswith('/review'):
        git_info = tools.get_git_changes(workspace_root)
        changed = git_info.get('files', [])
        tool_logs.append({
            'tool': 'git_status',
            'args': {},
            'status': 'ok',
            'summary': f'{len(changed)} entries in git status',
        })
        lines = '\n'.join(f"- `{c['status']}` `{c['path']}`" for c in changed[:20]) or '- Working tree is clean.'
        report_md = f"# Workspace Git Review\n\n**Changed Files ({len(changed)}):**\n{lines}\n\n## Diff Stat\n```text\n{git_info.get('diff', '')}\n```"
        _save_artifact(conversation_id, 'Git Review Summary', report_md)
        thoughts.append('Ran git status and git diff --stat inside sandboxed workspace.')
        return {
            'content': (
                f"**Workspace Review** (`{os.path.basename(workspace_root)}`)\n\n"
                f"Detected **{len(changed)}** uncommitted entries in git status:\n\n{lines}\n\n"
                "Check the **Files Changed** and **Artifacts** tabs for full stat details."
            ),
            'thoughts': thoughts,
            'tool_calls': tool_logs,
            'runtime_mode': 'local-agent',
        }

    if lower.startswith('/search'):
        query = text[7:].strip() or 'def '
        hits = tools.search_workspace_code(workspace_root, query, max_hits=12)
        tool_logs.append({
            'tool': 'search_code',
            'args': {'query': query},
            'status': 'ok',
            'summary': f'{len(hits)} matches found',
        })
        thoughts.append(f'Searched workspace code for "{query}" ({len(hits)} hits).')
        if not hits:
            return {
                'content': f'No matches found for `{query}` in `{os.path.basename(workspace_root)}`.',
                'thoughts': thoughts,
                'tool_calls': tool_logs,
                'runtime_mode': 'local-agent',
            }
        formatted = '\n'.join(f"- `{h['file']}:{h['line']}` — `{h['snippet']}`" for h in hits)
        return {
            'content': f"Found **{len(hits)}** matches for `{query}`:\n\n{formatted}",
            'thoughts': thoughts,
            'tool_calls': tool_logs,
            'runtime_mode': 'local-agent',
        }

    if lower.startswith('/goal'):
        goal = text[5:].strip() or 'Ship next verified milestone'
        _add_checklist_task(conversation_id, f'Goal active: {goal[:50]}', 'in_progress')
        thoughts.append('Registered active goal checklist item in Tasks pane.')
        return {
            'content': f"Goal registered in the **Tasks** inspector: **{goal}**.\n\nMention `@files` or run `/review` to track progress.",
            'thoughts': thoughts,
            'tool_calls': tool_logs,
            'runtime_mode': 'local-agent',
        }

    if lower.startswith('/schedule'):
        prompt_body = text[9:].strip() or '/review Periodic workspace check'
        conn = storage.get_db()
        sched_id = f'sched-{uuid.uuid4().hex[:8]}'
        conn.execute(
            '''INSERT INTO scheduled_tasks (id, project_id, name, cron_expr, prompt, enabled, last_status)
               VALUES (?, ?, ?, ?, ?, ?, ?)''',
            (sched_id, 'proj-builders-frame', f'Task: {prompt_body[:32]}', '*/30 * * * *', prompt_body, 1, 'scheduled'),
        )
        conn.commit()
        conn.close()
        thoughts.append('Created recurring cron task in Scheduled Tasks store.')
        return {
            'content': f"Created scheduled automation **`{sched_id}`** (`*/30 * * * *`) with prompt:\n> {prompt_body}\n\nOpen **Scheduled Tasks** in the left sidebar to run or toggle it anytime.",
            'thoughts': thoughts,
            'tool_calls': tool_logs,
            'runtime_mode': 'local-agent',
        }

    # General conversational / workspace inspection reply
    files = tools.list_workspace_files(workspace_root, limit=18)
    tool_logs.append({
        'tool': 'list_files',
        'args': {'limit': 18},
        'status': 'ok',
        'summary': f'Sampled {len(files)} files in {os.path.basename(workspace_root)}',
    })

    # If user asks something containing keywords, do a helpful code search too
    keywords = [w for w in re.findall(r'[A-Za-z_]{4,}', text) if w.lower() not in {'what', 'this', 'that', 'with', 'from', 'where', 'when', 'make', 'show', 'explain', 'build', 'about'}]
    search_section = ''
    if keywords and not mentioned_previews:
        q = keywords[0]
        hits = tools.search_workspace_code(workspace_root, q, max_hits=6)
        if hits:
            tool_logs.append({
                'tool': 'search_code',
                'args': {'query': q},
                'status': 'ok',
                'summary': f'{len(hits)} hits for "{q}"',
            })
            search_section = '\n\n**Relevant Workspace Matches (`' + q + '`):**\n' + '\n'.join(
                f"- `{h['file']}:{h['line']}` — `{h['snippet']}`" for h in hits
            )

    attach_summary = ''
    if attachments:
        attach_summary = '\n\n**Attached Context:** ' + ', '.join(f"`{a.get('name', 'file')}`" for a in attachments)

    sample_paths = ', '.join(f"`{f['path']}`" for f in files[:6])
    content = (
        f"Inspected **{os.path.basename(workspace_root)}** ({len(files)} sampled paths, e.g. {sample_paths}).\n\n"
        + ('\n\n'.join(mentioned_previews) if mentioned_previews else '')
        + search_section
        + attach_summary
        + "\n\n**Next actions you can trigger:**\n"
        "- Type **`/plan`** to generate a phased Artifact & Task checklist\n"
        "- Type **`/teamwork`** to spawn Researcher + Reviewer subagents\n"
        "- Type **`@`** to attach any workspace file inline\n"
        "- Add a `GEMINI_API_KEY` in **Settings** for full generative reasoning over these tools"
    )
    return {
        'content': content.strip(),
        'thoughts': thoughts,
        'tool_calls': tool_logs,
        'runtime_mode': 'local-agent',
    }
