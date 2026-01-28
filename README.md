# Dooist

Task management MCP server for Claude Code. Like Todoist, but you actually do it.

## Quick Install

```bash
# Add to Claude Code globally
claude mcp add dooist -- npx dooist
```

Restart Claude Code, then try: "What are my tasks?"

## Features

- **Natural Language**: "remind me to call mom tomorrow"
- **Priorities**: P1 (urgent) through P4 (low)
- **Labels**: Organize with @work, @shopping, etc.
- **Projects**: Group tasks (Inbox is default)
- **Persistent**: SQLite database at `~/.dooist/`

## Usage

Just talk naturally:

```
"add task to review PR due friday with priority 2"
"what's due today"
"list my tasks"
"complete the PR task"
"create project Work"
"what's overdue"
```

## Available Tools

| Tool | Description |
|------|-------------|
| `create_task` | Create task with project, priority, due date, labels |
| `list_tasks` | List tasks with filters |
| `complete_task` | Mark done |
| `reopen_task` | Unmark done |
| `update_task` | Modify task |
| `delete_task` | Remove task |
| `today` | Tasks due today + overdue |
| `upcoming` | Next N days |
| `list_projects` | All projects |
| `create_project` | New project |
| `list_labels` | All labels |
| `create_label` | New label |

## Due Date Examples

- `today`, `tomorrow`
- `next monday`, `this friday`
- `in 3 days`, `in 2 weeks`
- `March 15`, `2024-03-15`

## Configuration

Set `DOOIST_DB_PATH` to customize database location:

```bash
claude mcp add dooist -e DOOIST_DB_PATH=/custom/path/dooist.db -- npx dooist
```

## Development

```bash
git clone https://github.com/ryanbrandt/dooist
cd dooist
npm install
npm run build
npm test
```

## License

MIT
