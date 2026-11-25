const appState = {
  projects: [],
  conversations: [],
  scheduledTasks: [],
  customizations: { skills: [], rules: [], slash_commands: [] },
  settings: {},
  activeProjectId: 'proj-builders-frame',
  activeConversationId: 'conv-welcome',
  attachments: [],
  mentionQuery: null,
};

document.addEventListener('DOMContentLoaded', () => {
  loadWorkbenchState();
  setupDragAndDrop();
});

async function loadWorkbenchState(preserveConvId = true) {
  const res = await fetch('/api/state');
  const data = await res.json();
  if (data.status !== 'success') return;

  appState.projects = data.projects || [];
  appState.conversations = data.conversations || [];
  appState.scheduledTasks = data.scheduled_tasks || [];
  appState.customizations = data.customizations || { skills: [], rules: [], slash_commands: [] };
  appState.settings = data.settings || {};

  applySettingsToUI();
  renderProjects();
  renderConversationsList();
  renderScheduledTasks();
  renderSkillsList();

  if (!preserveConvId || !appState.conversations.some(c => c.id === appState.activeConversationId)) {
    if (appState.conversations.length > 0) {
      appState.activeConversationId = appState.conversations[0].id;
    }
  }

  if (appState.activeConversationId) {
    await loadConversation(appState.activeConversationId);
  }
  await loadTerminalLogs();
}

function applySettingsToUI() {
  const s = appState.settings;
  const theme = s.theme || 'dark';
  document.documentElement.setAttribute('data-theme', theme);

  const policyEl = document.getElementById('policyModeBadge');
  if (policyEl) policyEl.textContent = s.tool_execution_policy || 'proceed-in-sandbox';

  const runtimeEl = document.getElementById('runtimeModeBadge');
  if (runtimeEl) {
    const isLive = Boolean(s.gemini_api_key_set && s.internet_access !== 'deny');
    runtimeEl.textContent = isLive ? 'Gemini API Connected' : 'Local Workspace Agent';
    runtimeEl.classList.toggle('live', isLive);
  }

  const modelSel = document.getElementById('modelSelect');
  if (modelSel && s.model) modelSel.value = s.model;

  const hint = document.getElementById('setGeminiKeyStatus');
  if (hint) {
    hint.textContent = s.gemini_api_key_set
      ? `API key saved (${s.gemini_api_key_preview || 'configured'}). Leave blank to keep existing key.`
      : 'Not configured (running Local Workspace Tool-Agent).';
  }
  const setPolicy = document.getElementById('setPolicy');
  if (setPolicy && s.tool_execution_policy) setPolicy.value = s.tool_execution_policy;
  const setTheme = document.getElementById('setTheme');
  if (setTheme && s.theme) setTheme.value = s.theme;
  const setNonWs = document.getElementById('setNonWorkspace');
  if (setNonWs && s.non_workspace_access) setNonWs.value = s.non_workspace_access;
  const setNet = document.getElementById('setInternet');
  if (setNet && s.internet_access) setNet.value = s.internet_access;
}

function renderProjects() {
  const select = document.getElementById('projectSelect');
  if (select) {
    select.innerHTML = appState.projects.map(p =>
      `<option value="${escapeHtml(p.id)}" ${p.id === appState.activeProjectId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`
    ).join('');
  }
  const list = document.getElementById('projectsList');
  if (list) {
    list.innerHTML = appState.projects.map(p => `
      <button type="button" class="side-item ${p.id === appState.activeProjectId ? 'active' : ''}" onclick="switchProject('${escapeHtml(p.id)}')">
        <div class="side-item-title">${escapeHtml(p.name)}</div>
        <div class="side-item-sub">${escapeHtml(p.root_path)}</div>
      </button>
    `).join('');
  }
}

function renderConversationsList() {
  const host = document.getElementById('conversationsList');
  if (!host) return;
  const q = (document.getElementById('convFilterInput')?.value || '').trim().toLowerCase();
  const filtered = appState.conversations.filter(c =>
    !q || (c.title || '').toLowerCase().includes(q)
  );
  host.innerHTML = filtered.map(c => `
    <button type="button" class="side-item ${c.id === appState.activeConversationId ? 'active' : ''}" onclick="loadConversation('${escapeHtml(c.id)}')">
      <div class="side-item-title">${escapeHtml(c.title)}</div>
      <div class="side-item-sub">${escapeHtml(c.model || 'gemini-2.5-flash')}</div>
    </button>
  `).join('') || '<div class="sidebar-section-note">No matching conversations.</div>';
}

function renderScheduledTasks() {
  const host = document.getElementById('scheduledTasksList');
  if (!host) return;
  host.innerHTML = appState.scheduledTasks.map(t => `
    <div class="side-item">
      <div class="side-item-title">${escapeHtml(t.name)}</div>
      <div class="side-item-sub">${escapeHtml(t.cron_expr)} • ${t.enabled ? 'active' : 'paused'} • ${escapeHtml(t.last_status)}</div>
      <div style="display:flex; gap:6px; margin-top:6px;">
        <button type="button" class="btn-secondary btn-xs" onclick="runScheduledTaskNow('${escapeHtml(t.id)}')">Run</button>
        <button type="button" class="btn-ghost btn-xs" onclick="toggleScheduledTask('${escapeHtml(t.id)}')">${t.enabled ? 'Pause' : 'Resume'}</button>
        <button type="button" class="btn-ghost btn-xs" onclick="deleteScheduledTask('${escapeHtml(t.id)}')">Del</button>
      </div>
    </div>
  `).join('');
}

function renderSkillsList() {
  const host = document.getElementById('skillsList');
  if (!host) return;
  const cmds = appState.customizations.slash_commands || [];
  const skills = appState.customizations.skills || [];
  const rules = appState.customizations.rules || [];

  host.innerHTML = [
    ...cmds.map(c => `
      <button type="button" class="side-item" onclick="insertPromptText('${escapeHtml(c.cmd)} ')">
        <div class="side-item-title">${escapeHtml(c.cmd)}</div>
        <div class="side-item-sub">${escapeHtml(c.desc)}</div>
      </button>
    `),
    ...rules.map(r => `
      <div class="side-item">
        <div class="side-item-title">Rule: ${escapeHtml(r.name)}</div>
        <div class="side-item-sub">${escapeHtml(r.scope)}</div>
      </div>
    `),
    ...skills.slice(0, 15).map(s => `
      <button type="button" class="side-item" onclick="insertPromptText('@${escapeHtml(s.name)} ')">
        <div class="side-item-title">${escapeHtml(s.name)} <span style="opacity:0.6;">(${escapeHtml(s.scope)})</span></div>
        <div class="side-item-sub">${escapeHtml(s.description)}</div>
      </button>
    `),
  ].join('');
}

async function switchProject(projectId) {
  appState.activeProjectId = projectId;
  renderProjects();
  await loadTerminalLogs();
  if (appState.activeConversationId) {
    await loadConversation(appState.activeConversationId);
  }
}

async function createNewConversation() {
  const model = document.getElementById('modelSelect')?.value || 'gemini-2.5-flash';
  const res = await fetch('/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: appState.activeProjectId, title: 'New Conversation', model }),
  });
  const data = await res.json();
  if (data.status === 'success') {
    appState.activeConversationId = data.conversation.id;
    await loadWorkbenchState(true);
  }
}

async function loadConversation(convId) {
  appState.activeConversationId = convId;
  renderConversationsList();

  const res = await fetch(`/api/conversations/${encodeURIComponent(convId)}`);
  const data = await res.json();
  if (data.status !== 'success') return;

  const conv = data.conversation;
  appState.activeProjectId = conv.project_id;
  renderProjects();

  const titleEl = document.getElementById('activeConvTitle');
  const metaEl = document.getElementById('activeConvMeta');
  if (titleEl) titleEl.textContent = conv.title;
  const proj = appState.projects.find(p => p.id === conv.project_id);
  if (metaEl) metaEl.textContent = `${proj ? proj.name : conv.project_id} • ${conv.model}`;

  renderMessages(data.messages || []);
  renderInspector(data);
}

function renderMessages(messages) {
  const host = document.getElementById('messagesScroll');
  if (!host) return;
  if (messages.length === 0) {
    host.innerHTML = `
      <div class="msg-card">
        <div class="msg-meta"><span class="msg-role">Antigravity 2.0</span><span>New session</span></div>
        <div class="msg-body">Ask anything about the active workspace, type <code>/plan</code>, <code>/teamwork</code>, <code>/review</code>, or mention a file with <code>@</code>.</div>
      </div>
    `;
    return;
  }

  host.innerHTML = messages.map(m => {
    const thoughtsHtml = (m.thoughts && m.thoughts.length > 0) ? `
      <details class="thoughts-details">
        <summary>Reasoning steps (${m.thoughts.length})</summary>
        <ul class="thoughts-list">${m.thoughts.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
      </details>
    ` : '';

    const toolsHtml = (m.tool_calls && m.tool_calls.length > 0) ? `
      <div class="tool-calls-strip">
        ${m.tool_calls.map(tc => `
          <span class="tool-pill" title="${escapeHtml(tc.summary || '')}">
            <strong>${escapeHtml(tc.tool)}</strong> ${escapeHtml(JSON.stringify(tc.args || {}))}
          </span>
        `).join('')}
      </div>
    ` : '';

    return `
      <article class="msg-card ${m.role === 'user' ? 'user' : 'assistant'}">
        <div class="msg-meta">
          <span class="msg-role">${m.role === 'user' ? 'You' : 'Antigravity'}</span>
          <span>${escapeHtml(m.runtime_mode || '')} • ${escapeHtml(m.created_at || '')}</span>
        </div>
        ${thoughtsHtml}
        ${toolsHtml}
        <div class="msg-body">${renderSimpleMarkdown(m.content || '')}</div>
      </article>
    `;
  }).join('');

  host.scrollTop = host.scrollHeight;
}

function renderInspector(data) {
  const subs = data.subagents || [];
  const tasks = data.tasks || [];
  const arts = data.artifacts || [];
  const git = data.git_changes || { files: [], diff: '' };

  document.getElementById('cntSubagents').textContent = subs.length;
  document.getElementById('cntTasks').textContent = tasks.length;
  document.getElementById('cntArtifacts').textContent = arts.length;
  document.getElementById('cntFiles').textContent = (git.files || []).length;

  document.getElementById('inspSubagents').innerHTML = subs.length
    ? subs.map(s => `
      <div class="insp-card">
        <div class="insp-card-title">${escapeHtml(s.role)}</div>
        <div class="insp-card-meta">${escapeHtml(s.status)} • ${escapeHtml(s.model)}</div>
        <div class="insp-card-body">${escapeHtml(s.summary || s.prompt)}</div>
      </div>
    `).join('')
    : '<div class="sidebar-section-note">No subagents spawned in this conversation yet. Try <code>/teamwork</code>.</div>';

  document.getElementById('inspTasks').innerHTML = tasks.length
    ? tasks.map(t => `
      <div class="insp-card">
        <div class="insp-card-meta">${escapeHtml(t.status.toUpperCase())}</div>
        <div class="insp-card-title">${escapeHtml(t.title)}</div>
      </div>
    `).join('')
    : '<div class="sidebar-section-note">No checklist tasks yet. Try <code>/plan</code> or <code>/goal</code>.</div>';

  document.getElementById('inspArtifacts').innerHTML = arts.length
    ? arts.map(a => `
      <div class="insp-card">
        <div class="insp-card-title">${escapeHtml(a.title)}</div>
        <div class="insp-card-meta">${escapeHtml(a.kind)} • ${escapeHtml(a.updated_at || '')}</div>
        <div class="insp-card-body">${escapeHtml(a.content)}</div>
      </div>
    `).join('')
    : '<div class="sidebar-section-note">No artifacts generated yet.</div>';

  const fileItems = (git.files || []).map(f => `
    <div class="insp-card">
      <div class="insp-card-meta">${escapeHtml(f.status)}</div>
      <div class="insp-card-title" style="font-family:'JetBrains Mono', monospace; font-size:0.75rem;">${escapeHtml(f.path)}</div>
    </div>
  `).join('');
  document.getElementById('inspFiles').innerHTML = fileItems + `
    <div class="insp-card">
      <div class="insp-card-meta">GIT DIFF STAT</div>
      <div class="insp-card-body" style="font-family:'JetBrains Mono', monospace; font-size:0.72rem;">${escapeHtml(git.diff || 'No git diff available.')}</div>
    </div>
  `;
}

async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const btn = document.getElementById('sendMsgBtn');
  const text = (input?.value || '').trim();
  if (!text || !appState.activeConversationId) return;

  const model = document.getElementById('modelSelect')?.value || 'gemini-2.5-flash';
  input.value = '';
  hideAutocomplete();
  if (btn) btn.disabled = true;

  const attachments = [...appState.attachments];
  appState.attachments = [];
  renderAttachmentsStrip();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: appState.activeConversationId,
        message: text,
        model,
        attachments,
      }),
    });
    await res.json();
    await loadWorkbenchState(true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleComposerInput(textarea) {
  const val = textarea.value;
  const cursor = textarea.selectionStart || val.length;
  const before = val.slice(0, cursor);

  const slashMatch = before.match(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/);
  if (slashMatch) {
    const q = slashMatch[1].toLowerCase();
    const cmds = (appState.customizations.slash_commands || []).filter(c =>
      c.cmd.toLowerCase().includes('/' + q)
    );
    showAutocomplete(cmds.map(c => ({
      type: 'command',
      label: `${c.cmd} — ${c.desc}`,
      insert: c.cmd + ' ',
      trigger: '/' + slashMatch[1],
    })));
    return;
  }

  const atMatch = before.match(/(?:^|\s)@([A-Za-z0-9_.\-/]*)$/);
  if (atMatch) {
    const q = atMatch[1];
    const res = await fetch(`/api/mentions?project_id=${encodeURIComponent(appState.activeProjectId)}&q=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (data.status === 'success') {
      showAutocomplete((data.items || []).map(item => ({
        type: item.type,
        label: item.label,
        insert: item.insert + ' ',
        trigger: '@' + q,
      })));
      return;
    }
  }

  hideAutocomplete();
}

function handleComposerKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  } else if (e.key === 'Escape') {
    hideAutocomplete();
  }
}

function showAutocomplete(items) {
  const pop = document.getElementById('autocompletePopover');
  if (!pop) return;
  if (!items || items.length === 0) {
    hideAutocomplete();
    return;
  }
  pop.innerHTML = items.map(item => `
    <button type="button" class="ac-item" onclick="applyAutocomplete('${escapeHtml(item.trigger)}', '${escapeHtml(item.insert)}')">
      <span>${escapeHtml(item.label)}</span>
      <span class="ac-type">${escapeHtml(item.type)}</span>
    </button>
  `).join('');
  pop.hidden = false;
}

function hideAutocomplete() {
  const pop = document.getElementById('autocompletePopover');
  if (pop) pop.hidden = true;
}

function applyAutocomplete(trigger, insertion) {
  const input = document.getElementById('chatInput');
  if (!input) return;
  const idx = input.value.lastIndexOf(trigger);
  if (idx >= 0) {
    input.value = input.value.slice(0, idx) + insertion + input.value.slice(idx + trigger.length);
  } else {
    input.value += insertion;
  }
  hideAutocomplete();
  input.focus();
}

function insertPromptText(text) {
  const input = document.getElementById('chatInput');
  if (!input) return;
  input.value = text;
  input.focus();
}

function handleFileSelection(fileList) {
  Array.from(fileList || []).forEach(f => {
    appState.attachments.push({ name: f.name, size: f.size, type: f.type || 'file' });
  });
  renderAttachmentsStrip();
}

function renderAttachmentsStrip() {
  const strip = document.getElementById('attachedFilesStrip');
  if (!strip) return;
  if (appState.attachments.length === 0) {
    strip.hidden = true;
    strip.innerHTML = '';
    return;
  }
  strip.hidden = false;
  strip.innerHTML = appState.attachments.map((a, idx) => `
    <span class="attach-chip">${escapeHtml(a.name)} <button type="button" style="background:none;border:none;color:inherit;" onclick="removeAttachment(${idx})">✕</button></span>
  `).join('');
}

function removeAttachment(idx) {
  appState.attachments.splice(idx, 1);
  renderAttachmentsStrip();
}

function setupDragAndDrop() {
  const zone = document.getElementById('composerDropZone');
  if (!zone) return;
  zone.addEventListener('dragover', e => e.preventDefault());
  zone.addEventListener('drop', e => {
    e.preventDefault();
    if (e.dataTransfer?.files?.length) handleFileSelection(e.dataTransfer.files);
  });
}

function selectSidebarTab(tab) {
  document.querySelectorAll('.side-tab').forEach(b => b.classList.toggle('active', b.dataset.side === tab));
  document.getElementById('sidePaneChats').hidden = tab !== 'chats';
  document.getElementById('sidePaneProjects').hidden = tab !== 'projects';
  document.getElementById('sidePaneSchedules').hidden = tab !== 'schedules';
  document.getElementById('sidePaneSkills').hidden = tab !== 'skills';
}

function selectInspectorTab(tab) {
  document.querySelectorAll('.insp-tab').forEach(b => b.classList.toggle('active', b.dataset.insp === tab));
  document.getElementById('inspSubagents').hidden = tab !== 'subagents';
  document.getElementById('inspTasks').hidden = tab !== 'tasks';
  document.getElementById('inspArtifacts').hidden = tab !== 'artifacts';
  document.getElementById('inspFiles').hidden = tab !== 'files';
  document.getElementById('inspTerminal').hidden = tab !== 'terminal';
}

function toggleRightPane() {
  const grid = document.getElementById('panesGrid');
  if (!grid) return;
  if (window.innerWidth <= 1120) {
    grid.classList.toggle('show-right-mobile');
  } else {
    grid.classList.toggle('hide-right');
  }
}

function toggleLeftSidebar() {
  document.getElementById('leftSidebar')?.classList.toggle('open-mobile');
}

async function addWorkspaceProject() {
  const name = document.getElementById('newProjName')?.value.trim();
  const root_path = document.getElementById('newProjPath')?.value.trim();
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, root_path }),
  });
  const data = await res.json();
  if (data.status === 'success') {
    document.getElementById('newProjName').value = '';
    document.getElementById('newProjPath').value = '';
    appState.activeProjectId = data.project.id;
    await loadWorkbenchState(true);
  } else {
    alert(data.message || 'Invalid path');
  }
}

async function createScheduledTask() {
  const name = document.getElementById('newSchedName')?.value.trim();
  const cron_expr = document.getElementById('newSchedCron')?.value.trim();
  const prompt = document.getElementById('newSchedPrompt')?.value.trim();
  await fetch('/api/scheduled-tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create', name, cron_expr, prompt, project_id: appState.activeProjectId }),
  });
  document.getElementById('newSchedName').value = '';
  document.getElementById('newSchedPrompt').value = '';
  await loadWorkbenchState(true);
}

async function toggleScheduledTask(id) {
  await fetch('/api/scheduled-tasks', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'toggle', id }),
  });
  await loadWorkbenchState(true);
}

async function runScheduledTaskNow(id) {
  await fetch('/api/scheduled-tasks', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'run_now', id }),
  });
  await loadWorkbenchState(true);
}

async function deleteScheduledTask(id) {
  await fetch('/api/scheduled-tasks', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }),
  });
  await loadWorkbenchState(true);
}

async function loadTerminalLogs() {
  const res = await fetch(`/api/terminal?project_id=${encodeURIComponent(appState.activeProjectId)}`);
  const data = await res.json();
  const out = document.getElementById('terminalOutput');
  if (!out || data.status !== 'success') return;
  out.textContent = (data.logs || []).map(l =>
    `$ ${l.command} [${l.policy_decision}, exit ${l.exit_code}]\n${l.stdout || ''}${l.stderr || ''}`
  ).join('\n---\n') || 'Sandboxed workspace terminal ready. Run ls, git status, or python3 checks.';
  out.scrollTop = out.scrollHeight;
}

async function runTerminalCommand(approved = false, pendingCmd = null) {
  const input = document.getElementById('terminalCmdInput');
  const command = pendingCmd !== null ? pendingCmd : (input?.value || '').trim();
  if (!command) return;
  if (input && pendingCmd === null) input.value = '';
  const res = await fetch('/api/terminal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: appState.activeProjectId, command, approved }),
  });
  const data = await res.json();
  if (data.status === 'approval_required' && !approved) {
    if (window.confirm(`Execution policy is "request-review". Run "${command}" in workspace?`)) {
      return runTerminalCommand(true, command);
    }
    return;
  }
  await loadTerminalLogs();
}

function openSettingsModal() { document.getElementById('settingsModal').hidden = false; }
function closeSettingsModal() { document.getElementById('settingsModal').hidden = true; }

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('settingsModal');
    if (modal && !modal.hidden) closeSettingsModal();
  }
});

async function saveSettings() {
  const payload = {
    gemini_api_key: document.getElementById('setGeminiKey')?.value.trim() || '',
    tool_execution_policy: document.getElementById('setPolicy')?.value,
    theme: document.getElementById('setTheme')?.value,
    non_workspace_access: document.getElementById('setNonWorkspace')?.value,
    internet_access: document.getElementById('setInternet')?.value,
  };
  await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  document.getElementById('setGeminiKey').value = '';
  closeSettingsModal();
  await loadWorkbenchState(true);
}

function renderSimpleMarkdown(md) {
  let html = escapeHtml(md);
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`);
  html = html.replace(/\n\n/g, '</p><p>');
  return `<p>${html}</p>`;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
