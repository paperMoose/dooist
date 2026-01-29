# Dooist

[![npm version](https://img.shields.io/npm/v/dooist)](https://www.npmjs.com/package/dooist)
[![npm downloads](https://img.shields.io/npm/dm/dooist)](https://www.npmjs.com/package/dooist)
[![CI](https://github.com/paperMoose/dooist/actions/workflows/ci.yml/badge.svg)](https://github.com/paperMoose/dooist/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

The agent todo app. Task management built for AI agents, not people.

## Why

Every Claude Code session starts blank. No memory. No state. Your agent doesn't know what it was working on yesterday.

So you re-explain. Re-paste the spec. Re-describe the goal. Every single time.

That's not a workflow. That's babysitting.

## The Fix

Dooist is an MCP server where every task carries rich context — intent, spec plan, desired outputs, current status. Any Claude session picks up any task and knows exactly what to do.

No `claude --resume`. No re-explaining. Context lives in the task, not the session.

```
create_task "Deploy auth service" with full context → spec, plan, status
```

Next session:

```
get_task → agent picks up exactly where it left off
```

## Agent-Native Design

Most developer tools with "AI support" are human tools with an API bolted on. That's backwards.

Agents don't need pretty UIs. They need structured data, rich context fields, and tool interfaces that match how they actually work — stateless, parallel, fast.

- `list_tasks` shows titles and a `[has context]` flag. Scannable. No noise.
- `get_task` returns the full markdown body — intent, plan, desired outputs.
- `create_task` supports parallel calls. Create 10 tasks in one message.

Information architecture matters for agents too. Don't dump everything at once.

## What This Looks Like

Run headless Claude Code against your inbox. It triages emails into tasks with full context — who sent it, what they need, deadline. Next Claude session picks up those tasks and executes.

Slack messages, meeting transcripts, texts — all of it generates work. An agent parses your inputs, creates tasks with full context, prioritizes them, and starts working the queue.

No human in the loop for task creation. The agent manages its own backlog.

## Install

```bash
claude mcp add dooist -- npx dooist
```

Restart Claude Code. Done.

## Teach Claude Your Workflow (Optional)

Installing the MCP server gives Claude the tools. This step teaches it *when* to use them — proactively suggesting tasks, checking your backlog, adding rich context.

Dooist ships a [`DOOIST_CLAUDE.md`](./DOOIST_CLAUDE.md) file you can import into your [CLAUDE.md](https://docs.anthropic.com/en/docs/claude-code/memory#claudemd-files). One line:

```bash
# Create the rules directory if it doesn't exist
mkdir -p ~/.claude/rules

# Download the instructions
curl -fsSL https://raw.githubusercontent.com/paperMoose/dooist/main/DOOIST_CLAUDE.md \
  -o ~/.claude/rules/dooist.md

# Add the import to your global CLAUDE.md
echo '@~/.claude/rules/dooist.md' >> ~/.claude/CLAUDE.md
```

That's it. Every Claude Code session now knows how to use Dooist — checking tasks on planning conversations, suggesting task creation when you mention future work, and including rich context automatically.

**What this changes:**
- "We should fix that later" → Claude asks "Want me to track that in Dooist?"
- "What should I work on?" → Claude checks your task list
- Bugs found during work → Claude suggests creating a task
- Session ends mid-task → Claude updates context so the next session picks up

**To remove:** Delete the `@~/.claude/rules/dooist.md` line from your CLAUDE.md.

## Usage

Just talk:

```
"remind me to fix the auth bug tomorrow"
"what's on my plate this week"
"show me the full context for that deploy task"
"scan this repo for TODOs and create tasks from them"
```

## Tools

| Tool | What it does |
|------|--------------|
| `create_task` | Add task with context, due date, priority, labels, parentId |
| `get_task` | Full task details including rich context body |
| `list_tasks` | Filter by project, label, status, parentId — scannable summaries |
| `complete_task` | Mark done |
| `update_task` | Change anything including context and parent |
| `delete_task` | Remove (cascades to subtasks) |
| `add_task_update` | Append timestamped status update to a task |
| `today` | Due today + overdue |
| `upcoming` | Next N days |
| `scan_todos` | Find TODO/FIXME/HACK comments in codebase |
| `list_projects` | All projects |
| `create_project` | New project |
| `list_labels` | All labels |
| `create_label` | New label |

## Features

- **Rich task context**: Markdown body with intent, plan, outputs, status
- **Subtasks**: Nest tasks with `parentId`, cascade delete, filter by parent
- **Task updates**: Timestamped activity log per task
- **Natural language dates**: "tomorrow", "next monday", "in 3 days"
- **Priorities**: P1 (urgent) through P4 (low)
- **Labels**: @work, @personal, @urgent
- **Projects**: Group related tasks
- **Truncated IDs**: Use first 8 chars of any task ID
- **Persistent**: SQLite at `~/.dooist/`
- **Self-hosted**: Your data stays on your machine

## Custom Database Location

```bash
claude mcp add dooist -e DOOIST_DB_PATH=/your/path/dooist.db -- npx dooist
```

## Development

```bash
git clone https://github.com/paperMoose/dooist
cd dooist
npm install
npm run build
npm test
```

## License

MIT
