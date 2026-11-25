# Antigravity Studio (Antigravity 2.0 Web Workbench)

A standalone, local-first web workbench inspired by **Antigravity 2.0**, featuring:
- **Left Sidebar**: Projects/workspaces, Conversations, Scheduled Tasks, Skills & Customizations discovery, and Global/Project Settings.
- **Center Chat Canvas**: Streaming-style reasoning steps, inline tool-call cards, `/` slash-command palette, `@` file/skill/conversation mentions, and file attachments.
- **Right Auxiliary Inspector Pane**: `Subagents`, `Tasks`, `Artifacts`, `Files Changed` (`git status`/`diff`), and `Terminals`.
- **Dual-Mode Agent Runtime**:
  - **Local Workspace Agent (default)**: Works immediately with zero external API keys by executing real workspace inspection tools (`list_files`, `read_file`, `search_code`, `git_status`, `write_artifact`), spawning subagent records, and updating inspector tabs.
  - **Live Gemini Mode**: Set `GEMINI_API_KEY` in the Settings modal (or environment) to run Gemini with real workspace function-calling tools.

## Quickstart

```bash
cd antigravity-studio
python3 server.py
```

Then open **http://localhost:8100** in your browser.
