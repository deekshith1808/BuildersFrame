import json
import os
import re
import shlex
import subprocess
from typing import Any, Dict, List

IGNORED_DIRS = {
    '.git', '__pycache__', 'node_modules', '.venv', 'venv', '.mypy_cache',
    '.pytest_cache', '.DS_Store', 'dist', 'build', '.next'
}

READONLY_COMMAND_PREFIXES = (
    'ls', 'pwd', 'git status', 'git log', 'git diff', 'git branch',
    'python3 -m py_compile', 'wc ', 'head ', 'tail ', 'find '
)


def resolve_safe_path(workspace_root: str, rel_path: str) -> str:
    """Resolve rel_path strictly inside workspace_root to block traversal."""
    root = os.path.realpath(workspace_root)
    candidate = os.path.realpath(os.path.join(root, rel_path.lstrip('/')))
    if candidate != root and not candidate.startswith(root + os.sep):
        raise ValueError(f'Path escapes workspace root: {rel_path}')
    return candidate


def list_workspace_files(workspace_root: str, limit: int = 120) -> List[Dict[str, Any]]:
    root = os.path.realpath(workspace_root)
    if not os.path.isdir(root):
        return []
    results = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d not in IGNORED_DIRS and not d.startswith('.'))
        for fname in sorted(filenames):
            if fname.startswith('.') or fname.endswith(('.pyc', '.db-journal', '.db-wal')):
                continue
            full = os.path.join(dirpath, fname)
            rel = os.path.relpath(full, root)
            try:
                size = os.path.getsize(full)
            except OSError:
                size = 0
            results.append({'path': rel, 'name': fname, 'size': size})
            if len(results) >= limit:
                return results
    return results


def read_workspace_file(workspace_root: str, rel_path: str, start_line: int = 1, max_lines: int = 120) -> Dict[str, Any]:
    target = resolve_safe_path(workspace_root, rel_path)
    if not os.path.isfile(target):
        return {'error': f'File not found: {rel_path}'}
    if os.path.getsize(target) > 512_000:
        return {'error': f'File too large to inline (>512KB): {rel_path}'}
    try:
        with open(target, 'r', encoding='utf-8', errors='replace') as f:
            lines = f.readlines()
    except Exception as exc:
        return {'error': str(exc)}

    start_idx = max(0, start_line - 1)
    end_idx = min(len(lines), start_idx + max_lines)
    numbered = ''.join(f'{i + 1}: {lines[i]}' for i in range(start_idx, end_idx))
    return {
        'path': rel_path,
        'total_lines': len(lines),
        'showing': f'{start_idx + 1}-{end_idx}',
        'content': numbered,
    }


def search_workspace_code(workspace_root: str, query: str, max_hits: int = 25) -> List[Dict[str, Any]]:
    root = os.path.realpath(workspace_root)
    q = (query or '').strip()
    if not q or not os.path.isdir(root):
        return []
    pattern = re.compile(re.escape(q), re.IGNORECASE)
    hits = []
    for item in list_workspace_files(root, limit=250):
        rel = item['path']
        if rel.endswith(('.db', '.png', '.jpg', '.jpeg', '.webp', '.woff2', '.ico')):
            continue
        full = os.path.join(root, rel)
        try:
            with open(full, 'r', encoding='utf-8', errors='ignore') as f:
                for idx, line in enumerate(f, start=1):
                    if pattern.search(line):
                        hits.append({
                            'file': rel,
                            'line': idx,
                            'snippet': line.strip()[:160],
                        })
                        if len(hits) >= max_hits:
                            return hits
        except OSError:
            continue
    return hits


def get_git_changes(workspace_root: str) -> Dict[str, Any]:
    root = os.path.realpath(workspace_root)
    if not os.path.isdir(root):
        return {'is_git_repo': False, 'files': [], 'diff': ''}
    try:
        status_proc = subprocess.run(
            ['git', 'status', '--short'],
            cwd=root,
            capture_output=True,
            text=True,
            timeout=5,
        )
        if status_proc.returncode != 0:
            return {'is_git_repo': False, 'files': [], 'diff': status_proc.stderr.strip()}

        files = []
        for line in status_proc.stdout.splitlines():
            if not line.strip():
                continue
            code = line[:2].strip() or 'M'
            path = line[3:].strip()
            files.append({'status': code, 'path': path})

        diff_proc = subprocess.run(
            ['git', 'diff', '--stat'],
            cwd=root,
            capture_output=True,
            text=True,
            timeout=5,
        )
        return {
            'is_git_repo': True,
            'files': files,
            'diff': diff_proc.stdout.strip() or 'Working tree clean (no unstaged diff).',
        }
    except Exception as exc:
        return {'is_git_repo': False, 'files': [], 'diff': str(exc)}


def run_sandboxed_command(
    workspace_root: str,
    command: str,
    policy: str = 'proceed-in-sandbox',
    approved: bool = False,
) -> Dict[str, Any]:
    cmd = (command or '').strip()
    if not cmd:
        return {'exit_code': 1, 'stdout': '', 'stderr': 'Empty command', 'policy_decision': 'rejected'}

    # Block shell chaining, pipes, redirections, and destructive patterns
    if any(tok in cmd for tok in ('&&', '||', ';', '|', '`', '$(', '>', '<')) or any(
        bad in cmd for bad in ('rm -rf', 'sudo ', 'mkfs', 'dd if=', ':(){')
    ):
        return {
            'exit_code': 126,
            'stdout': '',
            'stderr': 'Blocked by Antigravity Studio terminal safety policy.',
            'policy_decision': 'blocked',
        }

    try:
        argv = shlex.split(cmd)
    except ValueError as exc:
        return {'exit_code': 2, 'stdout': '', 'stderr': f'Invalid command syntax: {exc}', 'policy_decision': 'rejected'}

    if not argv:
        return {'exit_code': 1, 'stdout': '', 'stderr': 'Empty command', 'policy_decision': 'rejected'}

    if policy == 'strict' and not cmd.startswith(READONLY_COMMAND_PREFIXES):
        return {
            'exit_code': 126,
            'stdout': '',
            'stderr': f'Policy is "strict": only read-only diagnostic commands are permitted ({", ".join(READONLY_COMMAND_PREFIXES[:6])}...).',
            'policy_decision': 'denied-strict',
        }

    if policy == 'request-review' and not approved and not cmd.startswith(READONLY_COMMAND_PREFIXES):
        return {
            'exit_code': 0,
            'stdout': '',
            'stderr': '',
            'needs_approval': True,
            'policy_decision': 'approval-required',
        }

    try:
        proc = subprocess.run(
            argv,
            shell=False,
            cwd=os.path.realpath(workspace_root),
            capture_output=True,
            text=True,
            timeout=10,
        )
        return {
            'exit_code': proc.returncode,
            'stdout': proc.stdout[:12000],
            'stderr': proc.stderr[:6000],
            'policy_decision': policy,
        }
    except FileNotFoundError:
        return {
            'exit_code': 127,
            'stdout': '',
            'stderr': f'Executable not found: {argv[0]}',
            'policy_decision': policy,
        }
    except subprocess.TimeoutExpired:
        return {
            'exit_code': 124,
            'stdout': '',
            'stderr': 'Command timed out after 10s.',
            'policy_decision': policy,
        }
    except Exception as exc:
        return {'exit_code': 1, 'stdout': '', 'stderr': str(exc), 'policy_decision': policy}


def discover_customizations(workspace_root: str) -> Dict[str, Any]:
    """Discover skills, rules, and MCP configs in ~/.gemini and workspace/.gemini."""
    skills: List[Dict[str, str]] = []
    rules: List[Dict[str, str]] = []

    home = os.path.expanduser('~')
    search_roots = [
        ('workspace', os.path.join(workspace_root, '.agents', 'skills')),
        ('workspace', os.path.join(workspace_root, '.gemini', 'skills')),
        ('builtin', os.path.join(home, '.gemini', 'antigravity', 'builtin', 'skills')),
        ('global', os.path.join(home, '.gemini', 'config', 'skills')),
    ]

    for scope, base in search_roots:
        if not os.path.isdir(base):
            continue
        try:
            for entry in sorted(os.listdir(base))[:30]:
                skill_md = os.path.join(base, entry, 'SKILL.md')
                if os.path.isfile(skill_md):
                    desc = ''
                    try:
                        with open(skill_md, 'r', encoding='utf-8', errors='ignore') as f:
                            head = f.read(600)
                        m = re.search(r'description:\s*(.+)', head)
                        if m:
                            desc = m.group(1).strip().strip('"\'')
                    except OSError:
                        pass
                    skills.append({
                        'name': entry,
                        'scope': scope,
                        'description': desc[:140] or 'Skill definition',
                        'path': skill_md,
                    })
        except OSError:
            continue

    rule_dirs = [
        ('workspace', os.path.join(workspace_root, '.agents', 'rules')),
        ('workspace', os.path.join(workspace_root, '.gemini', 'rules')),
        ('global', os.path.join(home, '.gemini', 'rules')),
    ]
    if os.path.isfile(os.path.join(workspace_root, 'GEMINI.md')):
        rules.append({'name': 'GEMINI.md', 'scope': 'workspace', 'path': os.path.join(workspace_root, 'GEMINI.md')})
    for scope, rdir in rule_dirs:
        if not os.path.isdir(rdir):
            continue
        try:
            for entry in sorted(os.listdir(rdir))[:20]:
                if entry.endswith('.md'):
                    rules.append({'name': entry, 'scope': scope, 'path': os.path.join(rdir, entry)})
        except OSError:
            continue

    return {
        'skills': skills[:40],
        'rules': rules,
        'slash_commands': [
            {'cmd': '/plan', 'desc': 'Break request into phased implementation plan + Artifact'},
            {'cmd': '/goal', 'desc': 'Set autonomous multi-step milestone checklist in Tasks'},
            {'cmd': '/teamwork', 'desc': 'Spawn parallel Researcher + Reviewer subagents'},
            {'cmd': '/review', 'desc': 'Inspect git changes and audit workspace files'},
            {'cmd': '/search', 'desc': 'Search symbols and patterns across the active project'},
            {'cmd': '/explain', 'desc': 'Read mentioned @files and explain architecture'},
            {'cmd': '/schedule', 'desc': 'Create a recurring prompt automation in Scheduled Tasks'},
        ],
    }
