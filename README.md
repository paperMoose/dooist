# Dooist

Task management for Claude Code. One task list across all your projects.

## The Problem

You use Claude Code across multiple repos. Personal projects, work stuff, side hustles. Each instance has no idea what you need to do outside that specific project.

Tracking tasks in Markdown files? Switching to Todoist? Context switching kills flow.

## The Solution

Dooist is an MCP server with a single SQLite database. Every Claude Code instance sees your full task list.

```
"What's due today?" works everywhere.
```

## Install

```bash
claude mcp add dooist -- npx dooist
```

Restart Claude Code. Done.

## Usage

Just talk:

```
"remind me to fix the auth bug tomorrow"
"add task to review PR with priority 1"
"what's on my plate this week"
"show me overdue tasks"
"complete the PR review"
```

## Features

- **Natural language dates**: "tomorrow", "next monday", "in 3 days"
- **Priorities**: P1 (urgent) through P4 (low)
- **Labels**: @work, @personal, @urgent
- **Projects**: Group related tasks
- **Persistent**: SQLite at `~/.dooist/`
- **Self-hosted**: Your data stays on your machine

## Tools

| Tool | What it does |
|------|--------------|
| `create_task` | Add task with due date, priority, labels |
| `list_tasks` | Filter by project, label, status |
| `complete_task` | Mark done |
| `update_task` | Change anything |
| `delete_task` | Remove |
| `today` | Due today + overdue |
| `upcoming` | Next N days |
| `scan_todos` | Find TODO/FIXME/HACK comments in codebase |
| `list_projects` | All projects |
| `create_project` | New project |
| `list_labels` | All labels |
| `create_label` | New label |

## Scan TODOs

Find all TODO comments in your codebase:

```
"scan this repo for TODOs"
"find all FIXMEs in the codebase"
"scan for TODOs and create tasks from them"
```

Creates tasks with file:line references so you can jump right to them.

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
